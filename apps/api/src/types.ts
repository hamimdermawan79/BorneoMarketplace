import type { FastifyReply, FastifyRequest } from 'fastify';
import { pool } from './database/client.js';

export type Role = 'SUPERADMIN' | 'ADMIN' | 'BUYER';
export type AuthUser = { id: string; role: Role; organizationId: string | null; email: string };

declare module '@fastify/jwt' {
  interface FastifyJWT { user: AuthUser; payload: AuthUser }
}

export async function authenticate(request: FastifyRequest) { await request.jwtVerify(); const user=(await pool.query('SELECT role,active FROM users WHERE id=$1',[request.user.id])).rows[0];if(!user?.active||user.role!==request.user.role)throw Object.assign(new Error('Sesi tidak berlaku. Silakan masuk kembali.'),{statusCode:401}); }
export function allow(...roles: Role[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    await authenticate(request);
    if (!roles.includes(request.user.role)) return reply.code(403).send({ message: 'Akses tidak diizinkan.' });
  };
}
