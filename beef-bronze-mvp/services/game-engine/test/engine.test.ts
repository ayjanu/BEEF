import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { Engine, MemoryStore } from '../src/engine.ts';

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
    assert.equal(last.ended?.session.log.length, 7);
    assert.deepEqual(await engine.move(SID, B, { column: 2 }), { ok: false, error: 'game_over' });
  });

  it('resign gives the win to the opponent', async () => {
    const engine = await fresh();
    const r = await engine.resign(SID, A);
    assert.ok(r.ok);
    assert.equal(r.ended?.winnerSeat, 1);
    assert.equal(r.ended?.session.resignedSeat, 0);
  });
});
