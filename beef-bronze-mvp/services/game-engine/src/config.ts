import { z } from 'zod';

const Env = z.object({
  PORT: z.coerce.number().int().default(3100),
  REDIS_URL: z.string().min(1),
  JWT_PUBLIC_KEY: z.string().min(40).transform((s) => s.replace(/\\n/g, '\n')),
  INTERNAL_TOKEN: z.string().min(16),
  CORE_API_URL: z.url(),
  /** Screens player-written text in moves (Two Truths, 20 Questions). */
  SAFETY_URL: z.url(),
  /** How often this replica looks for due timers (clock flags, round closes, forfeits). */
  TIMER_SWEEP_MS: z.coerce.number().int().min(50).default(250),
  MOVE_LOG_TABLE: z.string().default('beef-dev-move-logs'),
  AWS_REGION: z.string().default('us-east-2'),
  /** Set only for local DynamoDB; in AWS the SDK uses EKS Pod Identity credentials. */
  DYNAMODB_ENDPOINT: z.string().optional(),
});

export type Config = z.infer<typeof Env>;
export const loadConfig = (env = process.env): Config => Env.parse(env);
