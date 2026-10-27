import { mulberry32 } from './rng.ts';

/** Seeded draw of `n` distinct ids from a bank (Fisher-Yates). Same seed, same deck. */
export function drawDeck(seed: number, ids: readonly number[], n: number): number[] {
  const rand = mulberry32(seed);
  const deck = ids.slice();
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [deck[i], deck[j]] = [deck[j]!, deck[i]!];
  }
  return deck.slice(0, n);
}

/** Seats that have not answered the current round yet. */
