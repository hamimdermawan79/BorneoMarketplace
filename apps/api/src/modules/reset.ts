import type {FastifyInstance} from 'fastify';
import bcrypt from 'bcryptjs';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdir,stat} from 'node:fs/promises';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {config} from '../config.js';
import {pool,withTransaction} from '../database/client.js';
import {allow} from '../types.js';
export const confirmation='Ya, Saya Yakin Untuk Hapus Semua Data.';
const tables=['special_requests','inventory_movements','order_status_history','order_item_allocations','order_items','orders','inventory_batches','admin_products','vendors','admin_kitchens','audit_logs'];
export async function resetRoutes(app:FastifyInstance){
  const enabled=()=>process.env.ALLOW_DATA_RESET==='true';
  app.get('/management/reset',{preHandler:allow('SUPERADMIN')},async()=>{
    const {rows}=await pool.query(`SELECT (SELECT count(*) FROM orders)::int AS pesanan,(SELECT count(*) FROM special_requests)::int AS permintaan,(SELECT count(*) FROM inventory_batches)::int AS stok,(SELECT count(*) FROM vendors)::int AS vendor,(SELECT count(*) FROM users WHERE role<>'SUPERADMIN')::int AS akun`);
    return {enabled:enabled(),counts:rows[0]};
  });
  app.post('/management/reset',{preHandler:allow('SUPERADMIN')},async(request,reply)=>{
    if(!enabled())return reply.code(403).send({message:'Reset data dinonaktifkan pada server.'});
    const input=z.object({confirmation:z.literal(confirmation),password:z.string().min(1)}).parse(request.body);
    return withTransaction(async client=>{
      await client.query("SET LOCAL lock_timeout='10s'");
      await client.query(`LOCK TABLE users,organizations,product_templates,${tables.join(',')} IN SHARE ROW EXCLUSIVE MODE`);
      const user=(await client.query("SELECT password_hash FROM users WHERE id=$1 AND role='SUPERADMIN' AND active",[request.user.id])).rows[0];
      if(!user||!await bcrypt.compare(input.password,user.password_hash))return reply.code(403).send({message:'Password superadmin tidak sesuai.'});
      const backupId=`before-reset-${Date.now()}-${randomUUID()}.dump`;
      const directory=resolve(process.cwd(),'backups');await mkdir(directory,{recursive:true});
      const path=resolve(directory,backupId);const db=new URL(config.DATABASE_URL);
      try{
        await promisify(execFile)(process.env.PG_DUMP_PATH||'pg_dump',['--format=custom','--file',path],{timeout:120000,windowsHide:true,env:{...process.env,PGHOST:db.hostname,PGPORT:db.port||'5432',PGDATABASE:decodeURIComponent(db.pathname.slice(1)),PGUSER:decodeURIComponent(db.username),PGPASSWORD:decodeURIComponent(db.password)}});
        if((await stat(path)).size===0)throw Error('Empty backup');
      }catch{throw Object.assign(new Error('Backup gagal. Tidak ada data yang dihapus. Periksa konfigurasi pg_dump.'),{statusCode:503})}
      for(const table of tables)await client.query(`DELETE FROM ${table}`);
      await client.query('DELETE FROM product_templates WHERE owner_admin_user_id IS NOT NULL');
      await client.query("DELETE FROM users WHERE role<>'SUPERADMIN'");
      await client.query("DELETE FROM organizations WHERE type='KITCHEN' AND id NOT IN (SELECT organization_id FROM users WHERE organization_id IS NOT NULL)");
      await client.query("INSERT INTO audit_logs(actor_id,action,entity_type,changes) VALUES($1,'RESET','SYSTEM',$2)",[request.user.id,JSON.stringify({backupId})]);
      return {success:true,backupId};
    });
  });
}
