import { v4 as uuidv4 } from 'uuid';
import seedrandom from 'seedrandom';
import { GameSession, GameStatus, GameAction, GameState, Match, GameResult } from '../types';
import { logger } from '../utils/logger';
import { DynamoDBRepository } from '../repositories/DynamoDBRepository';
import { SNSEventPublisher } from '../publishers/SNSEventPublisher';
import { GameLogic } from './GameLogic';

export class GameSessionManager {
  private sessions: Map<string, GameSession> = new Map();
  private gameLogic: GameLogic;

  constructor(
    private repository: DynamoDBRepository,
    private eventPublisher: SNSEventPublisher,
    private gameConfig: { tickRate: number; maxSessionDurationMinutes: number; inactivityTimeoutSeconds: number }
  ) {
    this.gameLogic = new GameLogic();
  }

  /**
   * Create a new game session from a match
   */
  async createSession(match: Match): Promise<GameSession> {
    const sessionId = uuidv4();
    const seed = Math.floor(Math.random() * 1000000);

    const players = match.players.map((p) => ({
      userId: p.userId,
      username: p.userId, // TODO: Fetch from user service
      connected: false,
      ready: false,
      score: 0,
    }));

    const initialState: GameState = {
      turn: 0,
      currentPlayerId: players[0].userId,
      boardState: this.gameLogic.initializeBoard(seed),
      timestamp: new Date(),
    };

    const session: GameSession = {
      sessionId,
      matchId: match.matchId,
      gameMode: match.gameMode,
      region: match.region,
      players,
      status: GameStatus.WAITING_FOR_PLAYERS,
      seed,
      gameState: initialState,
    };

    // Store in memory
    this.sessions.set(sessionId, session);

    // Persist to DynamoDB
    await this.repository.saveGameSession(session);

    // Publish event
    await this.eventPublisher.publishGameCreated(session);

    logger.info('Game session created', { sessionId, matchId: match.matchId });

    return session;
  }

  /**
   * Get a game session by ID
   */
  async getSession(sessionId: string): Promise<GameSession | null> {
    // Check memory first
    const session = this.sessions.get(sessionId);
    if (session) {
      return session;
    }

    // Fallback to database
    const dbSession = await this.repository.getGameSession(sessionId);
    if (dbSession) {
      this.sessions.set(sessionId, dbSession);
      return dbSession;
    }

    return null;
  }

  /**
   * Player connects to a session
   */
  async playerConnect(sessionId: string, userId: string): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    const player = session.players.find((p) => p.userId === userId);
    if (!player) {
      throw new Error('Player not in session');
    }

    player.connected = true;

    // Check if all players are connected
    const allConnected = session.players.every((p) => p.connected);
    if (allConnected && session.status === GameStatus.WAITING_FOR_PLAYERS) {
      session.status = GameStatus.IN_PROGRESS;
      session.startedAt = new Date();

      await this.eventPublisher.publishGameStarted(session);
      logger.info('Game started', { sessionId });
    }

    await this.repository.saveGameSession(session);
  }

  /**
   * Player disconnects from a session
   */
  async playerDisconnect(sessionId: string, userId: string): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) {
      return;
    }

    const player = session.players.find((p) => p.userId === userId);
    if (player) {
      player.connected = false;
    }

    await this.repository.saveGameSession(session);

    // TODO: Handle game abandonment if player doesn't reconnect
  }

  /**
   * Process a game action
   */
  async processAction(sessionId: string, userId: string, actionType: string, payload: any): Promise<GameState> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    if (session.status !== GameStatus.IN_PROGRESS) {
      throw new Error('Game not in progress');
    }

    // Validate it's the player's turn
    if (session.gameState.currentPlayerId !== userId) {
      throw new Error('Not your turn');
    }

    // Create action
    const action: GameAction = {
      actionId: uuidv4(),
      userId,
      type: actionType,
      payload,
      timestamp: new Date(),
      validated: false,
    };

    // Validate and apply action using game logic
    const isValid = this.gameLogic.validateAction(session.gameState, action);
    if (!isValid) {
      throw new Error('Invalid action');
    }

    action.validated = true;

    // Apply action to game state
    const newState = this.gameLogic.applyAction(session.gameState, action);
    session.gameState = newState;
    session.gameState.lastAction = action;

    // Save action to DynamoDB
    await this.repository.saveGameAction(sessionId, action);

    // Determine next player
    const currentPlayerIndex = session.players.findIndex((p) => p.userId === userId);
    const nextPlayerIndex = (currentPlayerIndex + 1) % session.players.length;
    session.gameState.currentPlayerId = session.players[nextPlayerIndex].userId;
    session.gameState.turn += 1;

    // Check for game end condition
    const gameResult = this.gameLogic.checkGameEnd(session);
    if (gameResult) {
      await this.endSession(sessionId, gameResult.winnerId);
    } else {
      await this.repository.saveGameSession(session);
    }

    return session.gameState;
  }

  /**
   * End a game session
   */
  async endSession(sessionId: string, winnerId: string): Promise<GameResult> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    session.status = GameStatus.COMPLETED;
    session.endedAt = new Date();
    session.winner = winnerId;

    const duration = session.startedAt
      ? Math.floor((session.endedAt.getTime() - session.startedAt.getTime()) / 1000)
      : 0;

    const finalScore: Record<string, number> = {};
    session.players.forEach((p) => {
      finalScore[p.userId] = p.score;
    });

    // Calculate MMR changes (simplified)
    const mmrChanges: Record<string, number> = {};
    session.players.forEach((p) => {
      mmrChanges[p.userId] = p.userId === winnerId ? 25 : -25;
    });

    const result: GameResult = {
      sessionId,
      winnerId,
      loserId: session.players.find((p) => p.userId !== winnerId)?.userId || '',
      duration,
      finalScore,
      mmrChanges,
    };

    await this.repository.saveGameSession(session);
    await this.eventPublisher.publishGameEnded(session, result);

    logger.info('Game ended', { sessionId, winnerId, duration });

    // Remove from memory after delay
    setTimeout(() => {
      this.sessions.delete(sessionId);
    }, 60000); // 1 minute

    return result;
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): GameSession[] {
    return Array.from(this.sessions.values()).filter(
      (s) => s.status === GameStatus.IN_PROGRESS || s.status === GameStatus.WAITING_FOR_PLAYERS
    );
  }
}
