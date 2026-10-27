import type { AnyGameRules, GameOutcome, Seat } from './types.ts';

/**
 * A match wraps a title's rules with what every game needs regardless of
 * rules: an append-only event log, server timestamps, resignations, and turn
 * forfeits. Everything that changes a match is a log entry, so replaying the
 * log reproduces the exact final state, including how it ended. This is the
 * dispute evidence (Spec 02, "Result verification").
 */
export type LogEntry =
  | { kind: 'move'; seat: Seat; move: unknown; at: number }
  /** A rules-owned deadline fired (clock flag, round closed). */
  | { kind: 'deadline'; at: number }
  /** The seat to move ran out of turn time (games without their own clock). */
  | { kind: 'forfeit'; seat: Seat; at: number }
  | { kind: 'resign'; seat: Seat; at: number };

export interface Ending {
  winner: Seat | null;
  draw: boolean;
  reason: 'resign' | 'timeout';
}

export interface MatchState {
  gameId: string;
  rulesVersion: number;
  seed: number;
  playerCount: number;
  startedAt: number;
  lastActionAt: number;
  options?: unknown;
  state: unknown;
  /** Set when the match ended outside the rules (resignation, turn forfeit). */
  ending: Ending | null;
  log: LogEntry[];
}

export type MatchResult = MatchState | { error: string };

export function startMatch(
  rules: AnyGameRules,
  seed: number,
  playerCount: number,
  now: number,
  options?: unknown,
): MatchState {
  if (playerCount < rules.manifest.minPlayers || playerCount > rules.manifest.maxPlayers) {
    throw new Error(`${rules.manifest.id} takes ${rules.manifest.minPlayers}-${rules.manifest.maxPlayers} players`);
  }
  return {
    gameId: rules.manifest.id,
    rulesVersion: rules.manifest.rulesVersion,
    seed,
    playerCount,
    startedAt: now,
    lastActionAt: now,
    options,
    state: rules.init(seed, playerCount, now, options),
    ending: null,
    log: [],
  };
}

export function matchOutcome(rules: AnyGameRules, m: MatchState): GameOutcome {
  const base = rules.outcome(m.state);
  if (m.ending) return { done: true, winner: m.ending.winner, draw: m.ending.draw, scores: base.scores };
  return base;
}

export function matchAwaiting(rules: AnyGameRules, m: MatchState): Seat[] {
  return matchOutcome(rules, m).done ? [] : rules.awaiting(m.state);
}

/** When the engine must next act on its own: a rules deadline, or the turn-time limit. */
export function matchDeadline(rules: AnyGameRules, m: MatchState): number | null {
  if (matchOutcome(rules, m).done) return null;
  if (rules.deadline) return rules.deadline(m.state);
  const t = rules.manifest.turnTimeoutMs;
  return t && rules.awaiting(m.state).length > 0 ? m.lastActionAt + t : null;
}

export function matchView(rules: AnyGameRules, m: MatchState, seat: Seat | null): unknown {
  // At the end every secret is revealed: the 20 Questions answer, the lies, the right answers.
  if (matchOutcome(rules, m).done) return m.state;
  return rules.view ? rules.view(m.state, seat) : m.state;
}

const otherSeatWins = (m: MatchState, loser: Seat): Seat | null => (m.playerCount === 2 ? 1 - loser : null);

/** Applies one log entry. Pure: returns the next match, or an error code and no change. */
export function applyEntry(rules: AnyGameRules, m: MatchState, e: LogEntry): MatchResult {
  if (matchOutcome(rules, m).done) return { error: 'game_over' };
  const next = (patch: Partial<MatchState>): MatchState => ({ ...m, ...patch, lastActionAt: e.at, log: [...m.log, e] });

  switch (e.kind) {
    case 'move': {
      if (e.seat < 0 || e.seat >= m.playerCount) return { error: 'not_a_player' };
      const deadline = matchDeadline(rules, m);
      if (deadline !== null && e.at >= deadline) return { error: 'time_expired' };
      const err = rules.validate(m.state, e.move, e.seat, { now: e.at });
      if (err) return { error: err };
      return next({ state: rules.apply(m.state, e.move, e.seat, { now: e.at }) });
    }
    case 'deadline': {
      const deadline = matchDeadline(rules, m);
      if (deadline === null || e.at < deadline || !rules.onDeadline) return { error: 'not_due' };
      return next({ state: rules.onDeadline(m.state, e.at) });
    }
    case 'forfeit': {
      const deadline = matchDeadline(rules, m);
      if (rules.deadline || deadline === null || e.at < deadline) return { error: 'not_due' };
      if (!rules.awaiting(m.state).includes(e.seat)) return { error: 'not_awaited' };
      return next({ ending: { winner: otherSeatWins(m, e.seat), draw: false, reason: 'timeout' } });
    }
    case 'resign': {
      if (e.seat < 0 || e.seat >= m.playerCount) return { error: 'not_a_player' };
      if (rules.resign) return next({ state: rules.resign(m.state, e.seat) });
      return next({ ending: { winner: otherSeatWins(m, e.seat), draw: m.playerCount !== 2, reason: 'resign' } });
    }
  }
}

/**
 * What the engine does when a match's deadline passes: rules-owned deadlines
 * fire `onDeadline`; otherwise the seat to move forfeits.
 */
export function deadlineEntry(rules: AnyGameRules, m: MatchState, now: number): LogEntry | null {
  const d = matchDeadline(rules, m);
  if (d === null || now < d) return null;
  if (rules.deadline) return { kind: 'deadline', at: now };
  const seat = rules.awaiting(m.state)[0];
  return seat === undefined ? null : { kind: 'forfeit', seat, at: now };
}

/** Rebuilds a match from its log. Throws if any entry no longer applies (rules changed or tampering). */
export function replayMatch(
  rules: AnyGameRules,
  seed: number,
  playerCount: number,
  startedAt: number,
  log: LogEntry[],
  options?: unknown,
): MatchState {
  let m = startMatch(rules, seed, playerCount, startedAt, options);
  for (const e of log) {
    const r = applyEntry(rules, m, e);
    if ('error' in r) throw new Error(`replay diverged at ${e.kind}: ${r.error}`);
    m = r;
  }
  return m;
}
