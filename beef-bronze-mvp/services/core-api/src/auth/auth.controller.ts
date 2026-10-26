import {
  Body,
  Controller,
  HttpCode,
  HttpException,
  HttpStatus,
  Inject,
  NotImplementedException,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { OtpStartRequest, OtpVerifyRequest, type AuthResult } from '@beef/contracts';
import type { Redis } from 'ioredis';
import { CONFIG, type Config } from '../config.ts';
import { DB, type Db } from '../infra/db.ts';
import { REDIS } from '../infra/redis.ts';
import { ZodPipe } from '../common/http.ts';
import { TOKENS, type TokenService } from './jwt.ts';

/**
 * Phone one-time-code sign-in. Bronze accepts DEV_OTP_CODE (local and dev only;
 * config refuses it in staging/prod). Silver swaps in Twilio Verify behind the
 * same two endpoints. Sign in with Apple / Google arrive in Silver too.
 */
@Controller('v1/auth')
export class AuthController {
  constructor(
    @Inject(CONFIG) private readonly cfg: Config,
    @Inject(DB) private readonly db: Db,
    @Inject(REDIS) private readonly redis: Redis,
    @Inject(TOKENS) private readonly tokens: TokenService,
  ) {}

  private phoneHash(phone: string): string {
    return createHmac('sha256', this.cfg.PII_HASH_KEY).update(phone).digest('hex');
  }

  /** At most 5 attempts per phone per 10 minutes, for both start and verify. */
  private async throttle(kind: string, phoneHash: string): Promise<void> {
    const key = `otp:${kind}:${phoneHash}`;
    const n = await this.redis.incr(key);
    if (n === 1) await this.redis.expire(key, 600);
    if (n > 5) throw new HttpException({ error: 'too_many_attempts' }, HttpStatus.TOO_MANY_REQUESTS);
  }

  @Post('otp/start')
  @HttpCode(200)
  async start(@Body(new ZodPipe(OtpStartRequest)) body: OtpStartRequest) {
    await this.throttle('start', this.phoneHash(body.phone));
    if (!this.cfg.DEV_OTP_CODE) {
      throw new NotImplementedException({ error: 'sms_provider_not_configured' });
    }
    return { sent: true };
  }

  @Post('otp/verify')
  @HttpCode(200)
  async verify(@Body(new ZodPipe(OtpVerifyRequest)) body: OtpVerifyRequest): Promise<AuthResult> {
    const hash = this.phoneHash(body.phone);
    await this.throttle('verify', hash);
    const expected = this.cfg.DEV_OTP_CODE;
    if (!expected || !timingSafeEqual(Buffer.from(body.code), Buffer.from(expected))) {
      throw new UnauthorizedException({ error: 'bad_code' });
    }
    const inserted = await this.db.query(
      `INSERT INTO users (phone_hash) VALUES ($1)
       ON CONFLICT (phone_hash) DO NOTHING
       RETURNING id, tier`,
      [hash],
    );
    const isNew = inserted.rowCount === 1;
    const user = isNew
      ? inserted.rows[0]
      : (await this.db.query('SELECT id, tier, status FROM users WHERE phone_hash = $1', [hash])).rows[0];
    if (user.status && user.status !== 'active') throw new UnauthorizedException({ error: 'account_inactive' });
    return { token: await this.tokens.sign(user.id, user.tier), userId: user.id, isNew };
  }
}
