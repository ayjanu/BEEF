/**
 * The rules contract every BEEF title implements (Spec 02, "Game framework contract", part 2).
 *
 * Rules are pure functions: the same seed, rules version, options and move log
 * (with the server timestamps recorded in it) always produce the same state.
 * The server runs them as the authority; clients run them for instant
 * feedback and reconcile with the server's state.
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
  /** "none" | "low" | "high". High-chance games never pay Beef Points (Spec 02 economy). */
  chance: 'none' | 'low' | 'high';
  turnBased: boolean;
  /** Bumped whenever rules change; stored on every session so old replays stay valid. */
  rulesVersion: number;
  /**
   * Whether results move skill ratings and leaderboards. Opinion and
   * get-to-know-you games (Would You Rather, Two Truths) are unrated.
   */
  rated: boolean;
  /**
   * How the result is verified (Spec 02, "Result verification"):
   * "server" — the server decides the result from the rules;
   * "mutual" — no objective winner (players finish it together).
   * Beef Points are paid only for rated, server-verified results; everything else pays XP.
   */
  verification: 'server' | 'mutual';
  /** Moves contain free text from players, which the engine screens with the safety service. */
  userText: boolean;
  /**
   * For turn-based games without their own clock: how long the seat to move
   * may take before forfeiting. Games with clocks or round timers implement
   * `deadline` instead.
   */
  turnTimeoutMs?: number;
}

/** Server-provided context. `now` is the server's clock, recorded in the move log for replays. */
export interface MoveContext {
  now: number;
}

export interface GameOutcome {
  done: boolean;
  /** Winning seat, or null for a draw, a no-winner social game, or an unfinished game. */
  winner: Seat | null;
  draw: boolean;
  /** Optional per-seat scores for display (boxes captured, questions right...). */
  scores?: number[];
}

export interface GameRules<State, Move, Options = undefined> {
  manifest: GameManifest;
  init(seed: number, playerCount: number, now: number, options?: Options): State;
  /**
   * Seats whose input the game is waiting for. Turn-based games return the
   * seat to move; simultaneous games return every seat that has not acted yet.
   * Empty when the game is over.
   */
  awaiting(state: State): Seat[];
  /** Returns a reason string when the move is illegal, otherwise null. */
  validate(state: State, move: unknown, seat: Seat, ctx: MoveContext): string | null;
  apply(state: State, move: Move, seat: Seat, ctx: MoveContext): State;
  outcome(state: State): GameOutcome;
  /**
   * What `seat` may see (null = spectator). Hide secrets here: the 20 Questions
   * answer, unrevealed lies, the right trivia answer before the round closes.
   * Omit when the whole state is public.
   */
  view?(state: State, seat: Seat | null): unknown;
  /** Absolute server time (ms) at which `onDeadline` must run, or null. */
  deadline?(state: State): number | null;
  /** Applied by the engine once `now` passes `deadline`: clocks flag, rounds close, turns forfeit. */
  onDeadline?(state: State, now: number): State;
  /**
   * Called when a player resigns. Default (handled by the engine): 1v1 games
   * end with the other seat as winner.
   */
  resign?(state: State, seat: Seat): State;
  /**
   * For `userText` games: the free text inside a move, which the engine sends
   * to the safety service before applying it. Called only on valid moves.
   */
  userTexts?(move: Move): string[];
}

/** Erases the generic types so a registry can hold every title. */
export type AnyGameRules = GameRules<any, any, any>;
