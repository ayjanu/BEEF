import { Inject, Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { DB, type Db, type Tx } from '../infra/db.ts';
import { REDIS } from '../infra/redis.ts';

/**
 * SQL predicate: no block in either direction between the user in parameter
 * `$me` and the column `other`. Use in every query that shows one person to
 * another (deck, feed, comments, followers).
 */
export const notBlocked = (me: string, other: string) => `NOT EXISTS (
  SELECT 1 FROM blocks b
  WHERE (b.blocker = ${me} AND b.blocked = ${other}) OR (b.blocker = ${other} AND b.blocked = ${me}))`;

/** Same check for a set of users (every member of a post or a thread). */
export const noneBlocked = (me: string, others: string) => `NOT EXISTS (
  SELECT 1 FROM blocks b
  WHERE (b.blocker = ${me} AND b.blocked = ANY(${others})) OR (b.blocked = ${me} AND b.blocker = ANY(${others})))`;

export async function isBlockedBetween(db: Db | Tx, a: string, b: string): Promise<boolean> {
  const r = await db.query(
    `SELECT 1 FROM blocks WHERE (blocker = $1 AND blocked = $2) OR (blocker = $2 AND blocked = $1) LIMIT 1`,
    [a, b],
  );
  return (r.rowCount ?? 0) > 0;
}

/** Redis set of users this user must never meet, read by the Go matchmaker. */
export const blockKey = (userId: string) => `beef:blocks:${userId}`;

/** Re-asserts both directions of a block in the matchmaker's Redis sets. */
export async function cacheBlock(redis: Redis, a: string, b: string): Promise<void> {
  await redis.multi().sadd(blockKey(a), b).sadd(blockKey(b), a).exec();
}

/**
 * Rebuilds the matchmaker's block sets from Postgres (the source of truth) at
 * startup, so a Redis flush or failover cannot let blocked players meet in the
 * queue. Additive and idempotent; runs on every replica.
 */
@Injectable()
export class BlockCacheWarmer implements OnApplicationBootstrap {
  private readonly log = new Logger('BlockCacheWarmer');
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  async onApplicationBootstrap() {
    try {
      const rows = (await this.db.query('SELECT blocker, blocked FROM blocks')).rows;
      for (let i = 0; i < rows.length; i += 500) {
        const multi = this.redis.multi();
        for (const r of rows.slice(i, i + 500)) multi.sadd(blockKey(r.blocker), r.blocked).sadd(blockKey(r.blocked), r.blocker);
        await multi.exec();
      }
      this.log.log(`block cache warmed (${rows.length} blocks)`);
    } catch (err) {
      this.log.error(`block cache warm failed: ${(err as Error).message}`);
    }
  }
}
