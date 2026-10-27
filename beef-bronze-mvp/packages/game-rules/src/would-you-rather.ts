import type { GameRules } from './types.ts';

/**
 * Would You Rather: 10 prompts, both players pick A or B at the same time,
 * 60 s per prompt. Nobody wins: the result is how often you matched. Picks
 * stay hidden until both are in (or the round times out), so nobody copies.
 * Unrated and "mutual": it pays XP, never ratings or Beef Points.
 */
export const WYR_ROUNDS = 10;
export const WYR_ROUND_MS = 60_000;

export interface WyrPromptData {
  id: number;
  a: string;
  b: string;
}

export interface WyrOptions {
  prompts: WyrPromptData[];
}

export type WyrChoice = 'a' | 'b';

export interface WyrState {
  prompts: WyrPromptData[];
  round: number;
  roundStartedAt: number;
  picks: Array<WyrChoice | null>;
  history: Array<{ id: number; picks: Array<WyrChoice | null> }>;
}

export interface WyrMove {
  choice: WyrChoice;
}

const finished = (s: WyrState) => s.round >= s.prompts.length;

/** Rounds where both answered the same, and the match percentage over rounds both answered. */
export function wyrMatch(history: WyrState['history']): { matched: number; answered: number; percent: number } {
  const both = history.filter((h) => h.picks.every((p) => p !== null));
  const matched = both.filter((h) => h.picks[0] === h.picks[1]).length;
  return { matched, answered: both.length, percent: both.length ? Math.round((100 * matched) / both.length) : 0 };
}

function closeRound(s: WyrState, now: number): WyrState {
  return {
    ...s,
    round: s.round + 1,
    roundStartedAt: now,
    picks: s.picks.map(() => null),
    history: [...s.history, { id: s.prompts[s.round]!.id, picks: s.picks }],
  };
}

export const wouldYouRather: GameRules<WyrState, WyrMove, WyrOptions> = {
  manifest: {
    id: 'would-you-rather',
    name: 'Would You Rather',
    level: 1,
    formats: ['1v1'],
    minPlayers: 2,
    maxPlayers: 2,
    chance: 'none',
    turnBased: false,
    rulesVersion: 1,
    rated: false,
    verification: 'mutual',
    userText: false,
  },

  init(_seed, playerCount, now, options) {
    const prompts = options?.prompts ?? [];
    if (prompts.length < WYR_ROUNDS) throw new Error(`would-you-rather needs ${WYR_ROUNDS} prompts`);
    return {
      prompts: prompts.slice(0, WYR_ROUNDS),
      round: 0,
      roundStartedAt: now,
      picks: Array.from({ length: playerCount }, () => null),
      history: [],
    };
  },

  awaiting: (s) => (finished(s) ? [] : s.picks.flatMap((p, seat) => (p ? [] : [seat]))),

  validate(s, move, seat, ctx) {
    if (finished(s)) return 'game_over';
    const m = move as WyrMove;
    if (!m || (m.choice !== 'a' && m.choice !== 'b')) return 'bad_move_shape';
    if (ctx.now >= s.roundStartedAt + WYR_ROUND_MS) return 'time_expired';
    if (s.picks[seat]) return 'already_answered';
    return null;
  },

  apply(s, m, seat, ctx) {
    const picks = s.picks.slice();
    picks[seat] = m.choice;
    const next = { ...s, picks };
    return picks.every(Boolean) ? closeRound(next, ctx.now) : next;
  },

  outcome(s) {
    const { matched } = wyrMatch(s.history);
    return { done: finished(s), winner: null, draw: false, scores: [matched, matched] };
  },

  view(s, seat) {
    const p = s.prompts[s.round];
    return {
      round: s.round,
      rounds: s.prompts.length,
      roundEndsAt: s.roundStartedAt + WYR_ROUND_MS,
      prompt: p ?? null,
      answered: s.picks.map(Boolean),
      myPick: seat === null ? null : s.picks[seat],
      history: s.history,
      match: wyrMatch(s.history),
    };
  },

  deadline: (s) => (finished(s) ? null : s.roundStartedAt + WYR_ROUND_MS),
  // A round nobody answered means both walked away: end instead of ticking through the rest.
  onDeadline: (s, now) =>
    s.picks.some(Boolean) ? closeRound(s, now) : { ...closeRound(s, now), round: s.prompts.length },
};
