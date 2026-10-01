import pg from 'pg';
import { config } from '../config.js';

export const pool = new pg.Pool({ connectionString: config.DATABASE_URL, max: 10,
  connectionTimeoutMillis: 5000, idleTimeoutMillis: 30000,
  statement_timeout: 15000, lock_timeout: 5000, idle_in_transaction_session_timeout: 30000,
  application_name: 'borneo-api' });
// An idle connection error must not terminate the API or print connection secrets.
pool.on('error', () => { console.error('Database connection interrupted.'); });

export async function assertRuntimeDatabaseRole() {
  const { rows } = await pool.query(`SELECT r.rolsuper,r.rolcreatedb,r.rolcreaterole,r.rolbypassrls,
    pg_has_role(current_user,d.datdba,'MEMBER') AS owns_database,
    has_schema_privilege(current_user,'public','CREATE') AS can_create,
    EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relkind='r' AND pg_has_role(current_user,c.relowner,'MEMBER')) AS owns_tables
    FROM pg_roles r CROSS JOIN pg_database d WHERE r.rolname=current_user AND d.datname=current_database()`);
  if (!rows[0] || Object.values(rows[0]).some(Boolean)) {
    throw new Error('API requires a restricted database login, separate from the migration owner. Run db:secure.');
  }
}

export async function withTransaction<T>(work: (client: pg.PoolClient) => Promise<T>) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
