import { z } from 'zod';

// ============================================================================
// Enums
// ============================================================================

export const GameRegionSchema = z.enum([
  'na-east',
  'na-west',
  'eu-west',
  'eu-east',
  'asia-pacific',
  'sa-east',
]);

export const GameModeSchema = z.enum([
  'quickplay-1v1',
  'quickplay-2v2',
  'ranked-1v1',
  'ranked-2v2',
  'custom',
]);

export const GameStatusSchema = z.enum([
  'INITIALIZING',
  'WAITING_FOR_PLAYERS',
  'IN_PROGRESS',
  'PAUSED',
  'COMPLETED',
  'ABORTED',
]);

export const MatchmakingStatusSchema = z.enum([
  'QUEUED',
  'SEARCHING',
  'MATCH_FOUND',
  'ACCEPTED',
  'DECLINED',
  'TIMED_OUT',
  'CANCELLED',
]);

export const MatchStatusSchema = z.enum([
  'PENDING_ACCEPTANCE',
  'READY',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
]);

// ============================================================================
// User & Profile Schemas
// ============================================================================

export const UserSchema = z.object({
  id: z.string().uuid(),
  cognitoId: z.string(),
  email: z.string().email(),
  username: z.string().min(3).max(20).regex(/^[a-zA-Z0-9_-]+$/),
  displayName: z.string().min(1).max(50),
  avatarUrl: z.string().url().optional(),
  region: GameRegionSchema,
  mmr: z.number().int().min(0).max(10000),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const PlayerStatsSchema = z.object({
  gamesPlayed: z.number().int().min(0),
  gamesWon: z.number().int().min(0),
  gamesLost: z.number().int().min(0),
  winRate: z.number().min(0).max(100),
  currentStreak: z.number().int(),
  bestStreak: z.number().int().min(0),
  totalPlayTime: z.number().int().min(0),
});

export const UserPreferencesSchema = z.object({
  region: GameRegionSchema,
  notifications: z.object({
    matchFound: z.boolean(),
    gameInvites: z.boolean(),
    chat: z.boolean(),
  }),
  privacy: z.object({
    showOnlineStatus: z.boolean(),
    allowSpectators: z.boolean(),
  }),
});

export const UserProfileSchema = UserSchema.extend({
  bio: z.string().max(500).optional(),
  stats: PlayerStatsSchema,
  preferences: UserPreferencesSchema,
});

// ============================================================================
// Matchmaking Schemas
// ============================================================================

export const QueueEntrySchema = z.object({
  userId: z.string().uuid(),
  mmr: z.number().int().min(0).max(10000),
  region: GameRegionSchema,
  gameMode: GameModeSchema,
  queuedAt: z.date(),
});

export const MatchmakingRequestSchema = z.object({
  region: GameRegionSchema,
  gameMode: GameModeSchema,
});

export const MatchmakingResponseSchema = z.object({
  queueId: z.string().uuid(),
  position: z.number().int().min(1),
  estimatedWaitTime: z.number().int().min(0),
  status: MatchmakingStatusSchema,
});

export const MatchPlayerSchema = z.object({
  userId: z.string().uuid(),
  mmr: z.number().int().min(0).max(10000),
  accepted: z.boolean(),
  team: z.number().int().min(1).max(2).optional(),
});

export const MatchSchema = z.object({
  matchId: z.string().uuid(),
  players: z.array(MatchPlayerSchema).min(2).max(4),
  region: GameRegionSchema,
  gameMode: GameModeSchema,
  createdAt: z.date(),
  expiresAt: z.date(),
  status: MatchStatusSchema,
});

// ============================================================================
// Game Schemas
// ============================================================================

export const GamePlayerSchema = z.object({
  userId: z.string().uuid(),
  username: z.string(),
  team: z.number().int().min(1).max(2).optional(),
  connected: z.boolean(),
  ready: z.boolean(),
  score: z.number().int().min(0),
});

export const GameActionSchema = z.object({
  actionId: z.string().uuid(),
  userId: z.string().uuid(),
  type: z.string(),
  payload: z.any(),
  timestamp: z.date(),
  validated: z.boolean(),
});

export const GameStateSchema = z.object({
  turn: z.number().int().min(0),
  currentPlayerId: z.string().uuid(),
  boardState: z.any(),
  lastAction: GameActionSchema.optional(),
  timestamp: z.date(),
});

export const GameSessionSchema = z.object({
  sessionId: z.string().uuid(),
  matchId: z.string().uuid(),
  gameMode: GameModeSchema,
  region: GameRegionSchema,
  players: z.array(GamePlayerSchema).min(2).max(4),
  status: GameStatusSchema,
  seed: z.number().int().min(0),
  startedAt: z.date().optional(),
  endedAt: z.date().optional(),
  winner: z.string().uuid().optional(),
  gameState: GameStateSchema,
});

export const GameResultSchema = z.object({
  sessionId: z.string().uuid(),
  winnerId: z.string().uuid(),
  loserId: z.string().uuid(),
  duration: z.number().int().min(0),
  finalScore: z.record(z.string(), z.number()),
  mmrChanges: z.record(z.string(), z.number()),
  replay: z.string().url().optional(),
});

// ============================================================================
// API Request/Response Schemas
// ============================================================================

export const ApiResponseSchema = z.object({
  success: z.boolean(),
  data: z.any().optional(),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.any().optional(),
    statusCode: z.number().int(),
  }).optional(),
  metadata: z.object({
    requestId: z.string().uuid(),
    timestamp: z.date(),
  }).optional(),
});

export const PaginatedResponseSchema = z.object({
  items: z.array(z.any()),
  total: z.number().int().min(0),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1).max(100),
  hasNext: z.boolean(),
});

// ============================================================================
// WebSocket Message Schemas
// ============================================================================

export const WebSocketMessageSchema = z.object({
  type: z.enum(['ping', 'pong', 'subscribe', 'unsubscribe', 'event', 'error']),
  payload: z.any().optional(),
  timestamp: z.date(),
});

// ============================================================================
// Type exports (inferred from schemas)
// ============================================================================

export type User = z.infer<typeof UserSchema>;
export type PlayerStats = z.infer<typeof PlayerStatsSchema>;
export type UserPreferences = z.infer<typeof UserPreferencesSchema>;
export type UserProfile = z.infer<typeof UserProfileSchema>;
export type QueueEntry = z.infer<typeof QueueEntrySchema>;
export type MatchmakingRequest = z.infer<typeof MatchmakingRequestSchema>;
export type MatchmakingResponse = z.infer<typeof MatchmakingResponseSchema>;
export type MatchPlayer = z.infer<typeof MatchPlayerSchema>;
export type Match = z.infer<typeof MatchSchema>;
export type GamePlayer = z.infer<typeof GamePlayerSchema>;
export type GameAction = z.infer<typeof GameActionSchema>;
export type GameState = z.infer<typeof GameStateSchema>;
export type GameSession = z.infer<typeof GameSessionSchema>;
export type GameResult = z.infer<typeof GameResultSchema>;
export type ApiResponse = z.infer<typeof ApiResponseSchema>;
export type PaginatedResponse = z.infer<typeof PaginatedResponseSchema>;
export type WebSocketMessage = z.infer<typeof WebSocketMessageSchema>;
