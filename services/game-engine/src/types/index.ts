export enum GameStatus {
  INITIALIZING = 'INITIALIZING',
  WAITING_FOR_PLAYERS = 'WAITING_FOR_PLAYERS',
  IN_PROGRESS = 'IN_PROGRESS',
  PAUSED = 'PAUSED',
  COMPLETED = 'COMPLETED',
  ABORTED = 'ABORTED',
}

export enum GameMode {
  QUICKPLAY_1V1 = 'quickplay-1v1',
  QUICKPLAY_2V2 = 'quickplay-2v2',
  RANKED_1V1 = 'ranked-1v1',
  RANKED_2V2 = 'ranked-2v2',
  CUSTOM = 'custom',
}

export enum GameRegion {
  NA_EAST = 'na-east',
  NA_WEST = 'na-west',
  EU_WEST = 'eu-west',
  EU_EAST = 'eu-east',
  ASIA_PACIFIC = 'asia-pacific',
  SA_EAST = 'sa-east',
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

export interface GameSession {
  sessionId: string;
  matchId: string;
  gameMode: GameMode;
  region: GameRegion;
  players: GamePlayer[];
  status: GameStatus;
  seed: number; // Deterministic seed
  startedAt?: Date;
  endedAt?: Date;
  winner?: string;
  gameState: GameState;
}

export interface GameResult {
  sessionId: string;
  winnerId: string;
  loserId: string;
  duration: number; // seconds
  finalScore: Record<string, number>;
  mmrChanges: Record<string, number>;
  replay?: string; // S3 URL
}

export interface Match {
  matchId: string;
  players: Array<{
    userId: string;
    mmr: number;
    accepted: boolean;
  }>;
  region: GameRegion;
  gameMode: GameMode;
  createdAt: Date;
  status: string;
}
