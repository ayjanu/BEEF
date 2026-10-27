import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import {
  STAGE1_AFTER_END_MS,
  STAGE2_AFTER_END_MS,
  checkinOpen,
  needsCertifiedVenue,
  nextEscalation,
} from '../src/venues/meet-safety.ts';

const END = 1_000_000_000;

describe('meet safety', () => {
  it('escalates in two stages when nobody answers the end-of-meet check-in', () => {
    const p = { endsAt: END, answeredAfterEnd: false, stage: 0 as const };
    assert.equal(nextEscalation(p, END + STAGE1_AFTER_END_MS - 1), 0);
    assert.equal(nextEscalation(p, END + STAGE1_AFTER_END_MS), 1);
    assert.equal(nextEscalation({ ...p, stage: 1 }, END + STAGE1_AFTER_END_MS + 60_000), 0);
    assert.equal(nextEscalation({ ...p, stage: 1 }, END + STAGE2_AFTER_END_MS), 2);
    assert.equal(nextEscalation({ ...p, stage: 2 }, END + STAGE2_AFTER_END_MS + 60_000), 0);
  });

  it('a late sweep still takes the highest stage due, once', () => {
    assert.equal(nextEscalation({ endsAt: END, answeredAfterEnd: false, stage: 0 }, END + STAGE2_AFTER_END_MS + 5), 2);
  });

  it('never escalates for a player who answered', () => {
    assert.equal(nextEscalation({ endsAt: END, answeredAfterEnd: true, stage: 0 }, END + STAGE2_AFTER_END_MS), 0);
  });

  it('check-in opens 30 minutes early and closes at the end', () => {
    const start = END;
    assert.equal(checkinOpen(start, start + 3_600_000, start - 31 * 60_000), false);
    assert.equal(checkinOpen(start, start + 3_600_000, start - 30 * 60_000), true);
    assert.equal(checkinOpen(start, start + 3_600_000, start + 3_600_001), false);
  });

  it('the first two meets of a pair need a certified venue', () => {
    assert.equal(needsCertifiedVenue(0), true);
    assert.equal(needsCertifiedVenue(1), true);
    assert.equal(needsCertifiedVenue(2), false);
  });
});
