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

// ---------- social: follows, feed, reactions, comments ----------

/** One reaction per person per post, from a fixed set (no free-text reactions to moderate). */
export const ReactionKind = z.enum(['fire', 'skull', 'clap', 'beef', 'laugh']);
export type ReactionKind = z.infer<typeof ReactionKind>;

export const ReactionRequest = z.object({ kind: ReactionKind });
export type ReactionRequest = z.infer<typeof ReactionRequest>;

export const CommentCreateRequest = z.object({ body: z.string().trim().min(1).max(500) });
export type CommentCreateRequest = z.infer<typeof CommentCreateRequest>;

export const FeedPlayer = z.object({
  userId: z.uuid(),
  displayName: z.string(),
  /** Rating change from this game; null for unrated titles. */
  ratingDelta: z.number().nullable(),
});

/**
 * A feed card. Silver posts are game results ("Ayan beat Sam at Chess by
 * checkmate"); Gold adds clips once the media moderation pipeline ships.
 */
export const FeedPost = z.object({
  id: z.uuid(),
  kind: z.enum(['result']),
  sessionId: z.uuid(),
  gameId: z.string(),
  gameName: z.string(),
  players: z.array(FeedPlayer),
  winnerSeat: z.number().int().nullable(),
  draw: z.boolean(),
  reason: z.string(),
  scores: z.array(z.number()).nullable(),
  rated: z.boolean(),
  reactions: z.record(z.string(), z.number().int()),
  myReaction: ReactionKind.nullable(),
  commentCount: z.number().int(),
  createdAt: z.string(),
});
export type FeedPost = z.infer<typeof FeedPost>;

export const FeedPage = z.object({
  posts: z.array(FeedPost),
  /** Pass as ?before= for the next page; null at the end. */
  next: z.string().nullable(),
});
export type FeedPage = z.infer<typeof FeedPage>;

export const Comment = z.object({
  id: z.uuid(),
  postId: z.uuid(),
  userId: z.uuid(),
  displayName: z.string(),
  body: z.string(),
  /** "blur": shown behind a tap-to-reveal, like chat. */
  action: z.enum(['allow', 'blur']),
  createdAt: z.string(),
});
export type Comment = z.infer<typeof Comment>;

export const SocialCounts = z.object({
  userId: z.uuid(),
  followers: z.number().int(),
  following: z.number().int(),
  iFollow: z.boolean(),
});
export type SocialCounts = z.infer<typeof SocialCounts>;

// ---------- Level 4: venues, bookings, check-in (no money moves) ----------

export const Venue = z.object({
  id: z.uuid(),
  name: z.string(),
  address: z.string(),
  city: z.string(),
  lat: z.number(),
  lng: z.number(),
  games: z.array(z.string()),
  safeCertified: z.boolean(),
});
export type Venue = z.infer<typeof Venue>;

export const VenueCreateRequest = z.object({
  name: z.string().trim().min(2).max(80),
  address: z.string().trim().min(5).max(200),
  city: z.string().trim().min(2).max(80),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  timezone: z.string().default('America/Chicago'),
  games: z.array(GameId).min(1).max(20),
  safeCertified: z.boolean().default(false),
  /** The venue's first staff account (owner), an existing BEEF user. */
  ownerUserId: z.uuid(),
});
export type VenueCreateRequest = z.input<typeof VenueCreateRequest>;

export const SlotCreateRequest = z.object({
  gameId: GameId,
  startsAt: z.iso.datetime({ offset: true }),
  endsAt: z.iso.datetime({ offset: true }),
  capacity: z.number().int().min(1).max(50),
});
export type SlotCreateRequest = z.infer<typeof SlotCreateRequest>;

export const VenueSlot = z.object({
  id: z.uuid(),
  venueId: z.uuid(),
  gameId: z.string(),
  startsAt: z.string(),
  endsAt: z.string(),
  capacity: z.number().int(),
  available: z.number().int(),
});
export type VenueSlot = z.infer<typeof VenueSlot>;

export const BookingCreateRequest = z.object({
  slotId: z.uuid(),
  /** Someone you have matched with. They must accept before the booking holds a table. */
  guestId: z.uuid(),
  /** Share the meet plan (who, where, when) with your emergency contacts. */
  sharePlan: z.boolean().default(false),
});
export type BookingCreateRequest = z.input<typeof BookingCreateRequest>;

export const BookingAcceptRequest = z.object({ sharePlan: z.boolean().default(false) });
export type BookingAcceptRequest = z.input<typeof BookingAcceptRequest>;

export const BookingState = z.enum(['invited', 'confirmed', 'checked_in', 'completed', 'cancelled', 'no_show']);

export const Booking = z.object({
  id: z.uuid(),
  state: BookingState,
  venue: Venue,
  slot: VenueSlot.omit({ available: true }),
  hostId: z.uuid(),
  guestId: z.uuid(),
  hostCheckedIn: z.boolean(),
  guestCheckedIn: z.boolean(),
  sessionId: z.uuid().nullable(),
});
export type Booking = z.infer<typeof Booking>;

/** What a player's QR code carries: a 2-minute signed token, re-issued while the screen is open. */
export const CheckinToken = z.object({ token: z.string(), expiresAt: z.string() });
export type CheckinToken = z.infer<typeof CheckinToken>;

export const CheckinRequest = z.object({ token: z.string().min(20).max(2000) });
export type CheckinRequest = z.infer<typeof CheckinRequest>;

export const VenueResultRequest = z.object({
  winnerUserId: z.uuid().nullable(),
  draw: z.boolean().default(false),
  /** Host score first, then guest, for score-kept titles (bowling, table tennis). */
  scores: z.array(z.number().int().min(0).max(10_000)).length(2).optional(),
});
export type VenueResultRequest = z.input<typeof VenueResultRequest>;

/** Shield button (Spec 04). "ok" also answers the start and end check-in prompts. */
export const SafetyEventRequest = z.object({
  kind: z.enum(['ok', 'get_me_out', 'alert_contacts', 'emergency']),
});
export type SafetyEventRequest = z.infer<typeof SafetyEventRequest>;

export const MeetFeedbackRequest = z.object({ feltSafe: z.boolean() });
export type MeetFeedbackRequest = z.infer<typeof MeetFeedbackRequest>;

export const EmergencyContactsRequest = z.object({
  contacts: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(60),
        phone: z.string().regex(/^\+[1-9]\d{7,14}$/, 'phone must be E.164'),
      }),
    )
    .max(3),
});
export type EmergencyContactsRequest = z.infer<typeof EmergencyContactsRequest>;

export const StaffFlagRequest = z.object({
  userId: z.uuid(),
  bookingId: z.uuid(),
  note: z.string().trim().min(3).max(1000),
});
export type StaffFlagRequest = z.infer<typeof StaffFlagRequest>;

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
  /** How it ended: checkmate, timeout, resign, scored, stumped, complete... */
  reason: z.string().max(40).default('complete'),
  /** Per-seat scores when the title keeps them (boxes, trivia points, match count). */
  scores: z.array(z.number()).optional(),
  moveCount: z.number().int().nonnegative(),
  rulesVersion: z.number().int(),
});
export type ResultReport = z.input<typeof ResultReport>;

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
  bookingInvite: 'booking_invite',
  bookingUpdate: 'booking_update',
  /** Start/end-of-meet "Are you OK?" prompt (Spec 04). */
  safetyCheck: 'safety_check',
  matchFound: 'match_found',
  gameResult: 'game_result',
} as const;
export type RealtimeEventName = (typeof RealtimeEvent)[keyof typeof RealtimeEvent];

export interface GameResultEvent {
  sessionId: string;
  gameId: string;
  /** "complete": a no-winner social game (Would You Rather) or a no-contest. */
  outcome: 'win' | 'loss' | 'draw' | 'complete';
  reason: string;
  /** Whether ratings and leaderboards moved (unrated social titles pay XP only). */
  rated: boolean;
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
