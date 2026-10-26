import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { getRules } from '@beef/game-rules';
import { RealtimeEvent, type GameResultEvent, type ResultReport } from '@beef/contracts';
import type { Redis } from 'ioredis';
import { DB, withTx, type Db, type Tx } from '../infra/db.ts';
import { REDIS } from '../infra/redis.ts';
import { CLIENTS, type ServiceClients } from '../infra/clients.ts';
import { DEFAULT_RATING, rateGame, type Rating } from '../progression/glicko2.ts';
import {
  STRENGTH,
  XP_FOR,
  applyDailyCap,
  bpForResult,
  capForLevel,
  type Level,
  type Outcome,
} from '../progression/economy.ts';

export const leaderboardKey = (gameId: string, scope = 'global') => `lb:${gameId}:${scope}`;

/**
 * Turns a server-verified game result into ratings, XP, Beef Points and a
 * leaderboard update, all in one transaction. Idempotent: a retried report
 * for a finished session returns without paying twice.
 */
@Injectable()
export class ResultsService {
  private readonly log = new Logger('ResultsService');

  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(REDIS) private readonly redis: Redis,
    @Inject(CLIENTS) private readonly clients: ServiceClients,
  ) {}

  private async loadRating(tx: Tx, userId: string, gameId: string): Promise<Rating> {
    const r = (
      await tx.query(
        `SELECT rating, rd, vol FROM ratings WHERE user_id = $1 AND game_id = $2 AND format = '1v1' FOR UPDATE`,
        [userId, gameId],
      )
    ).rows[0];
    return r ? { rating: r.rating, rd: r.rd, vol: r.vol } : { ...DEFAULT_RATING };
  }

  async record(report: ResultReport): Promise<{ recorded: boolean; events: GameResultEvent[] }> {
    const rules = getRules(report.gameId);
    if (report.players.length !== 2) throw new BadRequestException({ error: 'bronze_supports_1v1_only' });

    const outcome = await withTx(this.db, async (tx) => {
      const session = (await tx.query('SELECT * FROM game_sessions WHERE id = $1 FOR UPDATE', [report.sessionId])).rows[0];
      if (!session) throw new NotFoundException({ error: 'session_not_found' });
      if (session.state !== 'active') return null; // already recorded: idempotent
      if (session.game_id !== report.gameId || session.players.join() !== report.players.join()) {
        throw new BadRequestException({ error: 'report_does_not_match_session' });
      }

      const [a, b] = report.players as [string, string];
      const winnerId = report.draw || report.winnerSeat === null ? null : report.players[report.winnerSeat] ?? null;
      const outcomeOf = (uid: string): Outcome => (winnerId === null ? 'draw' : winnerId === uid ? 'win' : 'loss');

      await tx.query(`UPDATE game_sessions SET state = 'finished', ended_at = now() WHERE id = $1`, [session.id]);
      await tx.query(
        `INSERT INTO results (session_id, winner_id, draw, move_count, verification, strength)
         VALUES ($1, $2, $3, $4, 'server', $5)`,
        [session.id, winnerId, winnerId === null, report.moveCount, STRENGTH.serverAuthoritative],
      );

      // Ratings (Glicko-2, one game per rating period in Bronze).
      const ra = await this.loadRating(tx, a, report.gameId);
      const rb = await this.loadRating(tx, b, report.gameId);
      const scoreA = winnerId === null ? 0.5 : winnerId === a ? 1 : 0;
      const [na, nb] = rateGame(ra, rb, scoreA);
      for (const [uid, r] of [[a, na], [b, nb]] as const) {
        await tx.query(
          `INSERT INTO ratings (user_id, game_id, format, rating, rd, vol, games)
           VALUES ($1, $2, '1v1', $3, $4, $5, 1)
           ON CONFLICT (user_id, game_id, format) DO UPDATE SET
             rating = EXCLUDED.rating, rd = EXCLUDED.rd, vol = EXCLUDED.vol,
             games = ratings.games + 1, updated_at = now()`,
          [uid, report.gameId, r.rating, r.rd, r.vol],
        );
      }

      // Economy (Spec 02): diminishing returns per opponent per day, daily caps per level group.
      const nth = Number(
        (
          await tx.query(
            `SELECT count(*) FROM game_sessions
             WHERE state = 'finished'
               AND players @> ARRAY[$1::uuid, $2::uuid]
               AND ended_at >= date_trunc('day', now())`,
            [a, b],
          )
        ).rows[0].count,
      );
      const level = rules.manifest.level as Level;
      const capGroup = level <= 2 ? 'l12' : `l${level}`;
      const events: GameResultEvent[] = [];
      for (const [uid, before, after] of [[a, ra, na], [b, rb, nb]] as const) {
        const o = outcomeOf(uid);
        const xp = XP_FOR[o];
        const earned = Number(
          (
            await tx.query(
              `SELECT coalesce(sum(delta), 0) AS s FROM ledger
               WHERE user_id = $1 AND currency = 'BP' AND cap_group = $2 AND created_at >= date_trunc('day', now())`,
              [uid, capGroup],
            )
          ).rows[0].s,
        );
        const raw = bpForResult({
          level,
          outcome: o,
          strength: STRENGTH.serverAuthoritative,
          nthGameVsOpponentToday: nth,
          chance: rules.manifest.chance,
        });
        const bp = applyDailyCap(raw, earned, capForLevel(level));
        await tx.query(
          `INSERT INTO ledger (user_id, currency, delta, reason, cap_group, ref_id) VALUES ($1, 'XP', $2, 'game', $3, $4)`,
          [uid, xp, capGroup, session.id],
        );
        if (bp > 0) {
          await tx.query(
            `INSERT INTO ledger (user_id, currency, delta, reason, cap_group, ref_id) VALUES ($1, 'BP', $2, 'game', $3, $4)`,
            [uid, bp, capGroup, session.id],
          );
        }
        events.push({
          sessionId: session.id,
          gameId: report.gameId,
          outcome: o,
          xp,
          bp,
          rating: Math.round(after.rating),
          ratingDelta: Math.round(after.rating - before.rating),
        });
      }
      return { events, ratings: [[a, na.rating], [b, nb.rating]] as Array<[string, number]> };
    });

    if (!outcome) return { recorded: false, events: [] };

    // After commit: leaderboard and pushes. Both are rebuildable from Postgres if they fail.
    const pipeline = this.redis.pipeline();
    for (const [uid, rating] of outcome.ratings) pipeline.zadd(leaderboardKey(report.gameId), rating, uid);
    await pipeline.exec();
    for (const [i, uid] of report.players.entries()) {
      const ev = outcome.events[i];
      if (ev) await this.clients.notify([uid], RealtimeEvent.gameResult, ev);
    }
    this.log.log(`result recorded for session ${report.sessionId}`);
    return { recorded: true, events: outcome.events };
  }
}
