import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import {
  applyEntry,
  deadlineEntry,
  fourUp,
  matchAwaiting,
  matchDeadline,
  matchOutcome,
  replayMatch,
  startMatch,
  type LogEntry,
  type MatchState,
} from '../src/index.ts';

const DAY = 24 * 60 * 60 * 1000;

function ok(m: MatchState, e: LogEntry): MatchState {
  const r = applyEntry(fourUp, m, e);
  assert.ok(!('error' in r), `entry rejected: ${'error' in r ? r.error : ''}`);
  return r as MatchState;
}

describe('match layer', () => {
  it('rejects bad player counts', () => {
    assert.throws(() => startMatch(fourUp, 1, 3, 0), /2-2 players/);
  });

  it('forfeits the seat to move after the turn timeout, and only then', () => {
    let m = startMatch(fourUp, 1, 2, 0);
    m = ok(m, { kind: 'move', seat: 0, move: { column: 3 }, at: 1000 });
    assert.equal(matchDeadline(fourUp, m), 1000 + DAY);
    assert.equal(deadlineEntry(fourUp, m, 1000 + DAY - 1), null);
    const r = applyEntry(fourUp, m, { kind: 'forfeit', seat: 1, at: 5000 });
    assert.deepEqual(r, { error: 'not_due' });
    const e = deadlineEntry(fourUp, m, 1000 + DAY)!;
    assert.deepEqual(e, { kind: 'forfeit', seat: 1, at: 1000 + DAY });
    m = ok(m, e);
    assert.deepEqual(matchOutcome(fourUp, m), { done: true, winner: 0, draw: false, scores: undefined });
    assert.deepEqual(matchAwaiting(fourUp, m), []);
    assert.equal(matchDeadline(fourUp, m), null);
  });

  it('rejects a move at or after the deadline', () => {
    const m = startMatch(fourUp, 1, 2, 0);
    assert.deepEqual(applyEntry(fourUp, m, { kind: 'move', seat: 0, move: { column: 0 }, at: DAY }), { error: 'time_expired' });
  });

  it('resignation ends a 1v1 for the other seat, out of turn too', () => {
    let m = startMatch(fourUp, 1, 2, 0);
    m = ok(m, { kind: 'resign', seat: 1, at: 10 });
    assert.equal(matchOutcome(fourUp, m).winner, 0);
    assert.deepEqual(applyEntry(fourUp, m, { kind: 'move', seat: 0, move: { column: 0 }, at: 11 }), { error: 'game_over' });
  });

  it('replays resignations and forfeits exactly', () => {
    const log: LogEntry[] = [
      { kind: 'move', seat: 0, move: { column: 3 }, at: 5 },
      { kind: 'forfeit', seat: 1, at: 5 + DAY },
    ];
    const m = replayMatch(fourUp, 1, 2, 0, log);
    assert.equal(m.ending?.reason, 'timeout');
    assert.equal(m.log.length, 2);
  });

  it('never mutates the input match', () => {
    const m = startMatch(fourUp, 1, 2, 0);
    const snap = JSON.stringify(m);
    applyEntry(fourUp, m, { kind: 'move', seat: 0, move: { column: 0 }, at: 1 });
    applyEntry(fourUp, m, { kind: 'resign', seat: 0, at: 1 });
    assert.equal(JSON.stringify(m), snap);
  });
});
