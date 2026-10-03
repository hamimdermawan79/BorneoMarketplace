import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { ZodError } from 'zod';
import { config } from './config.js';
import { pool, assertRuntimeDatabaseRole } from './database/client.js';
import { authRoutes } from './modules/auth.js';
import { catalogRoutes } from './modules/catalog.js';
import { clusterRoutes } from './modules/clusters.js';
import { orderRoutes } from './modules/orders.js';
import { reportRoutes } from './modules/reports.js';
import { managementRoutes } from './modules/management.js';
import { specialRequestRoutes } from './modules/special-requests.js';
import { resetRoutes } from './modules/reset.js';
import { imageRoutes } from './modules/images.js';
import { websiteRoutes } from './modules/website.js';
import {accountRoutes} from './modules/accounts.js';
import {landingContentRoutes} from './modules/landing-content.js';

export async function buildApp() {
  if (config.NODE_ENV === 'production') await assertRuntimeDatabaseRole();
  const app = Fastify({
    logger: config.NODE_ENV === 'test' ? false : {
      redact: { paths: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]', 'password', 'currentPassword', 'newPassword', 'req.body.password', 'req.body.currentPassword', 'req.body.newPassword', 'password_hash', 'token', 'DATABASE_URL', 'JWT_SECRET'], censor: '[REDACTED]' },
      // Avoid query-string secrets in request logs, including unknown URLs.
      serializers: { req: request => ({ method: request.method, url: request.url?.split('?')[0], remoteAddress: request.ip }) }
    },
    trustProxy: config.TRUST_PROXY === 'loopback' ? 'loopback' : false,
    bodyLimit: 1024 * 1024,
    requestTimeout: 30_000,
    connectionTimeout: 10_000
  });
  app.addHook('onRequest', async (_request, reply) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-Frame-Options', 'DENY');
    reply.header('Referrer-Policy', 'no-referrer');
    reply.header('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'; base-uri 'none'");
    reply.header('Cache-Control', 'no-store');
    if (config.NODE_ENV === 'production') reply.header('Strict-Transport-Security', 'max-age=31536000');
  });
  await app.register(cors, { origin: config.WEB_ORIGIN, methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'], allowedHeaders: ['Authorization', 'Content-Type'] });
  await app.register(rateLimit, { global: true, max: 300, timeWindow: '1 minute' });
  await app.register(jwt, { secret: config.JWT_SECRET, sign: { algorithm: 'HS256' }, verify: { algorithms: ['HS256'] } });
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) return reply.code(400).send({
      message: 'Data belum lengkap atau tidak valid.',
      issues: error.issues.map(issue => ({ path: issue.path, message: issue.message }))
    });
    const known = error as Error & { statusCode?: number; code?: string };
    const status = known.statusCode && known.statusCode >= 400 && known.statusCode < 600 ? known.statusCode : 500;
    if (status >= 500) request.log.error({ errorCode: known.code, requestId: request.id }, 'API request failed');
    if (status === 429) return reply.code(429).send({ message: 'Terlalu banyak permintaan. Silakan coba lagi beberapa saat.' });
    if (status === 401) return reply.code(401).send({ message: 'Sesi tidak berlaku. Silakan masuk kembali.' });
    return reply.code(status).send({ message: status < 500 ? known.message : 'Terjadi kesalahan pada server.' });
  });
  app.setNotFoundHandler({ preHandler: app.rateLimit() }, async (_request, reply) => reply.code(404).send({ message: 'Halaman API tidak ditemukan.' }));
  app.get('/api/health', async () => { await pool.query('SELECT 1'); return { status: 'ok' }; });
  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(catalogRoutes, { prefix: '/api' });
  await app.register(imageRoutes, { prefix: '/api' });
  await app.register(clusterRoutes, { prefix: '/api' });
  await app.register(orderRoutes, { prefix: '/api' });
  await app.register(reportRoutes, { prefix: '/api' });
  await app.register(managementRoutes, { prefix: '/api' });
  await app.register(specialRequestRoutes, { prefix: '/api' });
  await app.register(resetRoutes, { prefix: '/api' });
  await app.register(websiteRoutes, { prefix: '/api' });
  await app.register(landingContentRoutes, {prefix:'/api'});
  await app.register(accountRoutes, {prefix:'/api'});
  return app;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const app = await buildApp();
  try {
    await app.listen({ port: config.PORT, host: config.HOST });
  } catch {
    app.log.error('API startup failed. Check server configuration and database availability.');
    process.exitCode = 1;
    await app.close();
    await pool.end();
  }
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, async () => { await app.close(); await pool.end(); });
  }
}
