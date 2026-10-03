import type {FastifyInstance} from 'fastify';
import {z} from 'zod';
import {pool,withTransaction} from '../database/client.js';
import {allow} from '../types.js';
import {convertToWebp} from '../images/convert.js';

const httpsUrl=z.string().trim().max(2048).url().refine(value=>{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password},'Gunakan tautan HTTPS tanpa username/password.');
const thumbnailInput=z.union([httpsUrl,z.string().max(700000).regex(/^data:image\/webp;base64,[A-Za-z0-9+/]+={0,2}$/)]);
export const newsInput=z.object({headline:z.string().trim().min(3).max(180),thumbnail:thumbnailInput.optional(),destination:httpsUrl,active:z.boolean().default(true)}).strict();
export const priceInput=newsInput.extend({thumbnail:z.union([z.literal(''),thumbnailInput]).optional()});
const idInput=z.object({id:z.string().uuid()});
const newsColumns=`id,headline,CASE WHEN thumbnail LIKE 'data:%' THEN '/api/website/news/'||id::text||'/thumbnail' ELSE thumbnail END AS thumbnail,destination,active,created_at AS "createdAt",updated_at AS "updatedAt"`;
const priceColumns=newsColumns.replace('/website/news/','/website/prices/');
const missing=()=>Object.assign(new Error('Konten tidak ditemukan.'),{statusCode:404});
async function normalizedThumbnail(value:string|undefined){
  if(!value||!value.startsWith('data:'))return value;
  const output=await convertToWebp(Buffer.from(value.split(',')[1],'base64'));
  if(output.length>500000)throw Object.assign(new Error('Thumbnail terlalu besar. Gunakan gambar lebih sederhana atau URL gambar HTTPS.'),{statusCode:400});
  return `data:image/webp;base64,${output.toString('base64')}`;
}
export async function landingContentRoutes(app:FastifyInstance){
  app.get('/website/content',async()=>{
    const [news,prices]=await Promise.all([pool.query(`SELECT ${newsColumns} FROM landing_news WHERE active ORDER BY created_at DESC,id LIMIT 50`),pool.query(`SELECT ${priceColumns} FROM landing_prices WHERE active ORDER BY created_at DESC,id LIMIT 3`)]);
    return {news:news.rows,prices:prices.rows};
  });
  for(const kind of ['news','prices'] as const)app.get(`/website/${kind}/:id/thumbnail`,async(request,reply)=>{
    const {id}=idInput.parse(request.params);
    const row=(await pool.query(`SELECT thumbnail FROM ${kind==='news'?'landing_news':'landing_prices'} WHERE id=$1 AND active AND thumbnail LIKE 'data:image/webp;base64,%'`,[id])).rows[0];
    if(!row)throw missing();
    return reply.type('image/webp').header('Cache-Control','no-store').send(Buffer.from(row.thumbnail.split(',')[1],'base64'));
  });
  app.get('/management/content',{preHandler:allow('SUPERADMIN')},async()=>{
    const [news,prices]=await Promise.all([pool.query(`SELECT ${newsColumns} FROM landing_news ORDER BY created_at DESC,id LIMIT 100`),pool.query(`SELECT ${priceColumns} FROM landing_prices ORDER BY created_at DESC,id LIMIT 100`)]);
    return {news:news.rows,prices:prices.rows};
  });
  // Draft thumbnails are only available to the editor.
  for(const kind of ['news','prices'] as const)app.get(`/management/content/${kind}/:id/thumbnail`,{preHandler:allow('SUPERADMIN')},async request=>{
    const {id}=idInput.parse(request.params);const row=(await pool.query(`SELECT thumbnail FROM ${kind==='news'?'landing_news':'landing_prices'} WHERE id=$1`,[id])).rows[0];
    if(!row)throw missing();return row;
  });
  for(const kind of ['news','prices'] as const){
    const table=kind==='news'?'landing_news':'landing_prices';
    const columns=kind==='news'?newsColumns:priceColumns;
    for(const method of ['POST','PUT'] as const){
      app.route({method,url:`/management/content/${kind}${method==='PUT'?'/:id':''}`,preHandler:allow('SUPERADMIN'),config:{rateLimit:{max:30,timeWindow:'1 minute'}},handler:async request=>{
        const id=method==='PUT'?idInput.parse(request.params).id:null;
        const input=kind==='news'?newsInput.parse(request.body):priceInput.parse(request.body);
        const thumbnail=await normalizedThumbnail(input.thumbnail);
        if(method==='POST'&&kind==='news'&&!thumbnail)throw Object.assign(new Error('Thumbnail berita wajib diisi.'),{statusCode:400});
        return withTransaction(async client=>{
          if(method==='POST'){
            await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',[`landing-content-${kind}`]);
            const count=Number((await client.query(`SELECT count(*) AS count FROM ${table}`)).rows[0]?.count||0);
            if(count>=50)throw Object.assign(new Error('Maksimal 50 entri per bagian. Hapus entri lama sebelum menambahkan konten baru.'),{statusCode:409});
          }
          let result;
          result=method==='POST'?await client.query(`INSERT INTO ${table}(headline,thumbnail,destination,active) VALUES($1,$2,$3,$4) RETURNING ${columns}`,[input.headline,thumbnail??'',input.destination,input.active]):await client.query(`UPDATE ${table} SET headline=$1,thumbnail=COALESCE($2,thumbnail),destination=$3,active=$4,updated_at=now() WHERE id=$5 RETURNING ${columns}`,[input.headline,thumbnail??null,input.destination,input.active,id]);
          if(!result.rows[0])throw missing();
          // Never copy image data into the audit log.
          const changes={...input,thumbnail:thumbnail===undefined?'unchanged':'updated'};
          await client.query('INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,changes) VALUES($1,$2,$3,$4,$5)',[request.user.id,method==='POST'?'CREATE':'UPDATE',kind==='news'?'LANDING_NEWS':'LANDING_PRICE',result.rows[0].id,JSON.stringify(changes)]);
          return result.rows[0];
        });
      }});
    }
    app.delete(`/management/content/${kind}/:id`,{preHandler:allow('SUPERADMIN')},async request=>{
      const {id}=idInput.parse(request.params);
      return withTransaction(async client=>{
        const result=await client.query(`DELETE FROM ${table} WHERE id=$1 RETURNING id`,[id]);if(!result.rows[0])throw missing();
        await client.query("INSERT INTO audit_logs(actor_id,action,entity_type,entity_id) VALUES($1,'DELETE',$2,$3)",[request.user.id,kind==='news'?'LANDING_NEWS':'LANDING_PRICE',id]);
        return {deleted:true};
      });
    });
  }
}
