import type { GameRules, Seat } from './types.ts';

/**
 * Two Truths & a Lie, 1v1. Both players secretly write three statements about
 * themselves and mark the lie (3 min), then both guess the other's lie (60 s).
 * A point for spotting the lie, a point for fooling the other player.
 * Statements are free text, so the engine screens them with the safety
 * service before they are stored (manifest.userText). Unrated.
 */
export const TT_WRITE_MS = 3 * 60_000;
export const TT_GUESS_MS = 60_000;
export const TT_MIN_LEN = 3;
export const TT_MAX_LEN = 140;

export interface TtSet {
  statements: [string, string, string];
  lie: number;
}

export type TtMove = { kind: 'write'; statements: string[]; lie: number } | { kind: 'guess'; guess: number };

export interface TtState {
  phase: 'write' | 'guess' | 'done';
  phaseStartedAt: number;
  sets: Array<TtSet | null>;
  guesses: Array<number | null>;
  scores: [number, number];
  result: { winner: Seat | null; draw: boolean; reason: string } | null;
}

const other = (seat: Seat): Seat => 1 - seat;
const isIdx = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= 0 && (n as number) <= 2;

function startGuessing(s: TtState, now: number): TtState {
  return { ...s, phase: 'guess', phaseStartedAt: now };
}

function finish(s: TtState, now: number): TtState {
  const right = [0, 1].map((seat) => s.guesses[seat] === s.sets[other(seat)]!.lie);
  const scores: [number, number] = [
    (right[0] ? 1 : 0) + (right[1] ? 0 : 1),
    (right[1] ? 1 : 0) + (right[0] ? 0 : 1),
  ];
  const [a, b] = scores;
  const result = { winner: a === b ? null : a > b ? 0 : 1, draw: a === b, reason: 'scored' };
  return { ...s, phase: 'done', phaseStartedAt: now, scores, result };
}

export const twoTruths: GameRules<TtState, TtMove> = {
  manifest: {
    id: 'two-truths',
    name: 'Two Truths & a Lie',
    level: 1,
    formats: ['1v1'],
    minPlayers: 2,
    maxPlayers: 2,
    chance: 'none',
    turnBased: false,
    rulesVersion: 1,
    rated: false,
    verification: 'server',
    userText: true,
  },

  init: (_seed, _players, now) => ({
    phase: 'write',
    phaseStartedAt: now,
    sets: [null, null],
    guesses: [null, null],
    scores: [0, 0],
    result: null,
  }),

  awaiting(s) {
    if (s.phase === 'write') return [0, 1].filter((i) => !s.sets[i]);
    if (s.phase === 'guess') return [0, 1].filter((i) => s.guesses[i] === null);
    return [];
  },

  validate(s, move, seat, ctx) {
    if (s.phase === 'done') return 'game_over';
    const m = move as TtMove;
    if (!m || (m.kind !== 'write' && m.kind !== 'guess')) return 'bad_move_shape';
    if (m.kind !== s.phase) return 'wrong_phase';
    const limit = s.phaseStartedAt + (s.phase === 'write' ? TT_WRITE_MS : TT_GUESS_MS);
    if (ctx.now >= limit) return 'time_expired';
    if (m.kind === 'write') {
      if (s.sets[seat]) return 'already_written';
      if (!Array.isArray(m.statements) || m.statements.length !== 3 || !isIdx(m.lie)) return 'bad_move_shape';
      if (!m.statements.every((t) => typeof t === 'string')) return 'bad_move_shape';
      const trimmed = m.statements.map((t) => t.trim());
      if (trimmed.some((t) => t.length < TT_MIN_LEN || t.length > TT_MAX_LEN)) return 'statement_length';
      if (new Set(trimmed.map((t) => t.toLowerCase())).size !== 3) return 'statements_not_distinct';
      return null;
    }
    if (s.guesses[seat] !== null) return 'already_guessed';
    if (!isIdx(m.guess)) return 'bad_move_shape';
    return null;
  },

  apply(s, m, seat, ctx) {
    if (m.kind === 'write') {
      const sets = s.sets.slice();
      const st = m.statements.map((t) => t.trim()) as [string, string, string];
      sets[seat] = { statements: st, lie: m.lie };
      const next = { ...s, sets };
      return sets.every(Boolean) ? startGuessing(next, ctx.now) : next;
    }
    const guesses = s.guesses.slice();
    guesses[seat] = m.guess;
    const next = { ...s, guesses };
    return guesses.every((g) => g !== null) ? finish(next, ctx.now) : next;
  },

  outcome: (s) =>
    s.result
      ? { done: true, winner: s.result.winner, draw: s.result.draw, scores: [...s.scores] }
      : { done: false, winner: null, draw: false, scores: [...s.scores] },

  view(s, seat) {
    const sets = s.sets.map((set, i) => {
      if (!set) return null;
      if (i === seat) return set;
      // The other player's statements appear only in the guess phase, never the lie.
      return s.phase === 'guess' ? { statements: set.statements } : null;
    });
    return {
      phase: s.phase,
      phaseEndsAt: s.phaseStartedAt + (s.phase === 'write' ? TT_WRITE_MS : TT_GUESS_MS),
      written: s.sets.map(Boolean),
      guessed: s.guesses.map((g) => g !== null),
      sets,
      myGuess: seat === null ? null : s.guesses[seat],
      scores: s.scores,
    };
  },

  deadline: (s) =>
    s.phase === 'done' ? null : s.phaseStartedAt + (s.phase === 'write' ? TT_WRITE_MS : TT_GUESS_MS),

  onDeadline(s, now) {
    if (s.phase === 'guess') return finish(s, now); // a missing guess counts as wrong
    const wrote = [0, 1].filter((i) => s.sets[i]);
    const result =
      wrote.length === 0
        ? { winner: null, draw: false, reason: 'abandoned' }
        : { winner: wrote[0]!, draw: false, reason: 'opponent_did_not_write' };
    return { ...s, phase: 'done', phaseStartedAt: now, result };
  },

  resign: (s, seat) => ({ ...s, phase: 'done', result: { winner: other(seat), draw: false, reason: 'resignation' } }),

  userTexts: (m) => (m.kind === 'write' ? m.statements : []),
};
