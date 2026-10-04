import type {FastifyInstance} from 'fastify';
import bcrypt from 'bcryptjs';
import {z} from 'zod';
import {pool,withTransaction} from '../database/client.js';
import {allow,credentialVersion} from '../types.js';
import {passwordInput} from '../security/input-validation.js';
import {usernameInput,optionalEmailInput,optionalMapsUrlInput} from '../security/user-input.js';

const phoneInput=z.string().trim().min(6).max(30).regex(/^\+?[0-9 ()-]+$/,'Nomor HP tidak valid.');
export const accountUpdateInput=z.object({
  fullName:z.string().trim().min(2).max(120).optional(),username:usernameInput.optional(),email:optionalEmailInput.optional(),active:z.boolean().optional(),
  password:passwordInput.optional(),currentPassword:passwordInput.optional(),
  kitchen:z.object({name:z.string().trim().min(2).max(120).optional(),phone:phoneInput.optional(),address:z.string().trim().min(5).max(300).optional(),gmapsUrl:optionalMapsUrlInput.optional(),adminId:z.string().uuid().nullable().optional()}).strict().optional()
}).strict().refine(v=>Object.keys(v).some(k=>k!=='currentPassword'),'Tidak ada perubahan.');
export const selfUpdateInput=z.object({phone:phoneInput.optional(),currentPassword:passwordInput.optional(),newPassword:passwordInput.optional()}).strict()
  .refine(v=>!!v.phone||!!v.newPassword,'Tidak ada perubahan.').refine(v=>!v.newPassword||!!v.currentPassword,'Password saat ini wajib diisi.');

const accountSelect=`SELECT u.id,u.full_name AS name,u.username,u.email,u.role,u.active,o.id AS "organizationId",o.name AS organization,o.phone,o.address,o.gmaps_url AS "gmapsUrl",ak.admin_user_id AS "managerId" FROM users u LEFT JOIN organizations o ON o.id=u.organization_id LEFT JOIN admin_kitchens ak ON ak.kitchen_id=o.id AND u.role='BUYER'`;
const fail=(message:string,statusCode=400)=>Object.assign(new Error(message),{statusCode});

export async function accountRoutes(app:FastifyInstance){
  app.get('/accounts',{preHandler:allow('SUPERADMIN','ADMIN')},async request=>{
    return (await pool.query(`${accountSelect} WHERE u.deleted_at IS NULL AND ($1::boolean OR (u.role='BUYER' AND ak.admin_user_id=$2)) ORDER BY u.full_name`,[request.user.role==='SUPERADMIN',request.user.id])).rows;
  });
  app.patch('/accounts/:id',{preHandler:allow('SUPERADMIN','ADMIN'),bodyLimit:8192,config:{rateLimit:{max:30,timeWindow:'15 minutes'}}},async(request,reply)=>{
    const {id}=z.object({id:z.string().uuid()}).parse(request.params);
    const input=accountUpdateInput.parse(request.body);
    try{return await withTransaction(async client=>{
      await client.query('SELECT pg_advisory_xact_lock(7182431)');
      const actor=(await client.query('SELECT role,active,password_hash FROM users WHERE id=$1',[request.user.id])).rows[0];
      const claims=await request.jwtVerify<{credentialVersion:string}>();
      if(!actor?.active||actor.role!==request.user.role||credentialVersion(actor.password_hash)!==claims.credentialVersion)throw fail('Sesi tidak berlaku.',401);
      const target=(await client.query('SELECT id,role,active,organization_id FROM users WHERE id=$1 AND deleted_at IS NULL FOR UPDATE',[id])).rows[0];
      if(!target)throw fail('Akun tidak ditemukan.',404);
      if(actor.role==='ADMIN'){
        if(target.role!=='BUYER'||!target.organization_id)throw fail('Akun tidak ditemukan.',404);
        const assigned=await client.query('SELECT 1 FROM admin_kitchens WHERE admin_user_id=$1 AND kitchen_id=$2',[request.user.id,target.organization_id]);
        if(!assigned.rowCount)throw fail('Akun tidak ditemukan.',404);
        if(input.kitchen&&Object.hasOwn(input.kitchen,'adminId'))throw fail('Admin pengelola hanya dapat diatur superadmin.',403);
      }
      if(input.kitchen&&target.role!=='BUYER')throw fail('Informasi dapur hanya berlaku untuk akun buyer.');
      if(id===request.user.id&&input.active===false)throw fail('Akun yang sedang digunakan tidak dapat dinonaktifkan.',409);
      if(target.role==='SUPERADMIN'&&target.active&&input.active===false){
        const remaining=(await client.query("SELECT count(*)::int AS n FROM users WHERE role='SUPERADMIN' AND active AND id<>$1",[id])).rows[0];
        if(!remaining.n)throw fail('Minimal satu superadmin aktif harus dipertahankan.',409);
      }
      if(input.password&&actor.role!=='SUPERADMIN'){
        if(!input.currentPassword)throw fail('Password pengelola saat ini wajib diisi.');
        if(!await bcrypt.compare(input.currentPassword,actor.password_hash))throw fail('Password pengelola tidak sesuai.',403);
      }
      const hash=input.password?await bcrypt.hash(input.password,12):null;
      await client.query(`UPDATE users SET full_name=COALESCE($1,full_name),username=COALESCE($2,username),email=CASE WHEN $3 THEN $4 ELSE email END,active=COALESCE($5,active),password_hash=COALESCE($6,password_hash) WHERE id=$7`,[input.fullName??null,input.username??null,Object.hasOwn(input,'email'),input.email??null,input.active??null,hash,id]);
      if(input.kitchen){
        const k=input.kitchen;
        await client.query(`UPDATE organizations SET name=COALESCE($1,name),phone=COALESCE($2,phone),address=COALESCE($3,address),gmaps_url=CASE WHEN $4 THEN $5 ELSE gmaps_url END WHERE id=$6 AND type='KITCHEN'`,[k.name??null,k.phone??null,k.address??null,Object.hasOwn(k,'gmapsUrl'),k.gmapsUrl??null,target.organization_id]);
        if(Object.hasOwn(k,'adminId')){
          if(k.adminId){const admin=await client.query("SELECT 1 FROM users WHERE id=$1 AND role='ADMIN' AND active",[k.adminId]);if(!admin.rowCount)throw fail('Admin pengelola tidak ditemukan.',404);}
          await client.query('DELETE FROM admin_kitchens WHERE kitchen_id=$1',[target.organization_id]);
          if(k.adminId)await client.query('INSERT INTO admin_kitchens(admin_user_id,kitchen_id) VALUES($1,$2)',[k.adminId,target.organization_id]);
        }
      }
      const {password,currentPassword,...changes}=input;
      await client.query("INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,changes) VALUES($1,'UPDATE','USER',$2,$3)",[request.user.id,id,JSON.stringify({...changes,...(password?{passwordChanged:true}:{})})]);
      return (await client.query(`${accountSelect} WHERE u.id=$1`,[id])).rows[0];
    });}catch(error){if((error as {code?:string}).code==='23505')return reply.code(409).send({message:'Username, email, atau nama dapur sudah digunakan.'});throw error;}
  });
  app.delete('/accounts/:id',{preHandler:allow('SUPERADMIN'),config:{rateLimit:{max:10,timeWindow:'15 minutes'}}},async request=>{
    const {id}=z.object({id:z.string().uuid()}).parse(request.params);
    return withTransaction(async client=>{
      await client.query('SELECT pg_advisory_xact_lock(7182431)');
      const actor=(await client.query('SELECT role,active,password_hash FROM users WHERE id=$1',[request.user.id])).rows[0];
      const claims=await request.jwtVerify<{credentialVersion:string}>();
      if(!actor?.active||actor.role!=='SUPERADMIN'||credentialVersion(actor.password_hash)!==claims.credentialVersion)throw fail('Sesi tidak berlaku.',401);
      if(id===request.user.id)throw fail('Akun yang sedang digunakan tidak dapat dihapus.',409);
      const target=(await client.query('SELECT id,role,active FROM users WHERE id=$1 AND deleted_at IS NULL FOR UPDATE',[id])).rows[0];
      if(!target)throw fail('Akun tidak ditemukan.',404);
      if(target.active)throw fail('Nonaktifkan akun terlebih dahulu sebelum menghapusnya.',409);
      // Preserve foreign keys and historical attribution, but permanently revoke
      // access and remove this account from all account-management lists.
      await client.query('UPDATE users SET deleted_at=now() WHERE id=$1 AND NOT active',[id]);
      await client.query("INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,changes) VALUES($1,'DELETE','USER',$2,$3)",[request.user.id,id,JSON.stringify({deleted:true,historyPreserved:true,role:target.role})]);
      return {success:true};
    });
  });
  app.patch('/auth/me',{preHandler:allow('BUYER'),bodyLimit:4096,config:{rateLimit:{max:10,timeWindow:'15 minutes'}}},async request=>{
    const input=selfUpdateInput.parse(request.body);
    return withTransaction(async client=>{
      await client.query('SELECT pg_advisory_xact_lock(7182431)');
      const user=(await client.query('SELECT role,active,password_hash,organization_id FROM users WHERE id=$1 FOR UPDATE',[request.user.id])).rows[0];
      const claims=await request.jwtVerify<{credentialVersion:string}>();
      if(!user?.active||user.role!=='BUYER'||credentialVersion(user.password_hash)!==claims.credentialVersion)throw fail('Sesi tidak berlaku.',401);
      if(input.newPassword){
        if(!await bcrypt.compare(input.currentPassword!,user.password_hash))throw fail('Password saat ini tidak sesuai.',403);
        if(await bcrypt.compare(input.newPassword,user.password_hash))throw fail('Gunakan password baru yang berbeda.');
        await client.query('UPDATE users SET password_hash=$1 WHERE id=$2',[await bcrypt.hash(input.newPassword,12),request.user.id]);
      }
      if(input.phone)await client.query("UPDATE organizations SET phone=$1 WHERE id=$2 AND type='KITCHEN'",[input.phone,user.organization_id]);
      await client.query("INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,changes) VALUES($1,'UPDATE','USER',$1,$2)",[request.user.id,JSON.stringify({...input.phone?{phone:input.phone}:{},...input.newPassword?{passwordChanged:true}:{}})]);
      return {success:true,phone:input.phone,signInAgain:!!input.newPassword};
    });
  });
}
