import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { DEFAULT_RATING, expectedScore, rateGame, updateRating } from '../src/progression/glicko2.ts';
import {
  DAILY_CAP,
  STRENGTH,
  applyDailyCap,
  bpForResult,
  capForLevel,
  diminishing,
  levelForXp,
} from '../src/progression/economy.ts';

const near = (actual: number, expected: number, tol: number) =>
  assert.ok(Math.abs(actual - expected) <= tol, `${actual} not within ${tol} of ${expected}`);

describe('glicko-2', () => {
  it('matches the worked example in Glickman (2013)', () => {
    const player = { rating: 1500, rd: 200, vol: 0.06 };
    const next = updateRating(player, [
      { opponent: { rating: 1400, rd: 30, vol: 0.06 }, score: 1 },
      { opponent: { rating: 1550, rd: 100, vol: 0.06 }, score: 0 },
      { opponent: { rating: 1700, rd: 300, vol: 0.06 }, score: 0 },
    ]);
    near(next.rating, 1464.06, 0.05);
    near(next.rd, 151.52, 0.05);
    near(next.vol, 0.05999, 0.00001);
  });

  it('winner gains what the loser loses for equal new players', () => {
    const [a, b] = rateGame(DEFAULT_RATING, DEFAULT_RATING, 1);
    assert.ok(a.rating > 1500 && b.rating < 1500);
    near(a.rating - 1500, 1500 - b.rating, 0.001);
    assert.ok(a.rd < 350 && b.rd < 350, 'uncertainty shrinks after a game');
  });

  it('a draw between equals changes nothing but uncertainty', () => {
    const [a] = rateGame(DEFAULT_RATING, DEFAULT_RATING, 0.5);
    near(a.rating, 1500, 0.001);
  });

  it('expected score favors the higher rating', () => {
    const strong = { rating: 1900, rd: 50, vol: 0.06 };
    const weak = { rating: 1300, rd: 50, vol: 0.06 };
    assert.ok(expectedScore(strong, weak) > 0.9);
    near(expectedScore(strong, weak) + expectedScore(weak, strong), 1, 1e-9);
  });
});

describe('beef point economy (Spec 02)', () => {
  it('pays the documented venue-night example: check-in 100 + venue-attested L4 win 75', () => {
    const win = bpForResult({ level: 4, outcome: 'win', strength: STRENGTH.venueAttest, nthGameVsOpponentToday: 1, chance: 'none' });
    assert.equal(win, 75);
    assert.equal(100 + win, 175);
  });

  it('pays L1 server-verified results by outcome', () => {
    const base = { level: 1 as const, strength: STRENGTH.serverAuthoritative, nthGameVsOpponentToday: 1, chance: 'none' as const };
    assert.equal(bpForResult({ ...base, outcome: 'win' }), 10);
    assert.equal(bpForResult({ ...base, outcome: 'draw' }), 6);
    assert.equal(bpForResult({ ...base, outcome: 'loss' }), 3);
  });

  it('never pays chance-driven games or mutual-confirm games', () => {
    assert.equal(bpForResult({ level: 1, outcome: 'win', strength: 1, nthGameVsOpponentToday: 1, chance: 'high' }), 0);
    assert.equal(bpForResult({ level: 2, outcome: 'win', strength: STRENGTH.mutualConfirm, nthGameVsOpponentToday: 1, chance: 'none' }), 0);
  });

  it('diminishes repeat games against the same opponent to zero by the 4th', () => {
    assert.deepEqual([1, 2, 3, 4, 9].map(diminishing), [1, 0.5, 0.25, 0, 0]);
  });

  it('caps levels 1-2 at 50 BP per day', () => {
    assert.equal(capForLevel(1), DAILY_CAP.levels1and2);
    assert.equal(applyDailyCap(10, 45, 50), 5);
    assert.equal(applyDailyCap(10, 50, 50), 0);
    assert.equal(applyDailyCap(10, 0, Number.POSITIVE_INFINITY), 10);
  });

  it('maps XP to levels 1..100', () => {
    assert.equal(levelForXp(0), 1);
    assert.equal(levelForXp(49), 1);
    assert.equal(levelForXp(50), 2);
    assert.equal(levelForXp(200), 3);
    assert.equal(levelForXp(10_000_000), 100);
  });
});
