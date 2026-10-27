import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { getManifest } from '@beef/game-rules';
import { RealtimeEvent, type GameResultEvent, type ResultReport } from '@beef/contracts';
import type { Redis } from 'ioredis';
import { DB, withTx, type Db, type Tx } from '../infra/db.ts';
import { REDIS } from '../infra/redis.ts';
import { CLIENTS, type ServiceClients } from '../infra/clients.ts';
import { DEFAULT_RATING, rateGame, type Rating } from '../progression/glicko2.ts';
import {
  NO_CONTEST_REASONS,
  STRENGTH,
  XP_FOR,
  applyDailyCap,
  bpForResult,
  DAILY_CAP,
  capForLevel,
  type Level,
  type Outcome,
} from '../progression/economy.ts';

export const leaderboardKey = (gameId: string, scope = 'global') => `lb:${gameId}:${scope}`;

/**
 * Turns a game result into ratings, XP, Beef Points and a leaderboard update,
 * all in one transaction. Idempotent: a retried report for a finished session
 * returns without paying twice.
 *
 * What a result pays depends on the title's manifest (Spec 02):
 * - rated + server-verified: ratings, leaderboard, XP and BP;
 * - unrated or mutual (Would You Rather, Two Truths, 20 Questions): XP only.
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

  /**
   * `visit` scopes Level 4 caps to one venue visit (Spec 02: 300 BP per visit)
   * instead of the calendar day.
   */
  async record(
    report: ResultReport,
    visit?: { bookingId: string },
  ): Promise<{ recorded: boolean; events: GameResultEvent[] }> {
    const manifest = getManifest(report.gameId);
    const rules = { manifest };
    if (report.players.length !== 2) throw new BadRequestException({ error: 'bronze_supports_1v1_only' });

    const outcome = await withTx(this.db, async (tx) => {
      const session = (await tx.query('SELECT * FROM game_sessions WHERE id = $1 FOR UPDATE', [report.sessionId])).rows[0];
      if (!session) throw new NotFoundException({ error: 'session_not_found' });
      if (session.state !== 'active') return null; // already recorded: idempotent
      if (session.game_id !== report.gameId || session.players.join() !== report.players.join()) {
        throw new BadRequestException({ error: 'report_does_not_match_session' });
      }

      const [a, b] = report.players as [string, string];
      const reason = report.reason ?? 'complete';
      const rated = rules.manifest.rated;
      const strength = !rated
        ? STRENGTH.unrated
        : rules.manifest.verification === 'venue'
          ? STRENGTH.venueAttest
          : rules.manifest.verification === 'server'
            ? STRENGTH.serverAuthoritative
            : STRENGTH.mutualConfirm;
      const noContest = NO_CONTEST_REASONS.has(reason);
      const winnerId = report.draw || report.winnerSeat === null ? null : report.players[report.winnerSeat] ?? null;
      const outcomeOf = (uid: string): Outcome =>
        winnerId !== null ? (winnerId === uid ? 'win' : 'loss') : report.draw ? 'draw' : 'complete';

      await tx.query(`UPDATE game_sessions SET state = 'finished', ended_at = now() WHERE id = $1`, [session.id]);
      await tx.query(
        `INSERT INTO results (session_id, winner_id, draw, move_count, verification, strength, reason, scores, rated)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          session.id,
          winnerId,
          report.draw,
          report.moveCount,
          rules.manifest.verification,
          strength,
          reason,
          report.scores ?? null,
          rated,
        ],
      );

      // Ratings (Glicko-2, one game per rating period), rated titles only.
      const ra = await this.loadRating(tx, a, report.gameId);
      const rb = await this.loadRating(tx, b, report.gameId);
      let [na, nb] = [ra, rb];
      if (rated && !noContest) {
        const scoreA = winnerId === null ? 0.5 : winnerId === a ? 1 : 0;
        [na, nb] = rateGame(ra, rb, scoreA);
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
      const capGroup = visit ? `visit:${visit.bookingId}` : level <= 2 ? 'l12' : `l${level}`;
      const events: GameResultEvent[] = [];
      for (const [uid, before, after] of [[a, ra, na], [b, rb, nb]] as const) {
        const o = outcomeOf(uid);
        const xp = noContest ? 0 : XP_FOR[o];
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
          strength: noContest ? 0 : strength,
          nthGameVsOpponentToday: nth,
          chance: rules.manifest.chance,
        });
        const bp = applyDailyCap(raw, earned, visit ? DAILY_CAP.perVenueVisit : capForLevel(level));
        if (xp > 0) {
          await tx.query(
            `INSERT INTO ledger (user_id, currency, delta, reason, cap_group, ref_id) VALUES ($1, 'XP', $2, 'game', $3, $4)`,
            [uid, xp, capGroup, session.id],
          );
        }
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
          reason,
          rated,
          xp,
          bp,
          rating: Math.round(after.rating),
          ratingDelta: Math.round(after.rating - before.rating),
        });
      }
      // The feed card. No-contests (nobody played) do not post.
      if (!noContest) {
        const deltas = events.map((e) => (rated ? e.ratingDelta : null));
        await tx.query(
          `INSERT INTO posts (kind, session_id, game_id, players, payload) VALUES ('result', $1, $2, $3, $4)
           ON CONFLICT (session_id) DO NOTHING`,
          [
            session.id,
            report.gameId,
            report.players,
            JSON.stringify({
              winnerSeat: winnerId === null ? null : report.winnerSeat,
              draw: report.draw,
              reason,
              scores: report.scores ?? null,
              rated,
              ratingDeltas: deltas,
            }),
          ],
        );
      }
      const ratings = rated && !noContest ? ([[a, na.rating], [b, nb.rating]] as Array<[string, number]>) : [];
      return { events, ratings };
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
