import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';

function loadLocalEnv() {
  try {
    let path = resolve(process.cwd(), '.env');
    if (!process.cwd().replaceAll('\\','/').endsWith('/apps/api')) path = resolve(process.cwd(), 'apps/api/.env');
    const text = readFileSync(path, 'utf8');
    for (const line of text.split(/\r?\n/)) {
      const match = line.match(/^([A-Z_]+)=(.*)$/);
      if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
    }
  } catch { /* environment variables may be provided by the process */ }
}

// Reload local configuration whenever the API process starts.
loadLocalEnv();

export const config = z.object({
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  PORT: z.coerce.number().int().positive().default(4000),
  WEB_ORIGIN: z.string().default('http://127.0.0.1:5173')
}).parse(process.env);
