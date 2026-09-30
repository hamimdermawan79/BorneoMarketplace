import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { pool, withTransaction } from '../database/client.js';
import { allow, authenticate } from '../types.js';
import { canTransition, lineTotal, requiredStock } from '../domain/order-rules.js';

async function visibleOrder(id:string,user:{id:string;role:string;organizationId:string|null}) {
  const params:unknown[]=[id];
  let scope='';
  if(user.role==='ADMIN'){params.push(user.id);scope=' AND o.admin_user_id=$2';}
  if(user.role==='BUYER'){params.push(user.organizationId);scope=' AND o.kitchen_id=$2';}
  const result=await pool.query(`SELECT o.* FROM orders o WHERE o.id=$1${scope}`,params);
  return result.rows[0];
}

export async function orderRoutes(app:FastifyInstance){
  app.post('/orders',{preHandler:allow('BUYER')},async(request,reply)=>{
    const input=z.object({neededDate:z.string().date(),note:z.string().trim().max(500).optional(),idempotencyKey:z.string().uuid(),items:z.array(z.object({adminProductId:z.string().uuid(),quantity:z.coerce.number().positive()})).min(1)}).parse(request.body);
    try{return await withTransaction(async client=>{
      const assigned=await client.query('SELECT admin_user_id FROM admin_kitchens WHERE kitchen_id=$1',[request.user.organizationId]);
      if(!assigned.rowCount) throw Object.assign(new Error('Dapur belum memiliki admin pengelola.'),{statusCode:409});
      const adminId=assigned.rows[0].admin_user_id;
      const existing=await client.query('SELECT id,order_no FROM orders WHERE created_by=$1 AND idempotency_key=$2',[request.user.id,input.idempotencyKey]);
      if(existing.rowCount)return existing.rows[0];
      const orderNo=`ORD-${new Date().toISOString().slice(0,10).replaceAll('-','')}-${Math.floor(1000+Math.random()*9000)}`;
      const order=(await client.query(`INSERT INTO orders(order_no,kitchen_id,admin_user_id,needed_date,note,idempotency_key,created_by) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id,order_no`,[orderNo,request.user.organizationId,adminId,input.neededDate,input.note||null,input.idempotencyKey,request.user.id])).rows[0];
      let estimatedTotal=0;
      for(const requested of input.items){
        const productResult=await client.query(`SELECT ap.id,ap.sale_price,pt.name,pt.order_unit,pt.price_unit,pt.weighing_required,pt.estimated_kg_per_unit
          FROM admin_products ap JOIN product_templates pt ON pt.id=ap.template_id WHERE ap.id=$1 AND ap.admin_user_id=$2 AND ap.active AND pt.active`,[requested.adminProductId,adminId]);
        const product=productResult.rows[0];
        if(!product)throw Object.assign(new Error('Produk tidak tersedia untuk dapur ini.'),{statusCode:409});
        const required=requiredStock(product,requested.quantity);const estimatedWeight=product.weighing_required?required:null;
        const estimatedLineTotal=lineTotal(required,Number(product.sale_price));
        const item=(await client.query(`INSERT INTO order_items(order_id,admin_product_id,product_name,ordered_quantity,order_unit,price_unit,unit_price,estimated_weight_kg,estimated_total)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,[order.id,product.id,product.name,requested.quantity,product.order_unit,product.price_unit,product.sale_price,estimatedWeight,estimatedLineTotal])).rows[0];
        let remaining=required;
        const batches=await client.query(`SELECT ib.id,ib.source,ib.vendor_id,ib.quantity_available FROM inventory_batches ib
          WHERE ib.admin_product_id=$1 AND ib.quantity_available>0 ORDER BY CASE ib.source WHEN 'COOPERATIVE' THEN 0 ELSE 1 END,ib.received_at FOR UPDATE`,[product.id]);
        for(const batch of batches.rows){
          if(remaining<=0)break;
          const allocated=Math.min(remaining,Number(batch.quantity_available));
          await client.query('UPDATE inventory_batches SET quantity_available=quantity_available-$1,quantity_reserved=quantity_reserved+$1 WHERE id=$2',[allocated,batch.id]);
          await client.query(`INSERT INTO order_item_allocations(order_item_id,inventory_batch_id,source,vendor_id,reserved_quantity) VALUES($1,$2,$3,$4,$5)`,[item.id,batch.id,batch.source,batch.vendor_id,allocated]);
          await client.query(`INSERT INTO inventory_movements(inventory_batch_id,order_id,movement_type,quantity,note,created_by) VALUES($1,$2,'RESERVE',$3,'Reservasi checkout',$4)`,[batch.id,order.id,-allocated,request.user.id]);
          remaining-=allocated;
        }
        if(remaining>0)throw Object.assign(new Error(`Stok ${product.name} tidak mencukupi.`),{statusCode:409});
        estimatedTotal+=estimatedLineTotal;
      }
      await client.query('UPDATE orders SET estimated_total=$1 WHERE id=$2',[estimatedTotal,order.id]);
      await client.query(`INSERT INTO order_status_history(order_id,to_status,changed_by,note) VALUES($1,'SUBMITTED',$2,'Pesanan dibuat')`,[order.id,request.user.id]);
      return {...order,estimatedTotal};
    });}catch(error){const known=error as Error&{statusCode?:number};return reply.code(known.statusCode||500).send({message:known.statusCode?known.message:'Pesanan gagal dibuat.'});}
  });

  app.get('/orders',{preHandler:authenticate},async request=>{
    const params:unknown[]=[];let scope='';
    if(request.user.role==='ADMIN'){params.push(request.user.id);scope=`WHERE o.admin_user_id=$1`;}
    if(request.user.role==='BUYER'){params.push(request.user.organizationId);scope=`WHERE o.kitchen_id=$1`;}
    const {rows}=await pool.query(`SELECT o.id,o.order_no AS "orderNo",o.status,o.needed_date AS "neededDate",o.estimated_total AS "estimatedTotal",o.final_total AS "finalTotal",o.created_at AS "createdAt",k.name AS kitchen,
      COALESCE(json_agg(json_build_object('id',oi.id,'name',oi.product_name,'quantity',oi.ordered_quantity,'orderUnit',oi.order_unit,'priceUnit',oi.price_unit,'unitPrice',oi.unit_price,'estimatedWeightKg',oi.estimated_weight_kg,'actualWeightKg',oi.actual_weight_kg,'prepared',oi.prepared,'allocations',(
        SELECT COALESCE(json_agg(json_build_object('id',a.id,'source',a.source,'vendor',v.name,'quantity',COALESCE(a.actual_quantity,a.reserved_quantity),'prepared',a.prepared)),'[]') FROM order_item_allocations a LEFT JOIN vendors v ON v.id=a.vendor_id WHERE a.order_item_id=oi.id
      ))) FILTER(WHERE oi.id IS NOT NULL),'[]') AS items
      FROM orders o JOIN organizations k ON k.id=o.kitchen_id LEFT JOIN order_items oi ON oi.order_id=o.id ${scope}
      GROUP BY o.id,k.name ORDER BY o.needed_date DESC,o.created_at DESC`,params);
    return rows;
  });

  app.patch('/allocations/:id/prepared',{preHandler:allow('ADMIN')},async(request,reply)=>{
    const params=z.object({id:z.string().uuid()}).parse(request.params);const input=z.object({prepared:z.boolean()}).parse(request.body);
    const result=await pool.query(`UPDATE order_item_allocations a SET prepared=$1 FROM order_items oi,orders o WHERE a.id=$2 AND oi.id=a.order_item_id AND o.id=oi.order_id AND o.admin_user_id=$3 AND o.status IN('SUBMITTED','PREPARING') RETURNING oi.id AS item_id,o.id AS order_id,o.status`,[input.prepared,params.id,request.user.id]);
    if(!result.rowCount)return reply.code(404).send({message:'Alokasi barang tidak dapat diubah.'});
    const row=result.rows[0];await pool.query(`UPDATE order_items SET prepared=NOT EXISTS(SELECT 1 FROM order_item_allocations WHERE order_item_id=$1 AND NOT prepared) WHERE id=$1`,[row.item_id]);
    if(row.status==='SUBMITTED')await pool.query(`UPDATE orders SET status='PREPARING',updated_at=now() WHERE id=$1`,[row.order_id]);
    return {success:true};
  });

  app.patch('/order-items/:id/actual-weight',{preHandler:allow('ADMIN')},async(request,reply)=>{
    const params=z.object({id:z.string().uuid()}).parse(request.params);const input=z.object({actualWeightKg:z.coerce.number().positive()}).parse(request.body);
    const result=await pool.query(`UPDATE order_items oi SET actual_weight_kg=$1,final_total=round($1*oi.unit_price,2) FROM orders o
      WHERE oi.id=$2 AND o.id=oi.order_id AND o.admin_user_id=$3 AND oi.price_unit='kg' AND oi.order_unit IN('pcs','potong') AND o.status='PREPARING' RETURNING oi.order_id`,[input.actualWeightKg,params.id,request.user.id]);
    if(!result.rowCount)return reply.code(404).send({message:'Item timbang tidak ditemukan atau pesanan bukan dalam penyiapan.'});
    return {success:true};
  });

  app.patch('/orders/:id/status',{preHandler:authenticate},async(request,reply)=>{
    const params=z.object({id:z.string().uuid()}).parse(request.params);const input=z.object({status:z.enum(['PREPARING','SHIPPED','AWAITING_KITCHEN','COMPLETED','CANCELLED']),note:z.string().max(300).optional()}).parse(request.body);
    const order=await visibleOrder(params.id,request.user);if(!order)return reply.code(404).send({message:'Pesanan tidak ditemukan.'});
    if(!canTransition(order.status,input.status))return reply.code(409).send({message:'Perubahan status tidak sesuai alur pesanan.'});
    if(request.user.role==='BUYER'&&!['COMPLETED','CANCELLED'].includes(input.status))return reply.code(403).send({message:'Aksi tidak diizinkan.'});
    if(request.user.role==='BUYER'&&input.status==='CANCELLED'&&order.status!=='SUBMITTED')return reply.code(409).send({message:'Pesanan hanya dapat dibatalkan sebelum mulai disiapkan.'});
    if(request.user.role==='ADMIN'&&input.status==='COMPLETED')return reply.code(403).send({message:'Penyelesaian akhir harus dikonfirmasi dapur.'});
    if(input.status==='SHIPPED'){
      const pending=await pool.query(`SELECT count(*)::int AS count FROM order_items WHERE order_id=$1 AND (NOT prepared OR (price_unit='kg' AND order_unit IN('pcs','potong') AND actual_weight_kg IS NULL))`,[order.id]);
      if(pending.rows[0].count)return reply.code(409).send({message:'Semua item harus dicentang dan berat aktual telur/ayam wajib diisi.'});
    }
    await withTransaction(async client=>{
      if(input.status==='CANCELLED'){
        const allocations=await client.query('SELECT inventory_batch_id,reserved_quantity FROM order_item_allocations a JOIN order_items i ON i.id=a.order_item_id WHERE i.order_id=$1',[order.id]);
        for(const a of allocations.rows){await client.query('UPDATE inventory_batches SET quantity_available=quantity_available+$1,quantity_reserved=quantity_reserved-$1 WHERE id=$2',[a.reserved_quantity,a.inventory_batch_id]);await client.query(`INSERT INTO inventory_movements(inventory_batch_id,order_id,movement_type,quantity,note,created_by) VALUES($1,$2,'RELEASE',$3,$4,$5)`,[a.inventory_batch_id,order.id,a.reserved_quantity,input.note||'Pesanan dibatalkan',request.user.id]);}
      }
      if(input.status==='SHIPPED'){
        const items=await client.query('SELECT id,admin_product_id,ordered_quantity,actual_weight_kg FROM order_items WHERE order_id=$1',[order.id]);
        for(const item of items.rows){
          let remaining=Number(item.actual_weight_kg??item.ordered_quantity);
          const allocations=await client.query(`SELECT a.id,a.inventory_batch_id,a.reserved_quantity FROM order_item_allocations a WHERE a.order_item_id=$1 ORDER BY a.id`,[item.id]);
          for(const a of allocations.rows){const used=Math.min(remaining,Number(a.reserved_quantity));const released=Number(a.reserved_quantity)-used;await client.query('UPDATE order_item_allocations SET actual_quantity=$1 WHERE id=$2',[used,a.id]);await client.query('UPDATE inventory_batches SET quantity_reserved=quantity_reserved-$1,quantity_available=quantity_available+$2 WHERE id=$3',[a.reserved_quantity,released,a.inventory_batch_id]);if(used>0)await client.query(`INSERT INTO inventory_movements(inventory_batch_id,order_id,movement_type,quantity,note,created_by) VALUES($1,$2,'OUT',$3,'Barang dikirim',$4)`,[a.inventory_batch_id,order.id,-used,request.user.id]);remaining-=used;}
          if(remaining>0){const extra=await client.query(`SELECT id,source,vendor_id,quantity_available FROM inventory_batches WHERE admin_product_id=$1 AND quantity_available>0 ORDER BY CASE source WHEN 'COOPERATIVE' THEN 0 ELSE 1 END,received_at FOR UPDATE`,[item.admin_product_id]);for(const batch of extra.rows){if(remaining<=0)break;const used=Math.min(remaining,Number(batch.quantity_available));await client.query('UPDATE inventory_batches SET quantity_available=quantity_available-$1 WHERE id=$2',[used,batch.id]);await client.query(`INSERT INTO order_item_allocations(order_item_id,inventory_batch_id,source,vendor_id,reserved_quantity,actual_quantity) VALUES($1,$2,$3,$4,$5,$5) ON CONFLICT(order_item_id,inventory_batch_id) DO UPDATE SET actual_quantity=COALESCE(order_item_allocations.actual_quantity,0)+excluded.actual_quantity`,[item.id,batch.id,batch.source,batch.vendor_id,used]);await client.query(`INSERT INTO inventory_movements(inventory_batch_id,order_id,movement_type,quantity,note,created_by) VALUES($1,$2,'OUT',$3,'Selisih timbang aktual',$4)`,[batch.id,order.id,-used,request.user.id]);remaining-=used;}if(remaining>0)throw Object.assign(new Error('Stok tidak cukup untuk selisih berat aktual.'),{statusCode:409});}
        }
        await client.query(`UPDATE orders SET final_total=(SELECT sum(COALESCE(final_total,estimated_total)) FROM order_items WHERE order_id=$1) WHERE id=$1`,[order.id]);
      }
      await client.query('UPDATE orders SET status=$1,updated_at=now() WHERE id=$2',[input.status,order.id]);
      await client.query('INSERT INTO order_status_history(order_id,from_status,to_status,changed_by,note) VALUES($1,$2,$3,$4,$5)',[order.id,order.status,input.status,request.user.id,input.note||null]);
    });
    return {success:true,status:input.status};
  });
}
