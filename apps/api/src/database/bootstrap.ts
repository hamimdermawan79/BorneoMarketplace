import bcrypt from 'bcryptjs';
import {maintenancePool} from './maintenance.js';
import {parseBootstrapCredentials} from './bootstrap-input.js';

const {username,email,password}=parseBootstrapCredentials(process.env);
const pool=maintenancePool();const client=await pool.connect();
try{
  await client.query('BEGIN');
  await client.query("SELECT pg_advisory_xact_lock(hashtext('borneo-bootstrap'))");
  if((await client.query('SELECT 1 FROM users LIMIT 1')).rowCount)throw new Error('Bootstrap requires an empty users table; existing accounts were not changed.');
  let organization=(await client.query("SELECT id FROM organizations WHERE type='COOPERATIVE' ORDER BY created_at LIMIT 1")).rows[0];
  organization??=(await client.query("INSERT INTO organizations(type,name,address) VALUES('COOPERATIVE','Koperasi Borneo Mandiri','Desa Lumbang, Sambas, Kalimantan Barat') RETURNING id")).rows[0];
  const hash=await bcrypt.hash(password,12);
  const user=(await client.query("INSERT INTO users(organization_id,full_name,username,email,password_hash,role) VALUES($1,'Superadmin',COALESCE($2,'user-' || replace(gen_random_uuid()::text,'-','')),$3,$4,'SUPERADMIN') RETURNING id",[organization.id,username,email,hash])).rows[0];
  await client.query("INSERT INTO audit_logs(actor_id,action,entity_type,entity_id) VALUES($1,'CREATE','USER',$1)",[user.id]);
  await client.query('COMMIT');console.log('Initial superadmin created. Credentials were not logged.');
}catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();await pool.end();}
