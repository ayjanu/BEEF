import {
  Body,
  ConflictException,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  Inject,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  ServiceUnavailableException,
  UnprocessableEntityException,
  UseGuards,
} from '@nestjs/common';
import { getRules, registry } from '@beef/game-rules';
import {
  CommentCreateRequest,
  RealtimeEvent,
  ReactionRequest,
  type Challenge,
  type Comment,
  type FeedPage,
  type FeedPost,
  type SocialCounts,
} from '@beef/contracts';
import type { Redis } from 'ioredis';
import { DB, withTx, type Db } from '../infra/db.ts';
import { REDIS } from '../infra/redis.ts';
import { CLIENTS, type ServiceClients } from '../infra/clients.ts';
import { CurrentUser, UserGuard, ZodPipe, requireTier, type AuthedUser } from '../common/http.ts';
import { blockKey, isBlockedBetween, noneBlocked, notBlocked } from './blocks.ts';

const PAGE = 20;

/** Cursor = "<created_at ISO>|<id>", newest first. */
function parseCursor(raw?: string): [string, string] | null {
  if (!raw) return null;
  const [at, id] = raw.split('|');
  if (!at || !id || Number.isNaN(Date.parse(at)) || !/^[0-9a-f-]{36}$/.test(id)) return null;
  return [at, id];
}

/**
 * Posts a viewer may see: their own games and games of people they follow,
 * never involving anyone they blocked or who blocked them, never hidden.
 * `$1` is the viewer.
 */
const VISIBLE = `
  p.hidden = false
  AND (p.players && ARRAY[$1::uuid] OR p.players && (SELECT coalesce(array_agg(followee), '{}') FROM follows WHERE follower = $1))
  AND ${noneBlocked('$1', 'p.players')}`;

const POST_SELECT = `
  SELECT p.*,
    (SELECT json_object_agg(kind, n) FROM (SELECT kind, count(*)::int AS n FROM reactions r WHERE r.post_id = p.id GROUP BY kind) k) AS reaction_counts,
    (SELECT kind FROM reactions r WHERE r.post_id = p.id AND r.user_id = $1) AS my_reaction,
    (SELECT count(*)::int FROM comments c WHERE c.post_id = p.id AND c.deleted_at IS NULL) AS comment_count,
    (SELECT json_object_agg(pr.user_id, pr.display_name) FROM profiles pr WHERE pr.user_id = ANY(p.players)) AS names
  FROM posts p`;

function toPost(r: Record<string, any>): FeedPost {
  const pl = r.payload as {
    winnerSeat: number | null;
    draw: boolean;
    reason: string;
    scores: number[] | null;
    rated: boolean;
    ratingDeltas: Array<number | null>;
  };
  return {
    id: r.id,
    kind: r.kind,
    sessionId: r.session_id,
    gameId: r.game_id,
    gameName: registry[r.game_id]?.manifest.name ?? r.game_id,
    players: (r.players as string[]).map((userId, i) => ({
      userId,
      displayName: r.names?.[userId] ?? 'Player',
      ratingDelta: pl.ratingDeltas?.[i] ?? null,
    })),
    winnerSeat: pl.winnerSeat,
    draw: pl.draw,
    reason: pl.reason,
    scores: pl.scores ?? null,
    rated: pl.rated,
    reactions: r.reaction_counts ?? {},
    myReaction: r.my_reaction ?? null,
    commentCount: r.comment_count,
    createdAt: r.created_at.toISOString(),
  };
}

@Controller('v1')
@UseGuards(UserGuard)
export class SocialController {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(REDIS) private readonly redis: Redis,
    @Inject(CLIENTS) private readonly clients: ServiceClients,
  ) {}

  // ---------- follows ----------

  @Put('follows/:userId')
  async follow(@CurrentUser() user: AuthedUser, @Param('userId', ParseUUIDPipe) target: string): Promise<SocialCounts> {
    if (target === user.id) throw new ForbiddenException({ error: 'cannot_follow_self' });
    // Blocked pairs look like "not found" to each other, so a block is not revealed.
    const exists = await this.db.query(`SELECT 1 FROM users WHERE id = $1 AND status = 'active'`, [target]);
    if (exists.rowCount === 0 || (await isBlockedBetween(this.db, user.id, target))) {
      throw new NotFoundException({ error: 'not_found' });
    }
    await this.db.query('INSERT INTO follows (follower, followee) VALUES ($1, $2) ON CONFLICT DO NOTHING', [user.id, target]);
    return this.counts(user, target);
  }

  @Delete('follows/:userId')
  async unfollow(@CurrentUser() user: AuthedUser, @Param('userId', ParseUUIDPipe) target: string): Promise<SocialCounts> {
    await this.db.query('DELETE FROM follows WHERE follower = $1 AND followee = $2', [user.id, target]);
    return this.counts(user, target);
  }

  @Get('users/:userId/social')
  async counts(@CurrentUser() user: AuthedUser, @Param('userId', ParseUUIDPipe) target: string): Promise<SocialCounts> {
    if (target !== user.id && (await isBlockedBetween(this.db, user.id, target))) {
      throw new NotFoundException({ error: 'not_found' });
    }
    const r = (
      await this.db.query(
        `SELECT
           (SELECT count(*)::int FROM follows WHERE followee = $2) AS followers,
           (SELECT count(*)::int FROM follows WHERE follower = $2) AS following,
           EXISTS (SELECT 1 FROM follows WHERE follower = $1 AND followee = $2) AS i_follow`,
        [user.id, target],
      )
    ).rows[0];
    return { userId: target, followers: r.followers, following: r.following, iFollow: r.i_follow };
  }

  // ---------- blocks ----------

  /** Blocking also removes follows both ways and cancels open challenges between the two. */
  @Put('blocks/:userId')
  @HttpCode(200)
  async block(@CurrentUser() user: AuthedUser, @Param('userId', ParseUUIDPipe) target: string) {
    if (target === user.id) throw new ForbiddenException({ error: 'cannot_block_self' });
    await withTx(this.db, async (tx) => {
      await tx.query('INSERT INTO blocks (blocker, blocked) VALUES ($1, $2) ON CONFLICT DO NOTHING', [user.id, target]);
      await tx.query(
        'DELETE FROM follows WHERE (follower = $1 AND followee = $2) OR (follower = $2 AND followee = $1)',
        [user.id, target],
      );
      await tx.query(
        `UPDATE challenges SET state = 'cancelled'
         WHERE state = 'sent' AND ((from_user = $1 AND to_user = $2) OR (from_user = $2 AND to_user = $1))`,
        [user.id, target],
      );
    });
    // The matchmaker reads these sets so blocked players never meet in the queue.
    await this.redis.multi().sadd(blockKey(user.id), target).sadd(blockKey(target), user.id).exec();
    return { blocked: true };
  }

  @Delete('blocks/:userId')
  async unblock(@CurrentUser() user: AuthedUser, @Param('userId', ParseUUIDPipe) target: string) {
    await this.db.query('DELETE FROM blocks WHERE blocker = $1 AND blocked = $2', [user.id, target]);
    // Keep the matchmaker's sets if the other person still blocks this user.
    if (!(await isBlockedBetween(this.db, user.id, target))) {
      await this.redis.multi().srem(blockKey(user.id), target).srem(blockKey(target), user.id).exec();
    }
    return { blocked: false };
  }

  @Get('blocks')
  async blocks(@CurrentUser() user: AuthedUser) {
    const rows = (
      await this.db.query(
        `SELECT b.blocked AS user_id, coalesce(p.display_name, 'Player') AS display_name, b.created_at
         FROM blocks b LEFT JOIN profiles p ON p.user_id = b.blocked
         WHERE b.blocker = $1 ORDER BY b.created_at DESC`,
        [user.id],
      )
    ).rows;
    return rows.map((r) => ({ userId: r.user_id, displayName: r.display_name, blockedAt: r.created_at.toISOString() }));
  }

  // ---------- feed ----------

  @Get('feed')
  async feed(@CurrentUser() user: AuthedUser, @Query('before') before?: string): Promise<FeedPage> {
    const cursor = parseCursor(before);
    const rows = (
      await this.db.query(
        `${POST_SELECT}
         WHERE ${VISIBLE}
           ${cursor ? 'AND (p.created_at, p.id) < ($3::timestamptz, $4::uuid)' : ''}
         ORDER BY p.created_at DESC, p.id DESC
         LIMIT $2`,
        cursor ? [user.id, PAGE, cursor[0], cursor[1]] : [user.id, PAGE],
      )
    ).rows;
    const last = rows[rows.length - 1];
    return {
      posts: rows.map(toPost),
      next: rows.length === PAGE && last ? `${last.created_at.toISOString()}|${last.id}` : null,
    };
  }

  /** A player's own results, as shown on their profile. Same visibility rules as the feed, minus follows. */
  @Get('users/:userId/posts')
  async userPosts(@CurrentUser() user: AuthedUser, @Param('userId', ParseUUIDPipe) target: string): Promise<FeedPost[]> {
    if (target !== user.id && (await isBlockedBetween(this.db, user.id, target))) {
      throw new NotFoundException({ error: 'not_found' });
    }
    const rows = (
      await this.db.query(
        `${POST_SELECT}
         WHERE p.hidden = false AND p.players && ARRAY[$2::uuid] AND ${noneBlocked('$1', 'p.players')}
         ORDER BY p.created_at DESC, p.id DESC LIMIT ${PAGE}`,
        [user.id, target],
      )
    ).rows;
    return rows.map(toPost);
  }

  private async visiblePost(viewer: string, postId: string): Promise<Record<string, any>> {
    const row = (await this.db.query(`${POST_SELECT} WHERE p.id = $2 AND ${VISIBLE}`, [viewer, postId])).rows[0];
    if (!row) throw new NotFoundException({ error: 'not_found' });
    return row;
  }

  /** A player can hide their own result from every feed (a bad day is allowed to stay private). */
  @Post('posts/:id/hide')
  @HttpCode(200)
  async hide(@CurrentUser() user: AuthedUser, @Param('id', ParseUUIDPipe) id: string) {
    const r = await this.db.query('UPDATE posts SET hidden = true WHERE id = $1 AND $2 = ANY(players)', [id, user.id]);
    if (r.rowCount === 0) throw new NotFoundException({ error: 'not_found' });
    return { hidden: true };
  }

  // ---------- reactions ----------

  @Put('posts/:id/reaction')
  async react(
    @CurrentUser() user: AuthedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(ReactionRequest)) body: ReactionRequest,
  ): Promise<FeedPost> {
    await this.visiblePost(user.id, id);
    await this.db.query(
      `INSERT INTO reactions (post_id, user_id, kind) VALUES ($1, $2, $3)
       ON CONFLICT (post_id, user_id) DO UPDATE SET kind = EXCLUDED.kind, created_at = now()`,
      [id, user.id, body.kind],
    );
    return toPost(await this.visiblePost(user.id, id));
  }

  @Delete('posts/:id/reaction')
  async unreact(@CurrentUser() user: AuthedUser, @Param('id', ParseUUIDPipe) id: string): Promise<FeedPost> {
    await this.db.query('DELETE FROM reactions WHERE post_id = $1 AND user_id = $2', [id, user.id]);
    return toPost(await this.visiblePost(user.id, id));
  }

  // ---------- comments ----------

  @Get('posts/:id/comments')
  async comments(@CurrentUser() user: AuthedUser, @Param('id', ParseUUIDPipe) id: string): Promise<Comment[]> {
    await this.visiblePost(user.id, id);
    const rows = (
      await this.db.query(
        `SELECT c.*, coalesce(pr.display_name, 'Player') AS display_name
         FROM comments c LEFT JOIN profiles pr ON pr.user_id = c.user_id
         WHERE c.post_id = $2 AND c.deleted_at IS NULL AND ${notBlocked('$1', 'c.user_id')}
         ORDER BY c.created_at ASC LIMIT 200`,
        [user.id, id],
      )
    ).rows;
    return rows.map((r) => ({
      id: r.id,
      postId: r.post_id,
      userId: r.user_id,
      displayName: r.display_name,
      body: r.body,
      action: r.action,
      createdAt: r.created_at.toISOString(),
    }));
  }

  @Post('posts/:id/comments')
  @HttpCode(201)
  async comment(
    @CurrentUser() user: AuthedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(CommentCreateRequest)) body: CommentCreateRequest,
  ): Promise<Comment> {
    requireTier(user, 'V1');
    await this.visiblePost(user.id, id);
    let verdict: { action: 'allow' | 'blur' | 'block'; labels: string[] };
    try {
      verdict = await this.clients.classifyText(body.body, 'comment');
    } catch {
      // Comments are public to followers: with no screening available, they wait.
      throw new ServiceUnavailableException({ error: 'safety_unavailable' });
    }
    if (verdict.action === 'block') throw new UnprocessableEntityException({ error: 'text_blocked' });
    const r = (
      await this.db.query(
        `INSERT INTO comments (post_id, user_id, body, action, labels) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [id, user.id, body.body, verdict.action, verdict.labels],
      )
    ).rows[0];
    const name = (await this.db.query('SELECT display_name FROM profiles WHERE user_id = $1', [user.id])).rows[0];
    return {
      id: r.id,
      postId: r.post_id,
      userId: r.user_id,
      displayName: name?.display_name ?? 'Player',
      body: r.body,
      action: r.action,
      createdAt: r.created_at.toISOString(),
    };
  }

  @Delete('comments/:id')
  async deleteComment(@CurrentUser() user: AuthedUser, @Param('id', ParseUUIDPipe) id: string) {
    // Authors delete their own comments; players can remove comments on their own results.
    const r = await this.db.query(
      `UPDATE comments c SET deleted_at = now()
       FROM posts p
       WHERE c.id = $1 AND c.post_id = p.id AND c.deleted_at IS NULL AND (c.user_id = $2 OR $2 = ANY(p.players))`,
      [id, user.id],
    );
    if (r.rowCount === 0) throw new NotFoundException({ error: 'not_found' });
    return { deleted: true };
  }

  // ---------- rematch ----------

  /** "Run it back": challenges the other player of a finished 1v1 to the same title. */
  @Post('sessions/:id/rematch')
  @HttpCode(201)
  async rematch(@CurrentUser() user: AuthedUser, @Param('id', ParseUUIDPipe) id: string): Promise<Challenge> {
    requireTier(user, 'V1');
    const s = (
      await this.db.query(`SELECT * FROM game_sessions WHERE id = $1 AND $2 = ANY(players)`, [id, user.id])
    ).rows[0];
    if (!s) throw new NotFoundException({ error: 'not_found' });
    if (s.state !== 'finished') throw new ConflictException({ error: 'session_not_finished' });
    getRules(s.game_id);
    const other = (s.players as string[]).find((p) => p !== user.id);
    if (!other || (s.players as string[]).length !== 2) throw new ConflictException({ error: 'rematch_1v1_only' });
    if (await isBlockedBetween(this.db, user.id, other)) throw new NotFoundException({ error: 'not_found' });
    const row = (
      await this.db.query(
        `INSERT INTO challenges (from_user, to_user, game_id, rematch_of)
         SELECT $1, $2, $3, $4
         WHERE NOT EXISTS (SELECT 1 FROM challenges WHERE rematch_of = $4 AND state = 'sent')
         RETURNING *`,
        [user.id, other, s.game_id, id],
      )
    ).rows[0];
    if (!row) throw new ConflictException({ error: 'rematch_already_offered' });
    const challenge: Challenge = {
      id: row.id,
      fromUserId: row.from_user,
      toUserId: row.to_user,
      gameId: row.game_id,
      state: row.state,
      sessionId: row.session_id,
      expiresAt: row.expires_at.toISOString(),
    };
    await this.clients.notify([other], RealtimeEvent.challengeReceived, challenge);
    return challenge;
  }
}
