import type { FastifyReply, FastifyRequest } from 'fastify';

export type Role = 'SUPERADMIN' | 'ADMIN' | 'BUYER';
export type AuthUser = { id: string; role: Role; organizationId: string | null; email: string };

declare module '@fastify/jwt' {
  interface FastifyJWT { user: AuthUser; payload: AuthUser }
}

export async function authenticate(request: FastifyRequest) { await request.jwtVerify(); }
export function allow(...roles: Role[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    await request.jwtVerify();
    if (!roles.includes(request.user.role)) return reply.code(403).send({ message: 'Akses tidak diizinkan.' });
  };
}
