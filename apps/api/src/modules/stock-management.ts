import type {FastifyInstance} from 'fastify';
import {z} from 'zod';
import {pool,withTransaction} from '../database/client.js';
import {allow} from '../types.js';
import {decimalInput,priceInput} from '../security/input-validation.js';

const maxQuantity=99_999_999_999.999;
const availableQuantity=decimalInput(3,maxQuantity);
export const stockEditInput=z.object({
  salePrice:priceInput,
  expectedSalePrice:priceInput,
  adjustments:z.array(z.object({batchId:z.string().uuid(),quantity:availableQuantity,expectedQuantity:availableQuantity}).strict()).max(1000),
  note:z.string().trim().min(3).max(200).optional()
}).strict().refine(value=>new Set(value.adjustments.map(row=>row.batchId)).size===value.adjustments.length,'Batch stok tidak boleh berulang.');
export const stockDelta=(current:number,next:number)=>Number((next-current).toFixed(3));
const fail=(message:string,statusCode:number)=>Object.assign(new Error(message),{statusCode});

export async function stockManagementRoutes(app:FastifyInstance){
  app.get('/admin-products/:id/stock',{preHandler:allow('ADMIN')},async(request,reply)=>{
    const {id}=z.object({id:z.string().uuid()}).parse(request.params);
    const product=(await pool.query(`SELECT ap.id,ap.sale_price AS "salePrice",pt.name,pt.price_unit AS "priceUnit"
      FROM admin_products ap JOIN product_templates pt ON pt.id=ap.template_id
      WHERE ap.id=$1 AND ap.admin_user_id=$2 AND ap.active
      AND (pt.owner_admin_user_id IS NULL OR pt.owner_admin_user_id=$2)`,[id,request.user.id])).rows[0];
    if(!product)return reply.code(404).send({message:'Stok produk tidak ditemukan.'});
    const batches=(await pool.query(`SELECT ib.id,ib.source,v.name AS vendor,ib.quantity_available AS "quantityAvailable",
      ib.quantity_reserved AS "quantityReserved",ib.received_at AS "receivedAt"
      FROM inventory_batches ib LEFT JOIN vendors v ON v.id=ib.vendor_id
      JOIN admin_products ap ON ap.id=ib.admin_product_id
      WHERE ib.admin_product_id=$1 AND ap.admin_user_id=$2 ORDER BY ib.received_at DESC,ib.id LIMIT 1001`,[id,request.user.id])).rows;
    if(batches.length>1000)return reply.code(409).send({message:'Terlalu banyak batch untuk diedit sekaligus. Hubungi pengelola sistem.'});
    return {...product,batches};
  });

  app.patch('/admin-products/:id/stock',{preHandler:allow('ADMIN')},async request=>{
    const {id}=z.object({id:z.string().uuid()}).parse(request.params);
    const input=stockEditInput.parse(request.body);
    return withTransaction(async client=>{
      // Same parent lock as checkout: stock correction and reservation cannot race.
      const product=(await client.query(`SELECT ap.id,ap.sale_price AS "salePrice" FROM admin_products ap
        JOIN product_templates pt ON pt.id=ap.template_id WHERE ap.id=$1 AND ap.admin_user_id=$2 AND ap.active
        AND (pt.owner_admin_user_id IS NULL OR pt.owner_admin_user_id=$2) FOR UPDATE OF ap`,[id,request.user.id])).rows[0];
      if(!product)throw fail('Stok produk tidak ditemukan.',404);
      if(Number(product.salePrice)!==input.expectedSalePrice)throw fail('Harga berubah sejak form dibuka. Muat ulang data sebelum menyimpan.',409);
      const batchIds=input.adjustments.map(row=>row.batchId).sort();
      const batches=batchIds.length?(await client.query(`SELECT id,quantity_available AS available,quantity_initial AS initial
        FROM inventory_batches WHERE admin_product_id=$1 AND id=ANY($2::uuid[]) ORDER BY id FOR UPDATE`,[id,batchIds])).rows:[];
      if(batches.length!==batchIds.length)throw fail('Batch stok tidak ditemukan pada produk ini.',404);
      const corrections=input.adjustments.map(row=>{
        const batch=batches.find(batch=>batch.id===row.batchId)!;
        if(Number(batch.available)!==row.expectedQuantity)throw fail('Stok berubah sejak form dibuka. Muat ulang data sebelum menyimpan.',409);
        const delta=stockDelta(Number(batch.available),row.quantity);
        if(Number(batch.initial)+Math.max(0,delta)>maxQuantity)throw fail('Jumlah stok batch melebihi batas yang diizinkan.',400);
        return {batchId:row.batchId,before:Number(batch.available),after:row.quantity,delta};
      }).filter(row=>row.delta!==0);
      for(const row of corrections){
        // Reserved stock is never changed; only the free quantity is corrected.
        await client.query(`UPDATE inventory_batches SET quantity_available=$1,quantity_initial=quantity_initial+GREATEST($2::numeric,0)
          WHERE id=$3 AND admin_product_id=$4`,[row.after,row.delta,row.batchId,id]);
        await client.query(`INSERT INTO inventory_movements(inventory_batch_id,movement_type,quantity,note,created_by)
          VALUES($1,'ADJUSTMENT',$2,$3,$4)`,[row.batchId,row.delta,input.note||'Koreksi stok oleh admin',request.user.id]);
      }
      const priceChanged=Number(product.salePrice)!==input.salePrice;
      if(priceChanged)await client.query('UPDATE admin_products SET sale_price=$1 WHERE id=$2 AND admin_user_id=$3',[input.salePrice,id,request.user.id]);
      if(priceChanged||corrections.length)await client.query(`INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,changes)
        VALUES($1,'UPDATE','ADMIN_PRODUCT',$2,$3)`,[request.user.id,id,JSON.stringify({salePrice:{before:Number(product.salePrice),after:input.salePrice},stock:corrections,note:input.note||null})]);
      return {success:true};
    });
  });
}
