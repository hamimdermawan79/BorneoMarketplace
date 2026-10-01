import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { maintenancePool } from './maintenance.js';

const pool=maintenancePool();
const migrationLock=await pool.connect();
try {
await migrationLock.query("SELECT pg_advisory_lock(hashtext('borneo-schema-migrations'))");

const directory = fileURLToPath(new URL('./migrations/', import.meta.url));
await pool.query('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
for (const name of readdirSync(directory).filter(file => file.endsWith('.sql')).sort()) {
  const exists = await pool.query('SELECT 1 FROM schema_migrations WHERE name = $1', [name]);
  if (exists.rowCount) continue;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(readFileSync(resolve(directory, name), 'utf8'));
    await client.query('INSERT INTO schema_migrations(name) VALUES($1)', [name]);
    await client.query('COMMIT');
    console.log(`Applied ${name}`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}
} finally {
  try { await migrationLock.query("SELECT pg_advisory_unlock(hashtext('borneo-schema-migrations'))"); }
  finally { migrationLock.release(); await pool.end(); }
}
