import bcrypt from 'bcryptjs';
import {maintenancePool} from './maintenance.js';

const email=process.env.BOOTSTRAP_EMAIL?.trim().toLowerCase();
const password=process.env.BOOTSTRAP_PASSWORD;
if(!email||!email.includes('@')||email.length>254||!password||password.length<12||Buffer.byteLength(password)>72||password==='Demo123!')throw new Error('Provide BOOTSTRAP_EMAIL and a unique BOOTSTRAP_PASSWORD (12–72 bytes).');
const pool=maintenancePool();const client=await pool.connect();
try{
  await client.query('BEGIN');
  await client.query("SELECT pg_advisory_xact_lock(hashtext('borneo-bootstrap'))");
  if((await client.query('SELECT 1 FROM users LIMIT 1')).rowCount)throw new Error('Bootstrap requires an empty users table; existing accounts were not changed.');
  let organization=(await client.query("SELECT id FROM organizations WHERE type='COOPERATIVE' ORDER BY created_at LIMIT 1")).rows[0];
  organization??=(await client.query("INSERT INTO organizations(type,name,address) VALUES('COOPERATIVE','Koperasi Borneo Mandiri','Desa Lumbang, Sambas, Kalimantan Barat') RETURNING id")).rows[0];
  const hash=await bcrypt.hash(password,12);
  const user=(await client.query("INSERT INTO users(organization_id,full_name,email,password_hash,role) VALUES($1,'Superadmin',$2,$3,'SUPERADMIN') RETURNING id",[organization.id,email,hash])).rows[0];
  await client.query("INSERT INTO audit_logs(actor_id,action,entity_type,entity_id) VALUES($1,'CREATE','USER',$1)",[user.id]);
  await client.query('COMMIT');console.log('Initial superadmin created. Credentials were not logged.');
}catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();await pool.end();}
