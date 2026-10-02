import { describe, expect, it, vi } from 'vitest';
vi.hoisted(() => {
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
  process.env.JWT_SECRET = 'test-only-secret-at-least-thirty-two-characters';
  process.env.NODE_ENV = 'test';
});
import { parseConfig } from './config.js';

const production = {
  NODE_ENV: 'production', DATABASE_URL: 'postgresql://runtime:secret@localhost:5432/borneo',
  JWT_SECRET: '4f27e68d16f6d141541cb98dc4cae5a103296e2c525dac1b4c46877ec567c55b',
  WEB_ORIGIN: 'https://market.example'
};

describe('production configuration', () => {
  it('accepts one secure web origin and defaults to no proxy trust', () => {
    expect(parseConfig(production).TRUST_PROXY).toBe('off');
  });

  it.each([
    { WEB_ORIGIN: '*' }, { WEB_ORIGIN: 'http://market.example' },
    { WEB_ORIGIN: 'https://market.example/path' }, { WEB_ORIGIN: 'https://user:pass@market.example' },
    { JWT_SECRET: 'replace-this-with-a-long-production-secret-please-1234567890' },
    { JWT_SECRET: 'x'.repeat(32) }, { DATABASE_URL: 'https://database.example' }, { TRUST_PROXY: 'true' }
  ])('rejects unsafe production configuration: %o', overrides => {
    expect(() => parseConfig({ ...production, ...overrides })).toThrow('Invalid API configuration:');
  });

  it('never includes credential values in configuration error messages', () => {
    try {
      parseConfig({ ...production, JWT_SECRET: 'super-private-secret', DATABASE_URL: 'private-db-password' });
      throw new Error('Expected configuration validation to reject credentials');
    } catch (error) {
      expect(String(error)).not.toMatch(/super-private-secret|private-db-password/);
      expect(String(error)).toContain('JWT_SECRET');
    }
  });
});
