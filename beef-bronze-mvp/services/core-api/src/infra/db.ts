import { readFileSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import type { Config } from '../config.ts';

export type Db = pg.Pool;
export type Tx = pg.PoolClient;
export const DB = Symbol('DB');

// Return DATE columns as 'YYYY-MM-DD' strings, not local-midnight Date objects (avoids off-by-one ages).
pg.types.setTypeParser(1082, (v: string) => v);

export function createPool(cfg: Config): pg.Pool {
  return new pg.Pool({
    connectionString: cfg.DATABASE_URL,
    // In AWS: TLS with full certificate verification against the RDS CA bundle baked into the image.
    ssl:
      cfg.DATABASE_SSL === 'require'
        ? { rejectUnauthorized: true, ...(cfg.DATABASE_CA_FILE ? { ca: readFileSync(cfg.DATABASE_CA_FILE, 'utf8') } : {}) }
        : undefined,
    max: 10,
  });
}

export async function withTx<T>(db: Db, fn: (tx: Tx) => Promise<T>): Promise<T> {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const out = await fn(client);
    await client.query('COMMIT');
    return out;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Applies migrations/NNN_*.sql in order, once each, under an advisory lock so
 * several replicas starting together never race.
 */
export async function migrate(db: Db, log: (m: string) => void = console.log): Promise<void> {
  const dir = fileURLToPath(new URL('../../migrations/', import.meta.url));
  const files = (await readdir(dir)).filter((f) => /^\d+_.+\.sql$/.test(f)).sort();
  const client = await db.connect();
  try {
    await client.query('SELECT pg_advisory_lock(7031001)');
    await client.query(
      'CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())',
    );
    const done = new Set((await client.query('SELECT name FROM schema_migrations')).rows.map((r) => r.name));
    for (const file of files) {
      if (done.has(file)) continue;
      const sql = await readFile(dir + file, 'utf8');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
        await client.query('COMMIT');
        log(`migration applied: ${file}`);
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    }
  } finally {
    await client.query('SELECT pg_advisory_unlock(7031001)').catch(() => undefined);
    client.release();
  }
}
