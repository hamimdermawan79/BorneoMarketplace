import type { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { pool } from '../database/client.js';
import { config } from '../config.js';
import { authenticate, credentialVersion } from '../types.js';

const loginSchema = z.object({
  email: z.string().trim().min(1).max(254).optional(),
  identifier: z.string().trim().min(1).max(254).optional(),
  password: z.string().min(8).max(72).refine(value => Buffer.byteLength(value, 'utf8') <= 72)
}).strict().refine(value=>Boolean(value.identifier||value.email));
// Comparing a dummy hash gives unknown accounts the same password-work path.
const dummyHash = bcrypt.hashSync('not-a-real-account-password', 12);

export async function authRoutes(app: FastifyInstance) {
  app.post('/login', { bodyLimit: 4096, config: { rateLimit: { max: 20, timeWindow: '15 minutes' } } }, async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(401).send({ message: 'Username/email atau password tidak sesuai.' });
    const input = parsed.data;
    const result = await pool.query(`SELECT u.id,u.organization_id,u.full_name,u.username,u.email,u.password_hash,u.role,u.active,o.active AS organization_active,o.name AS organization,o.phone,o.address,o.gmaps_url AS "gmapsUrl"
      FROM users u LEFT JOIN organizations o ON o.id=u.organization_id WHERE lower(u.email)=lower($1) OR u.username=lower($1)`, [input.identifier||input.email]);
    const user = result.rows[0];
    const passwordMatches = await bcrypt.compare(input.password, user?.password_hash || dummyHash);
    if (!user?.active || !passwordMatches || (user.organization_id && !user.organization_active) || (user.role !== 'SUPERADMIN' && !user.organization_id)) {
      return reply.code(401).send({ message: 'Username/email atau password tidak sesuai.' });
    }
    if (config.NODE_ENV === 'production' && await bcrypt.compare('Demo123!', user.password_hash)) {
      return reply.code(401).send({ message: 'Username/email atau password tidak sesuai.' });
    }
    const payload = { id: user.id, role: user.role, organizationId: user.organization_id, email: user.email, username:user.username };
    return { token: app.jwt.sign({ ...payload, credentialVersion: credentialVersion(user.password_hash) }, { expiresIn: user.role==='SUPERADMIN'?'1d':'30d' }), user: { ...payload, name: user.full_name,organization:user.organization,phone:user.phone,address:user.address,gmapsUrl:user.gmapsUrl } };
  });

  app.get('/me', { preHandler: authenticate }, async request => {
    const result = await pool.query(`SELECT u.id,u.full_name AS name,u.username,u.email,u.role,u.organization_id AS "organizationId",o.name AS organization,o.phone,o.address,o.gmaps_url AS "gmapsUrl"
      FROM users u LEFT JOIN organizations o ON o.id=u.organization_id WHERE u.id=$1`, [request.user.id]);
    return result.rows[0];
  });
}
