import { GameLogic } from '../game/GameLogic';
import { GameState, GameAction } from '../types';

describe('GameLogic', () => {
  let gameLogic: GameLogic;

  beforeEach(() => {
    gameLogic = new GameLogic();
  });

  describe('initializeBoard', () => {
    it('should create a deterministic board with same seed', () => {
      const seed = 12345;
      const board1 = gameLogic.initializeBoard(seed);
      const board2 = gameLogic.initializeBoard(seed);

      expect(board1).toEqual(board2);
    });

    it('should create different boards with different seeds', () => {
      const board1 = gameLogic.initializeBoard(12345);
      const board2 = gameLogic.initializeBoard(54321);

      expect(board1).not.toEqual(board2);
    });

    it('should create a valid board structure', () => {
      const board = gameLogic.initializeBoard(12345);

      expect(board).toHaveProperty('grid');
      expect(board).toHaveProperty('entities');
      expect(board).toHaveProperty('resources');
      expect(Array.isArray(board.grid)).toBe(true);
      expect(board.resources).toBeGreaterThanOrEqual(0);
    });
  });

  describe('validateAction', () => {
    let gameState: GameState;

    beforeEach(() => {
      gameState = {
        turn: 0,
        currentPlayerId: 'player-1',
        boardState: gameLogic.initializeBoard(12345),
        timestamp: new Date(),
      };
    });

    it('should validate a valid MOVE action', () => {
      const action: GameAction = {
        actionId: 'action-1',
        userId: 'player-1',
        type: 'MOVE',
        payload: {
          from: { x: 5, y: 5 },
          to: { x: 6, y: 5 },
        },
        timestamp: new Date(),
        validated: false,
      };

      const isValid = gameLogic.validateAction(gameState, action);
      expect(isValid).toBe(true);
    });

    it('should reject MOVE action that is too far', () => {
      const action: GameAction = {
        actionId: 'action-1',
        userId: 'player-1',
        type: 'MOVE',
        payload: {
          from: { x: 5, y: 5 },
          to: { x: 10, y: 10 },
        },
        timestamp: new Date(),
        validated: false,
      };

      const isValid = gameLogic.validateAction(gameState, action);
      expect(isValid).toBe(false);
    });

    it('should reject MOVE action with no movement', () => {
      const action: GameAction = {
        actionId: 'action-1',
        userId: 'player-1',
        type: 'MOVE',
        payload: {
          from: { x: 5, y: 5 },
          to: { x: 5, y: 5 },
        },
        timestamp: new Date(),
        validated: false,
      };

      const isValid = gameLogic.validateAction(gameState, action);
      expect(isValid).toBe(false);
    });

    it('should reject unknown action types', () => {
      const action: GameAction = {
        actionId: 'action-1',
        userId: 'player-1',
        type: 'INVALID_ACTION',
        payload: {},
        timestamp: new Date(),
        validated: false,
      };

      const isValid = gameLogic.validateAction(gameState, action);
      expect(isValid).toBe(false);
    });
  });

  describe('applyAction', () => {
    let gameState: GameState;

    beforeEach(() => {
      gameState = {
        turn: 0,
        currentPlayerId: 'player-1',
        boardState: gameLogic.initializeBoard(12345),
        timestamp: new Date(),
      };
    });

    it('should return a new state object', () => {
      const action: GameAction = {
        actionId: 'action-1',
        userId: 'player-1',
        type: 'MOVE',
        payload: {
          from: { x: 5, y: 5 },
          to: { x: 6, y: 5 },
        },
        timestamp: new Date(),
        validated: true,
      };

      const newState = gameLogic.applyAction(gameState, action);

      expect(newState).not.toBe(gameState);
      expect(newState.timestamp).not.toEqual(gameState.timestamp);
    });

    it('should update timestamp after action', () => {
      const action: GameAction = {
        actionId: 'action-1',
        userId: 'player-1',
        type: 'MOVE',
        payload: {
          from: { x: 5, y: 5 },
          to: { x: 6, y: 5 },
        },
        timestamp: new Date(),
        validated: true,
      };

      const originalTimestamp = gameState.timestamp;
      const newState = gameLogic.applyAction(gameState, action);

      expect(newState.timestamp).not.toEqual(originalTimestamp);
    });
  });

  describe('checkGameEnd', () => {
    it('should return null if game is not over', () => {
      const session: any = {
        players: [
          { userId: 'player-1', score: 50 },
          { userId: 'player-2', score: 45 },
        ],
        gameState: {
          turn: 10,
        },
      };

      const result = gameLogic.checkGameEnd(session);
      expect(result).toBeNull();
    });

    it('should return winner when score reaches 100', () => {
      const session: any = {
        players: [
          { userId: 'player-1', score: 100 },
          { userId: 'player-2', score: 45 },
        ],
        gameState: {
          turn: 50,
        },
      };

      const result = gameLogic.checkGameEnd(session);
      expect(result).not.toBeNull();
      expect(result?.winnerId).toBe('player-1');
    });

    it('should return winner after max turns', () => {
      const session: any = {
        players: [
          { userId: 'player-1', score: 75 },
          { userId: 'player-2', score: 50 },
        ],
        gameState: {
          turn: 1000,
        },
      };

      const result = gameLogic.checkGameEnd(session);
      expect(result).not.toBeNull();
      expect(result?.winnerId).toBe('player-1');
    });

    it('should handle tie by highest score', () => {
      const session: any = {
        players: [
          { userId: 'player-1', score: 75 },
          { userId: 'player-2', score: 75 },
        ],
        gameState: {
          turn: 1000,
        },
      };

      const result = gameLogic.checkGameEnd(session);
      expect(result).not.toBeNull();
      // Should return one of the players (deterministic based on implementation)
      expect(['player-1', 'player-2']).toContain(result?.winnerId);
    });
  });
});
