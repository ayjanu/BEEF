import { getRules } from '@beef/game-rules';
import type { SessionOpen } from '@beef/contracts';

/**
 * Game sessions are stored outside the process so any game-engine replica can
 * accept any player's socket. Every move is a compare-and-set on the stored
 * record, which makes moves from two replicas safe without a single owner.
 */
export interface StoredSession {
  sessionId: string;
  gameId: string;
  rulesVersion: number;
  seed: number;
  players: string[];
  state: unknown;
  log: Array<{ seat: number; move: unknown; at: number }>;
  status: 'active' | 'finished';
  resignedSeat: number | null;
  createdAt: number;
}

export interface SessionStore {
  create(s: StoredSession): Promise<boolean>;
  get(sessionId: string): Promise<StoredSession | null>;
  /** Apply `fn` atomically. `fn` returns the next record, or an error code to abort. */
  update(
    sessionId: string,
    fn: (s: StoredSession) => StoredSession | { error: string },
  ): Promise<StoredSession | { error: string }>;
}

export interface EndedGame {
  session: StoredSession;
  winnerSeat: number | null;
  draw: boolean;
}

export type MoveResult =
  | { ok: true; session: StoredSession; ended: EndedGame | null }
  | { ok: false; error: string };

export function newSession(open: SessionOpen): StoredSession {
  const rules = getRules(open.gameId);
  return {
    sessionId: open.sessionId,
    gameId: open.gameId,
    rulesVersion: rules.manifest.rulesVersion,
    seed: open.seed,
    players: open.players,
    state: rules.init(open.seed, open.players.length),
    log: [],
    status: 'active',
    resignedSeat: null,
    createdAt: Date.now(),
  };
}

export class Engine {
  constructor(private readonly store: SessionStore) {}

  async open(open: SessionOpen): Promise<StoredSession> {
    const s = newSession(open);
    const created = await this.store.create(s);
    return created ? s : ((await this.store.get(open.sessionId)) as StoredSession); // idempotent
  }

  seatOf(s: StoredSession, userId: string): number {
    return s.players.indexOf(userId);
  }

  async move(sessionId: string, userId: string, move: unknown): Promise<MoveResult> {
    let ended: EndedGame | null = null;
    const res = await this.store.update(sessionId, (s) => {
      if (s.status !== 'active') return { error: 'game_over' };
      const seat = this.seatOf(s, userId);
      if (seat < 0) return { error: 'not_a_player' };
      const rules = getRules(s.gameId);
      const err = rules.validate(s.state, move, seat);
      if (err) return { error: err };
      const state = rules.apply(s.state, move, seat);
      const outcome = rules.outcome(state);
      const next: StoredSession = {
        ...s,
        state,
        log: [...s.log, { seat, move, at: Date.now() }],
        status: outcome.done ? 'finished' : 'active',
      };
      ended = outcome.done ? { session: next, winnerSeat: outcome.winner, draw: outcome.draw } : null;
      return next;
    });
    if ('error' in res) return { ok: false, error: res.error };
    return { ok: true, session: res, ended };
  }

  /** Resigning hands the win to the other player (1v1 in Bronze). */
  async resign(sessionId: string, userId: string): Promise<MoveResult> {
    let ended: EndedGame | null = null;
    const res = await this.store.update(sessionId, (s) => {
      if (s.status !== 'active') return { error: 'game_over' };
      const seat = this.seatOf(s, userId);
      if (seat < 0) return { error: 'not_a_player' };
      const next: StoredSession = { ...s, status: 'finished', resignedSeat: seat };
      ended = { session: next, winnerSeat: s.players.length === 2 ? 1 - seat : null, draw: false };
      return next;
    });
    if ('error' in res) return { ok: false, error: res.error };
    return { ok: true, session: res, ended };
  }
}

/** In-memory store for tests and single-process local runs. */
export class MemoryStore implements SessionStore {
  private readonly m = new Map<string, StoredSession>();
  async create(s: StoredSession) {
    if (this.m.has(s.sessionId)) return false;
    this.m.set(s.sessionId, structuredClone(s));
    return true;
  }
  async get(id: string) {
    const s = this.m.get(id);
    return s ? structuredClone(s) : null;
  }
  async update(id: string, fn: (s: StoredSession) => StoredSession | { error: string }) {
    const s = this.m.get(id);
    if (!s) return { error: 'session_not_found' };
    const next = fn(structuredClone(s));
    if (!('error' in next)) this.m.set(id, structuredClone(next));
    return next;
  }
}
