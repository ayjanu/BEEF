import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpException,
  HttpStatus,
  Inject,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { RealtimeEvent, SwipeRequest, type Profile, type SwipeResult, type Thread } from '@beef/contracts';
import type { Redis } from 'ioredis';
import { CONFIG, type Config } from '../config.ts';
import { DB, withTx, type Db, type Tx } from '../infra/db.ts';
import { REDIS } from '../infra/redis.ts';
import { CLIENTS, type ServiceClients } from '../infra/clients.ts';
import { CurrentUser, InternalGuard, UserGuard, ZodPipe, requireTier, type AuthedUser } from '../common/http.ts';
import { PROFILE_SELECT, toProfile } from '../profiles/profiles.controller.ts';
import { isBlockedBetween, notBlocked } from '../social/blocks.ts';

export const pairKey = (a: string, b: string) => [a, b].sort().join(':');

/** Finds or creates the one direct thread between two users. Safe under concurrent calls. */
export async function directThread(tx: Tx | Db, a: string, b: string): Promise<string> {
  const key = pairKey(a, b);
  const created = await tx.query(
    `INSERT INTO threads (kind, pair_key) VALUES ('direct', $1) ON CONFLICT (pair_key) DO NOTHING RETURNING id`,
    [key],
  );
  const id: string = created.rows[0]?.id ?? (await tx.query('SELECT id FROM threads WHERE pair_key = $1', [key])).rows[0].id;
  await tx.query(
    `INSERT INTO thread_members (thread_id, user_id) VALUES ($1, $2), ($1, $3) ON CONFLICT DO NOTHING`,
    [id, a, b],
  );
  return id;
}

@Controller('v1')
@UseGuards(UserGuard)
export class MatchController {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(REDIS) private readonly redis: Redis,
    @Inject(CLIENTS) private readonly clients: ServiceClients,
    @Inject(CONFIG) private readonly cfg: Config,
  ) {}

  /**
   * Bronze deck: hard filters only (Spec 03 "Swipe deck", step 1), newest first.
   * Silver moves candidate generation to the Go matchmaking service with H3
   * distance and the affinity + competitive-fit score.
   */
  @Get('swipe/deck')
  async deck(@CurrentUser() user: AuthedUser, @Query('limit') limitRaw?: string): Promise<Profile[]> {
    requireTier(user, 'V1');
    const limit = Math.min(Math.max(Number(limitRaw) || 20, 1), 50);
    const rows = (
      await this.db.query(
        `${PROFILE_SELECT}
         JOIN profiles me ON me.user_id = $1
         WHERE p.user_id <> $1
           AND u.status = 'active'
           AND u.tier <> 'V0'
           AND p.intents && me.intents
           AND ${notBlocked('$1', 'p.user_id')}
           AND NOT EXISTS (
             SELECT 1 FROM swipes s
             WHERE s.swiper_id = $1 AND s.target_id = p.user_id AND s.created_at > now() - interval '30 days')
         ORDER BY p.updated_at DESC
         LIMIT $2`,
        [user.id, limit],
      )
    ).rows;
    return rows.map(toProfile);
  }

  @Post('swipe')
  async swipe(
    @CurrentUser() user: AuthedUser,
    @Body(new ZodPipe(SwipeRequest)) body: SwipeRequest,
  ): Promise<SwipeResult> {
    requireTier(user, 'V1');
    if (body.targetId === user.id) throw new ForbiddenException({ error: 'cannot_swipe_self' });

    if (body.direction === 'right') {
      // Daily right-swipe cap for the free tier (Spec 05). Silver: Pro is unlimited.
      const day = new Date().toISOString().slice(0, 10);
      const key = `swipes:right:${user.id}:${day}`;
      const n = await this.redis.incr(key);
      if (n === 1) await this.redis.expire(key, 60 * 60 * 26);
      if (n > this.cfg.FREE_DAILY_RIGHT_SWIPES) {
        throw new HttpException({ error: 'daily_swipe_limit' }, HttpStatus.TOO_MANY_REQUESTS);
      }
    }

    const result = await withTx(this.db, async (tx) => {
      const target = await tx.query(`SELECT 1 FROM users WHERE id = $1 AND status = 'active'`, [body.targetId]);
      if (target.rowCount === 0 || (await isBlockedBetween(tx, user.id, body.targetId))) {
        throw new NotFoundException({ error: 'not_found' });
      }
      await tx.query(
        `INSERT INTO swipes (swiper_id, target_id, direction) VALUES ($1, $2, $3)
         ON CONFLICT (swiper_id, target_id) DO UPDATE SET direction = EXCLUDED.direction, created_at = now()`,
        [user.id, body.targetId, body.direction],
      );
      if (body.direction === 'left') return { matched: false, threadId: null };
      const reverse = await tx.query(
        `SELECT 1 FROM swipes WHERE swiper_id = $1 AND target_id = $2 AND direction = 'right'`,
        [body.targetId, user.id],
      );
      if (reverse.rowCount === 0) return { matched: false, threadId: null };
      return { matched: true, threadId: await directThread(tx, user.id, body.targetId) };
    });

    if (result.matched) {
      await this.clients.notify([user.id], RealtimeEvent.mutualMatch, { threadId: result.threadId, withUserId: body.targetId });
      await this.clients.notify([body.targetId], RealtimeEvent.mutualMatch, { threadId: result.threadId, withUserId: user.id });
    }
    return result;
  }

  @Get('threads')
  async threads(@CurrentUser() user: AuthedUser): Promise<Thread[]> {
    const rows = (
      await this.db.query(
        `SELECT t.id, t.kind, t.created_at,
                json_agg(json_build_object('userId', m.user_id, 'displayName', coalesce(p.display_name, 'Player'))) AS members
         FROM threads t
         JOIN thread_members mine ON mine.thread_id = t.id AND mine.user_id = $1
         JOIN thread_members m ON m.thread_id = t.id
         LEFT JOIN profiles p ON p.user_id = m.user_id
         WHERE NOT EXISTS (
           SELECT 1 FROM thread_members o JOIN blocks b
             ON (b.blocker = $1 AND b.blocked = o.user_id) OR (b.blocked = $1 AND b.blocker = o.user_id)
           WHERE o.thread_id = t.id)
         GROUP BY t.id
         ORDER BY t.created_at DESC`,
        [user.id],
      )
    ).rows;
    return rows.map((r) => ({ id: r.id, kind: r.kind, members: r.members, createdAt: r.created_at.toISOString() }));
  }
}

/** Called by the chat service to authorize a user joining a thread channel. */
@Controller('internal')
@UseGuards(InternalGuard)
export class InternalThreadsController {
  constructor(@Inject(DB) private readonly db: Db) {}

  @Get('threads/:id/members')
  async members(@Param('id', ParseUUIDPipe) id: string): Promise<{ userIds: string[] }> {
    const rows = (await this.db.query('SELECT user_id FROM thread_members WHERE thread_id = $1', [id])).rows;
    if (rows.length === 0) throw new NotFoundException({ error: 'not_found' });
    const userIds: string[] = rows.map((r) => r.user_id);
    // A block closes the thread for both people: chat refuses to join or deliver.
    const blocked = await this.db.query(
      'SELECT 1 FROM blocks WHERE blocker = ANY($1) AND blocked = ANY($1) LIMIT 1',
      [userIds],
    );
    if ((blocked.rowCount ?? 0) > 0) throw new ForbiddenException({ error: 'thread_closed' });
    return { userIds };
  }
}
