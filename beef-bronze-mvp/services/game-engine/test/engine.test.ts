import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { contentFor } from '@beef/game-rules/content';
import { TRIVIA_REVEAL_MS, TRIVIA_ROUND_MS } from '@beef/game-rules';
import { Engine, MemoryStore, type ScreenVerdict } from '../src/engine.ts';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const C = '33333333-3333-4333-8333-333333333333';
const SID = '99999999-9999-4999-8999-999999999999';

async function fresh() {
  const engine = new Engine(new MemoryStore());
  await engine.open({ sessionId: SID, gameId: 'four-up', players: [A, B], seed: 7 });
  return engine;
}

describe('game engine', () => {
  it('opens sessions idempotently', async () => {
    const engine = await fresh();
    const again = await engine.open({ sessionId: SID, gameId: 'four-up', players: [A, B], seed: 999 });
    assert.equal(again.seed, 7, 'second open returns the original session');
  });

  it('enforces turns and membership on the server', async () => {
    const engine = await fresh();
    assert.deepEqual(await engine.move(SID, B, { column: 0 }), { ok: false, error: 'not_your_turn' });
    assert.deepEqual(await engine.move(SID, C, { column: 0 }), { ok: false, error: 'not_a_player' });
    const ok = await engine.move(SID, A, { column: 0 });
    assert.equal(ok.ok, true);
  });

  it('plays to a win, reports the end once, and rejects further moves', async () => {
    const engine = await fresh();
    const cols = [0, 1, 0, 1, 0, 1];
    for (const [i, column] of cols.entries()) {
      const r = await engine.move(SID, i % 2 === 0 ? A : B, { column });
      assert.ok(r.ok && r.ended === null);
    }
    const last = await engine.move(SID, A, { column: 0 });
    assert.ok(last.ok);
    assert.equal(last.ended?.winnerSeat, 0);
    assert.equal(last.ended?.reason, 'complete');
    assert.equal(last.ended?.session.log.length, 7);
    assert.deepEqual(await engine.move(SID, B, { column: 2 }), { ok: false, error: 'game_over' });
  });

  it('resign gives the win to the opponent', async () => {
    const engine = await fresh();
    const r = await engine.resign(SID, A);
    assert.ok(r.ok);
    assert.equal(r.ended?.winnerSeat, 1);
    assert.equal(r.ended?.reason, 'resign');
  });

  it('forfeits an idle turn when the timer comes due, and not before', async () => {
    let now = 1_000;
    const store = new MemoryStore();
    const engine = new Engine(store, { now: () => now });
    await engine.open({ sessionId: SID, gameId: 'four-up', players: [A, B], seed: 7 });
    assert.ok((await engine.move(SID, A, { column: 3 })).ok);
    assert.deepEqual(await store.due(now + 1000, 10), []);
    assert.deepEqual(await engine.tick(SID), { ok: false, error: 'nothing_due' });
    now += 24 * 60 * 60 * 1000;
    assert.deepEqual(await store.due(now, 10), [SID]);
    const r = await engine.tick(SID);
    assert.ok(r.ok);
    assert.equal(r.ended?.winnerSeat, 0);
    assert.equal(r.ended?.reason, 'timeout');
    assert.deepEqual(await store.due(now, 10), [], 'timer cleared once finished');
  });

  it('a late move loses to the clock even before the sweeper runs', async () => {
    let now = 0;
    const engine = new Engine(new MemoryStore(), { now: () => now });
    await engine.open({ sessionId: SID, gameId: 'chess-bullet', players: [A, B], seed: 1 });
    assert.ok((await engine.move(SID, A, { from: 'e2', to: 'e4' })).ok);
    now = 120_000;
    const r = await engine.move(SID, B, { from: 'e7', to: 'e5' });
    assert.ok(r.ok, 'the due flag is applied; the move itself is dropped');
    assert.equal(r.ended?.winnerSeat, 0);
    assert.equal(r.ended?.reason, 'timeout');
  });

  it('gives each seat its own view and hides trivia answers', async () => {
    let now = 0;
    const engine = new Engine(new MemoryStore(), { now: () => now, content: contentFor });
    const s = await engine.open({ sessionId: SID, gameId: 'trivia-burst', players: [A, B], seed: 11 });
    assert.equal(JSON.stringify(engine.view(s, 0)).includes('"answer"'), false);
    now = TRIVIA_REVEAL_MS + 100;
    const r = await engine.move(SID, A, { choice: 1 });
    assert.ok(r.ok);
    const mine = engine.view(r.session, 0) as { state: { myPick: number | null }; awaiting: number[] };
    const theirs = engine.view(r.session, 1) as { state: { myPick: number | null } };
    assert.equal(mine.state.myPick, 1);
    assert.equal(theirs.state.myPick, null);
    assert.deepEqual(mine.awaiting, [1]);
    now = TRIVIA_REVEAL_MS + TRIVIA_ROUND_MS;
    const t = await engine.tick(SID);
    assert.ok(t.ok);
    assert.equal((engine.view(t.session, 1) as { state: { round: number } }).state.round, 1);
  });

  it('screens player-written text and fails closed', async () => {
    const seen: Array<[string[], string]> = [];
    let verdict: ScreenVerdict = 'block';
    const engine = new Engine(new MemoryStore(), {
      screen: async (texts, context) => {
        seen.push([texts, context]);
        return verdict;
      },
    });
    await engine.open({ sessionId: SID, gameId: 'two-truths', players: [A, B], seed: 1 });
    const write = { kind: 'write', statements: ['I have a dog', 'I can juggle', 'I hate pizza'], lie: 2 };
    assert.deepEqual(await engine.move(SID, A, write), { ok: false, error: 'text_blocked' });
    assert.deepEqual(seen[0], [write.statements, 'two_truths']);
    verdict = 'unavailable';
    assert.deepEqual(await engine.move(SID, A, write), { ok: false, error: 'safety_unavailable' });
    verdict = 'allow';
    assert.ok((await engine.move(SID, A, write)).ok);
    // Invalid moves are rejected before any text is sent for screening.
    const before = seen.length;
    assert.deepEqual(await engine.move(SID, A, write), { ok: false, error: 'already_written' });
    assert.equal(seen.length, before);
    // No screener configured at all: still fails closed.
    const bare = new Engine(new MemoryStore());
    await bare.open({ sessionId: SID, gameId: 'two-truths', players: [A, B], seed: 1 });
    assert.deepEqual(await bare.move(SID, A, write), { ok: false, error: 'safety_unavailable' });
  });
});
