import {access,unlink,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {randomBytes} from 'node:crypto';
import {apiDirectory,maintenancePool,maintenanceUrl} from './maintenance.js';

// Run once with reviewed maintenance credentials and temporary CREATEROLE.
// This provisions access only; it NEVER resets operational data.
const destination=join(apiDirectory,'.env.cleanup');
const url=new URL(maintenanceUrl());
if(!['postgres:','postgresql:'].includes(url.protocol)||!['127.0.0.1','localhost','[::1]'].includes(url.hostname))throw new Error('Cleanup provisioning requires local PostgreSQL.');
try{await access(destination);throw new Error('.env.cleanup already exists; refusing to overwrite credentials.');}
catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
const pool=maintenancePool();const client=await pool.connect();let written=false;
try{
  await client.query('BEGIN');
  if((await client.query("SELECT 1 FROM pg_roles WHERE rolname='borneo_cleanup'")).rowCount)throw new Error('Cleanup role already exists; refusing to change its password.');
  const password=randomBytes(36).toString('base64url');
  await client.query(`CREATE ROLE borneo_cleanup LOGIN PASSWORD '${password}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 3`);
  const database=(await client.query('SELECT current_database() AS name')).rows[0].name as string;
  const quoted='"'+database.replaceAll('"','""')+'"';
  await client.query(`GRANT CONNECT ON DATABASE ${quoted} TO borneo_cleanup`);
  await client.query('GRANT USAGE ON SCHEMA public TO borneo_cleanup');
  // pg_dump must read every current table; no default privileges or schema ownership.
  await client.query('GRANT SELECT ON ALL TABLES IN SCHEMA public TO borneo_cleanup');
  await client.query('GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO borneo_cleanup');
  await client.query('GRANT DELETE ON special_requests,inventory_movements,order_status_history,order_item_allocations,order_items,orders,inventory_batches,admin_products,vendors,admin_kitchens,audit_logs,product_templates,users,organizations TO borneo_cleanup');
  await client.query('GRANT INSERT ON audit_logs TO borneo_cleanup');
  await client.query("ALTER ROLE borneo_cleanup SET statement_timeout='150s'");
  await client.query("ALTER ROLE borneo_cleanup SET lock_timeout='10s'");
  await client.query("ALTER ROLE borneo_cleanup SET idle_in_transaction_session_timeout='180s'");
  url.username='borneo_cleanup';url.password=password;
  await writeFile(destination,`# Generated cleanup-only access. Never commit or print.\nALLOW_DATA_RESET=true\nDATA_RESET_DATABASE_URL=${url.toString()}\nDATA_RESET_BACKUP_DIR=/var/lib/borneo-marketplace/cleanup-backups\nPG_DUMP_PATH=/usr/bin/pg_dump\n`,{flag:'wx',mode:0o600});
  written=true;
  await client.query('COMMIT');
  console.log('Restricted cleanup role created; .env.cleanup saved. No operational data was deleted.');
}catch(error){await client.query('ROLLBACK');if(written)await unlink(destination);throw error;}
finally{client.release();await pool.end();}
