import type { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { pool } from '../database/client.js';
import { authenticate } from '../types.js';

export async function authRoutes(app: FastifyInstance) {
  app.post('/login', async (request, reply) => {
    const input = z.object({ email: z.string().email(), password: z.string().min(8) }).parse(request.body);
    const result = await pool.query(`SELECT u.id,u.organization_id,u.full_name,u.email,u.password_hash,u.role,u.active,o.name AS organization,o.phone,o.address,o.gmaps_url AS "gmapsUrl"
      FROM users u LEFT JOIN organizations o ON o.id=u.organization_id WHERE lower(u.email)=lower($1)`, [input.email]);
    const user = result.rows[0];
    if (!user?.active || !(await bcrypt.compare(input.password, user.password_hash))) return reply.code(401).send({ message: 'Email atau password tidak sesuai.' });
    const payload = { id: user.id, role: user.role, organizationId: user.organization_id, email: user.email };
    return { token: app.jwt.sign(payload, { expiresIn: '8h' }), user: { ...payload, name: user.full_name,organization:user.organization,phone:user.phone,address:user.address,gmapsUrl:user.gmapsUrl } };
  });

  app.get('/me', { preHandler: authenticate }, async request => {
    const result = await pool.query(`SELECT u.id,u.full_name AS name,u.email,u.role,u.organization_id AS "organizationId",o.name AS organization,o.phone,o.address,o.gmaps_url AS "gmapsUrl"
      FROM users u LEFT JOIN organizations o ON o.id=u.organization_id WHERE u.id=$1`, [request.user.id]);
    return result.rows[0];
  });
}
