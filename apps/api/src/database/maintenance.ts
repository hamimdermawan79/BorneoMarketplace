import pg from 'pg';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Imported only by maintenance CLIs, never by the HTTP server.
export const apiDirectory = fileURLToPath(new URL('../../', import.meta.url));
export function maintenanceUrl() {
  if (process.env.MIGRATION_DATABASE_URL) return process.env.MIGRATION_DATABASE_URL;
  if (process.env.NODE_ENV === 'production') throw new Error('Set MIGRATION_DATABASE_URL for maintenance only.');
  const content = readFileSync(new URL('../../.env', import.meta.url), 'utf8');
  const url = content.match(/^DATABASE_URL=(.*)$/m)?.[1].trim();
  if (!url) throw new Error('Maintenance database URL is missing.');
  return url;
}
export function maintenancePool() {
  return new pg.Pool({connectionString:maintenanceUrl(),max:2,connectionTimeoutMillis:5000,application_name:'borneo-maintenance'});
}
