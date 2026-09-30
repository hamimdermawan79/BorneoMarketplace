import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { pool,withTransaction } from '../database/client.js';
import { allow,authenticate } from '../types.js';

export async function specialRequestRoutes(app:FastifyInstance){
  app.get('/special-requests',{preHandler:authenticate},async request=>{
    const params:unknown[]=[];let scope='';
    if(request.user.role==='ADMIN'){params.push(request.user.id);scope='WHERE r.admin_user_id=$1';}
    if(request.user.role==='BUYER'){params.push(request.user.organizationId);scope='WHERE r.kitchen_id=$1';}
    const {rows}=await pool.query(`SELECT r.id,r.request_no AS "requestNo",r.name,r.quantity,r.unit,r.note,r.status,r.order_id AS "orderId",r.created_at AS "createdAt",k.name AS kitchen
      FROM special_requests r JOIN organizations k ON k.id=r.kitchen_id ${scope} ORDER BY r.created_at DESC`,params);return rows;
  });

  app.post('/special-requests',{preHandler:allow('BUYER')},async(request,reply)=>{
    const input=z.object({name:z.string().trim().min(2).max(140),quantity:z.coerce.number().positive(),unit:z.string().trim().min(1).max(40),note:z.string().trim().max(500).optional()}).parse(request.body);
    const assigned=await pool.query('SELECT admin_user_id FROM admin_kitchens WHERE kitchen_id=$1',[request.user.organizationId]);
    if(!assigned.rowCount)return reply.code(409).send({message:'Dapur belum memiliki admin pengelola.'});
    const requestNo=`REQ-${new Date().toISOString().slice(0,10).replaceAll('-','')}-${Math.floor(1000+Math.random()*9000)}`;
    const {rows}=await pool.query(`INSERT INTO special_requests(request_no,kitchen_id,admin_user_id,name,quantity,unit,note,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id,request_no AS "requestNo"`,[requestNo,request.user.organizationId,assigned.rows[0].admin_user_id,input.name,input.quantity,input.unit,input.note||null,request.user.id]);return rows[0];
  });

  app.patch('/special-requests/:id/reject',{preHandler:allow('ADMIN','SUPERADMIN')},async(request,reply)=>{
    const params=z.object({id:z.string().uuid()}).parse(request.params);const scope=request.user.role==='ADMIN'?' AND admin_user_id=$2':'';const values=request.user.role==='ADMIN'?[params.id,request.user.id]:[params.id];
    const result=await pool.query(`UPDATE special_requests SET status='REJECTED',updated_at=now() WHERE id=$1 AND status='PENDING'${scope} RETURNING id`,values);if(!result.rowCount)return reply.code(404).send({message:'Permintaan tidak ditemukan atau sudah diproses.'});return{success:true};
  });

  app.patch('/special-requests/:id/approve',{preHandler:allow('ADMIN','SUPERADMIN')},async(request,reply)=>{
    const params=z.object({id:z.string().uuid()}).parse(request.params);const input=z.object({source:z.enum(['COOPERATIVE','VENDOR']),vendorId:z.string().uuid().nullable().optional(),salePrice:z.coerce.number().nonnegative(),costPrice:z.coerce.number().nonnegative().nullable().optional()}).parse(request.body);
    if(input.source==='VENDOR'&&!input.vendorId)return reply.code(400).send({message:'Vendor wajib dipilih untuk sumber vendor.'});
    try{return await withTransaction(async client=>{
      const values=request.user.role==='ADMIN'?[params.id,request.user.id]:[params.id];const scope=request.user.role==='ADMIN'?' AND r.admin_user_id=$2':'';
      const result=await client.query(`SELECT r.* FROM special_requests r WHERE r.id=$1 AND r.status='PENDING'${scope} FOR UPDATE`,values);const item=result.rows[0];if(!item)throw Object.assign(new Error('Permintaan tidak ditemukan atau sudah diproses.'),{statusCode:404});
      if(input.source==='VENDOR'){const vendor=await client.query('SELECT 1 FROM vendors WHERE id=$1 AND admin_user_id=$2 AND active',[input.vendorId,item.admin_user_id]);if(!vendor.rowCount)throw Object.assign(new Error('Vendor tidak tersedia untuk admin ini.'),{statusCode:404});}
      const sku=`REQ-${item.id.slice(0,8).toUpperCase()}`;
      const template=(await client.query(`INSERT INTO product_templates(sku,name,category,order_unit,price_unit,active,owner_admin_user_id) VALUES($1,$2,'Permintaan Khusus',$3,$3,false,$4) RETURNING id`,[sku,item.name,item.unit,item.admin_user_id])).rows[0];
      const product=(await client.query(`INSERT INTO admin_products(admin_user_id,template_id,sale_price,active) VALUES($1,$2,$3,false) RETURNING id`,[item.admin_user_id,template.id,input.salePrice])).rows[0];
      const batch=(await client.query(`INSERT INTO inventory_batches(admin_product_id,source,vendor_id,quantity_initial,quantity_available,quantity_reserved,cost_price,created_by) VALUES($1,$2,$3,$4,0,$4,$5,$6) RETURNING id`,[product.id,input.source,input.source==='VENDOR'?input.vendorId:null,item.quantity,input.costPrice??null,request.user.id])).rows[0];
      const orderNo=`ORD-${new Date().toISOString().slice(0,10).replaceAll('-','')}-${Math.floor(1000+Math.random()*9000)}`;const total=Number(item.quantity)*Number(input.salePrice);
      const order=(await client.query(`INSERT INTO orders(order_no,kitchen_id,admin_user_id,needed_date,note,created_by,status,estimated_total) VALUES($1,$2,$3,current_date+1,$4,$5,'PREPARING',$6) RETURNING id`,[orderNo,item.kitchen_id,item.admin_user_id,`Permintaan ${item.request_no}`,item.created_by,total])).rows[0];
      const orderItem=(await client.query(`INSERT INTO order_items(order_id,admin_product_id,product_name,ordered_quantity,order_unit,price_unit,unit_price,estimated_total) VALUES($1,$2,$3,$4,$5,$5,$6,$7) RETURNING id`,[order.id,product.id,item.name,item.quantity,item.unit,input.salePrice,total])).rows[0];
      await client.query(`INSERT INTO order_item_allocations(order_item_id,inventory_batch_id,source,vendor_id,reserved_quantity) VALUES($1,$2,$3,$4,$5)`,[orderItem.id,batch.id,input.source,input.source==='VENDOR'?input.vendorId:null,item.quantity]);
      await client.query(`INSERT INTO inventory_movements(inventory_batch_id,order_id,movement_type,quantity,note,created_by) VALUES($1,$2,'RESERVE',$3,'Permintaan barang di luar katalog',$4)`,[batch.id,order.id,-Number(item.quantity),request.user.id]);
      await client.query(`INSERT INTO order_status_history(order_id,to_status,changed_by,note) VALUES($1,'PREPARING',$2,'Permintaan barang disetujui')`,[order.id,request.user.id]);
      await client.query(`UPDATE special_requests SET status='APPROVED',order_id=$1,updated_at=now() WHERE id=$2`,[order.id,item.id]);return{success:true,orderId:order.id};
    });}catch(error){const known=error as Error&{statusCode?:number};return reply.code(known.statusCode||500).send({message:known.statusCode?known.message:'Permintaan gagal disetujui.'});}
  });
}
