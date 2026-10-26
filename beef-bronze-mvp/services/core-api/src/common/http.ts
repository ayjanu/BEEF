import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  PipeTransform,
  UnauthorizedException,
  createParamDecorator,
} from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import type { Tier } from '@beef/contracts';
import type { z } from 'zod';
import { CONFIG, type Config } from '../config.ts';
import { DB, type Db } from '../infra/db.ts';
import { TOKENS, type TokenService } from '../auth/jwt.ts';

/** Validates a body or query with a @beef/contracts schema. */
export class ZodPipe<S extends z.ZodType> implements PipeTransform {
  constructor(private readonly schema: S) {}
  transform(value: unknown): z.infer<S> {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        error: 'validation_failed',
        issues: result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      });
    }
    return result.data;
  }
}

export interface AuthedUser {
  id: string;
  tier: Tier;
}

const TIER_ORDER: Record<Tier, number> = { V0: 0, V1: 1, V2: 2, V3: 3 };
export const tierAtLeast = (have: Tier, need: Tier) => TIER_ORDER[have] >= TIER_ORDER[need];

/**
 * Verifies the bearer token, then re-reads status and tier from the database
 * so a ban or a tier change takes effect immediately, not when the token expires.
 */
@Injectable()
export class UserGuard implements CanActivate {
  constructor(
    @Inject(TOKENS) private readonly tokens: TokenService,
    @Inject(DB) private readonly db: Db,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const header: string = req.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) throw new UnauthorizedException({ error: 'missing_token' });
    let userId: string;
    try {
      ({ userId } = await this.tokens.verify(token));
    } catch {
      throw new UnauthorizedException({ error: 'invalid_token' });
    }
    const row = (await this.db.query('SELECT status, tier FROM users WHERE id = $1', [userId])).rows[0];
    if (!row || row.status !== 'active') throw new ForbiddenException({ error: 'account_inactive' });
    req.user = { id: userId, tier: row.tier } satisfies AuthedUser;
    return true;
  }
}

@Injectable()
export class InternalGuard implements CanActivate {
  constructor(@Inject(CONFIG) private readonly cfg: Config) {}
  canActivate(ctx: ExecutionContext): boolean {
    const got = Buffer.from(String(ctx.switchToHttp().getRequest().headers['x-internal-token'] ?? ''));
    const want = Buffer.from(this.cfg.INTERNAL_TOKEN);
    if (got.length !== want.length || !timingSafeEqual(got, want)) {
      throw new UnauthorizedException({ error: 'internal_only' });
    }
    return true;
  }
}

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AuthedUser => ctx.switchToHttp().getRequest().user,
);

export function requireTier(user: AuthedUser, need: Tier): void {
  if (!tierAtLeast(user.tier, need)) {
    throw new ForbiddenException({ error: 'verification_required', need, have: user.tier });
  }
}
