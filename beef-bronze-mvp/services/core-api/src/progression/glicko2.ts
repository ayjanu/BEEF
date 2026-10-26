/**
 * Glicko-2 rating system (Glickman, "Example of the Glicko-2 system", 2013).
 * Spec 02 picks Glicko-2 over plain Elo for 1v1 because it tracks rating
 * deviation (uncertainty), which drives placement and fair pairing.
 */

export interface Rating {
  rating: number; // Glicko scale, starts at 1500
  rd: number; // rating deviation, starts at 350
  vol: number; // volatility, starts at 0.06
}

export interface GameResult {
  opponent: Rating;
  /** 1 win, 0.5 draw, 0 loss */
  score: number;
}

export const DEFAULT_RATING: Rating = Object.freeze({ rating: 1500, rd: 350, vol: 0.06 });
const SCALE = 173.7178;
const TAU = 0.5; // system constant: how much volatility can change
const EPS = 0.000001;
/** Floor so long-time players can still move. */
const MIN_RD = 30;

const g = (phi: number) => 1 / Math.sqrt(1 + (3 * phi * phi) / (Math.PI * Math.PI));
const E = (mu: number, muJ: number, phiJ: number) => 1 / (1 + Math.exp(-g(phiJ) * (mu - muJ)));

/** Update one player's rating after a rating period containing `results`. */
export function updateRating(player: Rating, results: GameResult[]): Rating {
  const mu = (player.rating - 1500) / SCALE;
  const phi = player.rd / SCALE;
  const sigma = player.vol;

  if (results.length === 0) {
    // No games: only uncertainty grows.
    const phiStar = Math.sqrt(phi * phi + sigma * sigma);
    return { rating: player.rating, rd: Math.min(350, phiStar * SCALE), vol: sigma };
  }

  let vInv = 0;
  let deltaSum = 0;
  for (const { opponent, score } of results) {
    const muJ = (opponent.rating - 1500) / SCALE;
    const phiJ = opponent.rd / SCALE;
    const gj = g(phiJ);
    const ej = E(mu, muJ, phiJ);
    vInv += gj * gj * ej * (1 - ej);
    deltaSum += gj * (score - ej);
  }
  const v = 1 / vInv;
  const delta = v * deltaSum;

  // Step 5: new volatility via the Illinois algorithm.
  const a = Math.log(sigma * sigma);
  const f = (x: number) => {
    const ex = Math.exp(x);
    const num = ex * (delta * delta - phi * phi - v - ex);
    const den = 2 * Math.pow(phi * phi + v + ex, 2);
    return num / den - (x - a) / (TAU * TAU);
  };
  let A = a;
  let B: number;
  if (delta * delta > phi * phi + v) {
    B = Math.log(delta * delta - phi * phi - v);
  } else {
    let k = 1;
    while (f(a - k * TAU) < 0) k++;
    B = a - k * TAU;
  }
  let fA = f(A);
  let fB = f(B);
  while (Math.abs(B - A) > EPS) {
    const C = A + ((A - B) * fA) / (fB - fA);
    const fC = f(C);
    if (fC * fB <= 0) {
      A = B;
      fA = fB;
    } else {
      fA = fA / 2;
    }
    B = C;
    fB = fC;
  }
  const newSigma = Math.exp(A / 2);

  const phiStar = Math.sqrt(phi * phi + newSigma * newSigma);
  const newPhi = 1 / Math.sqrt(1 / (phiStar * phiStar) + 1 / v);
  const newMu = mu + newPhi * newPhi * deltaSum;

  return {
    rating: newMu * SCALE + 1500,
    rd: Math.max(MIN_RD, newPhi * SCALE),
    vol: newSigma,
  };
}

/** Rates a single 1v1 game for both players. scoreA is 1, 0.5 or 0 from A's side. */
export function rateGame(a: Rating, b: Rating, scoreA: number): [Rating, Rating] {
  return [
    updateRating(a, [{ opponent: b, score: scoreA }]),
    updateRating(b, [{ opponent: a, score: 1 - scoreA }]),
  ];
}

/** Probability that A beats B, used to refuse lopsided pairings (> 90%) in matchmaking. */
export function expectedScore(a: Rating, b: Rating): number {
  const mu = (a.rating - 1500) / SCALE;
  const muJ = (b.rating - 1500) / SCALE;
  const phiJ = Math.sqrt(a.rd * a.rd + b.rd * b.rd) / SCALE;
  return E(mu, muJ, phiJ);
}
