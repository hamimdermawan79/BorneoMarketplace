import {randomBytes} from 'node:crypto';
import {writeFile,access} from 'node:fs/promises';
import {join} from 'node:path';
import {apiDirectory,maintenancePool,maintenanceUrl} from './maintenance.js';

// One-time provisioning. Never rotates an existing role or overwrites credentials.
const role='borneo_runtime';
const destination=join(apiDirectory,'.env.runtime');
const url=new URL(maintenanceUrl());
if(!['127.0.0.1','localhost','[::1]'].includes(url.hostname))throw new Error('Automatic provisioning is limited to local PostgreSQL.');
try{await access(destination);throw new Error('.env.runtime already exists; credentials were not changed.');}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
const pool=maintenancePool();const client=await pool.connect();
const password=randomBytes(36).toString('base64url');
try{
  await client.query('BEGIN');
  if((await client.query('SELECT 1 FROM pg_roles WHERE rolname=$1',[role])).rowCount)throw new Error('Runtime role already exists; refusing to alter it.');
  // Identifier is a fixed literal; password is generated base64url, never user input.
  await client.query(`CREATE ROLE borneo_runtime LOGIN PASSWORD '${password}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 15`);
  const db=(await client.query('SELECT current_database() AS name')).rows[0].name as string;
  const quoted='"'+db.replaceAll('"','""')+'"';
  await client.query(`REVOKE ALL ON DATABASE ${quoted} FROM PUBLIC`);
  await client.query(`GRANT CONNECT ON DATABASE ${quoted} TO borneo_runtime`);
  await client.query('REVOKE CREATE ON SCHEMA public FROM PUBLIC');
  await client.query('GRANT USAGE ON SCHEMA public TO borneo_runtime');
  await client.query('GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO borneo_runtime');
  await client.query('GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO borneo_runtime');
  await client.query('REVOKE ALL ON schema_migrations FROM borneo_runtime');
  await client.query('REVOKE UPDATE,DELETE ON audit_logs,order_status_history,inventory_movements FROM borneo_runtime');
  // Future tables require an explicit privilege review in the migration.
  await client.query("ALTER ROLE borneo_runtime SET statement_timeout='15s'");
  await client.query("ALTER ROLE borneo_runtime SET lock_timeout='5s'");
  await client.query("ALTER ROLE borneo_runtime SET idle_in_transaction_session_timeout='30s'");
  url.username=role;url.password=password;
  await writeFile(destination,`# Generated runtime-only credentials. Never commit.\nDATABASE_URL=${url.toString()}\n`,{flag:'wx',mode:0o600});
  await client.query('COMMIT');
  console.log('Restricted runtime role created; .env.runtime saved. Restart the API. Migration credentials remain in .env.');
}catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();await pool.end();}
