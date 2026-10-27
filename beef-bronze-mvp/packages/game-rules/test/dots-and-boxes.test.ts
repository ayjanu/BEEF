import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { BOXES, dotsAndBoxes as D, type DotsMove, type DotsState } from '../src/index.ts';

const CTX = { now: 0 };

function play(s: DotsState, moves: DotsMove[]): DotsState {
  for (const m of moves) {
    const seat = s.turn;
    const err = D.validate(s, m, seat, CTX);
    assert.equal(err, null, `${JSON.stringify(m)}: ${err}`);
    s = D.apply(s, m, seat, CTX);
  }
  return s;
}

/** Every line, row by row: horizontals then verticals. */
function allLines(): DotsMove[] {
  const out: DotsMove[] = [];
  for (let r = 0; r <= BOXES; r++) for (let c = 0; c < BOXES; c++) out.push({ o: 'h', r, c });
  for (let r = 0; r < BOXES; r++) for (let c = 0; c <= BOXES; c++) out.push({ o: 'v', r, c });
  return out;
}

describe('dots and boxes', () => {
  it('closing a box scores it and keeps the turn', () => {
    let s = D.init(1, 2, 0);
    s = play(s, [{ o: 'h', r: 0, c: 0 }, { o: 'h', r: 1, c: 0 }, { o: 'v', r: 0, c: 0 }]);
    assert.equal(s.turn, 1);
    s = play(s, [{ o: 'v', r: 0, c: 1 }]);
    assert.deepEqual(s.scores, [0, 1]);
    assert.equal(s.owner[0]![0], 1);
    assert.equal(s.turn, 1);
  });

  it('one line can close two boxes', () => {
    let s = D.init(1, 2, 0);
    s = play(s, [
      { o: 'h', r: 0, c: 0 }, { o: 'h', r: 1, c: 0 }, { o: 'v', r: 0, c: 0 },
      { o: 'h', r: 0, c: 1 }, { o: 'h', r: 1, c: 1 }, { o: 'v', r: 0, c: 2 },
    ]);
    const seat = s.turn;
    s = play(s, [{ o: 'v', r: 0, c: 1 }]);
    assert.equal(s.scores[seat as 0 | 1], 2);
  });

  it('rejects taken, out-of-range, malformed and out-of-turn lines', () => {
    const s = play(D.init(1, 2, 0), [{ o: 'h', r: 0, c: 0 }]);
    assert.equal(D.validate(s, { o: 'h', r: 0, c: 0 }, 1, CTX), 'line_taken');
    assert.equal(D.validate(s, { o: 'h', r: 7, c: 0 }, 1, CTX), 'line_out_of_range');
    assert.equal(D.validate(s, { o: 'v', r: 0, c: 7 }, 1, CTX), 'line_out_of_range');
    assert.equal(D.validate(s, { o: 'x', r: 0, c: 0 }, 1, CTX), 'bad_move_shape');
    assert.equal(D.validate(s, { o: 'h', r: 1, c: 1 }, 0, CTX), 'not_your_turn');
  });

  it('ends when every box is claimed, scores sum to 36', () => {
    const s = play(D.init(1, 2, 0), allLines());
    const o = D.outcome(s);
    assert.equal(o.done, true);
    assert.equal(s.scores[0] + s.scores[1], BOXES * BOXES);
    assert.deepEqual(D.awaiting(s), []);
    assert.equal(D.validate(s, { o: 'h', r: 0, c: 0 }, s.turn, CTX), 'game_over');
  });
});
