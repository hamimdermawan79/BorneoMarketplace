import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';

function loadLocalEnv() {
  const directory = process.cwd().replaceAll('\\','/').endsWith('/apps/api') ? process.cwd() : resolve(process.cwd(), 'apps/api');
  for (const filename of ['.env.runtime', '.env']) {
    try {
      const text = readFileSync(resolve(directory, filename), 'utf8');
      for (const line of text.split(/\r?\n/)) {
        const match = line.match(/^([A-Z_]+)=(.*)$/);
        if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2];
      }
    } catch { /* environment variables may be provided by the process */ }
  }
}

// Reload local configuration whenever the API process starts.
loadLocalEnv();

const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().url().refine(value => {
    try { return ['postgres:', 'postgresql:'].includes(new URL(value).protocol); } catch { return false; }
  }),
  JWT_SECRET: z.string().min(32),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  HOST: z.string().default('127.0.0.1'),
  // Enable only when a trusted local reverse proxy is the sole public entry point.
  TRUST_PROXY: z.enum(['off', 'loopback']).default('off'),
  WEB_ORIGIN: z.string().url().default('http://127.0.0.1:5173')
}).superRefine((value, context) => {
  let origin: URL;
  try { origin = new URL(value.WEB_ORIGIN); } catch {
    context.addIssue({ code: 'custom', path: ['WEB_ORIGIN'], message: 'A valid origin is required.' });
    return;
  }
  if (!['http:', 'https:'].includes(origin.protocol) || origin.origin !== value.WEB_ORIGIN) {
    context.addIssue({ code: 'custom', path: ['WEB_ORIGIN'], message: 'Use one HTTP(S) origin without a path.' });
  }
  if (value.NODE_ENV === 'production') {
    if (origin.protocol !== 'https:') context.addIssue({ code: 'custom', path: ['WEB_ORIGIN'], message: 'HTTPS is required in production.' });
    if (value.JWT_SECRET.length < 48 || /change.?me|replace|example|development|demo|test.?secret/i.test(value.JWT_SECRET)) {
      context.addIssue({ code: 'custom', path: ['JWT_SECRET'], message: 'Use a randomly generated production secret of at least 48 characters.' });
    }
  }
});

export function parseConfig(environment: NodeJS.ProcessEnv) {
  const result = configSchema.safeParse(environment);
  if (!result.success) {
    // Do not print Zod input values: these contain database credentials and JWT secrets.
    const fields = [...new Set(result.error.issues.map(issue => issue.path.join('.')))];
    throw new Error(`Invalid API configuration: ${fields.join(', ')}.`);
  }
  return result.data;
}

export const config = parseConfig(process.env);
