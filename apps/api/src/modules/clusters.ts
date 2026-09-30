import type { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { pool, withTransaction } from '../database/client.js';
import { allow } from '../types.js';

export async function clusterRoutes(app: FastifyInstance) {
  app.get('/clusters', { preHandler: allow('SUPERADMIN') }, async () => {
    const { rows } = await pool.query(`SELECT u.id AS "adminId",u.full_name AS admin,u.email,u.active,
      COALESCE(json_agg(json_build_object('id',o.id,'name',o.name,'address',o.address,'phone',o.phone)) FILTER(WHERE o.id IS NOT NULL),'[]') AS kitchens
      FROM users u LEFT JOIN admin_kitchens ak ON ak.admin_user_id=u.id LEFT JOIN organizations o ON o.id=ak.kitchen_id
      WHERE u.role='ADMIN' GROUP BY u.id ORDER BY u.full_name`);
    return rows;
  });

  app.get('/kitchens', { preHandler: allow('SUPERADMIN') }, async () => {
    const { rows } = await pool.query(`SELECT o.id,o.name,o.phone,o.address,o.gmaps_url AS "gmapsUrl",o.active,u.id AS "managerId",u.full_name AS manager
      FROM organizations o LEFT JOIN admin_kitchens ak ON ak.kitchen_id=o.id LEFT JOIN users u ON u.id=ak.admin_user_id
      WHERE o.type='KITCHEN' ORDER BY o.name`);
    return rows;
  });

  app.get('/my-kitchens', { preHandler: allow('ADMIN') }, async request => {
    const { rows } = await pool.query('SELECT o.id,o.name,o.phone,o.address,o.gmaps_url AS "gmapsUrl" FROM admin_kitchens ak JOIN organizations o ON o.id=ak.kitchen_id WHERE ak.admin_user_id=$1 AND o.active ORDER BY o.name', [request.user.id]);
    return rows;
  });

  app.post('/partners',{preHandler:allow('ADMIN')},async(request)=>{
    const input=z.object({name:z.string().trim().min(2).max(120),phone:z.string().trim().min(6).max(30),address:z.string().trim().min(5).max(300),gmapsUrl:z.string().trim().url()}).parse(request.body);
    const base=input.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'.').replace(/^\.|\.$/g,'')||'dapur';
    let email=`${base}@borneo.local`;const found=await pool.query('SELECT 1 FROM users WHERE email=$1',[email]);if(found.rowCount)email=`${base}.${Math.floor(1000+Math.random()*9000)}@borneo.local`;
    const temporaryPassword='Demo123!';const passwordHash=await bcrypt.hash(temporaryPassword,12);
    return withTransaction(async client=>{
      const kitchen=(await client.query(`INSERT INTO organizations(type,name,phone,address,gmaps_url) VALUES('KITCHEN',$1,$2,$3,$4) RETURNING id`,[input.name,input.phone,input.address,input.gmapsUrl])).rows[0];
      const user=(await client.query(`INSERT INTO users(organization_id,full_name,email,password_hash,role) VALUES($1,$2,$3,$4,'BUYER') RETURNING id`,[kitchen.id,input.name,email,passwordHash])).rows[0];
      await client.query('INSERT INTO admin_kitchens(admin_user_id,kitchen_id) VALUES($1,$2)',[request.user.id,kitchen.id]);
      await client.query(`INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,changes) VALUES($1,'CREATE','PARTNER',$2,$3)`,[request.user.id,user.id,JSON.stringify({kitchenId:kitchen.id,email})]);
      return{success:true,email,temporaryPassword,kitchenId:kitchen.id,userId:user.id};
    });
  });

  app.put('/clusters/:adminId/kitchens', { preHandler: allow('SUPERADMIN') }, async request => {
    const params = z.object({ adminId:z.string().uuid() }).parse(request.params);
    const input = z.object({ kitchenIds:z.array(z.string().uuid()) }).parse(request.body);
    await withTransaction(async client=>{
      const admin=await client.query(`SELECT 1 FROM users WHERE id=$1 AND role='ADMIN' AND active`,[params.adminId]);
      if(!admin.rowCount)throw Object.assign(new Error('Admin tidak ditemukan atau tidak aktif.'),{statusCode:404});
      if(input.kitchenIds.length){const kitchens=await client.query(`SELECT count(*)::int AS count FROM organizations WHERE id=ANY($1::uuid[]) AND type='KITCHEN' AND active`,[input.kitchenIds]);if(kitchens.rows[0].count!==new Set(input.kitchenIds).size)throw Object.assign(new Error('Salah satu dapur tidak ditemukan atau tidak aktif.'),{statusCode:404});}
      await client.query('DELETE FROM admin_kitchens WHERE admin_user_id=$1 OR kitchen_id=ANY($2::uuid[])',[params.adminId,input.kitchenIds]);
      for(const kitchenId of new Set(input.kitchenIds))await client.query('INSERT INTO admin_kitchens(admin_user_id,kitchen_id) VALUES($1,$2)',[params.adminId,kitchenId]);
      await client.query(`INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,changes) VALUES($1,'ASSIGN','ADMIN_CLUSTER',$2,$3)`,[request.user.id,params.adminId,JSON.stringify({kitchenIds:input.kitchenIds})]);
    });
    return { success:true };
  });
}
