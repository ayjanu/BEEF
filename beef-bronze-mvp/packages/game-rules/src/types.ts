/**
 * The rules contract every BEEF title implements (Spec 02, "Game framework contract", part 2).
 *
 * Rules are pure functions: the same seed, rules version and move log always
 * produce the same state. The server runs them as the authority; clients run
 * them for instant feedback and reconcile with the server's state.
 */

/** Player seat index within a session (0-based, in the order players were seated). */
export type Seat = number;

export interface GameManifest {
  id: string;
  name: string;
  /** Escalation level from Spec 01: 1 phone, 2 mind, 3 physical, 4 in person. */
  level: 1 | 2 | 3 | 4;
  formats: Array<'1v1' | '2v2' | 'ffa'>;
  minPlayers: number;
  maxPlayers: number;
  /** "none" | "low" | "high". High-chance games may never pay Beef Points (Spec 02 economy). */
  chance: 'none' | 'low' | 'high';
  turnBased: boolean;
  /** Bumped whenever rules change; stored on every session so old replays stay valid. */
  rulesVersion: number;
}

export interface GameOutcome {
  done: boolean;
  /** Winning seat, or null for a draw or an unfinished game. */
  winner: Seat | null;
  draw: boolean;
}

export interface GameRules<State, Move> {
  manifest: GameManifest;
  init(seed: number, playerCount: number): State;
  /** Seat whose turn it is, or null when simultaneous / finished. */
  currentSeat(state: State): Seat | null;
  /** Returns a reason string when the move is illegal, otherwise null. */
  validate(state: State, move: unknown, seat: Seat): string | null;
  apply(state: State, move: Move, seat: Seat): State;
  outcome(state: State): GameOutcome;
}

/** Erases the generic types so a registry can hold every title. */
export type AnyGameRules = GameRules<any, any>;
