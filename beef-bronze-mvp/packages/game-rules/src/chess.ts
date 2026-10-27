import { Chess } from 'chess.js';
import type { GameManifest, GameRules, Seat } from './types.ts';

/**
 * Chess with a server-kept clock (seat 0 plays white). Move legality, mate,
 * stalemate, repetition, insufficient material and the 50-move rule come from
 * chess.js (BSD-2-Clause). Two titles share this implementation: Classic
 * (5 min + 3 s per move) and Bullet (1 min, no increment), per Spec 02.
 */
export interface ChessState {
  /** SAN moves from the start position; the board is rebuilt from these (needed for repetition). */
  sans: string[];
  fen: string;
  /** Remaining time per seat in ms, as of `turnStartedAt`. */
  clocks: [number, number];
  incrementMs: number;
  turnStartedAt: number;
  result: { winner: Seat | null; draw: boolean; reason: string } | null;
}

export interface ChessMove {
  from: string;
  to: string;
  promotion?: 'q' | 'r' | 'b' | 'n';
}

const SQUARE = /^[a-h][1-8]$/;
const turnSeat = (fen: string): Seat => (fen.split(' ')[1] === 'w' ? 0 : 1);

function isMove(m: unknown): m is ChessMove {
  const x = m as ChessMove;
  return (
    !!x &&
    typeof x.from === 'string' &&
    typeof x.to === 'string' &&
    SQUARE.test(x.from) &&
    SQUARE.test(x.to) &&
    (x.promotion === undefined || ['q', 'r', 'b', 'n'].includes(x.promotion))
  );
}

function board(sans: string[]): Chess {
  const c = new Chess();
  for (const san of sans) c.move(san);
  return c;
}

/** Only a bare king (or king + one minor piece) cannot deliver mate: a flag against it is a draw. */
function cannotMate(fen: string, seat: Seat): boolean {
  const pieces = fen.split(' ')[0]!.replace(/[^a-zA-Z]/g, '');
  const mine = seat === 0 ? pieces.replace(/[a-z]/g, '') : pieces.replace(/[A-Z]/g, '').toUpperCase();
  return mine === 'K' || mine === 'KN' || mine === 'NK' || mine === 'KB' || mine === 'BK';
}

function makeChess(manifest: GameManifest, baseMs: number, incrementMs: number): GameRules<ChessState, ChessMove> {
  return {
    manifest,

    init(_seed, _players, now) {
      return {
        sans: [],
        fen: new Chess().fen(),
        clocks: [baseMs, baseMs],
        incrementMs,
        turnStartedAt: now,
        result: null,
      };
    },

    awaiting: (s) => (s.result ? [] : [turnSeat(s.fen)]),

    validate(s, move, seat, ctx) {
      if (s.result) return 'game_over';
      if (seat !== turnSeat(s.fen)) return 'not_your_turn';
      if (!isMove(move)) return 'bad_move_shape';
      if (ctx.now - s.turnStartedAt >= s.clocks[seat as 0 | 1]) return 'time_expired';
      try {
        new Chess(s.fen).move({ from: move.from, to: move.to, promotion: move.promotion });
        return null;
      } catch {
        return 'illegal_move';
      }
    },

    apply(s, move, seat, ctx) {
      const c = board(s.sans);
      const played = c.move({ from: move.from, to: move.to, promotion: move.promotion });
      const clocks: [number, number] = [s.clocks[0], s.clocks[1]];
      clocks[seat as 0 | 1] = clocks[seat as 0 | 1] - (ctx.now - s.turnStartedAt) + s.incrementMs;
      let result: ChessState['result'] = null;
      if (c.isCheckmate()) result = { winner: seat, draw: false, reason: 'checkmate' };
      else if (c.isStalemate()) result = { winner: null, draw: true, reason: 'stalemate' };
      else if (c.isThreefoldRepetition()) result = { winner: null, draw: true, reason: 'repetition' };
      else if (c.isInsufficientMaterial()) result = { winner: null, draw: true, reason: 'insufficient_material' };
      else if (c.isDraw()) result = { winner: null, draw: true, reason: 'fifty_move_rule' };
      return { sans: [...s.sans, played.san], fen: c.fen(), clocks, incrementMs: s.incrementMs, turnStartedAt: ctx.now, result };
    },

    outcome: (s) =>
      s.result ? { done: true, winner: s.result.winner, draw: s.result.draw } : { done: false, winner: null, draw: false },

    deadline: (s) => (s.result ? null : s.turnStartedAt + s.clocks[turnSeat(s.fen) as 0 | 1]),

    onDeadline(s, now) {
      const flagged = turnSeat(s.fen);
      const clocks: [number, number] = [s.clocks[0], s.clocks[1]];
      clocks[flagged as 0 | 1] = 0;
      const opponent = 1 - flagged;
      const result = cannotMate(s.fen, opponent)
        ? { winner: null, draw: true, reason: 'timeout_vs_insufficient_material' }
        : { winner: opponent, draw: false, reason: 'timeout' };
      return { ...s, clocks, turnStartedAt: now, result };
    },

    resign: (s, seat) => ({ ...s, result: { winner: 1 - seat, draw: false, reason: 'resignation' } }),
  };
}

const base = {
  level: 1 as const,
  formats: ['1v1' as const],
  minPlayers: 2,
  maxPlayers: 2,
  chance: 'none' as const,
  turnBased: true,
  rulesVersion: 1,
  rated: true,
  verification: 'server' as const,
  userText: false,
};

export const chessClassic = makeChess({ ...base, id: 'chess', name: 'Chess (5+3)' }, 5 * 60_000, 3_000);
export const chessBullet = makeChess({ ...base, id: 'chess-bullet', name: 'Chess Bullet (1+0)' }, 60_000, 0);
