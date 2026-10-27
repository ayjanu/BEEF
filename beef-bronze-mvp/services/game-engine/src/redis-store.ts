import type { Redis } from 'ioredis';
import type { SessionStore, StoredSession } from './engine.ts';

const key = (id: string) => `ge:session:${id}`;
const TIMERS = 'ge:deadlines';
/**
 * Active sessions outlive the longest turn timeout (24 h) with margin; every
 * change refreshes the TTL. Finished ones linger an hour for reconnects; the
 * durable record is the DynamoDB move log.
 */
const ACTIVE_TTL_S = 60 * 60 * 24 * 3;
const FINISHED_TTL_S = 60 * 60;

/**
 * Compare-and-set in one Lua call: the write lands only if the record is still
 * exactly what we read. Works on a single shared connection (no per-move
 * WATCH connections) and is atomic on Redis/Valkey, including ElastiCache.
 */
const CAS = `
if redis.call('GET', KEYS[1]) == ARGV[1] then
  redis.call('SET', KEYS[1], ARGV[2], 'EX', tonumber(ARGV[3]))
  if ARGV[5] == '1' then
    if ARGV[4] == '' then
      redis.call('ZREM', KEYS[2], ARGV[6])
    else
      redis.call('ZADD', KEYS[2], tonumber(ARGV[4]), ARGV[6])
    end
  end
  return 1
end
return 0`;

export class RedisStore implements SessionStore {
  constructor(private readonly redis: Redis) {}

  async create(s: StoredSession): Promise<boolean> {
    const ok = await this.redis.set(key(s.sessionId), JSON.stringify(s), 'EX', ACTIVE_TTL_S, 'NX');
    return ok === 'OK';
  }

  async get(id: string): Promise<StoredSession | null> {
    const raw = await this.redis.get(key(id));
    return raw ? (JSON.parse(raw) as StoredSession) : null;
  }

  async update(
    id: string,
    fn: (s: StoredSession) => StoredSession | { error: string },
    timerOf?: (s: StoredSession) => number | null,
  ) {
    for (let attempt = 0; attempt < 8; attempt++) {
      const raw = await this.redis.get(key(id));
      if (!raw) return { error: 'session_not_found' };
      const next = fn(JSON.parse(raw) as StoredSession);
      if ('error' in next) return next;
      const ttl = next.status === 'finished' ? FINISHED_TTL_S : ACTIVE_TTL_S;
      const timer = timerOf ? timerOf(next) : null;
      const swapped = await this.redis.eval(
        CAS,
        2,
        key(id),
        TIMERS,
        raw,
        JSON.stringify(next),
        String(ttl),
        timer === null ? '' : String(timer),
        timerOf ? '1' : '0',
        id,
      );
      if (swapped === 1) return next;
    }
    return { error: 'contention' };
  }

  async schedule(id: string, at: number | null): Promise<void> {
    if (at === null) await this.redis.zrem(TIMERS, id);
    else await this.redis.zadd(TIMERS, at, id);
  }

  async due(now: number, limit: number): Promise<string[]> {
    return this.redis.zrangebyscore(TIMERS, '-inf', now, 'LIMIT', 0, limit);
  }
}
