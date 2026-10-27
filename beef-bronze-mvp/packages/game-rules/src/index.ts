import { chessBullet, chessClassic } from './chess.ts';
import { dotsAndBoxes } from './dots-and-boxes.ts';
import { fourUp } from './four-up.ts';
import { triviaBurst } from './trivia-burst.ts';
import { twentyQuestions } from './twenty-questions.ts';
import { twoTruths } from './two-truths.ts';
import type { AnyGameRules, GameManifest } from './types.ts';
import { venueGames } from './venue-games.ts';
import { wouldYouRather } from './would-you-rather.ts';

export * from './types.ts';
export * from './match.ts';
export * from './four-up.ts';
export * from './dots-and-boxes.ts';
export * from './chess.ts';
export * from './trivia-burst.ts';
export * from './would-you-rather.ts';
export * from './two-truths.ts';
export * from './twenty-questions.ts';
export * from './venue-games.ts';
export { mulberry32 } from './rng.ts';
export { drawDeck } from './rounds.ts';

const titles: AnyGameRules[] = [
  fourUp,
  dotsAndBoxes,
  chessClassic,
  chessBullet,
  triviaBurst,
  wouldYouRather,
  twoTruths,
  twentyQuestions,
];

/**
 * Every playable title, keyed by id (the Spec 02 beta catalog). The game
 * engine, core-api and the mobile app all read this registry.
 */
export const registry: Readonly<Record<string, AnyGameRules>> = Object.freeze(
  Object.fromEntries(titles.map((t) => [t.manifest.id, t])),
);

export function getRules(gameId: string): AnyGameRules {
  const rules = registry[gameId];
  if (!rules) throw new Error(`unknown game: ${gameId}`);
  return rules;
}

/** Manifest of any title: engine-hosted or played at a venue. */
export function getManifest(gameId: string): GameManifest {
  const m = registry[gameId]?.manifest ?? venueGames[gameId];
  if (!m) throw new Error(`unknown game: ${gameId}`);
  return m;
}
