/**
 * Small, fast, seedable PRNG. Games that need randomness (shuffles, letter
 * grids) must draw from this, seeded with the session seed, so the server and
 * every replay produce identical results. Never use Math.random in rules.
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
