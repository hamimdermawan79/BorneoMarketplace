import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { pool, withTransaction } from '../database/client.js';
import { allow, authenticate } from '../types.js';
import { persistProductImage } from '../images/storage.js';
import {resolveStockSource,type StockSource} from './stock-source.js';
import {stockManagementRoutes} from './stock-management.js';
import { randomUUID } from 'node:crypto';
import { estimatedWeightInput, priceInput, productImageInput, quantityInput } from '../security/input-validation.js';

export async function catalogRoutes(app: FastifyInstance) {
  await stockManagementRoutes(app);
  app.get('/templates', { preHandler: allow('SUPERADMIN','ADMIN') }, async request => {
    const { rows } = await pool.query(`SELECT id, sku, name, category, image_path AS image, order_unit AS "orderUnit", price_unit AS "priceUnit", weighing_required AS "weighingRequired", estimated_kg_per_unit AS "estimatedKgPerUnit",stock_source AS "stockSource",active FROM product_templates WHERE owner_admin_user_id IS NULL${request.user.role==='SUPERADMIN'?'':' AND active'} ORDER BY category,name`);
    return rows;
  });

  app.post('/templates', { preHandler: allow('SUPERADMIN') }, async request => {
    const input=z.object({name:z.string().trim().min(2).max(120),category:z.string().trim().min(2).max(80),image:productImageInput.nullable().optional(),orderUnit:z.string().trim().min(1).max(30),priceUnit:z.string().trim().min(1).max(30),stockSource:z.enum(['COOPERATIVE','VENDOR']).default('COOPERATIVE'),weighingRequired:z.boolean().default(false),estimatedKgPerUnit:estimatedWeightInput.nullable().optional()}).superRefine((value,ctx)=>{if(value.weighingRequired&&value.priceUnit!=='kg')ctx.addIssue({code:'custom',path:['priceUnit'],message:'Produk timbang harus menggunakan satuan harga kg.'});if(value.weighingRequired&&!value.estimatedKgPerUnit)ctx.addIssue({code:'custom',path:['estimatedKgPerUnit'],message:'Estimasi berat per unit wajib diisi.'})}).parse(request.body);
    if(input.image)input.image=await persistProductImage(input.image,'produk-pokok');
    return withTransaction(async client=>{
      const prefix=input.name.normalize('NFKD').replace(/[^a-zA-Z0-9 ]/g,'').split(/\s+/).filter(Boolean).map(part=>part[0]).join('').slice(0,3).toUpperCase()||'PRD';
      const sku=`${prefix}-${randomUUID().slice(0,8).toUpperCase()}`;
      const template=(await client.query(`INSERT INTO product_templates(sku,name,category,image_path,order_unit,price_unit,weighing_required,estimated_kg_per_unit,stock_source) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id,sku,name,stock_source AS "stockSource"`,[sku,input.name,input.category,input.image||null,input.orderUnit,input.priceUnit,input.weighingRequired,input.weighingRequired?input.estimatedKgPerUnit:null,input.stockSource])).rows[0];
      await client.query(`INSERT INTO admin_products(admin_user_id,template_id,sale_price) SELECT id,$1,0 FROM users WHERE role='ADMIN' AND active ON CONFLICT(admin_user_id,template_id) DO NOTHING`,[template.id]);
      await client.query(`INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,changes) VALUES($1,'CREATE','PRODUCT_TEMPLATE',$2,$3)`,[request.user.id,template.id,JSON.stringify({sku,name:input.name,orderUnit:input.orderUnit,priceUnit:input.priceUnit,stockSource:input.stockSource})]);
      return template;
    });
  });

  app.patch('/templates/:id', { preHandler: allow('SUPERADMIN') }, async(request,reply)=>{
    const params=z.object({id:z.string().uuid()}).parse(request.params);const input=z.object({name:z.string().trim().min(2).max(120).optional(),category:z.string().trim().min(2).max(80).optional(),image:productImageInput.nullable().optional(),active:z.boolean().optional(),stockSource:z.enum(['COOPERATIVE','VENDOR']).optional()}).refine(value=>Object.keys(value).length>0).parse(request.body);
    return withTransaction(async client=>{
      const existing=await client.query('SELECT id FROM product_templates WHERE id=$1 AND owner_admin_user_id IS NULL FOR UPDATE',[params.id]);
      if(!existing.rowCount)return reply.code(404).send({message:'Produk Pokok tidak ditemukan.'});
      if(input.image)input.image=await persistProductImage(input.image,'produk-pokok');
      const {rows}=await client.query(`UPDATE product_templates SET name=COALESCE($1,name),category=COALESCE($2,category),image_path=CASE WHEN $3::boolean THEN $4 ELSE image_path END,active=COALESCE($5,active),stock_source=COALESCE($6::source_type,stock_source) WHERE id=$7 AND owner_admin_user_id IS NULL RETURNING id,sku,name,active,stock_source AS "stockSource"`,[input.name??null,input.category??null,Object.prototype.hasOwnProperty.call(input,'image'),input.image??null,input.active??null,input.stockSource??null,params.id]);
      if(!rows.length)return reply.code(404).send({message:'Produk Pokok tidak ditemukan.'});
      if(rows[0].active)await client.query(`INSERT INTO admin_products(admin_user_id,template_id,sale_price) SELECT id,$1,0 FROM users WHERE role='ADMIN' AND active ON CONFLICT(admin_user_id,template_id) DO UPDATE SET active=true`,[params.id]);
      const {image,...changes}=input;
      await client.query(`INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,changes) VALUES($1,'UPDATE','PRODUCT_TEMPLATE',$2,$3)`,[request.user.id,params.id,JSON.stringify({...changes,...(image!==undefined?{imageChanged:true}:{})})]);return rows[0];
    });
  });

  app.delete('/templates/:id', { preHandler: allow('SUPERADMIN') }, async(request,reply)=>{
    const {id}=z.object({id:z.string().uuid()}).parse(request.params);
    try{return await withTransaction(async client=>{
      const product=(await client.query('SELECT id,name FROM product_templates WHERE id=$1 AND owner_admin_user_id IS NULL FOR UPDATE',[id])).rows[0];
      if(!product)return reply.code(404).send({message:'Produk Pokok tidak ditemukan.'});
      const linked=await client.query('SELECT id FROM admin_products WHERE template_id=$1 ORDER BY id FOR UPDATE',[id]);
      const ids=linked.rows.map(row=>row.id);
      if(ids.length){
        const used=await client.query('SELECT 1 FROM inventory_batches WHERE admin_product_id=ANY($1::uuid[]) UNION ALL SELECT 1 FROM order_items WHERE admin_product_id=ANY($1::uuid[]) LIMIT 1',[ids]);
        if(used.rowCount)return reply.code(409).send({message:'Produk sudah memiliki stok atau riwayat pesanan. Gunakan Nonaktifkan agar riwayat tetap tersimpan.'});
        await client.query('DELETE FROM admin_products WHERE template_id=$1',[id]);
      }
      await client.query('DELETE FROM product_templates WHERE id=$1',[id]);
      await client.query("INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,changes) VALUES($1,'DELETE','PRODUCT_TEMPLATE',$2,$3)",[request.user.id,id,JSON.stringify({name:product.name})]);
      return {success:true};
    });}catch(error){if((error as {code?:string}).code==='23503')return reply.code(409).send({message:'Produk masih digunakan. Gunakan Nonaktifkan.'});throw error;}
  });

  app.get('/catalog', { preHandler: authenticate }, async request => {
    let adminId = request.user.id;
    if (request.user.role === 'BUYER') {
      const assigned = await pool.query("SELECT ak.admin_user_id FROM admin_kitchens ak JOIN users u ON u.id=ak.admin_user_id JOIN organizations o ON o.id=ak.kitchen_id WHERE ak.kitchen_id=$1 AND u.active AND u.role='ADMIN' AND o.active", [request.user.organizationId]);
      if (!assigned.rowCount) return [];
      adminId = assigned.rows[0].admin_user_id;
    }
    const { rows } = await pool.query(`
      SELECT ap.id, pt.sku, pt.name, pt.category, pt.image_path AS image,
        pt.order_unit AS "orderUnit", pt.price_unit AS "priceUnit",
        pt.stock_source AS "stockSource", (pt.owner_admin_user_id IS NULL) AS "isMaster",
        pt.weighing_required AS "weighingRequired", pt.estimated_kg_per_unit AS "estimatedKgPerUnit",
        ap.sale_price AS "salePrice", COUNT(ib.id)>0 AS "hasStock", COALESCE(SUM(ib.quantity_available),0) AS "availableStock",
        COALESCE(SUM(ib.quantity_available) FILTER(WHERE ib.source='COOPERATIVE'),0) AS "cooperativeStock",
        COALESCE(SUM(ib.quantity_available) FILTER(WHERE ib.source='VENDOR'),0) AS "vendorStock"
      FROM admin_products ap JOIN product_templates pt ON pt.id=ap.template_id
      LEFT JOIN inventory_batches ib ON ib.admin_product_id=ap.id
      WHERE ap.admin_user_id=$1 AND ap.active AND pt.active AND (pt.owner_admin_user_id IS NULL OR pt.owner_admin_user_id=ap.admin_user_id)
      GROUP BY ap.id,pt.id
      HAVING $2::boolean=false OR COALESCE(SUM(ib.quantity_available),0)>0
      ORDER BY pt.category,pt.name`, [adminId,request.user.role==='BUYER']);
    return rows;
  });

  app.post('/admin-products', { preHandler: allow('ADMIN') }, async (request, reply) => {
    const input = z.object({ templateId:z.string().uuid(), salePrice:priceInput }).parse(request.body);
    const { rows } = await pool.query(`INSERT INTO admin_products(admin_user_id,template_id,sale_price)
      SELECT $1,id,$3 FROM product_templates WHERE id=$2 AND active AND (owner_admin_user_id IS NULL OR owner_admin_user_id=$1)
      ON CONFLICT(admin_user_id,template_id) DO UPDATE SET sale_price=excluded.sale_price,active=true RETURNING id`, [request.user.id,input.templateId,input.salePrice]);
    if (!rows.length) return reply.code(404).send({ message:'Produk tidak ditemukan.' });
    return { id: rows[0].id };
  });

  app.get('/vendors', { preHandler: allow('ADMIN') }, async request => {
    const { rows } = await pool.query('SELECT id,name,phone,address FROM vendors WHERE admin_user_id=$1 AND active ORDER BY name', [request.user.id]);
    return rows;
  });

  app.post('/vendors', { preHandler: allow('ADMIN') }, async request => {
    const input = z.object({ name:z.string().trim().min(2).max(120), phone:z.string().trim().max(30).optional(), address:z.string().trim().max(300).optional() }).parse(request.body);
    const { rows } = await pool.query('INSERT INTO vendors(admin_user_id,name,phone,address) VALUES($1,$2,$3,$4) RETURNING id,name', [request.user.id,input.name,input.phone||null,input.address||null]);
    return rows[0];
  });

  app.post('/stock', { preHandler: allow('ADMIN') }, async request => {
    const input = z.object({ adminProductId:z.string().uuid().nullable().optional(), customProduct:z.object({name:z.string().trim().min(2).max(120),category:z.string().trim().min(2).max(80),unit:z.string().trim().min(1).max(30),image:productImageInput.nullable().optional()}).nullable().optional(), salePrice:priceInput, source:z.enum(['COOPERATIVE','VENDOR']).optional(), vendorName:z.string().trim().min(2).max(120).nullable().optional(), quantity:quantityInput }).superRefine((value,ctx)=>{if(Boolean(value.adminProductId)===Boolean(value.customProduct))ctx.addIssue({code:'custom',message:'Pilih Produk Pokok atau isi produk baru.'})}).parse(request.body);
    if(input.customProduct?.image)input.customProduct.image=await persistProductImage(input.customProduct.image,'produk-tambahan');
    return withTransaction(async client => {
      let adminProductId=input.adminProductId??null;
      let source:StockSource=resolveStockSource(input.source);
      if(input.customProduct&&source==='VENDOR'&&!input.vendorName)throw Object.assign(new Error('Nama vendor wajib diisi.'),{statusCode:400});
      if(input.customProduct){
        const template=(await client.query(`INSERT INTO product_templates(sku,name,category,image_path,order_unit,price_unit,owner_admin_user_id,stock_source) VALUES('CUS-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,10)),$1,$2,$3,$4,$4,$5,$6) RETURNING id`,[input.customProduct.name,input.customProduct.category,input.customProduct.image||null,input.customProduct.unit,request.user.id,source])).rows[0];
        adminProductId=(await client.query('INSERT INTO admin_products(admin_user_id,template_id,sale_price) VALUES($1,$2,$3) RETURNING id',[request.user.id,template.id,input.salePrice])).rows[0].id;
      }else{
        const ownership = await client.query('SELECT pt.stock_source,pt.owner_admin_user_id FROM admin_products ap JOIN product_templates pt ON pt.id=ap.template_id WHERE ap.id=$1 AND ap.admin_user_id=$2 AND pt.active AND (pt.owner_admin_user_id IS NULL OR pt.owner_admin_user_id=$2) FOR SHARE OF pt', [adminProductId,request.user.id]);
        if (!ownership.rowCount) throw Object.assign(new Error('Produk tidak ditemukan.'), { statusCode:404 });
        source=resolveStockSource(input.source,ownership.rows[0].owner_admin_user_id===null?ownership.rows[0].stock_source:undefined);
        await client.query('SELECT id FROM admin_products WHERE id=$1 FOR UPDATE',[adminProductId]);
      }
      if(source==='VENDOR'&&!input.vendorName)throw Object.assign(new Error('Nama vendor wajib diisi.'),{statusCode:400});
      let vendorId:string|null=null;
      if (source === 'VENDOR') {
        const existing = await client.query('SELECT id FROM vendors WHERE admin_user_id=$1 AND active AND lower(name)=lower($2) ORDER BY created_at LIMIT 1', [request.user.id,input.vendorName]);
        vendorId=existing.rows[0]?.id??null;
        if(!vendorId){
          const created=await client.query('INSERT INTO vendors(admin_user_id,name) VALUES($1,$2) RETURNING id',[request.user.id,input.vendorName]);
          vendorId=created.rows[0].id;
        }
      }
      await client.query('UPDATE admin_products SET sale_price=$1,active=true WHERE id=$2',[input.salePrice,adminProductId]);
      const { rows } = await client.query(`INSERT INTO inventory_batches(admin_product_id,source,vendor_id,quantity_initial,quantity_available,cost_price,created_by)
        VALUES($1,$2,$3,$4,$4,NULL,$5) RETURNING id`, [adminProductId,source,vendorId,input.quantity,request.user.id]);
      await client.query(`INSERT INTO inventory_movements(inventory_batch_id,movement_type,quantity,note,created_by) VALUES($1,'IN',$2,'Stok masuk',$3)`, [rows[0].id,input.quantity,request.user.id]);
      await client.query(`INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,changes) VALUES($1,'CREATE','INVENTORY_BATCH',$2,$3)`,[request.user.id,rows[0].id,JSON.stringify({adminProductId,customProduct:input.customProduct?{name:input.customProduct.name,category:input.customProduct.category,unit:input.customProduct.unit}:null,quantity:input.quantity,salePrice:input.salePrice,source,vendorId,vendorName:source==='VENDOR'?input.vendorName:null})]);
      return { id:rows[0].id };
    });
  });
}
