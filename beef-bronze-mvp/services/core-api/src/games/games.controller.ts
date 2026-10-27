import {
  BadRequestException,
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
  UseGuards,
} from '@nestjs/common';
import { registry } from '@beef/game-rules';
import {
  ChallengeCreateRequest,
  QueueJoinRequest,
  RealtimeEvent,
  type Challenge,
  type Session,
} from '@beef/contracts';
import { CONFIG, type Config } from '../config.ts';
import { DB, type Db } from '../infra/db.ts';
import { CLIENTS, type ServiceClients } from '../infra/clients.ts';
import { CurrentUser, UserGuard, ZodPipe, requireTier, type AuthedUser } from '../common/http.ts';
import { pairKey } from '../match/match.controller.ts';
import { SessionsService, toSession } from './sessions.service.ts';
import { isBlockedBetween } from '../social/blocks.ts';

function assertGame(gameId: string) {
  if (!registry[gameId]) throw new BadRequestException({ error: 'unknown_game', gameId });
}

function toChallenge(r: Record<string, any>): Challenge {
  return {
    id: r.id,
    fromUserId: r.from_user,
    toUserId: r.to_user,
    gameId: r.game_id,
    state: r.state,
    sessionId: r.session_id,
    expiresAt: r.expires_at.toISOString(),
  };
}

@Controller('v1')
@UseGuards(UserGuard)
export class GamesController {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(CLIENTS) private readonly clients: ServiceClients,
    @Inject(CONFIG) private readonly cfg: Config,
    private readonly sessions: SessionsService,
  ) {}

  @Get('games')
  games() {
    return Object.values(registry).map((r) => r.manifest);
  }

  // ---------- direct challenges (from a match or a chat) ----------

  @Post('challenges')
  async challenge(
    @CurrentUser() user: AuthedUser,
    @Body(new ZodPipe(ChallengeCreateRequest)) body: ChallengeCreateRequest,
  ): Promise<Challenge> {
    requireTier(user, 'V1');
    assertGame(body.gameId);
    if (body.toUserId === user.id) throw new BadRequestException({ error: 'cannot_challenge_self' });
    // Bronze safety rule: you can only challenge someone you have matched with.
    const matched = await this.db.query('SELECT 1 FROM threads WHERE pair_key = $1', [pairKey(user.id, body.toUserId)]);
    if (matched.rowCount === 0) throw new ForbiddenException({ error: 'not_matched' });
    if (await isBlockedBetween(this.db, user.id, body.toUserId)) throw new ForbiddenException({ error: 'not_matched' });
    const row = (
      await this.db.query(
        `INSERT INTO challenges (from_user, to_user, game_id) VALUES ($1, $2, $3) RETURNING *`,
        [user.id, body.toUserId, body.gameId],
      )
    ).rows[0];
    const challenge = toChallenge(row);
    await this.clients.notify([body.toUserId], RealtimeEvent.challengeReceived, challenge);
    return challenge;
  }

  @Get('challenges')
  async myChallenges(@CurrentUser() user: AuthedUser): Promise<Challenge[]> {
    await this.db.query(`UPDATE challenges SET state = 'expired' WHERE state = 'sent' AND expires_at < now()`);
    const rows = (
      await this.db.query(
        `SELECT * FROM challenges WHERE (from_user = $1 OR to_user = $1) AND state = 'sent' ORDER BY created_at DESC LIMIT 50`,
        [user.id],
      )
    ).rows;
    return rows.map(toChallenge);
  }

  @Post('challenges/:id/accept')
  @HttpCode(200)
  async accept(@CurrentUser() user: AuthedUser, @Param('id', ParseUUIDPipe) id: string): Promise<Session> {
    // Claim the challenge atomically so a double tap cannot open two sessions.
    const claimed = (
      await this.db.query(
        `UPDATE challenges SET state = 'accepted'
         WHERE id = $1 AND to_user = $2 AND state = 'sent' AND expires_at > now()
         RETURNING *`,
        [id, user.id],
      )
    ).rows[0];
    if (!claimed) throw new ConflictException({ error: 'challenge_not_open' });
    const session = await this.sessions.open(claimed.game_id, [claimed.from_user, claimed.to_user], 'challenge');
    await this.db.query('UPDATE challenges SET session_id = $1 WHERE id = $2', [session.id, id]);
    await this.clients.notify([claimed.from_user], RealtimeEvent.matchFound, session);
    return session;
  }

  @Post('challenges/:id/decline')
  @HttpCode(200)
  async decline(@CurrentUser() user: AuthedUser, @Param('id', ParseUUIDPipe) id: string) {
    const res = await this.db.query(
      `UPDATE challenges SET state = 'declined' WHERE id = $1 AND to_user = $2 AND state = 'sent'`,
      [id, user.id],
    );
    if (res.rowCount === 0) throw new NotFoundException({ error: 'challenge_not_open' });
    return { declined: true };
  }

  // ---------- skill queue (Play tab) ----------

  @Post('queue')
  @HttpCode(202)
  async join(@CurrentUser() user: AuthedUser, @Body(new ZodPipe(QueueJoinRequest)) body: QueueJoinRequest) {
    requireTier(user, 'V1');
    assertGame(body.gameId);
    const r = (
      await this.db.query(`SELECT rating, rd FROM ratings WHERE user_id = $1 AND game_id = $2 AND format = '1v1'`, [
        user.id,
        body.gameId,
      ])
    ).rows[0];
    await this.clients.enqueue({
      userId: user.id,
      gameId: body.gameId,
      rating: r?.rating ?? 1500,
      rd: r?.rd ?? 350,
      region: this.cfg.DEFAULT_REGION, // Silver: H3 cell from the device's coarse location
    });
    return { queued: true, gameId: body.gameId };
  }

  @Delete('queue/:gameId')
  @HttpCode(200)
  async leave(@CurrentUser() user: AuthedUser, @Param('gameId') gameId: string) {
    assertGame(gameId);
    await this.clients.dequeue(user.id, gameId);
    return { queued: false };
  }

  // ---------- sessions ----------

  /** Polling fallback when a realtime match_found push is missed. */
  @Get('sessions/active')
  async active(@CurrentUser() user: AuthedUser): Promise<Session[]> {
    const rows = (
      await this.db.query(
        `SELECT * FROM game_sessions WHERE $1 = ANY(players) AND state = 'active' ORDER BY created_at DESC LIMIT 20`,
        [user.id],
      )
    ).rows;
    return rows.map(toSession);
  }

  @Get('sessions/:id')
  async session(@CurrentUser() user: AuthedUser, @Param('id', ParseUUIDPipe) id: string): Promise<Session> {
    const row = (await this.db.query('SELECT * FROM game_sessions WHERE id = $1 AND $2 = ANY(players)', [id, user.id]))
      .rows[0];
    if (!row) throw new NotFoundException({ error: 'not_found' });
    return toSession(row);
  }
}
