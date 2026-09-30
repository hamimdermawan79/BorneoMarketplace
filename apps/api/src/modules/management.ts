import type { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { pool, withTransaction } from '../database/client.js';
import { allow } from '../types.js';

const baseUser=z.object({fullName:z.string().trim().min(2).max(120),email:z.string().trim().email().transform(value=>value.toLowerCase()),password:z.string().min(8).max(100)});
const createUserSchema=z.discriminatedUnion('role',[
  baseUser.extend({role:z.literal('ADMIN')}),
  baseUser.extend({role:z.literal('BUYER'),kitchen:z.object({name:z.string().trim().min(2).max(120),phone:z.string().trim().min(6).max(30),address:z.string().trim().min(5).max(300),gmapsUrl:z.string().trim().url(),adminId:z.string().uuid().nullable().optional()})})
]);

export async function managementRoutes(app:FastifyInstance){
  app.get('/management/overview',{preHandler:allow('SUPERADMIN')},async()=>{
    const summary=(await pool.query(`SELECT
      (SELECT count(*)::int FROM users WHERE role='ADMIN' AND active) AS "activeAdmins",
      (SELECT count(*)::int FROM organizations WHERE type='KITCHEN' AND active) AS "activeKitchens",
      (SELECT count(*)::int FROM orders WHERE status NOT IN('COMPLETED','CANCELLED')) AS "activeOrders",
      (SELECT count(*)::int FROM orders WHERE status='COMPLETED' AND updated_at>=date_trunc('month',now())) AS "completedThisMonth",
      (SELECT COALESCE(sum(COALESCE(final_total,estimated_total)),0) FROM orders WHERE status='COMPLETED' AND updated_at>=date_trunc('month',now())) AS "salesThisMonth",
      (SELECT count(*)::int FROM organizations k WHERE k.type='KITCHEN' AND k.active AND NOT EXISTS(SELECT 1 FROM admin_kitchens ak WHERE ak.kitchen_id=k.id)) AS "unassignedKitchens"`)).rows[0];
    const statuses=(await pool.query(`SELECT status,count(*)::int AS count FROM orders GROUP BY status ORDER BY status`)).rows;
    const admins=(await pool.query(`SELECT u.id,u.full_name AS name,u.email,u.active,
      (SELECT count(*)::int FROM admin_kitchens ak WHERE ak.admin_user_id=u.id) AS kitchens,
      (SELECT count(*)::int FROM admin_products ap WHERE ap.admin_user_id=u.id AND ap.active) AS products,
      (SELECT count(*)::int FROM orders o WHERE o.admin_user_id=u.id AND o.status NOT IN('COMPLETED','CANCELLED')) AS "activeOrders",
      (SELECT COALESCE(sum(COALESCE(o.final_total,o.estimated_total)),0) FROM orders o WHERE o.admin_user_id=u.id AND o.status='COMPLETED' AND o.updated_at>=date_trunc('month',now())) AS "salesThisMonth"
      FROM users u WHERE u.role='ADMIN' ORDER BY u.full_name`)).rows;
    return {summary,statuses,admins};
  });

  app.get('/users',{preHandler:allow('SUPERADMIN')},async()=>{
    const {rows}=await pool.query(`SELECT u.id,u.full_name AS name,u.email,u.role,u.active,u.created_at AS "createdAt",o.id AS "organizationId",o.name AS organization,o.phone,o.address,o.gmaps_url AS "gmapsUrl",
      manager.id AS "managerId",manager.full_name AS manager
      FROM users u LEFT JOIN organizations o ON o.id=u.organization_id
      LEFT JOIN admin_kitchens ak ON ak.kitchen_id=o.id AND u.role='BUYER'
      LEFT JOIN users manager ON manager.id=ak.admin_user_id
      ORDER BY CASE u.role WHEN 'SUPERADMIN' THEN 0 WHEN 'ADMIN' THEN 1 ELSE 2 END,u.full_name`);
    return rows;
  });

  app.get('/organizations',{preHandler:allow('SUPERADMIN')},async()=>{
    const {rows}=await pool.query(`SELECT o.id,o.type,o.name,o.phone,o.address,o.gmaps_url AS "gmapsUrl",o.active,
      count(DISTINCT u.id)::int AS "userCount",manager.id AS "managerId",manager.full_name AS manager
      FROM organizations o LEFT JOIN users u ON u.organization_id=o.id
      LEFT JOIN admin_kitchens ak ON ak.kitchen_id=o.id LEFT JOIN users manager ON manager.id=ak.admin_user_id
      GROUP BY o.id,manager.id,manager.full_name
      ORDER BY CASE o.type WHEN 'COOPERATIVE' THEN 0 ELSE 1 END,o.name`);
    return rows;
  });

  app.get('/audit-logs',{preHandler:allow('SUPERADMIN')},async()=>{
    const {rows}=await pool.query(`SELECT l.id,l.action,l.entity_type AS "entityType",l.entity_id AS "entityId",l.changes,l.created_at AS "createdAt",
      actor.full_name AS actor,actor.email AS "actorEmail"
      FROM audit_logs l LEFT JOIN users actor ON actor.id=l.actor_id
      ORDER BY l.created_at DESC LIMIT 100`);
    return rows;
  });

  app.post('/users',{preHandler:allow('SUPERADMIN')},async(request,reply)=>{
    const input=createUserSchema.parse(request.body);const passwordHash=await bcrypt.hash(input.password,12);
    try{return await withTransaction(async client=>{
      const existing=await client.query('SELECT 1 FROM users WHERE email=$1',[input.email]);
      if(existing.rowCount)throw Object.assign(new Error('Email sudah digunakan.'),{statusCode:409});
      let organizationId:string;
      if(input.role==='ADMIN'){
        const cooperative=await client.query(`SELECT id FROM organizations WHERE type='COOPERATIVE' AND active ORDER BY created_at LIMIT 1`);
        if(!cooperative.rowCount)throw Object.assign(new Error('Organisasi koperasi belum tersedia.'),{statusCode:409});
        organizationId=cooperative.rows[0].id;
      }else{
        const kitchen=(await client.query(`INSERT INTO organizations(type,name,phone,address,gmaps_url) VALUES('KITCHEN',$1,$2,$3,$4) RETURNING id`,[input.kitchen.name,input.kitchen.phone,input.kitchen.address,input.kitchen.gmapsUrl])).rows[0];organizationId=kitchen.id;
        if(input.kitchen.adminId){const admin=await client.query(`SELECT 1 FROM users WHERE id=$1 AND role='ADMIN' AND active`,[input.kitchen.adminId]);if(!admin.rowCount)throw Object.assign(new Error('Admin pengelola tidak ditemukan.'),{statusCode:404});await client.query('INSERT INTO admin_kitchens(admin_user_id,kitchen_id) VALUES($1,$2)',[input.kitchen.adminId,organizationId]);}
      }
      const user=(await client.query(`INSERT INTO users(organization_id,full_name,email,password_hash,role) VALUES($1,$2,$3,$4,$5) RETURNING id,full_name AS name,email,role,active`,[organizationId,input.fullName,input.email,passwordHash,input.role])).rows[0];
      if(input.role==='ADMIN')await client.query(`INSERT INTO admin_products(admin_user_id,template_id,sale_price) SELECT $1,id,0 FROM product_templates WHERE active AND owner_admin_user_id IS NULL ON CONFLICT(admin_user_id,template_id) DO NOTHING`,[user.id]);
      await client.query(`INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,changes) VALUES($1,'CREATE','USER',$2,$3)`,[request.user.id,user.id,JSON.stringify({role:input.role,email:input.email})]);
      return user;
    });}catch(error){const known=error as Error&{statusCode?:number;code?:string};if(known.code==='23505')return reply.code(409).send({message:'Email atau nama dapur sudah digunakan.'});throw error;}
  });

  app.patch('/users/:id',{preHandler:allow('SUPERADMIN')},async(request,reply)=>{
    const params=z.object({id:z.string().uuid()}).parse(request.params);const input=z.object({fullName:z.string().trim().min(2).max(120).optional(),role:z.enum(['SUPERADMIN','ADMIN']).optional(),active:z.boolean().optional()}).refine(value=>Object.keys(value).length>0).parse(request.body);
    if(params.id===request.user.id&&(input.active===false||input.role))return reply.code(409).send({message:'Akun yang sedang digunakan tidak dapat dinonaktifkan atau diubah rolenya.'});
    const current=await pool.query('SELECT role FROM users WHERE id=$1',[params.id]);if(!current.rowCount)return reply.code(404).send({message:'Pengguna tidak ditemukan.'});
    if(current.rows[0].role==='BUYER'&&input.role)return reply.code(409).send({message:'Role buyer terikat dengan identitas dapur dan tidak dapat diubah langsung.'});
    const cooperative=input.role?(await pool.query(`SELECT id FROM organizations WHERE type='COOPERATIVE' AND active ORDER BY created_at LIMIT 1`)).rows[0]?.id:null;
    const {rows}=await pool.query(`UPDATE users SET full_name=COALESCE($1,full_name),role=COALESCE($2,role),active=COALESCE($3,active),organization_id=CASE WHEN $2 IS NOT NULL THEN $4 ELSE organization_id END WHERE id=$5 RETURNING id,full_name AS name,email,role,active`,[input.fullName??null,input.role??null,input.active??null,cooperative,params.id]);
    await pool.query(`INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,changes) VALUES($1,'UPDATE','USER',$2,$3)`,[request.user.id,params.id,JSON.stringify(input)]);
    return rows[0];
  });
}
