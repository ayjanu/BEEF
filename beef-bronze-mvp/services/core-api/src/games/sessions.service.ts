import { Inject, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { randomInt } from 'node:crypto';
import { getRules } from '@beef/game-rules';
import type { Session } from '@beef/contracts';
import { DB, type Db } from '../infra/db.ts';
import { CLIENTS, type ServiceClients } from '../infra/clients.ts';

export function toSession(r: Record<string, any>): Session {
  return { id: r.id, gameId: r.game_id, players: r.players, state: r.state, wsPath: `/session/${r.id}` };
}

/** Creates the authoritative session row, then asks game-engine to host it. */
@Injectable()
export class SessionsService {
  private readonly log = new Logger('SessionsService');

  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(CLIENTS) private readonly clients: ServiceClients,
  ) {}

  async open(gameId: string, players: string[], source: 'challenge' | 'queue'): Promise<Session> {
    const rules = getRules(gameId);
    const seed = randomInt(0, 2 ** 31 - 1);
    const row = (
      await this.db.query(
        `INSERT INTO game_sessions (game_id, rules_version, seed, players, source)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [gameId, rules.manifest.rulesVersion, seed, players, source],
      )
    ).rows[0];
    try {
      await this.clients.openGameSession({ sessionId: row.id, gameId, players, seed });
    } catch (err) {
      this.log.error(`game-engine refused session ${row.id}: ${(err as Error).message}`);
      await this.db.query(`UPDATE game_sessions SET state = 'void', ended_at = now() WHERE id = $1`, [row.id]);
      throw new ServiceUnavailableException({ error: 'game_engine_unavailable' });
    }
    return toSession(row);
  }
}
