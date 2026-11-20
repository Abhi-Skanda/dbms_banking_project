import { AsyncLocalStorage } from 'node:async_hooks';
import { Pool, PoolClient, QueryResultRow, types } from 'pg';

// Return DATE columns as plain 'YYYY-MM-DD' strings (avoids timezone shifts, e.g. in IST)
types.setTypeParser(types.builtins.DATE, (v) => v);

// Reuse one pool (and one context store) across Next.js hot reloads in dev
const g = globalThis as unknown as { pgPool?: Pool; reqUser?: AsyncLocalStorage<string> };

export const pool = g.pgPool ?? new Pool({ connectionString: process.env.DATABASE_URL });
if (process.env.NODE_ENV !== 'production') g.pgPool = pool;

/** Holds the username of whoever is making the current API request. */
export const requestUser = g.reqUser ?? new AsyncLocalStorage<string>();
g.reqUser = requestUser;

/**
 * Run a query. With audit=true (used for every write) the statement runs in a
 * transaction that first sets the session variable app.username, so database
 * triggers record WHO made the change in audit_log.changed_by.
 */
export async function query<T extends QueryResultRow = any>(
  text: string,
  params: unknown[] = [],
  audit = false
): Promise<T[]> {
  const who = audit ? requestUser.getStore() : undefined;
  if (!who) return (await pool.query<T>(text, params)).rows;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SELECT set_config('app.username', $1, true)`, [who]);
    const res = await client.query<T>(text, params);
    await client.query('COMMIT');
    return res.rows;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

// For multi-statement transactions written in JS (BEGIN ... COMMIT/ROLLBACK)
export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
