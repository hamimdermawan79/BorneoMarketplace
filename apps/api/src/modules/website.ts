import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { pool,withTransaction } from '../database/client.js';
import { allow } from '../types.js';

const settingsInput=z.object({
  whatsapp:z.string().trim().max(40).refine(value=>value===''||/^\+?[0-9 ()-]+$/.test(value),'Gunakan nomor WhatsApp yang valid.')
    .transform(value=>{const digits=value.replace(/\D/g,'');return digits.startsWith('0')?'62'+digits.slice(1):digits;})
    .refine(value=>value===''||/^[1-9]\d{7,14}$/.test(value),'Nomor WhatsApp harus memuat kode negara, misalnya 6281234567890.'),
  email:z.union([z.literal(''),z.string().trim().max(254).email()]).transform(value=>value.toLowerCase()),
  instagram:z.string().trim().max(31).refine(value=>value===''||/^@?[a-zA-Z0-9._]{1,30}$/.test(value),'Isi username Instagram, bukan tautan.')
    .transform(value=>value.replace(/^@/,'').toLowerCase()),
  address:z.string().trim().min(3).max(300),
}).strict();

export async function websiteRoutes(app:FastifyInstance){
  // Only intentionally public contact details are exposed here.
  app.get('/website',async()=>{
    return (await pool.query('SELECT whatsapp,email,instagram,address FROM website_settings WHERE id=1')).rows[0];
  });
  app.put('/management/website',{preHandler:allow('SUPERADMIN')},async request=>{
    const input=settingsInput.parse(request.body);
    return withTransaction(async client=>{
      const result=await client.query('UPDATE website_settings SET whatsapp=$1,email=$2,instagram=$3,address=$4,updated_at=now() WHERE id=1 RETURNING whatsapp,email,instagram,address',
        [input.whatsapp,input.email,input.instagram,input.address]);
      await client.query("INSERT INTO audit_logs(actor_id,action,entity_type,changes) VALUES($1,'UPDATE','WEBSITE',$2)",[request.user.id,JSON.stringify(input)]);
      return result.rows[0];
    });
  });
}
