/**
 * The Beef Point economy from Spec 02, "Progression and economy":
 *
 *   BP = B_level × O × S × D, then capped per day.
 *
 * Beef Points are earn-only: never bought, staked, transferred, or paid by
 * chance-driven games. XP is unlimited progress and is paid for finishing
 * any game, win or lose.
 */

export type Level = 1 | 2 | 3 | 4;
/** "complete": a finished game with no winner by design (Would You Rather). */
export type Outcome = 'win' | 'draw' | 'loss' | 'complete';
export type Chance = 'none' | 'low' | 'high';

export const BASE_BP: Readonly<Record<Level, number>> = { 1: 10, 2: 10, 3: 20, 4: 50 };
export const OUTCOME_FACTOR: Readonly<Record<Outcome, number>> = { win: 1, draw: 0.6, loss: 0.3, complete: 0 };

/** Verification strength multipliers (Spec 02, "Result verification"). */
export const STRENGTH = {
  serverAuthoritative: 1.0,
  mutualConfirm: 0, // opinion games pay XP only
  unrated: 0, // social titles with self-reported answers pay XP only
  captureAiReview: 0.8,
  captureWithReferee: 1.0,
  venueAttest: 1.5,
  playerAttest: 0.5,
} as const;

/** Daily caps per level group. Level 4 is uncapped per day but capped per venue visit. */
export const DAILY_CAP = { levels1and2: 50, level3: 60, perVenueVisit: 300 } as const;

/** Same opponent, same day: 1st game 1.0, 2nd 0.5, 3rd 0.25, 4th+ 0. */
export function diminishing(nthGameVsOpponentToday: number): number {
  if (nthGameVsOpponentToday <= 1) return 1;
  if (nthGameVsOpponentToday === 2) return 0.5;
  if (nthGameVsOpponentToday === 3) return 0.25;
  return 0;
}

export interface BpInput {
  level: Level;
  outcome: Outcome;
  strength: number;
  nthGameVsOpponentToday: number;
  chance: Chance;
}

export function bpForResult(input: BpInput): number {
  if (input.chance === 'high') return 0;
  const raw =
    BASE_BP[input.level] *
    OUTCOME_FACTOR[input.outcome] *
    input.strength *
    diminishing(input.nthGameVsOpponentToday);
  return Math.round(raw);
}

/** Clamp a payout to what is left of today's cap. */
export function applyDailyCap(bp: number, alreadyEarnedToday: number, cap: number): number {
  return Math.max(0, Math.min(bp, cap - alreadyEarnedToday));
}

export function capForLevel(level: Level): number {
  if (level === 3) return DAILY_CAP.level3;
  if (level === 4) return Number.POSITIVE_INFINITY;
  return DAILY_CAP.levels1and2;
}

export const XP_FOR: Readonly<Record<Outcome, number>> = { win: 30, draw: 20, loss: 15, complete: 20 };

/** Games that ended without anyone playing (both players walked away) pay nothing. */
export const NO_CONTEST_REASONS: ReadonlySet<string> = new Set(['abandoned']);

/** Level n needs 50 × (n − 1)² XP; capped at level 100. */
export function levelForXp(xp: number): number {
  return Math.min(100, Math.floor(Math.sqrt(Math.max(0, xp) / 50)) + 1);
}
