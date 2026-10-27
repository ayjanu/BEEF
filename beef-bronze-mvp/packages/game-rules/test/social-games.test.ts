import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import {
  applyEntry,
  deadlineEntry,
  matchView,
  normalizeGuess,
  replayMatch,
  startMatch,
  triviaBurst as T,
  TRIVIA_REVEAL_MS,
  TRIVIA_ROUND_MS,
  TT_WRITE_MS,
  twentyQuestions as Q,
  twoTruths as TT,
  wouldYouRather as W,
  WYR_ROUND_MS,
  type AnyGameRules,
  type LogEntry,
  type MatchState,
  type TqState,
  type TriviaState,
  type TtState,
  type WyrState,
} from '../src/index.ts';
import { TRIVIA_BANK, contentFor } from '../src/content/index.ts';

function step(rules: AnyGameRules, m: MatchState, e: LogEntry): MatchState {
  const r = applyEntry(rules, m, e);
  assert.ok(!('error' in r), `${JSON.stringify(e)} rejected: ${'error' in r ? r.error : ''}`);
  return r as MatchState;
}

describe('content', () => {
  it('draws the same questions for the same seed, all distinct and valid', () => {
    const a = contentFor('trivia-burst', 7) as { questions: Array<{ id: number; answer: number; choices: string[] }> };
    assert.deepEqual(a, contentFor('trivia-burst', 7));
    assert.notDeepEqual(a, contentFor('trivia-burst', 8));
    assert.equal(new Set(a.questions.map((q) => q.id)).size, 12);
    for (const q of TRIVIA_BANK) assert.ok(q.answer < q.choices.length);
    assert.equal(new Set(TRIVIA_BANK.map((q) => q.id)).size, TRIVIA_BANK.length);
    assert.equal(contentFor('four-up', 1), undefined);
  });
});

describe('trivia burst', () => {
  const opts = contentFor('trivia-burst', 3);
  const start = () => startMatch(T, 3, 2, 0, opts);
  const answerOf = (m: MatchState) => {
    const s = m.state as TriviaState;
    return s.questions[s.round]!.answer;
  };

  it('scores correct answers with a speed bonus and closes the round when all answer', () => {
    let m = start();
    const t0 = TRIVIA_REVEAL_MS;
    assert.deepEqual(applyEntry(T, m, { kind: 'move', seat: 0, move: { choice: 0 }, at: 0 }), { error: 'round_not_started' });
    const right = answerOf(m);
    m = step(T, m, { kind: 'move', seat: 0, move: { choice: right }, at: t0 });
    assert.deepEqual(applyEntry(T, m, { kind: 'move', seat: 0, move: { choice: right }, at: t0 + 1 }), { error: 'already_answered' });
    m = step(T, m, { kind: 'move', seat: 1, move: { choice: (right + 1) % 4 }, at: t0 + TRIVIA_ROUND_MS / 2 });
    const s = m.state as TriviaState;
    assert.equal(s.round, 1);
    assert.deepEqual(s.scores, [150, 0]);
  });

  it('hides the answer and the other pick until the round closes', () => {
    let m = start();
    m = step(T, m, { kind: 'move', seat: 0, move: { choice: 2 }, at: TRIVIA_REVEAL_MS });
    const v1 = matchView(T, m, 1) as { question: Record<string, unknown>; myPick: number | null; answered: boolean[] };
    assert.equal('answer' in v1.question, false);
    assert.equal(v1.myPick, null);
    assert.deepEqual(v1.answered, [true, false]);
    assert.equal(JSON.stringify(v1).includes('"picks":[{'), false);
  });

  it('times rounds out and finishes after 12, replaying exactly', () => {
    let m = start();
    for (let i = 0; i < 12; i++) {
      const s = m.state as TriviaState;
      const due = s.roundStartedAt + TRIVIA_ROUND_MS;
      const right = answerOf(m);
      m = step(T, m, { kind: 'move', seat: 1, move: { choice: right }, at: due - 1 });
      m = step(T, m, deadlineEntry(T, m, due)!);
    }
    const s = m.state as TriviaState;
    assert.equal(s.history.length, 12);
    assert.equal(s.scores[0], 0);
    assert.equal(s.scores[1], 12 * 100); // last-millisecond answers earn no speed bonus
    assert.deepEqual(T.outcome(s), { done: true, winner: 1, draw: false, scores: [0, 1200] });
    assert.deepEqual(replayMatch(T, 3, 2, 0, m.log, opts), m);
  });

  it('refuses to start without content', () => {
    assert.throws(() => startMatch(T, 1, 2, 0), /needs 12 questions/);
  });
});

describe('would you rather', () => {
  const opts = contentFor('would-you-rather', 5);

  it('reports match percentage, hides picks until both answer, and never names a winner', () => {
    let m = startMatch(W, 5, 2, 0, opts);
    m = step(W, m, { kind: 'move', seat: 0, move: { choice: 'a' }, at: 10 });
    assert.equal((matchView(W, m, 1) as { myPick: unknown }).myPick, null);
    m = step(W, m, { kind: 'move', seat: 1, move: { choice: 'a' }, at: 20 });
    m = step(W, m, { kind: 'move', seat: 0, move: { choice: 'a' }, at: 30 });
    m = step(W, m, { kind: 'move', seat: 1, move: { choice: 'b' }, at: 40 });
    const v = matchView(W, m, 0) as { match: { matched: number; answered: number; percent: number } };
    assert.deepEqual(v.match, { matched: 1, answered: 2, percent: 50 });
    assert.equal(W.outcome(m.state).winner, null);
  });

  it('ends early when a round passes with nobody answering', () => {
    let m = startMatch(W, 5, 2, 0, opts);
    m = step(W, m, deadlineEntry(W, m, WYR_ROUND_MS)!);
    const o = W.outcome(m.state as WyrState);
    assert.equal(o.done, true);
    assert.equal(o.draw, false);
  });
});

describe('two truths and a lie', () => {
  const write = (seat: number, lie: number, at: number): LogEntry => ({
    kind: 'move',
    seat,
    at,
    move: { kind: 'write', statements: [`I have ${seat} cats`, 'I can juggle', 'I ran a marathon'], lie },
  });

  it('plays write then guess and scores both ways', () => {
    let m = startMatch(TT, 1, 2, 0);
    m = step(TT, m, write(0, 2, 10));
    // Before both have written, the other set is invisible.
    assert.equal((matchView(TT, m, 1) as { sets: unknown[] }).sets[0], null);
    m = step(TT, m, write(1, 1, 20));
    const v = matchView(TT, m, 1) as { phase: string; sets: Array<Record<string, unknown> | null> };
    assert.equal(v.phase, 'guess');
    assert.equal('lie' in v.sets[0]!, false);
    m = step(TT, m, { kind: 'move', seat: 0, move: { kind: 'guess', guess: 1 }, at: 30 }); // right
    m = step(TT, m, { kind: 'move', seat: 1, move: { kind: 'guess', guess: 0 }, at: 40 }); // wrong
    const s = m.state as TtState;
    assert.deepEqual(s.scores, [2, 0]);
    assert.deepEqual(TT.outcome(s), { done: true, winner: 0, draw: false, scores: [2, 0] });
  });

  it('validates statements and exposes text for screening', () => {
    const s = TT.init(1, 2, 0);
    const bad = (statements: string[]) => TT.validate(s, { kind: 'write', statements, lie: 0 }, 0, { now: 1 });
    assert.equal(bad(['ab', 'long enough', 'also fine']), 'statement_length');
    assert.equal(bad(['Same thing', 'same thing', 'other one']), 'statements_not_distinct');
    assert.equal(TT.validate(s, { kind: 'guess', guess: 0 }, 0, { now: 1 }), 'wrong_phase');
    assert.deepEqual(TT.userTexts!({ kind: 'write', statements: ['a', 'b', 'c'], lie: 0 }), ['a', 'b', 'c']);
  });

  it('a player who never writes loses at the deadline', () => {
    let m = startMatch(TT, 1, 2, 0);
    m = step(TT, m, write(1, 0, 10));
    m = step(TT, m, deadlineEntry(TT, m, TT_WRITE_MS)!);
    assert.equal((m.state as TtState).result?.winner, 1);
    assert.equal((m.state as TtState).result?.reason, 'opponent_did_not_write');
  });
});

describe('20 questions', () => {
  const seed = 4; // even seed: seat 0 answers, seat 1 asks
  const mv = (seat: number, move: unknown, at: number): LogEntry => ({ kind: 'move', seat, move, at });

  it('hides the secret from the asker and wins on an exact guess', () => {
    let m = startMatch(Q, seed, 2, 0);
    assert.deepEqual(Q.awaiting(m.state), [0]);
    m = step(Q, m, mv(0, { kind: 'secret', secret: 'The Eiffel Tower', category: 'place' }, 1));
    assert.equal((matchView(Q, m, 1) as TqState).secret, null);
    assert.equal((matchView(Q, m, 0) as TqState).secret, 'The Eiffel Tower');
    m = step(Q, m, mv(1, { kind: 'question', text: 'Is it in Europe?' }, 2));
    m = step(Q, m, mv(0, { kind: 'reply', reply: 'yes' }, 3));
    m = step(Q, m, mv(1, { kind: 'guess', text: 'eiffel tower!' }, 4));
    const s = m.state as TqState;
    assert.deepEqual(s.result, { winner: 1, reason: 'guessed' });
    assert.equal((matchView(Q, m, 1) as TqState).secret, 'The Eiffel Tower'); // revealed at the end
  });

  it('lets the answerer accept a synonym, and requires yes/no for guesses', () => {
    let m = startMatch(Q, seed, 2, 0);
    m = step(Q, m, mv(0, { kind: 'secret', secret: 'car', category: 'thing' }, 1));
    m = step(Q, m, mv(1, { kind: 'guess', text: 'automobile' }, 2));
    assert.deepEqual(applyEntry(Q, m, mv(0, { kind: 'reply', reply: 'sometimes' }, 3)), { error: 'guess_needs_yes_or_no' });
    m = step(Q, m, mv(0, { kind: 'reply', reply: 'yes' }, 3));
    assert.deepEqual((m.state as TqState).result, { winner: 1, reason: 'guess_accepted' });
  });

  it('the answerer wins after 20 misses', () => {
    let m = startMatch(Q, seed, 2, 0);
    m = step(Q, m, mv(0, { kind: 'secret', secret: 'piano', category: 'thing' }, 1));
    for (let i = 0; i < 20; i++) {
      m = step(Q, m, mv(1, { kind: 'question', text: `Question number ${i}?` }, 2 + 2 * i));
      m = step(Q, m, mv(0, { kind: 'reply', reply: 'no' }, 3 + 2 * i));
    }
    assert.deepEqual((m.state as TqState).result, { winner: 0, reason: 'stumped' });
  });

  it('normalizes guesses', () => {
    assert.equal(normalizeGuess('  The   Café! '), 'cafe');
    assert.equal(normalizeGuess('an Apple'), 'apple');
  });
});
