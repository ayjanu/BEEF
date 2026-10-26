import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Inject,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ProfileUpdateRequest, type Profile, type ProfileUpdate } from '@beef/contracts';
import { CONFIG, type Config } from '../config.ts';
import { DB, type Db } from '../infra/db.ts';
import { TOKENS, type TokenService } from '../auth/jwt.ts';
import { CurrentUser, UserGuard, ZodPipe, type AuthedUser } from '../common/http.ts';

export function ageOn(birthDate: string | Date, today = new Date()): number {
  const b = new Date(birthDate);
  let age = today.getUTCFullYear() - b.getUTCFullYear();
  const m = today.getUTCMonth() - b.getUTCMonth();
  if (m < 0 || (m === 0 && today.getUTCDate() < b.getUTCDate())) age--;
  return age;
}

export const PROFILE_SELECT = `
  SELECT p.user_id, p.display_name, p.bio, p.birth_date, p.intents, p.vibe_tags, p.games, u.tier
  FROM profiles p JOIN users u ON u.id = p.user_id`;

export function toProfile(r: Record<string, any>): Profile {
  return {
    userId: r.user_id,
    displayName: r.display_name,
    bio: r.bio,
    age: ageOn(r.birth_date),
    intents: r.intents,
    vibeTags: r.vibe_tags,
    games: r.games,
    tier: r.tier,
  };
}

@Controller('v1')
@UseGuards(UserGuard)
export class ProfilesController {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(CONFIG) private readonly cfg: Config,
    @Inject(TOKENS) private readonly tokens: TokenService,
  ) {}

  @Get('me')
  async me(@CurrentUser() user: AuthedUser): Promise<Profile> {
    const row = (await this.db.query(`${PROFILE_SELECT} WHERE p.user_id = $1`, [user.id])).rows[0];
    if (!row) throw new NotFoundException({ error: 'profile_incomplete' });
    return toProfile(row);
  }

  @Put('me/profile')
  async update(
    @CurrentUser() user: AuthedUser,
    @Body(new ZodPipe(ProfileUpdateRequest)) body: ProfileUpdate,
  ): Promise<Profile> {
    // Adults only (Spec 04). Silver replaces self-declared DOB with store age signals + age estimation.
    if (ageOn(body.birthDate) < 18) throw new ForbiddenException({ error: 'under_18' });
    await this.db.query(
      `INSERT INTO profiles (user_id, display_name, bio, birth_date, intents, vibe_tags, games)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (user_id) DO UPDATE SET
         display_name = EXCLUDED.display_name, bio = EXCLUDED.bio, birth_date = EXCLUDED.birth_date,
         intents = EXCLUDED.intents, vibe_tags = EXCLUDED.vibe_tags, games = EXCLUDED.games, updated_at = now()`,
      [user.id, body.displayName, body.bio, body.birthDate, body.intents, body.vibeTags, body.games],
    );
    return this.me(user);
  }

  /**
   * Dev stub for the V1 selfie-liveness check. Local/dev only; Silver replaces
   * it with the identity vendor's webhook, which is the only path that can raise a tier.
   */
  @Post('me/verify/liveness')
  @HttpCode(200)
  async devLiveness(@CurrentUser() user: AuthedUser): Promise<{ tier: string; token: string }> {
    if (this.cfg.APP_ENV !== 'local' && this.cfg.APP_ENV !== 'dev') {
      throw new ForbiddenException({ error: 'use_identity_vendor' });
    }
    await this.db.query(`UPDATE users SET tier = 'V1' WHERE id = $1 AND tier = 'V0'`, [user.id]);
    const tier = (await this.db.query('SELECT tier FROM users WHERE id = $1', [user.id])).rows[0].tier;
    return { tier, token: await this.tokens.sign(user.id, tier) };
  }

  @Get('profiles/:id')
  async byId(@Param('id', ParseUUIDPipe) id: string): Promise<Profile> {
    const row = (await this.db.query(`${PROFILE_SELECT} WHERE p.user_id = $1 AND u.status = 'active'`, [id])).rows[0];
    if (!row) throw new NotFoundException({ error: 'not_found' });
    return toProfile(row);
  }
}
