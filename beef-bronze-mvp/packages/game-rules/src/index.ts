import { fourUp } from './four-up.ts';
import type { AnyGameRules } from './types.ts';

export * from './types.ts';
export * from './four-up.ts';
export { mulberry32 } from './rng.ts';

/**
 * Every playable title, keyed by id. Silver adds the rest of the beta catalog
 * (Spec 02) here; game-engine and the mobile app both read this registry.
 */
export const registry: Readonly<Record<string, AnyGameRules>> = Object.freeze({
  [fourUp.manifest.id]: fourUp,
});

export function getRules(gameId: string): AnyGameRules {
  const rules = registry[gameId];
  if (!rules) throw new Error(`unknown game: ${gameId}`);
  return rules;
}

/** Replays a move log from scratch. Used for dispute evidence and determinism tests. */
export function replay(
  gameId: string,
  seed: number,
  playerCount: number,
  log: Array<{ seat: number; move: unknown }>,
): unknown {
  const rules = getRules(gameId);
  let state = rules.init(seed, playerCount);
  for (const { seat, move } of log) {
    const err = rules.validate(state, move, seat);
    if (err) throw new Error(`replay diverged: ${err}`);
    state = rules.apply(state, move, seat);
  }
  return state;
}
