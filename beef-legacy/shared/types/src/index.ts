// Shared types for Beefmobile platform

// ============================================================================
// User & Profile Types
// ============================================================================

export interface User {
  id: string;
  cognitoId: string;
  email: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  region: GameRegion;
  mmr: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserProfile extends User {
  bio?: string;
  stats: PlayerStats;
  preferences: UserPreferences;
}

export interface PlayerStats {
  gamesPlayed: number;
  gamesWon: number;
  gamesLost: number;
  winRate: number;
  currentStreak: number;
  bestStreak: number;
  totalPlayTime: number; // in seconds
}

export interface UserPreferences {
  region: GameRegion;
  notifications: {
    matchFound: boolean;
    gameInvites: boolean;
    chat: boolean;
  };
  privacy: {
    showOnlineStatus: boolean;
    allowSpectators: boolean;
  };
}

// ============================================================================
// Matchmaking Types
// ============================================================================

export enum GameRegion {
  NA_EAST = 'na-east',
  NA_WEST = 'na-west',
  EU_WEST = 'eu-west',
  EU_EAST = 'eu-east',
  ASIA_PACIFIC = 'asia-pacific',
  SA_EAST = 'sa-east',
}

export enum MatchmakingStatus {
  QUEUED = 'QUEUED',
  SEARCHING = 'SEARCHING',
  MATCH_FOUND = 'MATCH_FOUND',
  ACCEPTED = 'ACCEPTED',
  DECLINED = 'DECLINED',
  TIMED_OUT = 'TIMED_OUT',
  CANCELLED = 'CANCELLED',
}

export interface QueueEntry {
  userId: string;
  mmr: number;
  region: GameRegion;
  queuedAt: Date;
  gameMode: GameMode;
}

export interface MatchmakingRequest {
  userId: string;
  region: GameRegion;
  gameMode: GameMode;
}

export interface MatchmakingResponse {
  queueId: string;
  position: number;
  estimatedWaitTime: number; // seconds
  status: MatchmakingStatus;
}

export interface Match {
  matchId: string;
  players: MatchPlayer[];
  region: GameRegion;
  gameMode: GameMode;
  createdAt: Date;
  expiresAt: Date;
  status: MatchStatus;
}

export interface MatchPlayer {
  userId: string;
  mmr: number;
  accepted: boolean;
  team?: number;
}

export enum MatchStatus {
  PENDING_ACCEPTANCE = 'PENDING_ACCEPTANCE',
  READY = 'READY',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

// ============================================================================
// Game Types
// ============================================================================

export enum GameMode {
  QUICKPLAY_1V1 = 'quickplay-1v1',
  QUICKPLAY_2V2 = 'quickplay-2v2',
  RANKED_1V1 = 'ranked-1v1',
  RANKED_2V2 = 'ranked-2v2',
  CUSTOM = 'custom',
}

export enum GameStatus {
  INITIALIZING = 'INITIALIZING',
  WAITING_FOR_PLAYERS = 'WAITING_FOR_PLAYERS',
  IN_PROGRESS = 'IN_PROGRESS',
  PAUSED = 'PAUSED',
  COMPLETED = 'COMPLETED',
  ABORTED = 'ABORTED',
}

export interface GameSession {
  sessionId: string;
  matchId: string;
  gameMode: GameMode;
  region: GameRegion;
  players: GamePlayer[];
  status: GameStatus;
  seed: number; // Deterministic seed for game logic
  startedAt?: Date;
  endedAt?: Date;
  winner?: string; // userId
  gameState: GameState;
}

export interface GamePlayer {
  userId: string;
  username: string;
  team?: number;
  connected: boolean;
  ready: boolean;
  score: number;
}

export interface GameState {
  turn: number;
  currentPlayerId: string;
  boardState: any; // Game-specific state
  lastAction?: GameAction;
  timestamp: Date;
}

export interface GameAction {
  actionId: string;
  userId: string;
  type: string;
  payload: any;
  timestamp: Date;
  validated: boolean;
}

export interface GameResult {
  sessionId: string;
  winnerId: string;
  loserId: string;
  duration: number; // seconds
  finalScore: {
    [userId: string]: number;
  };
  mmrChanges: {
    [userId: string]: number;
  };
  replay?: string; // S3 URL
}

// ============================================================================
// Event Types (for message passing)
// ============================================================================

export enum EventType {
  // Matchmaking events
  QUEUE_JOINED = 'matchmaking.queue.joined',
  QUEUE_LEFT = 'matchmaking.queue.left',
  MATCH_FOUND = 'matchmaking.match.found',
  MATCH_ACCEPTED = 'matchmaking.match.accepted',
  MATCH_DECLINED = 'matchmaking.match.declined',
  MATCH_READY = 'matchmaking.match.ready',

  // Game events
  GAME_CREATED = 'game.created',
  GAME_STARTED = 'game.started',
  GAME_STATE_UPDATE = 'game.state.update',
  GAME_ACTION = 'game.action',
  GAME_ENDED = 'game.ended',
  PLAYER_CONNECTED = 'game.player.connected',
  PLAYER_DISCONNECTED = 'game.player.disconnected',

  // Chat events
  MESSAGE_SENT = 'chat.message.sent',
  MESSAGE_RECEIVED = 'chat.message.received',

  // Presence events
  USER_ONLINE = 'presence.user.online',
  USER_OFFLINE = 'presence.user.offline',
  USER_IN_GAME = 'presence.user.in_game',
}

export interface Event<T = any> {
  eventId: string;
  type: EventType;
  timestamp: Date;
  userId?: string;
  sessionId?: string;
  matchId?: string;
  payload: T;
  metadata?: Record<string, any>;
}

// ============================================================================
// API Response Types
// ============================================================================

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: ApiError;
  metadata?: {
    requestId: string;
    timestamp: Date;
  };
}

export interface ApiError {
  code: string;
  message: string;
  details?: any;
  statusCode: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasNext: boolean;
}

// ============================================================================
// WebSocket Message Types
// ============================================================================

export enum WebSocketMessageType {
  PING = 'ping',
  PONG = 'pong',
  SUBSCRIBE = 'subscribe',
  UNSUBSCRIBE = 'unsubscribe',
  EVENT = 'event',
  ERROR = 'error',
}

export interface WebSocketMessage<T = any> {
  type: WebSocketMessageType;
  payload?: T;
  timestamp: Date;
}

// ============================================================================
// Analytics Types
// ============================================================================

export interface AnalyticsEvent {
  eventName: string;
  userId?: string;
  sessionId?: string;
  properties: Record<string, any>;
  timestamp: Date;
}

export interface PlayerEngagementMetrics {
  userId: string;
  dailyActiveStatus: boolean;
  sessionsToday: number;
  averageSessionDuration: number;
  gamesPlayedToday: number;
  lastActiveAt: Date;
}
