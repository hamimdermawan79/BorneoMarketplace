import type { FastifyInstance } from 'fastify';
import type { PoolClient } from 'pg';
import { z } from 'zod';
import { pool, withTransaction } from '../database/client.js';
import { allow, authenticate } from '../types.js';
import { canTransition, lineTotal, requiredStock, stockPrecision } from '../domain/order-rules.js';
import { boundedTotal, checkoutInput, quantityInput, referenceNumber } from '../domain/order-input.js';

async function visibleOrder(client:PoolClient,id:string,user:{id:string;role:string;organizationId:string|null}) {
  const params:unknown[]=[id];
  let scope='';
  if(user.role==='ADMIN'){params.push(user.id);scope=' AND o.admin_user_id=$2';}
  if(user.role==='BUYER'){params.push(user.organizationId);scope=' AND o.kitchen_id=$2';}
  // All mutations lock the parent first; status validation must use the locked row.
  const result=await client.query(`SELECT o.* FROM orders o WHERE o.id=$1${scope} FOR UPDATE OF o`,params);
  return result.rows[0];
}

function reject(message:string,statusCode:number):never {throw Object.assign(new Error(message),{statusCode});}

async function lockOrderProducts(client:PoolClient,orderId:string){
  // Checkout and shipment lock products in the same order, avoiding opposing batch locks.
  await client.query(`SELECT ap.id FROM admin_products ap WHERE ap.id IN
    (SELECT admin_product_id FROM order_items WHERE order_id=$1) ORDER BY ap.id FOR UPDATE OF ap`,[orderId]);
}

export async function orderRoutes(app:FastifyInstance){
  app.post('/orders',{preHandler:allow('BUYER')},async(request,reply)=>{
    const input=checkoutInput.parse(request.body);
    try{return await withTransaction(async client=>{
      // Concurrent retries wait here before checking for the already committed result.
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`checkout:${request.user.id}:${input.idempotencyKey.toLowerCase()}`]);
      const existing=await client.query('SELECT id,order_no,estimated_total AS "estimatedTotal" FROM orders WHERE created_by=$1 AND kitchen_id=$2 AND idempotency_key=$3',[request.user.id,request.user.organizationId,input.idempotencyKey]);
      if(existing.rowCount)return existing.rows[0];
      const assigned=await client.query(`SELECT ak.admin_user_id FROM admin_kitchens ak
        JOIN users manager ON manager.id=ak.admin_user_id AND manager.active AND manager.role='ADMIN'
        JOIN organizations kitchen ON kitchen.id=ak.kitchen_id AND kitchen.active AND kitchen.type='KITCHEN'
        WHERE ak.kitchen_id=$1 FOR SHARE OF ak,manager,kitchen`,[request.user.organizationId]);
      if(!assigned.rowCount) throw Object.assign(new Error('Dapur belum memiliki admin pengelola.'),{statusCode:409});
      const adminId=assigned.rows[0].admin_user_id;
      const orderNo=await referenceNumber('ORD',client);
      const order=(await client.query(`INSERT INTO orders(order_no,kitchen_id,admin_user_id,needed_date,note,idempotency_key,created_by) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id,order_no`,[orderNo,request.user.organizationId,adminId,input.neededDate,input.note||null,input.idempotencyKey,request.user.id])).rows[0];
      let estimatedTotal=0;
      const products=await client.query(`SELECT ap.id,ap.sale_price,pt.name,pt.order_unit,pt.price_unit,pt.weighing_required,pt.estimated_kg_per_unit
        FROM admin_products ap JOIN product_templates pt ON pt.id=ap.template_id
        WHERE ap.id=ANY($1::uuid[]) AND ap.admin_user_id=$2 AND ap.active AND pt.active
          AND (pt.owner_admin_user_id IS NULL OR pt.owner_admin_user_id=ap.admin_user_id)
        ORDER BY ap.id FOR UPDATE OF ap`,[input.items.map(item=>item.adminProductId),adminId]);
      if(products.rowCount!==input.items.length)reject('Produk tidak tersedia untuk dapur ini.',409);
      for(const requested of [...input.items].sort((a,b)=>a.adminProductId.toLowerCase().localeCompare(b.adminProductId.toLowerCase()))){
        const product=products.rows.find(product=>product.id===requested.adminProductId.toLowerCase());
        if(!product)throw Object.assign(new Error('Produk tidak tersedia untuk dapur ini.'),{statusCode:409});
        if(product.weighing_required&&!Number.isInteger(requested.quantity))reject('Jumlah produk satuan potong atau pcs harus bulat.',400);
        const required=requiredStock(product,requested.quantity);const estimatedWeight=product.weighing_required?required:null;
        const estimatedLineTotal=boundedTotal(lineTotal(required,Number(product.sale_price)));
        const item=(await client.query(`INSERT INTO order_items(order_id,admin_product_id,product_name,ordered_quantity,order_unit,price_unit,unit_price,estimated_weight_kg,estimated_total)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,[order.id,product.id,product.name,requested.quantity,product.order_unit,product.price_unit,product.sale_price,estimatedWeight,estimatedLineTotal])).rows[0];
        let remaining=required;
        const batches=await client.query(`SELECT ib.id,ib.source,ib.vendor_id,ib.quantity_available FROM inventory_batches ib
          WHERE ib.admin_product_id=$1 AND ib.quantity_available>0 ORDER BY CASE ib.source WHEN 'COOPERATIVE' THEN 0 ELSE 1 END,ib.received_at,ib.id FOR UPDATE`,[product.id]);
        for(const batch of batches.rows){
          if(remaining<=0)break;
          const allocated=Math.min(remaining,Number(batch.quantity_available));
          await client.query('UPDATE inventory_batches SET quantity_available=quantity_available-$1,quantity_reserved=quantity_reserved+$1 WHERE id=$2',[allocated,batch.id]);
          await client.query(`INSERT INTO order_item_allocations(order_item_id,inventory_batch_id,source,vendor_id,reserved_quantity) VALUES($1,$2,$3,$4,$5)`,[item.id,batch.id,batch.source,batch.vendor_id,allocated]);
          await client.query(`INSERT INTO inventory_movements(inventory_batch_id,order_id,movement_type,quantity,note,created_by) VALUES($1,$2,'RESERVE',$3,'Reservasi checkout',$4)`,[batch.id,order.id,-allocated,request.user.id]);
          remaining=stockPrecision(remaining-allocated);
        }
        if(remaining>0)throw Object.assign(new Error(`Stok ${product.name} tidak mencukupi.`),{statusCode:409});
        estimatedTotal=boundedTotal(estimatedTotal+estimatedLineTotal);
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
      COALESCE(o.final_total,SUM(COALESCE(oi.final_total,oi.estimated_total)),0) AS "currentTotal",
      COALESCE(json_agg(json_build_object('id',oi.id,'name',oi.product_name,'quantity',oi.ordered_quantity,'orderUnit',oi.order_unit,'priceUnit',oi.price_unit,'unitPrice',oi.unit_price,'estimatedWeightKg',oi.estimated_weight_kg,'actualWeightKg',oi.actual_weight_kg,'prepared',oi.prepared,'allocations',(
        SELECT COALESCE(json_agg(json_build_object('id',a.id,'source',a.source,'vendor',v.name,'quantity',COALESCE(a.actual_quantity,a.reserved_quantity),'prepared',a.prepared) ORDER BY a.id),'[]') FROM order_item_allocations a LEFT JOIN vendors v ON v.id=a.vendor_id WHERE a.order_item_id=oi.id
      )) ORDER BY oi.product_name,oi.id) FILTER(WHERE oi.id IS NOT NULL),'[]') AS items
      FROM orders o JOIN organizations k ON k.id=o.kitchen_id LEFT JOIN order_items oi ON oi.order_id=o.id ${scope}
      GROUP BY o.id,k.name ORDER BY o.needed_date DESC,o.created_at DESC,o.id`,params);
    return rows;
  });

  app.patch('/allocations/:id/prepared',{preHandler:allow('ADMIN')},async(request,reply)=>{
    const params=z.object({id:z.string().uuid()}).parse(request.params);const input=z.object({prepared:z.boolean()}).parse(request.body);
    return withTransaction(async client=>{
      const result=await client.query(`SELECT oi.id AS item_id,o.id AS order_id,o.status FROM orders o
        JOIN order_items oi ON oi.order_id=o.id JOIN order_item_allocations a ON a.order_item_id=oi.id
        WHERE a.id=$1 AND o.admin_user_id=$2 FOR UPDATE OF o`,[params.id,request.user.id]);
      const row=result.rows[0];
      if(!row)reject('Alokasi barang tidak ditemukan.',404);
      if(!['SUBMITTED','PREPARING'].includes(row.status))reject('Alokasi barang tidak dapat diubah pada status pesanan ini.',409);
      await client.query('UPDATE order_item_allocations SET prepared=$1 WHERE id=$2',[input.prepared,params.id]);
      await client.query(`UPDATE order_items SET prepared=NOT EXISTS(SELECT 1 FROM order_item_allocations WHERE order_item_id=$1 AND NOT prepared) WHERE id=$1`,[row.item_id]);
      if(row.status==='SUBMITTED'){
        await client.query(`UPDATE orders SET status='PREPARING',updated_at=now() WHERE id=$1`,[row.order_id]);
        await client.query(`INSERT INTO order_status_history(order_id,from_status,to_status,changed_by,note) VALUES($1,'SUBMITTED','PREPARING',$2,'Penyiapan barang dimulai')`,[row.order_id,request.user.id]);
      }
      return {success:true};
    });
  });

  app.patch('/order-items/:id/actual-weight',{preHandler:allow('ADMIN')},async(request,reply)=>{
    const params=z.object({id:z.string().uuid()}).parse(request.params);const input=z.object({actualWeightKg:quantityInput}).parse(request.body);
    return withTransaction(async client=>{
      const result=await client.query(`SELECT o.id,o.status,oi.unit_price FROM orders o JOIN order_items oi ON oi.order_id=o.id
        WHERE oi.id=$1 AND o.admin_user_id=$2 AND oi.estimated_weight_kg IS NOT NULL FOR UPDATE OF o`,[params.id,request.user.id]);
      const order=result.rows[0];
      if(!order)reject('Item timbang tidak ditemukan.',404);
      if(order.status!=='PREPARING')reject('Berat aktual hanya dapat diubah saat penyiapan.',409);
      const total=boundedTotal(lineTotal(input.actualWeightKg,Number(order.unit_price)));
      await client.query('UPDATE order_items SET actual_weight_kg=$1,final_total=$2 WHERE id=$3',[input.actualWeightKg,total,params.id]);
      return {success:true};
    });
  });

  app.patch('/orders/:id/status',{preHandler:authenticate},async(request,reply)=>{
    const params=z.object({id:z.string().uuid()}).parse(request.params);const input=z.object({status:z.enum(['PREPARING','SHIPPED','AWAITING_KITCHEN','COMPLETED','CANCELLED']),note:z.string().max(300).optional()}).parse(request.body);
    await withTransaction(async client=>{
      const order=await visibleOrder(client,params.id,request.user);if(!order)reject('Pesanan tidak ditemukan.',404);
      if(request.user.role==='BUYER'&&!['COMPLETED','CANCELLED'].includes(input.status))reject('Aksi tidak diizinkan.',403);
      if(request.user.role==='ADMIN'&&input.status==='COMPLETED')reject('Penyelesaian akhir harus dikonfirmasi dapur.',403);
      if(!canTransition(order.status,input.status))reject('Perubahan status tidak sesuai alur pesanan.',409);
      if(request.user.role==='BUYER'&&input.status==='CANCELLED'&&order.status!=='SUBMITTED')reject('Pesanan hanya dapat dibatalkan sebelum mulai disiapkan.',409);
      if(input.status==='SHIPPED'){
        const pending=await client.query(`SELECT count(*)::int AS count FROM order_items i WHERE i.order_id=$1 AND
          (NOT i.prepared OR (i.estimated_weight_kg IS NOT NULL AND i.actual_weight_kg IS NULL)
          OR NOT EXISTS(SELECT 1 FROM order_item_allocations a WHERE a.order_item_id=i.id)
          OR EXISTS(SELECT 1 FROM order_item_allocations a WHERE a.order_item_id=i.id AND NOT a.prepared))`,[order.id]);
        if(pending.rows[0].count)reject('Semua item harus dicentang dan berat aktual telur/ayam wajib diisi.',409);
      }
      if(input.status==='CANCELLED'||input.status==='SHIPPED')await lockOrderProducts(client,order.id);
      if(input.status==='CANCELLED'){
        const allocations=await client.query('SELECT inventory_batch_id,reserved_quantity FROM order_item_allocations a JOIN order_items i ON i.id=a.order_item_id WHERE i.order_id=$1 ORDER BY i.admin_product_id,a.inventory_batch_id,a.id',[order.id]);
        for(const a of allocations.rows){await client.query('UPDATE inventory_batches SET quantity_available=quantity_available+$1,quantity_reserved=quantity_reserved-$1 WHERE id=$2',[a.reserved_quantity,a.inventory_batch_id]);await client.query(`INSERT INTO inventory_movements(inventory_batch_id,order_id,movement_type,quantity,note,created_by) VALUES($1,$2,'RELEASE',$3,$4,$5)`,[a.inventory_batch_id,order.id,a.reserved_quantity,input.note||'Pesanan dibatalkan',request.user.id]);}
      }
      if(input.status==='SHIPPED'){
        const items=await client.query('SELECT id,admin_product_id,ordered_quantity,actual_weight_kg FROM order_items WHERE order_id=$1 ORDER BY admin_product_id,id',[order.id]);
        for(const item of items.rows){
          let remaining=Number(item.actual_weight_kg??item.ordered_quantity);
          const allocations=await client.query(`SELECT a.id,a.inventory_batch_id,a.reserved_quantity FROM order_item_allocations a WHERE a.order_item_id=$1 ORDER BY a.id`,[item.id]);
          for(const a of allocations.rows){const used=Math.min(remaining,Number(a.reserved_quantity));const released=stockPrecision(Number(a.reserved_quantity)-used);await client.query('UPDATE order_item_allocations SET actual_quantity=$1 WHERE id=$2',[used,a.id]);await client.query('UPDATE inventory_batches SET quantity_reserved=quantity_reserved-$1,quantity_available=quantity_available+$2 WHERE id=$3',[a.reserved_quantity,released,a.inventory_batch_id]);if(used>0)await client.query(`INSERT INTO inventory_movements(inventory_batch_id,order_id,movement_type,quantity,note,created_by) VALUES($1,$2,'OUT',$3,'Barang dikirim',$4)`,[a.inventory_batch_id,order.id,-used,request.user.id]);remaining=stockPrecision(remaining-used);}
          if(remaining>0){const extra=await client.query(`SELECT id,source,vendor_id,quantity_available FROM inventory_batches WHERE admin_product_id=$1 AND quantity_available>0 ORDER BY CASE source WHEN 'COOPERATIVE' THEN 0 ELSE 1 END,received_at,id FOR UPDATE`,[item.admin_product_id]);for(const batch of extra.rows){if(remaining<=0)break;const used=Math.min(remaining,Number(batch.quantity_available));await client.query('UPDATE inventory_batches SET quantity_available=quantity_available-$1 WHERE id=$2',[used,batch.id]);await client.query(`INSERT INTO order_item_allocations(order_item_id,inventory_batch_id,source,vendor_id,reserved_quantity,actual_quantity,prepared) VALUES($1,$2,$3,$4,$5,$5,true) ON CONFLICT(order_item_id,inventory_batch_id) DO UPDATE SET actual_quantity=COALESCE(order_item_allocations.actual_quantity,0)+excluded.actual_quantity`,[item.id,batch.id,batch.source,batch.vendor_id,used]);await client.query(`INSERT INTO inventory_movements(inventory_batch_id,order_id,movement_type,quantity,note,created_by) VALUES($1,$2,'OUT',$3,'Selisih timbang aktual',$4)`,[batch.id,order.id,-used,request.user.id]);remaining=stockPrecision(remaining-used);}if(remaining>0)throw Object.assign(new Error('Stok tidak cukup untuk selisih berat aktual.'),{statusCode:409});}
        }
        const total=await client.query('SELECT COALESCE(sum(COALESCE(final_total,estimated_total)),0) AS total FROM order_items WHERE order_id=$1',[order.id]);
        await client.query('UPDATE orders SET final_total=$1 WHERE id=$2',[boundedTotal(Number(total.rows[0].total)),order.id]);
      }
      await client.query('UPDATE orders SET status=$1,updated_at=now() WHERE id=$2',[input.status,order.id]);
      await client.query('INSERT INTO order_status_history(order_id,from_status,to_status,changed_by,note) VALUES($1,$2,$3,$4,$5)',[order.id,order.status,input.status,request.user.id,input.note||null]);
    });
    return {success:true,status:input.status};
  });
}
