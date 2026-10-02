import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';

const database = vi.hoisted(() => ({ query: vi.fn(), assertRole: vi.fn() }));
vi.mock('./config.js', () => ({ config: {
  NODE_ENV: 'test', JWT_SECRET: 'test-only-secret-at-least-thirty-two-characters',
  WEB_ORIGIN: 'http://127.0.0.1:5173', TRUST_PROXY: 'off', HOST: '127.0.0.1', PORT: 4000
} }));
vi.mock('./database/client.js', () => ({
  pool: { query: database.query, end: vi.fn() },
  assertRuntimeDatabaseRole: database.assertRole,
  withTransaction: vi.fn(() => { throw new Error('No real database access is permitted in this test.'); })
}));

import { buildApp } from './server.js';
import { allow, authenticate, credentialVersion } from './types.js';
import { config } from './config.js';

const userId = '12345678-1234-4234-8234-123456789abc';
const organizationId = '22345678-1234-4234-8234-123456789abc';
const previousOrganizationId = '32345678-1234-4234-8234-123456789abc';
const passwordHash = bcrypt.hashSync('A-valid-password', 4);
const user = {
  id: userId, email: 'dapur@example.test', full_name: 'Dapur Uji', role: 'BUYER', active: true,
  organization_id: organizationId, organization_active: true, password_hash: passwordHash
};
let app: FastifyInstance;

beforeEach(async () => {
  database.query.mockReset().mockResolvedValue({ rows: [] });
  app = await buildApp();
  app.get('/test/principal', { preHandler: authenticate }, request => request.user);
  app.get('/test/admin', { preHandler: allow('ADMIN', 'SUPERADMIN') }, async () => ({ allowed: true }));
});
afterEach(async () => { config.NODE_ENV = 'test'; await app.close(); });

function bearer(overrides = {}) {
  return { authorization: `Bearer ${app.jwt.sign({
    id: userId, role: 'BUYER', organizationId: previousOrganizationId,
    email: 'old@example.test', credentialVersion: credentialVersion(passwordHash), ...overrides
  }, { expiresIn: '1h' })}` };
}

describe('authentication boundary', () => {
  it('rejects missing and malformed tokens before database access', async () => {
    expect((await app.inject('/test/principal')).statusCode).toBe(401);
    expect((await app.inject({ url: '/test/principal', headers: { authorization: 'Bearer malformed' } })).statusCode).toBe(401);
    expect((await app.inject({ url: '/test/principal', headers: bearer({ id: 'not-a-uuid' }) })).statusCode).toBe(401);
    expect(database.query).not.toHaveBeenCalled();
  });

  it('rehydrates organization and email from the database without exposing credential claims', async () => {
    database.query.mockResolvedValue({ rows: [user] });
    const response = await app.inject({ url: '/test/principal', headers: bearer() });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ id: userId, role: 'BUYER', organizationId, email: user.email });
    expect(response.body).not.toContain('credentialVersion');
    expect(response.body).not.toContain(passwordHash);
  });

  it.each([
    { active: false }, { organization_active: false }, { organization_id: null },
    { role: 'SUPERADMIN' }, { password_hash: 'changed-password-hash' }
  ])('revokes sessions when user scope or credentials change: %o', async changes => {
    database.query.mockResolvedValue({ rows: [{ ...user, ...changes }] });
    expect((await app.inject({ url: '/test/principal', headers: bearer() })).statusCode).toBe(401);
  });

  it('rejects deleted accounts and buyer access to administrative routes', async () => {
    expect((await app.inject({ url: '/test/principal', headers: bearer() })).statusCode).toBe(401);
    database.query.mockResolvedValue({ rows: [user] });
    expect((await app.inject({ url: '/test/admin', headers: bearer() })).statusCode).toBe(403);
  });

  it('does not expose SQL details when a database error occurs', async () => {
    database.query.mockRejectedValue(new Error('secret database password and internal SQL'));
    const response = await app.inject({ url: '/test/principal', headers: bearer() });
    expect(response.statusCode).toBe(500);
    expect(response.body).not.toMatch(/password|SQL/);
  });
});

describe('login and API protections', () => {
  it('issues a revocable token without returning the password hash', async () => {
    database.query.mockResolvedValue({ rows: [user] });
    const response = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: user.email, password: 'A-valid-password' } });
    expect(response.statusCode).toBe(200);
    const claims = app.jwt.verify<{ credentialVersion: string }>(response.json().token);
    expect(claims.credentialVersion).toBe(credentialVersion(passwordHash));
    expect(response.body).not.toContain(passwordHash);
    expect(response.headers['cache-control']).toBe('no-store');
  });

  it('uses the same login response for invalid, unknown, disabled and inactive-organization accounts', async () => {
    const payload = { email: user.email, password: 'A-valid-password' };
    const unknown = await app.inject({ method: 'POST', url: '/api/auth/login', payload });
    database.query.mockResolvedValue({ rows: [{ ...user, active: false }] });
    const disabled = await app.inject({ method: 'POST', url: '/api/auth/login', payload });
    database.query.mockResolvedValue({ rows: [{ ...user, organization_active: false }] });
    const inactiveOrg = await app.inject({ method: 'POST', url: '/api/auth/login', payload });
    const invalid = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { ...payload, password: 'x' } });
    for (const response of [unknown, disabled, inactiveOrg, invalid]) {
      expect(response.statusCode).toBe(401);
      expect(response.json()).toEqual({ message: 'Username/email atau password tidak sesuai.' });
    }
  });

  it('bounds login strings by bytes and the total request body before DB access', async () => {
    for (const password of ['a'.repeat(73), 'é'.repeat(37)]) {
      expect((await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: user.email, password } })).statusCode).toBe(401);
    }
    expect((await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: user.email, password: 'x'.repeat(5000) } })).statusCode).toBe(413);
    expect(database.query).not.toHaveBeenCalled();
  });

  it('refuses the seeded demo password in production', async () => {
    config.NODE_ENV = 'production';
    database.query.mockResolvedValue({ rows: [{ ...user, password_hash: bcrypt.hashSync('Demo123!', 4) }] });
    const response = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: user.email, password: 'Demo123!' } });
    expect(response.statusCode).toBe(401);
    expect(response.json()).not.toHaveProperty('token');
  });

  it('limits login attempts even when X-Forwarded-For is forged', async () => {
    for (let index = 0; index < 20; index++) {
      const response = await app.inject({ method: 'POST', url: '/api/auth/login', headers: { 'x-forwarded-for': `192.0.2.${index + 1}` }, payload: {} });
      expect(response.statusCode).toBe(401);
    }
    const limited = await app.inject({ method: 'POST', url: '/api/auth/login', payload: {} });
    expect(limited.statusCode).toBe(429);
    expect(limited.headers['retry-after']).toBeDefined();
  });

  it('limits API traffic and sends protective headers without allowing an untrusted CORS origin', async () => {
    const response = await app.inject({ url: '/api/health', headers: { origin: 'https://attacker.example' } });
    expect(response.headers['access-control-allow-origin']).not.toBe('https://attacker.example');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-frame-options']).toBe('DENY');
    expect(response.headers['cache-control']).toBe('no-store');
    for (let index = 1; index < 300; index++) expect((await app.inject('/api/health')).statusCode).toBe(200);
    expect((await app.inject('/api/health')).statusCode).toBe(429);
  });
});
