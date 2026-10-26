import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { DB, type Db } from './infra/db.ts';
import { REDIS } from './infra/redis.ts';

@Controller()
export class HealthController {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  /** Public status behind the load balancer (only /v1/* is routed publicly). Reveals nothing. */
  @Get('v1/status')
  status() {
    return { ok: true, service: 'beef' };
  }

  /** Liveness: the process is up. */
  @Get('healthz')
  live() {
    return { ok: true };
  }

  /** Readiness: dependencies answer. Kubernetes stops routing traffic when this fails. */
  @Get('readyz')
  async ready() {
    try {
      await this.db.query('SELECT 1');
      await this.redis.ping();
      return { ok: true };
    } catch (err) {
      throw new ServiceUnavailableException({ ok: false, error: (err as Error).message });
    }
  }
}
