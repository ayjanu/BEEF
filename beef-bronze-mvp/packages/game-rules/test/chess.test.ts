import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import {
  applyEntry,
  chessBullet,
  chessClassic,
  deadlineEntry,
  matchOutcome,
  startMatch,
  type ChessMove,
  type ChessState,
  type MatchState,
} from '../src/index.ts';

function play(s: ChessState, moves: Array<[string, string]>, step = 1000): ChessState {
  let now = s.turnStartedAt;
  for (const [from, to] of moves) {
    now += step;
    const seat = chessClassic.awaiting(s)[0]!;
    const m: ChessMove = { from, to };
    assert.equal(chessClassic.validate(s, m, seat, { now }), null, `${from}${to}`);
    s = chessClassic.apply(s, m, seat, { now });
  }
  return s;
}

describe('chess', () => {
  it("fool's mate is checkmate for black", () => {
    const s = play(chessClassic.init(1, 2, 0), [['f2', 'f3'], ['e7', 'e5'], ['g2', 'g4'], ['d8', 'h4']]);
    assert.deepEqual(chessClassic.outcome(s), { done: true, winner: 1, draw: false });
    assert.equal(s.result?.reason, 'checkmate');
    assert.deepEqual(s.sans, ['f3', 'e5', 'g4', 'Qh4#']);
  });

  it('rejects illegal, malformed and out-of-turn moves', () => {
    const s = chessClassic.init(1, 2, 0);
    assert.equal(chessClassic.validate(s, { from: 'e2', to: 'e5' }, 0, { now: 1 }), 'illegal_move');
    assert.equal(chessClassic.validate(s, { from: 'e7', to: 'e5' }, 1, { now: 1 }), 'not_your_turn');
    assert.equal(chessClassic.validate(s, { from: 'z9', to: 'e4' }, 0, { now: 1 }), 'bad_move_shape');
  });

  it('runs the clock with increment', () => {
    const s = play(chessClassic.init(1, 2, 0), [['e2', 'e4']], 10_000);
    assert.equal(s.clocks[0], 5 * 60_000 - 10_000 + 3_000);
    assert.equal(s.clocks[1], 5 * 60_000);
    assert.equal(chessClassic.deadline!(s), 10_000 + 5 * 60_000);
  });

  it('flags on time through the match layer', () => {
    let m: MatchState = startMatch(chessBullet, 1, 2, 0);
    const r = applyEntry(chessBullet, m, { kind: 'move', seat: 0, move: { from: 'e2', to: 'e4' }, at: 1000 });
    m = r as MatchState;
    assert.equal(deadlineEntry(chessBullet, m, 60_000), null);
    const late = applyEntry(chessBullet, m, { kind: 'move', seat: 1, move: { from: 'e7', to: 'e5' }, at: 61_000 });
    assert.deepEqual(late, { error: 'time_expired' });
    const e = deadlineEntry(chessBullet, m, 61_000)!;
    assert.equal(e.kind, 'deadline');
    m = applyEntry(chessBullet, m, e) as MatchState;
    assert.deepEqual(matchOutcome(chessBullet, m), { done: true, winner: 0, draw: false });
    assert.equal((m.state as ChessState).result?.reason, 'timeout');
  });

  it('resignation hands the win to the opponent', () => {
    const s = chessClassic.resign!(chessClassic.init(1, 2, 0), 0);
    assert.equal(chessClassic.outcome(s).winner, 1);
  });
});
