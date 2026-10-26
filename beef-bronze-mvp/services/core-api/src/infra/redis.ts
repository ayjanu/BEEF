import { Redis } from 'ioredis';
import type { Config } from '../config.ts';

export const REDIS = Symbol('REDIS');

export function createRedis(cfg: Config): Redis {
  // rediss:// URLs (ElastiCache with in-transit encryption) enable TLS automatically.
  return new Redis(cfg.REDIS_URL, { maxRetriesPerRequest: 3, lazyConnect: false });
}
