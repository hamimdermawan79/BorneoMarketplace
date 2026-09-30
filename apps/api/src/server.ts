import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import { ZodError } from 'zod';
import { config } from './config.js';
import { pool } from './database/client.js';
import { authRoutes } from './modules/auth.js';
import { catalogRoutes } from './modules/catalog.js';
import { clusterRoutes } from './modules/clusters.js';
import { orderRoutes } from './modules/orders.js';
import { reportRoutes } from './modules/reports.js';
import { managementRoutes } from './modules/management.js';
import { specialRequestRoutes } from './modules/special-requests.js';

const app=Fastify({logger:true});
await app.register(cors,{origin:config.WEB_ORIGIN,credentials:true});
await app.register(jwt,{secret:config.JWT_SECRET});
app.setErrorHandler((error,_request,reply)=>{
  if(error instanceof ZodError)return reply.code(400).send({message:'Data belum lengkap atau tidak valid.',issues:error.issues});
  const known=error as Error&{statusCode?:number};const status=known.statusCode||500;reply.code(status).send({message:status<500?known.message:'Terjadi kesalahan pada server.'});
});
app.get('/api/health',async()=>{await pool.query('SELECT 1');return {status:'ok'};});
await app.register(authRoutes,{prefix:'/api/auth'});await app.register(catalogRoutes,{prefix:'/api'});await app.register(clusterRoutes,{prefix:'/api'});await app.register(orderRoutes,{prefix:'/api'});await app.register(reportRoutes,{prefix:'/api'});
await app.register(managementRoutes,{prefix:'/api'});
await app.register(specialRequestRoutes,{prefix:'/api'});
await app.listen({port:config.PORT,host:'127.0.0.1'});
