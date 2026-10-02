import type {FastifyInstance} from 'fastify';
import bcrypt from 'bcryptjs';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {chmod,mkdir,stat} from 'node:fs/promises';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import pg from 'pg';
import {config} from '../config.js';
import {backupPrivateProductImages} from '../images/backup.js';
import {pool} from '../database/client.js';
import {allow} from '../types.js';
import {passwordInput} from '../security/input-validation.js';
export const confirmation='Ya, Saya Yakin Untuk Hapus Semua Data.';
const tables=['special_requests','inventory_movements','order_status_history','order_item_allocations','order_items','orders','inventory_batches','admin_products','vendors','admin_kitchens','audit_logs'];
export async function resetRoutes(app:FastifyInstance){
  let resetInProgress=false;
  const maintenanceUrl=()=>{
    // Production is supported; explicit maintenance credentials and all reset checks still apply.
    if(process.env.ALLOW_DATA_RESET!=='true'||!process.env.DATA_RESET_DATABASE_URL)return null;
    try{
      const database=new URL(process.env.DATA_RESET_DATABASE_URL);const runtime=new URL(config.DATABASE_URL);
      if(!['postgres:','postgresql:'].includes(database.protocol)||!['localhost','127.0.0.1','[::1]'].includes(database.hostname))return null;
      if(database.hostname!==runtime.hostname||database.pathname!==runtime.pathname||(database.port||'5432')!==(runtime.port||'5432'))return null;
      return database;
    }catch{return null;}
  };
  const enabled=()=>maintenanceUrl()!==null;
  app.get('/management/reset',{preHandler:allow('SUPERADMIN')},async()=>{
    const {rows}=await pool.query(`SELECT (SELECT count(*) FROM orders)::int AS pesanan,(SELECT count(*) FROM special_requests)::int AS permintaan,(SELECT count(*) FROM inventory_batches)::int AS stok,(SELECT count(*) FROM vendors)::int AS vendor,(SELECT count(*) FROM users WHERE role<>'SUPERADMIN')::int AS akun`);
    return {enabled:enabled(),counts:rows[0]};
  });
  app.post('/management/reset',{preHandler:allow('SUPERADMIN'),config:{rateLimit:{max:3,timeWindow:'15 minutes'}}},async(request,reply)=>{
    const db=maintenanceUrl();
    if(!db)return reply.code(403).send({message:'Reset data dinonaktifkan pada server.'});
    const input=z.object({confirmation:z.literal(confirmation),password:passwordInput}).parse(request.body);
    // Validate before acquiring table locks or starting a privileged connection.
    const verifiedUser=(await pool.query("SELECT password_hash FROM users WHERE id=$1 AND role='SUPERADMIN' AND active",[request.user.id])).rows[0];
    if(!verifiedUser||!await bcrypt.compare(input.password,verifiedUser.password_hash))return reply.code(403).send({message:'Password superadmin tidak sesuai.'});
    if(resetInProgress)return reply.code(409).send({message:'Reset data sedang berlangsung.'});
    resetInProgress=true;
    const client=new pg.Client({connectionString:db.toString(),connectionTimeoutMillis:5000,application_name:'borneo-demo-reset'});
    try{
      await client.connect();
      await client.query('BEGIN');
      await client.query("SET LOCAL lock_timeout='10s'");
      await client.query("SET LOCAL statement_timeout='150s'");
      await client.query('SELECT pg_advisory_xact_lock(7182431)');
      await client.query(`LOCK TABLE users,organizations,product_templates,${tables.join(',')} IN SHARE ROW EXCLUSIVE MODE`);
      const user=(await client.query("SELECT password_hash FROM users WHERE id=$1 AND role='SUPERADMIN' AND active",[request.user.id])).rows[0];
      if(!user||user.password_hash!==verifiedUser.password_hash)throw Object.assign(new Error('Sesi tidak berlaku. Silakan masuk kembali.'),{statusCode:401});
      const backupId=`before-reset-${Date.now()}-${randomUUID()}.dump`;
      const directory=resolve(process.cwd(),'backups');await mkdir(directory,{recursive:true,mode:0o700});
      const path=resolve(directory,backupId);
      try{
        await promisify(execFile)(process.env.PG_DUMP_PATH||'pg_dump',['--format=custom','--file',path],{timeout:120000,windowsHide:true,env:{...process.env,PGHOST:db.hostname,PGPORT:db.port||'5432',PGDATABASE:decodeURIComponent(db.pathname.slice(1)),PGUSER:decodeURIComponent(db.username),PGPASSWORD:decodeURIComponent(db.password)}});
        if((await stat(path)).size===0)throw Error('Empty backup');
        await chmod(path,0o600);
        const images=(await client.query("SELECT image_path FROM product_templates WHERE image_path LIKE '/api/product-images/%'")).rows;
        await backupPrivateProductImages(images.map(row=>row.image_path),`${path}.media`);
      }catch{throw Object.assign(new Error('Backup database atau foto produk gagal. Tidak ada data yang dihapus. Periksa pg_dump dan storage gambar.'),{statusCode:503})}
      for(const table of tables)await client.query(`DELETE FROM ${table}`);
      await client.query('DELETE FROM product_templates WHERE owner_admin_user_id IS NOT NULL');
      await client.query("DELETE FROM users WHERE role<>'SUPERADMIN'");
      await client.query("DELETE FROM organizations WHERE type='KITCHEN' AND id NOT IN (SELECT organization_id FROM users WHERE organization_id IS NOT NULL)");
      await client.query("INSERT INTO audit_logs(actor_id,action,entity_type,changes) VALUES($1,'RESET','SYSTEM',$2)",[request.user.id,JSON.stringify({backupId})]);
      await client.query('COMMIT');
      return {success:true,backupId};
    }catch(error){await client.query('ROLLBACK').catch(()=>{});throw error;}
    finally{await client.end().catch(()=>{});resetInProgress=false;}
  });
}
