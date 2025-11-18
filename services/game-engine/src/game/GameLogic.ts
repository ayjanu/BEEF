import seedrandom from 'seedrandom';
import { GameSession, GameState, GameAction } from '../types';

/**
 * GameLogic contains the core game rules and mechanics
 * This is a simplified example - replace with actual game implementation
 */
export class GameLogic {
  /**
   * Initialize the game board with a deterministic seed
   */
  initializeBoard(seed: number): any {
    const rng = seedrandom(seed.toString());

    // Example: Simple grid-based game board
    return {
      grid: this.generateGrid(10, 10, rng),
      entities: [],
      resources: 1000,
    };
  }

  /**
   * Validate if an action is legal
   */
  validateAction(state: GameState, action: GameAction): boolean {
    // Example validation rules
    switch (action.type) {
      case 'MOVE':
        return this.validateMove(state, action);
      case 'ATTACK':
        return this.validateAttack(state, action);
      case 'BUILD':
        return this.validateBuild(state, action);
      default:
        return false;
    }
  }

  /**
   * Apply an action to the game state
   */
  applyAction(state: GameState, action: GameAction): GameState {
    const newState = JSON.parse(JSON.stringify(state)); // Deep clone

    switch (action.type) {
      case 'MOVE':
        newState.boardState = this.applyMove(newState.boardState, action);
        break;
      case 'ATTACK':
        newState.boardState = this.applyAttack(newState.boardState, action);
        break;
      case 'BUILD':
        newState.boardState = this.applyBuild(newState.boardState, action);
        break;
    }

    newState.timestamp = new Date();
    return newState;
  }

  /**
   * Check if the game has ended
   */
  checkGameEnd(session: GameSession): { winnerId: string } | null {
    // Example end condition: first to 100 points
    for (const player of session.players) {
      if (player.score >= 100) {
        return { winnerId: player.userId };
      }
    }

    // Example end condition: maximum turns reached
    if (session.gameState.turn >= 1000) {
      // Find player with highest score
      const winner = session.players.reduce((prev, current) =>
        prev.score > current.score ? prev : current
      );
      return { winnerId: winner.userId };
    }

    return null;
  }

  // Private helper methods

  private generateGrid(width: number, height: number, rng: () => number): number[][] {
    const grid: number[][] = [];
    for (let y = 0; y < height; y++) {
      const row: number[] = [];
      for (let x = 0; x < width; x++) {
        // Generate terrain with deterministic randomness
        row.push(Math.floor(rng() * 5));
      }
      grid.push(row);
    }
    return grid;
  }

  private validateMove(state: GameState, action: GameAction): boolean {
    const { from, to } = action.payload;
    if (!from || !to) return false;

    // Example: Check if destination is adjacent
    const dx = Math.abs(to.x - from.x);
    const dy = Math.abs(to.y - from.y);

    return dx <= 1 && dy <= 1 && (dx + dy) > 0;
  }

  private validateAttack(state: GameState, action: GameAction): boolean {
    const { attacker, target } = action.payload;
    if (!attacker || !target) return false;

    // Example validation
    return true; // Simplified
  }

  private validateBuild(state: GameState, action: GameAction): boolean {
    const { position, buildingType } = action.payload;
    if (!position || !buildingType) return false;

    // Example: Check if player has resources
    return state.boardState.resources >= 100;
  }

  private applyMove(boardState: any, action: GameAction): any {
    // Apply move logic
    const { from, to } = action.payload;
    // ... move entity from 'from' position to 'to' position
    return boardState;
  }

  private applyAttack(boardState: any, action: GameAction): any {
    // Apply attack logic
    return boardState;
  }

  private applyBuild(boardState: any, action: GameAction): any {
    // Apply build logic
    const { position, buildingType } = action.payload;
    boardState.resources -= 100;
    // ... add building to board
    return boardState;
  }
}
