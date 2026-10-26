/**
 * @beef/contracts — the single source of truth for the shapes that cross
 * service and app boundaries. Core API validates every request with these
 * schemas; the mobile app imports the inferred types, so a breaking change
 * fails the typecheck on both sides in the same pull request.
 */
import { z } from 'zod';

// ---------- shared enums ----------

export const Intent = z.enum(['platonic', 'romantic']);
export type Intent = z.infer<typeof Intent>;

/** Verification tiers from Spec 01. Bronze issues V0 and V1 (dev stub); Silver wires the vendor. */
export const Tier = z.enum(['V0', 'V1', 'V2', 'V3']);
export type Tier = z.infer<typeof Tier>;

export const GameId = z.string().regex(/^[a-z0-9-]{2,40}$/);

// ---------- auth ----------

export const OtpStartRequest = z.object({
  phone: z.string().regex(/^\+[1-9]\d{7,14}$/, 'phone must be E.164, e.g. +12145550100'),
});
export type OtpStartRequest = z.infer<typeof OtpStartRequest>;

export const OtpVerifyRequest = OtpStartRequest.extend({
  code: z.string().regex(/^\d{6}$/),
});
export type OtpVerifyRequest = z.infer<typeof OtpVerifyRequest>;

export const AuthResult = z.object({
  token: z.string(),
  userId: z.uuid(),
  isNew: z.boolean(),
});
export type AuthResult = z.infer<typeof AuthResult>;

// ---------- profiles ----------

export const ProfileUpdateRequest = z.object({
  displayName: z.string().trim().min(1).max(30),
  bio: z.string().max(300).default(''),
  /** ISO date. Under-18 is rejected: BEEF is adults-only (Spec 04). */
  birthDate: z.iso.date(),
  intents: z.array(Intent).min(1).max(2),
  vibeTags: z.array(z.string().max(24)).max(10).default([]),
  games: z.array(GameId).max(10).default([]),
});
export type ProfileUpdateRequest = z.input<typeof ProfileUpdateRequest>;
/** Parsed form, with defaults applied (what the server receives after validation). */
export type ProfileUpdate = z.output<typeof ProfileUpdateRequest>;

export const Profile = z.object({
  userId: z.uuid(),
  displayName: z.string(),
  bio: z.string(),
  age: z.number().int(),
  intents: z.array(Intent),
  vibeTags: z.array(z.string()),
  games: z.array(z.string()),
  tier: Tier,
});
export type Profile = z.infer<typeof Profile>;

// ---------- match (swipe) ----------

export const SwipeRequest = z.object({
  targetId: z.uuid(),
  direction: z.enum(['left', 'right']),
});
export type SwipeRequest = z.infer<typeof SwipeRequest>;

export const SwipeResult = z.object({
  matched: z.boolean(),
  threadId: z.uuid().nullable(),
});
export type SwipeResult = z.infer<typeof SwipeResult>;

// ---------- threads ----------

export const Thread = z.object({
  id: z.uuid(),
  kind: z.enum(['direct', 'group', 'event']),
  members: z.array(z.object({ userId: z.uuid(), displayName: z.string() })),
  createdAt: z.string(),
});
export type Thread = z.infer<typeof Thread>;

// ---------- challenges, queue, sessions ----------

export const ChallengeCreateRequest = z.object({
  toUserId: z.uuid(),
  gameId: GameId,
});
export type ChallengeCreateRequest = z.infer<typeof ChallengeCreateRequest>;

export const ChallengeState = z.enum(['sent', 'accepted', 'declined', 'expired', 'cancelled']);

export const Challenge = z.object({
  id: z.uuid(),
  fromUserId: z.uuid(),
  toUserId: z.uuid(),
  gameId: z.string(),
  state: ChallengeState,
  sessionId: z.uuid().nullable(),
  expiresAt: z.string(),
});
export type Challenge = z.infer<typeof Challenge>;

export const QueueJoinRequest = z.object({ gameId: GameId });
export type QueueJoinRequest = z.infer<typeof QueueJoinRequest>;

export const Session = z.object({
  id: z.uuid(),
  gameId: z.string(),
  players: z.array(z.uuid()),
  state: z.enum(['active', 'finished', 'void']),
  /** Path on the game-engine host, e.g. /session/<id>. The app appends ?token=. */
  wsPath: z.string(),
});
export type Session = z.infer<typeof Session>;

// ---------- progression ----------

export const Wallet = z.object({
  xp: z.number().int(),
  bp: z.number().int(),
  level: z.number().int(),
  ratings: z.array(
    z.object({ gameId: z.string(), rating: z.number(), rd: z.number(), games: z.number().int() }),
  ),
});
export type Wallet = z.infer<typeof Wallet>;

export const LeaderboardEntry = z.object({
  rank: z.number().int(),
  userId: z.uuid(),
  displayName: z.string(),
  rating: z.number(),
});
export type LeaderboardEntry = z.infer<typeof LeaderboardEntry>;

// ---------- safety ----------

export const ReportCreateRequest = z.object({
  subjectType: z.enum(['user', 'message', 'media', 'session']),
  subjectId: z.string().min(1).max(200),
  category: z.enum(['harassment', 'hate', 'sexual', 'threat', 'minor', 'ncii', 'cheating', 'spam', 'other']),
  details: z.string().max(2000).default(''),
});
export type ReportCreateRequest = z.input<typeof ReportCreateRequest>;
export type ReportCreate = z.output<typeof ReportCreateRequest>;

// ---------- internal (service to service) ----------

/** game-engine → core-api when a session ends. */
export const ResultReport = z.object({
  sessionId: z.uuid(),
  gameId: GameId,
  players: z.array(z.uuid()).min(2),
  winnerSeat: z.number().int().nullable(),
  draw: z.boolean(),
  moveCount: z.number().int().nonnegative(),
  rulesVersion: z.number().int(),
});
export type ResultReport = z.infer<typeof ResultReport>;

/** core-api → game-engine to open a session. */
export const SessionOpen = z.object({
  sessionId: z.uuid(),
  gameId: GameId,
  players: z.array(z.uuid()).min(2),
  seed: z.number().int().nonnegative(),
});
export type SessionOpen = z.infer<typeof SessionOpen>;

/** matchmaking → core-api via the Redis stream `beef:matches`. */
export const MatchFound = z.object({
  gameId: GameId,
  region: z.string(),
  players: z.array(z.uuid()).length(2),
});
export type MatchFound = z.infer<typeof MatchFound>;

// ---------- realtime events pushed on the user's chat channel ----------

export const RealtimeEvent = {
  mutualMatch: 'mutual_match',
  challengeReceived: 'challenge_received',
  matchFound: 'match_found',
  gameResult: 'game_result',
} as const;
export type RealtimeEventName = (typeof RealtimeEvent)[keyof typeof RealtimeEvent];

export interface GameResultEvent {
  sessionId: string;
  gameId: string;
  outcome: 'win' | 'loss' | 'draw';
  xp: number;
  bp: number;
  rating: number;
  ratingDelta: number;
}

/** JWT claims issued by core-api (ES256). Every service verifies with the public key. */
export interface AccessClaims {
  sub: string;
  tier: Tier;
  iss: 'beef-core';
  aud: 'beef';
}
