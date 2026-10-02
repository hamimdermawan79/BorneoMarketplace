import type { FastifyReply, FastifyRequest } from 'fastify';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { pool } from './database/client.js';
import { config } from './config.js';

export type Role = 'SUPERADMIN' | 'ADMIN' | 'BUYER';
export type AuthUser = { id: string; role: Role; organizationId: string | null; email: string | null };
export type AuthClaims = AuthUser & { credentialVersion: string };

const claimsSchema = z.object({
  id: z.string().uuid(),
  role: z.enum(['SUPERADMIN', 'ADMIN', 'BUYER']),
  credentialVersion: z.string().regex(/^[a-f0-9]{64}$/)
});

export function credentialVersion(passwordHash: string) {
  return createHmac('sha256', config.JWT_SECRET).update(passwordHash).digest('hex');
}

declare module '@fastify/jwt' {
  interface FastifyJWT { user: AuthUser; payload: AuthClaims }
}

export async function authenticate(request: FastifyRequest) {
  const invalidSession = () => Object.assign(new Error('Sesi tidak berlaku. Silakan masuk kembali.'), { statusCode: 401 });
  let claims: z.infer<typeof claimsSchema>;
  try {
    claims = claimsSchema.parse(await request.jwtVerify());
  } catch {
    throw invalidSession();
  }
  const user = (await pool.query(`SELECT u.id,u.role,u.active,u.organization_id,u.email,u.password_hash,o.active AS organization_active
    FROM users u LEFT JOIN organizations o ON o.id=u.organization_id WHERE u.id=$1`, [claims.id])).rows[0];
  if (!user?.active || user.role !== claims.role ||
      (user.organization_id && !user.organization_active) ||
      (user.role !== 'SUPERADMIN' && !user.organization_id) ||
      !timingSafeEqual(Buffer.from(claims.credentialVersion, 'hex'), Buffer.from(credentialVersion(user.password_hash), 'hex'))) {
    throw invalidSession();
  }
  // Authorization always uses the current database principal, not stale token tenancy.
  request.user = { id: user.id, role: user.role, organizationId: user.organization_id, email: user.email };
}
export function allow(...roles: Role[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    await authenticate(request);
    if (!roles.includes(request.user.role)) return reply.code(403).send({ message: 'Akses tidak diizinkan.' });
  };
}
