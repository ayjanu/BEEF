import type { GameOutcome, GameRules, Seat } from './types.ts';

/**
 * Four Up: drop discs into a 7x6 grid; four in a row wins.
 * (Renamed from "Connect 4", which is a third-party trademark — Spec 02.)
 */
export const COLS = 7;
export const ROWS = 6;

/** 0 = empty, 1 = seat 0, 2 = seat 1. board[row][col], row 0 is the bottom. */
export type Cell = 0 | 1 | 2;

export interface FourUpState {
  board: Cell[][];
  turn: Seat;
  moves: number;
  winner: Seat | null;
  draw: boolean;
  /** Cells of the winning line as [row, col] pairs, for the glow animation. */
  winLine: Array<[number, number]> | null;
}

export interface FourUpMove {
  column: number;
}

function emptyBoard(): Cell[][] {
  return Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => 0 as Cell));
}

function cell(board: Cell[][], r: number, c: number): Cell | undefined {
  return board[r]?.[c];
}

/** Lowest empty row in a column, or -1 when the column is full. */
export function landingRow(board: Cell[][], column: number): number {
  for (let r = 0; r < ROWS; r++) {
    if (cell(board, r, column) === 0) return r;
  }
  return -1;
}

const DIRECTIONS: Array<[number, number]> = [
  [0, 1], // horizontal
  [1, 0], // vertical
  [1, 1], // diagonal up-right
  [1, -1], // diagonal up-left
];

function findLine(board: Cell[][], r: number, c: number): Array<[number, number]> | null {
  const who = cell(board, r, c);
  if (!who) return null;
  for (const [dr, dc] of DIRECTIONS) {
    const line: Array<[number, number]> = [[r, c]];
    for (const sign of [1, -1]) {
      let rr = r + dr * sign;
      let cc = c + dc * sign;
      while (cell(board, rr, cc) === who) {
        line.push([rr, cc]);
        rr += dr * sign;
        cc += dc * sign;
      }
    }
    if (line.length >= 4) return line;
  }
  return null;
}

function isMove(move: unknown): move is FourUpMove {
  return (
    typeof move === 'object' &&
    move !== null &&
    Number.isInteger((move as FourUpMove).column)
  );
}

export const fourUp: GameRules<FourUpState, FourUpMove> = {
  manifest: {
    id: 'four-up',
    name: 'Four Up',
    level: 1,
    formats: ['1v1'],
    minPlayers: 2,
    maxPlayers: 2,
    chance: 'none',
    turnBased: true,
    rulesVersion: 2,
    rated: true,
    verification: 'server',
    userText: false,
    turnTimeoutMs: 24 * 60 * 60 * 1000, // Spec 02: a Level 1 turn may wait up to 24 h, then forfeits
  },

  init(_seed, playerCount) {
    if (playerCount !== 2) throw new Error('Four Up needs exactly 2 players');
    return { board: emptyBoard(), turn: 0, moves: 0, winner: null, draw: false, winLine: null };
  },

  awaiting(state) {
    return state.winner !== null || state.draw ? [] : [state.turn];
  },

  validate(state, move, seat) {
    if (state.winner !== null || state.draw) return 'game_over';
    if (seat !== state.turn) return 'not_your_turn';
    if (!isMove(move)) return 'bad_move_shape';
    if (move.column < 0 || move.column >= COLS) return 'column_out_of_range';
    if (landingRow(state.board, move.column) === -1) return 'column_full';
    return null;
  },

  apply(state, move, seat) {
    const board = state.board.map((row) => row.slice()) as Cell[][];
    const r = landingRow(board, move.column);
    const row = board[r];
    if (r === -1 || !row) throw new Error('apply called with an invalid move; call validate first');
    row[move.column] = (seat + 1) as Cell;
    const moves = state.moves + 1;
    const winLine = findLine(board, r, move.column);
    return {
      board,
      turn: seat === 0 ? 1 : 0,
      moves,
      winner: winLine ? seat : null,
      draw: !winLine && moves === ROWS * COLS,
      winLine,
    };
  },

  outcome(state): GameOutcome {
    return { done: state.winner !== null || state.draw, winner: state.winner, draw: state.draw };
  },
};
