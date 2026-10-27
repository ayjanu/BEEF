import { Inject, Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { hostname } from 'node:os';
import { MatchFound, RealtimeEvent } from '@beef/contracts';
import type { Redis } from 'ioredis';
import { REDIS } from '../infra/redis.ts';
import { CLIENTS, type ServiceClients } from '../infra/clients.ts';
import { SessionsService } from './sessions.service.ts';
import { DB, type Db } from '../infra/db.ts';
import { CONFIG, type Config } from '../config.ts';
import { cacheBlock, isBlockedBetween } from '../social/blocks.ts';

export const MATCH_STREAM = 'beef:matches';
const GROUP = 'core-api';

/**
 * Consumes pairings published by the Go matchmaker on a Redis Stream with a
 * consumer group, so each pairing is handled by exactly one core-api replica
 * and survives a crash between read and ack (pending entries are re-claimed).
 */
@Injectable()
export class MatchesConsumer implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly log = new Logger('MatchesConsumer');
  private reader?: Redis;
  private running = false;
  private readonly consumer = `${hostname()}-${process.pid}`;

  constructor(
    @Inject(REDIS) private readonly redis: Redis,
    @Inject(CLIENTS) private readonly clients: ServiceClients,
    @Inject(DB) private readonly db: Db,
    @Inject(CONFIG) private readonly cfg: Config,
    private readonly sessions: SessionsService,
  ) {}

  /** Backstop for the matchmaker's block check (its Redis sets can lag): put both back in line. */
  private async requeue(gameId: string, players: string[]) {
    for (const userId of players) {
      const r = (
        await this.db.query(`SELECT rating, rd FROM ratings WHERE user_id = $1 AND game_id = $2 AND format = '1v1'`, [
          userId,
          gameId,
        ])
      ).rows[0];
      await this.clients.enqueue({ userId, gameId, rating: r?.rating ?? 1500, rd: r?.rd ?? 350, region: this.cfg.DEFAULT_REGION });
    }
  }

  async onApplicationBootstrap() {
    try {
      await this.redis.xgroup('CREATE', MATCH_STREAM, GROUP, '$', 'MKSTREAM');
    } catch (err) {
      if (!String(err).includes('BUSYGROUP')) throw err;
    }
    this.reader = this.redis.duplicate();
    this.running = true;
    void this.loop();
  }

  async onApplicationShutdown() {
    this.running = false;
    this.reader?.disconnect();
  }

  private async loop() {
    // First drain anything this consumer left pending, then read new entries.
    let cursor = '0';
    while (this.running) {
      try {
        const res = (await this.reader!.xreadgroup(
          'GROUP', GROUP, this.consumer, 'COUNT', 10, 'BLOCK', 2000, 'STREAMS', MATCH_STREAM, cursor,
        )) as Array<[string, Array<[string, string[]]>]> | null;
        const entries = res?.[0]?.[1] ?? [];
        if (cursor === '0' && entries.length === 0) cursor = '>';
        for (const [id, fields] of entries) await this.handle(id, fields);
      } catch (err) {
        if (!this.running) return;
        this.log.error(`stream read failed: ${(err as Error).message}`);
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  }

  private async handle(id: string, fields: string[]) {
    try {
      const raw = Object.fromEntries(Array.from({ length: fields.length / 2 }, (_, i) => [fields[2 * i], fields[2 * i + 1]]));
      const match = MatchFound.parse({ ...raw, players: JSON.parse(String(raw.players)) });
      if (await isBlockedBetween(this.db, match.players[0]!, match.players[1]!)) {
        this.log.warn(`match ${id} pairs blocked users; repairing the block cache and requeueing`);
        // The matchmaker's cache missed this block: restore it first, or the same pair loops forever.
        await cacheBlock(this.redis, match.players[0]!, match.players[1]!);
        await this.requeue(match.gameId, match.players);
        return;
      }
      const session = await this.sessions.open(match.gameId, match.players, 'queue');
      await this.clients.notify(match.players, RealtimeEvent.matchFound, session);
      this.log.log(`queue match → session ${session.id}`);
    } catch (err) {
      // A malformed or unservable pairing is logged and acked so it cannot block the stream.
      this.log.error(`match ${id} failed: ${(err as Error).message}`);
    } finally {
      await this.redis.xack(MATCH_STREAM, GROUP, id);
    }
  }
}
