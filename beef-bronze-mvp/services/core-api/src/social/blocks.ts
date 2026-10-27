import type { Db, Tx } from '../infra/db.ts';

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
