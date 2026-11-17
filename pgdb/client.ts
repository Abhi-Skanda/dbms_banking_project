import { Pool, PoolClient, QueryResultRow, types } from 'pg';

// Return DATE columns as plain 'YYYY-MM-DD' strings (avoids timezone shifts, e.g. in IST)
types.setTypeParser(types.builtins.DATE, (v) => v);

// Reuse one pool across Next.js hot reloads in dev
const globalForPg = globalThis as unknown as { pgPool?: Pool };

export const pool =
  globalForPg.pgPool ?? new Pool({ connectionString: process.env.DATABASE_URL });

if (process.env.NODE_ENV !== 'production') globalForPg.pgPool = pool;

export async function query<T extends QueryResultRow = any>(
  text: string,
  params: unknown[] = []
): Promise<T[]> {
  const res = await pool.query<T>(text, params);
  return res.rows;
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
