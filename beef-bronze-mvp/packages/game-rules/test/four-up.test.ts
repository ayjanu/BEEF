import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { COLS, ROWS, fourUp, mulberry32, replay, type FourUpState } from '../src/index.ts';

function play(columns: number[]): FourUpState {
  let s = fourUp.init(1, 2);
  for (const column of columns) {
    const seat = s.turn;
    const err = fourUp.validate(s, { column }, seat);
    assert.equal(err, null, `move ${column} rejected: ${err}`);
    s = fourUp.apply(s, { column }, seat);
  }
  return s;
}

describe('four-up rules', () => {
  it('starts empty with seat 0 to move', () => {
    const s = fourUp.init(42, 2);
    assert.equal(fourUp.currentSeat(s), 0);
    assert.equal(s.board.flat().filter((c) => c !== 0).length, 0);
  });

  it('detects a vertical win', () => {
    const s = play([0, 1, 0, 1, 0, 1, 0]);
    assert.equal(s.winner, 0);
    assert.equal(s.winLine?.length, 4);
    assert.deepEqual(fourUp.outcome(s), { done: true, winner: 0, draw: false });
  });

  it('detects a horizontal win', () => {
    const s = play([0, 0, 1, 1, 2, 2, 3]);
    assert.equal(s.winner, 0);
  });

  it('detects diagonal wins in both directions', () => {
    // seat 0 builds the / diagonal (0,0) (1,1) (2,2) (3,3)
    const up = play([0, 1, 1, 2, 2, 3, 2, 3, 3, 6, 3]);
    assert.equal(up.winner, 0);
    // mirror image builds the \ diagonal
    const down = play([6, 5, 5, 4, 4, 3, 4, 3, 3, 0, 3]);
    assert.equal(down.winner, 0);
  });

  it('rejects out-of-turn, out-of-range, full-column and post-game moves', () => {
    const s = fourUp.init(1, 2);
    assert.equal(fourUp.validate(s, { column: 0 }, 1), 'not_your_turn');
    assert.equal(fourUp.validate(s, { column: 7 }, 0), 'column_out_of_range');
    assert.equal(fourUp.validate(s, { col: 1 }, 0), 'bad_move_shape');
    const full = play([0, 0, 0, 0, 0, 0]);
    assert.equal(fourUp.validate(full, { column: 0 }, full.turn), 'column_full');
    const won = play([0, 1, 0, 1, 0, 1, 0]);
    assert.equal(fourUp.validate(won, { column: 5 }, won.turn), 'game_over');
  });

  it('declares a draw on a full board with no line', () => {
    // A legal 42-move order that fills the board without four in a row (found by search).
    const order = [
      0, 1, 2, 3, 4, 5, 6, 0, 1, 2, 3, 4, 5, 6, 0, 1, 2, 3, 4, 5, 6,
      1, 0, 3, 2, 5, 4, 0, 6, 1, 2, 3, 4, 5, 6, 0, 1, 2, 3, 4, 5, 6,
    ];
    const s = play(order);
    assert.equal(s.board.flat().filter((c) => c !== 0).length, ROWS * COLS);
    assert.equal(s.draw, true);
    assert.equal(s.winner, null);
    assert.deepEqual(fourUp.outcome(s), { done: true, winner: null, draw: true });
    assert.equal(fourUp.currentSeat(s), null);
  });

  it('replays deterministically from a move log', () => {
    const log = [0, 1, 0, 1, 0, 1, 0].map((column, i) => ({ seat: i % 2, move: { column } }));
    const a = replay('four-up', 9, 2, log) as FourUpState;
    const b = replay('four-up', 9, 2, log) as FourUpState;
    assert.deepEqual(a, b);
    assert.equal(a.winner, 0);
    assert.throws(() => replay('four-up', 9, 2, [{ seat: 1, move: { column: 0 } }]), /diverged/);
  });

  it('never mutates the previous state', () => {
    const s0 = fourUp.init(1, 2);
    const snapshot = JSON.stringify(s0);
    fourUp.apply(s0, { column: 3 }, 0);
    assert.equal(JSON.stringify(s0), snapshot);
  });

  it('seeded rng is deterministic', () => {
    const a = mulberry32(123);
    const b = mulberry32(123);
    for (let i = 0; i < 5; i++) assert.equal(a(), b());
    assert.ok(COLS === 7);
  });
});
