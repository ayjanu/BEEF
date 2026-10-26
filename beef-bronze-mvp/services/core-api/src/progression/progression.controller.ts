import { BadRequestException, Controller, Get, Inject, Param, UseGuards } from '@nestjs/common';
import { registry } from '@beef/game-rules';
import type { LeaderboardEntry, Wallet } from '@beef/contracts';
import type { Redis } from 'ioredis';
import { DB, type Db } from '../infra/db.ts';
import { REDIS } from '../infra/redis.ts';
import { CurrentUser, UserGuard, type AuthedUser } from '../common/http.ts';
import { leaderboardKey } from '../games/results.service.ts';
import { levelForXp } from './economy.ts';

@Controller('v1')
@UseGuards(UserGuard)
export class ProgressionController {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  @Get('me/wallet')
  async wallet(@CurrentUser() user: AuthedUser): Promise<Wallet> {
    const sums = (
      await this.db.query(
        `SELECT currency, coalesce(sum(delta), 0)::int AS total FROM ledger WHERE user_id = $1 GROUP BY currency`,
        [user.id],
      )
    ).rows;
    const xp = sums.find((r) => r.currency === 'XP')?.total ?? 0;
    const bp = sums.find((r) => r.currency === 'BP')?.total ?? 0;
    const ratings = (
      await this.db.query(`SELECT game_id, rating, rd, games FROM ratings WHERE user_id = $1 ORDER BY game_id`, [user.id])
    ).rows.map((r) => ({ gameId: r.game_id, rating: Math.round(r.rating), rd: Math.round(r.rd), games: r.games }));
    return { xp, bp, level: levelForXp(xp), ratings };
  }

  /** Top 50 for a game. Served from a Redis sorted set; names joined from Postgres. */
  @Get('leaderboards/:gameId')
  async leaderboard(@Param('gameId') gameId: string): Promise<LeaderboardEntry[]> {
    if (!registry[gameId]) throw new BadRequestException({ error: 'unknown_game' });
    const flat = await this.redis.zrevrange(leaderboardKey(gameId), 0, 49, 'WITHSCORES');
    const ids: string[] = [];
    const scores: number[] = [];
    for (let i = 0; i < flat.length; i += 2) {
      ids.push(flat[i]!);
      scores.push(Number(flat[i + 1]));
    }
    if (ids.length === 0) return [];
    const names = new Map(
      (
        await this.db.query(
          `SELECT u.id, coalesce(p.display_name, 'Player') AS name
           FROM users u LEFT JOIN profiles p ON p.user_id = u.id
           WHERE u.id = ANY($1) AND u.status = 'active'`,
          [ids],
        )
      ).rows.map((r) => [r.id, r.name]),
    );
    const out: LeaderboardEntry[] = [];
    ids.forEach((id, i) => {
      if (names.has(id)) out.push({ rank: out.length + 1, userId: id, displayName: names.get(id), rating: Math.round(scores[i]!) });
    });
    return out;
  }
}
