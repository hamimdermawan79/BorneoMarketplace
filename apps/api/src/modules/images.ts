import type {FastifyInstance} from 'fastify';
import {allow,authenticate} from '../types.js';
import {z} from 'zod';
import {pool} from '../database/client.js';
import {readProductImage} from '../images/storage.js';
import {convertToWebp,MAX_IMAGE_BYTES} from '../images/convert.js';

export async function imageRoutes(app:FastifyInstance){
  app.get('/product-images/:kind/:filename',{preHandler:authenticate},async(request,reply)=>{
    const {kind,filename}=z.object({kind:z.enum(['produk-pokok','produk-tambahan']),filename:z.string().regex(/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}\.webp$/)}).parse(request.params);
    const path=`/api/product-images/${kind}/${filename}`;
    // Names are opaque, but permission is still checked on EVERY image request.
    const access=await pool.query(`SELECT 1 FROM product_templates pt WHERE pt.image_path=$1 AND (
      $2='SUPERADMIN' OR ($2='ADMIN' AND (pt.owner_admin_user_id IS NULL OR pt.owner_admin_user_id=$3))
      OR ($2='BUYER' AND EXISTS (
        SELECT 1 FROM admin_products ap JOIN admin_kitchens ak ON ak.admin_user_id=ap.admin_user_id
        JOIN users admin ON admin.id=ap.admin_user_id
        WHERE ap.template_id=pt.id AND ak.kitchen_id=$4 AND admin.active AND admin.role='ADMIN'
        AND (pt.owner_admin_user_id IS NULL OR pt.owner_admin_user_id=ap.admin_user_id)
        AND ((pt.active AND ap.active AND EXISTS(SELECT 1 FROM inventory_batches ib WHERE ib.admin_product_id=ap.id AND ib.quantity_available>0))
          OR EXISTS(SELECT 1 FROM order_items oi JOIN orders o ON o.id=oi.order_id WHERE oi.admin_product_id=ap.id AND o.kitchen_id=$4))
      ))) LIMIT 1`,[path,request.user.role,request.user.id,request.user.organizationId]);
    if(!access.rowCount)return reply.code(404).send({message:'Gambar tidak ditemukan.'});
    const image=await readProductImage(kind,filename);
    return reply.header('Cache-Control','private, no-store').type('image/webp').send(image);
  });
  app.addContentTypeParser('application/octet-stream',{parseAs:'buffer',bodyLimit:MAX_IMAGE_BYTES},(_request,body,done)=>done(null,body));
  app.post('/images/convert',{
    onRequest:allow('ADMIN','SUPERADMIN'),bodyLimit:MAX_IMAGE_BYTES,
    config:{rateLimit:{max:12,timeWindow:'1 minute'}}
  },async(request)=>{
    const result=await convertToWebp(request.body as Buffer);
    return {image:`data:image/webp;base64,${result.toString('base64')}`,bytes:result.length};
  });
}
