import type { Redis } from 'ioredis';
import type { SessionStore, StoredSession } from './engine.ts';

const key = (id: string) => `ge:session:${id}`;
/** Active sessions live a day; finished ones linger an hour for reconnects and replays. */
const ACTIVE_TTL_S = 60 * 60 * 24;
const FINISHED_TTL_S = 60 * 60;

/**
 * Compare-and-set in one Lua call: the write lands only if the record is still
 * exactly what we read. Works on a single shared connection (no per-move
 * WATCH connections) and is atomic on Redis/Valkey, including ElastiCache.
 */
const CAS = `
if redis.call('GET', KEYS[1]) == ARGV[1] then
  redis.call('SET', KEYS[1], ARGV[2], 'EX', tonumber(ARGV[3]))
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

  async update(id: string, fn: (s: StoredSession) => StoredSession | { error: string }) {
    for (let attempt = 0; attempt < 8; attempt++) {
      const raw = await this.redis.get(key(id));
      if (!raw) return { error: 'session_not_found' };
      const next = fn(JSON.parse(raw) as StoredSession);
      if ('error' in next) return next;
      const ttl = next.status === 'finished' ? FINISHED_TTL_S : ACTIVE_TTL_S;
      const swapped = await this.redis.eval(CAS, 1, key(id), raw, JSON.stringify(next), String(ttl));
      if (swapped === 1) return next;
    }
    return { error: 'contention' };
  }
}
