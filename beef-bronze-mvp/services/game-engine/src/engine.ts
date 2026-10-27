import {
  applyEntry,
  deadlineEntry,
  getRules,
  matchAwaiting,
  matchDeadline,
  matchOutcome,
  matchView,
  startMatch,
  type AnyGameRules,
  type LogEntry,
  type MatchState,
} from '@beef/game-rules';
import type { SessionOpen } from '@beef/contracts';

/**
 * Game sessions are stored outside the process so any game-engine replica can
 * accept any player's socket. Every change is a compare-and-set on the stored
 * record, which makes moves and timers from several replicas safe without a
 * single owner.
 *
 * The session is a `MatchState` from @beef/game-rules plus who is playing. All
 * game logic, timers included, lives in the rules package; the engine only
 * supplies the server clock, content, safety screening and storage.
 */
export interface StoredSession extends MatchState {
  sessionId: string;
  players: string[];
  status: 'active' | 'finished';
}

export interface SessionStore {
  create(s: StoredSession): Promise<boolean>;
  get(sessionId: string): Promise<StoredSession | null>;
  /**
   * Apply `fn` atomically. `fn` returns the next record, or an error code to
   * abort. `timerOf` gives the next timer for the new record; it is written in
   * the same atomic step, so a slower replica can never overwrite a newer timer.
   */
  update(
    sessionId: string,
    fn: (s: StoredSession) => StoredSession | { error: string },
    timerOf?: (s: StoredSession) => number | null,
  ): Promise<StoredSession | { error: string }>;
  /** Record when the session next needs the engine to act on its own (null = never). */
  schedule(sessionId: string, at: number | null): Promise<void>;
  /** Session ids whose scheduled time has passed. */
  due(now: number, limit: number): Promise<string[]>;
}

export interface EndedGame {
  session: StoredSession;
  winnerSeat: number | null;
  draw: boolean;
  reason: string;
  scores?: number[];
  /** Moves made by each seat: a seat that never played makes the game a no-contest. */
  seatMoves: number[];
}

export type ActResult =
  | { ok: true; session: StoredSession; ended: EndedGame | null }
  | { ok: false; error: string };

export type ScreenVerdict = 'allow' | 'block' | 'unavailable';

export interface EngineDeps {
  now?: () => number;
  /** Init options (question decks...) for a title, drawn from the seed. */
  content?: (gameId: string, seed: number) => unknown;
  /** Safety check for player-written text inside moves. */
  screen?: (texts: string[], context: string) => Promise<ScreenVerdict>;
}

/** Safety-service context per title; defaults to the generic game context. */
const SCREEN_CONTEXT: Record<string, string> = { 'two-truths': 'two_truths' };

export function endReason(rules: AnyGameRules, s: MatchState): string {
  if (s.ending) return s.ending.reason;
  const r = (s.state as { result?: { reason?: unknown } } | null)?.result?.reason;
  if (typeof r === 'string') return r;
  return rules.outcome(s.state).draw ? 'draw' : 'complete';
}

export class Engine {
  private readonly now: () => number;
  private readonly content: (gameId: string, seed: number) => unknown;
  private readonly screen?: EngineDeps['screen'];

  constructor(
    private readonly store: SessionStore,
    deps: EngineDeps = {},
  ) {
    this.now = deps.now ?? Date.now;
    this.content = deps.content ?? (() => undefined);
    this.screen = deps.screen;
  }

  async open(open: SessionOpen): Promise<StoredSession> {
    const rules = getRules(open.gameId);
    const now = this.now();
    const s: StoredSession = {
      ...startMatch(rules, open.seed, open.players.length, now, this.content(open.gameId, open.seed)),
      sessionId: open.sessionId,
      players: open.players,
      status: 'active',
    };
    const created = await this.store.create(s);
    if (!created) return (await this.store.get(open.sessionId)) as StoredSession; // idempotent
    await this.store.schedule(s.sessionId, matchDeadline(rules, s));
    return s;
  }

  seatOf(s: StoredSession, userId: string): number {
    return s.players.indexOf(userId);
  }

  /** What one player (or a spectator, seat null) is allowed to see. Secrets stay hidden until the end. */
  view(s: StoredSession, seat: number | null) {
    const rules = getRules(s.gameId);
    const o = matchOutcome(rules, s);
    return {
      sessionId: s.sessionId,
      gameId: s.gameId,
      players: s.players,
      status: s.status,
      seat,
      state: matchView(rules, s, seat),
      awaiting: matchAwaiting(rules, s),
      deadline: matchDeadline(rules, s),
      moves: s.log.filter((e) => e.kind === 'move').length,
      outcome: o.done ? { winnerSeat: o.winner, draw: o.draw, scores: o.scores, reason: endReason(rules, s) } : null,
    };
  }

  async move(sessionId: string, userId: string, move: unknown): Promise<ActResult> {
    const s = await this.store.get(sessionId);
    if (!s) return { ok: false, error: 'session_not_found' };
    const seat = this.seatOf(s, userId);
    if (seat < 0) return { ok: false, error: 'not_a_player' };
    const rules = getRules(s.gameId);

    // Screen player-written text before it can reach the other player or storage.
    if (rules.manifest.userText && rules.userTexts) {
      const preview = rules.validate(s.state, move, seat, { now: this.now() });
      if (preview) return { ok: false, error: preview };
      const texts = rules.userTexts(move).filter((t) => t.trim().length > 0);
      if (texts.length > 0) {
        // Fail closed: with no screening available, game text is not accepted.
        const verdict = this.screen ? await this.screen(texts, SCREEN_CONTEXT[s.gameId] ?? 'game_text') : 'unavailable';
        if (verdict === 'block') return { ok: false, error: 'text_blocked' };
        if (verdict === 'unavailable') return { ok: false, error: 'safety_unavailable' };
      }
    }
    return this.commit(sessionId, (m) => ({ kind: 'move', seat: this.seatOf(m, userId), move, at: this.now() }));
  }

  async resign(sessionId: string, userId: string): Promise<ActResult> {
    return this.commit(sessionId, (m) => {
      const seat = this.seatOf(m, userId);
      return seat < 0 ? { error: 'not_a_player' } : { kind: 'resign', seat, at: this.now() };
    });
  }

  /** Fire a due timer (clock flag, round close, turn forfeit). Safe to call from every replica. */
  async tick(sessionId: string): Promise<ActResult> {
    const r = await this.commit(sessionId, () => ({ error: 'nothing_due' }));
    if (!r.ok) {
      // A stale timer (the deadline moved, or the game ended elsewhere): re-sync it so the sweeper stops asking.
      const s = await this.store.get(sessionId);
      await this.store.schedule(sessionId, s && s.status === 'active' ? matchDeadline(getRules(s.gameId), s) : null);
    }
    return r;
  }

  /**
   * Applies, atomically: any timer that is already due, then the entry built
   * by `entryFor` (if the game is still on). A timer that fired first wins:
   * a move that arrives after the clock ran out is too late even if the
   * sweeper has not run yet.
   */
  private async commit(
    sessionId: string,
    entryFor: (s: StoredSession) => LogEntry | { error: string },
  ): Promise<ActResult> {
    let ended: EndedGame | null = null;
    const timerOf = (s: StoredSession) => (s.status === 'active' ? matchDeadline(getRules(s.gameId), s) : null);
    const res = await this.store.update(sessionId, (s) => {
      ended = null; // the store may retry this function
      if (s.status !== 'active') return { error: 'game_over' };
      const rules = getRules(s.gameId);
      let m: MatchState = s;
      let changed = false;
      const due = deadlineEntry(rules, m, this.now());
      if (due) {
        const r = applyEntry(rules, m, due);
        if (!('error' in r)) {
          m = r;
          changed = true;
        }
      }
      if (!matchOutcome(rules, m).done) {
        const entry = entryFor({ ...s, ...m });
        if ('error' in entry) {
          if (!changed) return entry;
        } else {
          const r = applyEntry(rules, m, entry);
          if ('error' in r) {
            if (!changed) return r;
          } else {
            m = r;
          }
        }
      } else if (!changed) {
        return { error: 'game_over' };
      }
      const o = matchOutcome(rules, m);
      const next: StoredSession = { ...s, ...m, status: o.done ? 'finished' : 'active' };
      if (o.done) {
        const seatMoves = next.players.map((_, seat) => next.log.filter((e) => e.kind === 'move' && e.seat === seat).length);
        ended = { session: next, winnerSeat: o.winner, draw: o.draw, reason: endReason(rules, next), scores: o.scores, seatMoves };
      }
      return next;
    }, timerOf);
    if ('error' in res) return { ok: false, error: res.error };
    return { ok: true, session: res, ended };
  }
}

/** In-memory store for tests and single-process local runs. */
export class MemoryStore implements SessionStore {
  private readonly m = new Map<string, StoredSession>();
  private readonly timers = new Map<string, number>();
  async create(s: StoredSession) {
    if (this.m.has(s.sessionId)) return false;
    this.m.set(s.sessionId, structuredClone(s));
    return true;
  }
  async get(id: string) {
    const s = this.m.get(id);
    return s ? structuredClone(s) : null;
  }
  async update(
    id: string,
    fn: (s: StoredSession) => StoredSession | { error: string },
    timerOf?: (s: StoredSession) => number | null,
  ) {
    const s = this.m.get(id);
    if (!s) return { error: 'session_not_found' };
    const next = fn(structuredClone(s));
    if (!('error' in next)) {
      this.m.set(id, structuredClone(next));
      if (timerOf) await this.schedule(id, timerOf(next));
    }
    return next;
  }
  async schedule(id: string, at: number | null) {
    if (at === null) this.timers.delete(id);
    else this.timers.set(id, at);
  }
  async due(now: number, limit: number) {
    return [...this.timers].filter(([, at]) => at <= now).slice(0, limit).map(([id]) => id);
  }
}
