import { z } from 'zod';

const pem = z
  .string()
  .min(40)
  .transform((s) => s.replace(/\\n/g, '\n'));

const Env = z.object({
  APP_ENV: z.enum(['local', 'dev', 'staging', 'prod']).default('local'),
  PORT: z.coerce.number().int().default(3000),
  DATABASE_URL: z.string().min(1),
  DATABASE_SSL: z.enum(['disable', 'require']).default('disable'),
  /** PEM bundle to verify the database certificate (RDS CAs are not in public trust stores). */
  DATABASE_CA_FILE: z.string().optional(),
  REDIS_URL: z.string().min(1),
  JWT_PRIVATE_KEY: pem,
  JWT_PUBLIC_KEY: pem,
  INTERNAL_TOKEN: z.string().min(16),
  PII_HASH_KEY: z.string().min(16),
  DEV_OTP_CODE: z.string().regex(/^\d{6}$/).optional(),
  GAME_ENGINE_URL: z.url(),
  MATCHMAKING_URL: z.url(),
  CHAT_URL: z.url(),
  SAFETY_URL: z.url(),
  DEFAULT_REGION: z.string().default('dfw'),
  FREE_DAILY_RIGHT_SWIPES: z.coerce.number().int().default(50),
  /** How often Level 4 check-in prompts and escalations run. */
  SAFETY_SWEEP_MS: z.coerce.number().int().min(1000).default(30_000),
});

export type Config = z.infer<typeof Env>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const cfg = Env.parse(env);
  if (cfg.DEV_OTP_CODE && (cfg.APP_ENV === 'staging' || cfg.APP_ENV === 'prod')) {
    // A fixed OTP in a real environment would let anyone sign in as anyone.
    throw new Error('DEV_OTP_CODE must not be set in staging or prod');
  }
  return cfg;
}

export const CONFIG = Symbol('CONFIG');
