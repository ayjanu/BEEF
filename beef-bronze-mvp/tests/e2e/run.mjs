#!/usr/bin/env node
/**
 * BEEF end-to-end test (Spec 07 Bronze and Silver exit tests).
 *
 * Drives the full loop through public interfaces only, exactly as the app does:
 * sign-up → adults-only gate → profile → verification tier gate → swipe →
 * mutual match → chat with safety screening → challenge → play Four Up on the
 * game engine → result → XP/BP/rating → skill queue via the Go matchmaker →
 * resign → diminishing returns → leaderboard → report → TAKE IT DOWN intake →
 * move log and chat history persisted in DynamoDB.
 *
 * Silver adds: the beta catalog (Chess, Trivia Burst with server timers,
 * Would You Rather, Two Truths with text screening, 20 Questions with hidden
 * information), XP-only social titles, the result feed with reactions,
 * comments, follows and rematches, exact replay of stored move logs, and
 * blocks enforced across feed, challenges, chat and the queue.
 *
 * Point it at any environment with CORE_URL, GAME_WS_URL, CHAT_WS_URL, SAFETY_URL.
 */
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { Socket } from 'phoenix';
import { getRules, replayMatch } from '@beef/game-rules';
import { existsSync, readFileSync } from 'node:fs';

const CORE = process.env.CORE_URL ?? 'http://localhost:3000';
const GAME_WS = process.env.GAME_WS_URL ?? 'ws://localhost:3100';
const CHAT_WS = process.env.CHAT_WS_URL ?? 'ws://localhost:4000/socket';
const SAFETY = process.env.SAFETY_URL ?? 'http://localhost:8000';
const OTP = process.env.DEV_OTP_CODE ?? '000000';
const DDB = process.env.DYNAMODB_ENDPOINT ?? 'http://localhost:8001';
const MOVE_LOG_TABLE = process.env.MOVE_LOG_TABLE ?? 'beef-local-move-logs';
// Remote mode (AWS): only public ALB routes are reachable, so direct readiness
// probes and the DynamoDB read are skipped; everything else runs unchanged.
const REMOTE = process.env.E2E_REMOTE === '1';
// Venue onboarding is an internal (ops) API. Locally the token comes from the stack's .env.
const ENV_FILE = new URL('../../.env', import.meta.url);
const INTERNAL_TOKEN =
  process.env.INTERNAL_TOKEN ??
  (existsSync(ENV_FILE) ? /^INTERNAL_TOKEN=(.*)$/m.exec(readFileSync(ENV_FILE, 'utf8'))?.[1]?.trim() : undefined);

let passed = 0;
async function step(name, fn) {
  const t0 = Date.now();
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name} (${Date.now() - t0} ms)`);
  } catch (err) {
    console.error(`  ✗ ${name}\n    ${err.stack ?? err}`);
    process.exit(1);
  }
}
function assert(cond, msg) {
  if (!cond) throw new Error(`assertion failed: ${msg}`);
}

async function api(method, path, token, body, expect = [200, 201, 202]) {
  const res = await fetch(CORE + path, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!expect.includes(res.status)) throw new Error(`${method} ${path} -> ${res.status} ${text}`);
  return { status: res.status, data };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(predicate, label, timeoutMs = 10_000) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    const v = await predicate();
    if (v) return v;
    await sleep(100);
  }
  throw new Error(`timed out waiting for ${label}`);
}

// ---------- realtime helpers ----------

function chatConnect(user) {
  const socket = new Socket(CHAT_WS, { params: { token: user.token }, transport: WebSocket, timeout: 5000 });
  socket.connect();
  user.socket = socket;
  user.events = [];
  const ch = socket.channel(`user:${user.id}`);
  for (const ev of ['mutual_match', 'challenge_received', 'match_found', 'game_result', 'booking_invite', 'booking_update', 'safety_check']) {
    ch.on(ev, (payload) => user.events.push({ ev, payload }));
  }
  return join(ch);
}

function join(channel) {
  return new Promise((resolve, reject) =>
    channel.join().receive('ok', (resp) => resolve({ channel, resp })).receive('error', reject).receive('timeout', () => reject(new Error('join timeout'))),
  );
}

function push(channel, event, payload) {
  return new Promise((resolve) =>
    channel
      .push(event, payload)
      .receive('ok', (r) => resolve({ ok: true, r }))
      .receive('error', (r) => resolve({ ok: false, r }))
      .receive('timeout', () => resolve({ ok: false, r: 'timeout' })),
  );
}

const eventOf = (user, ev, pred = () => true) => () => user.events.find((e) => e.ev === ev && pred(e.payload))?.payload;

function gameConnect(user, sessionId) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${GAME_WS}/session/${sessionId}?token=${user.token}`);
    const g = { ws, msgs: [], seat: null };
    ws.onmessage = (e) => {
      const m = JSON.parse(e.data);
      g.msgs.push(m);
      if (m.type === 'hello') {
        g.seat = m.seat;
        resolve(g);
      }
    };
    ws.onerror = () => reject(new Error('game socket error'));
    setTimeout(() => reject(new Error('game hello timeout')), 5000);
  });
}

// ---------- the test ----------

const runId = String(Date.now()).slice(-6);
const alex = { phone: `+1214${runId}01`, name: 'Alex' };
const blair = { phone: `+1214${runId}02`, name: 'Blair' };

console.log(`BEEF e2e against ${CORE}`);

await step('every service reports ready', async () => {
  if (REMOTE) {
    await waitFor(async () => (await fetch(`${CORE}/v1/status`).catch(() => null))?.ok, 'core-api via ALB', 120_000);
    return;
  }
  const urls = [`${CORE}/readyz`, `${GAME_WS.replace('ws', 'http')}/readyz`, `${CHAT_WS.replace('ws', 'http').replace('/socket', '')}/readyz`, `${SAFETY}/readyz`];
  for (const u of urls) await waitFor(async () => (await fetch(u).catch(() => null))?.ok, u, 60_000);
});

await step('two players sign up with phone OTP', async () => {
  for (const u of [alex, blair]) {
    await api('POST', '/v1/auth/otp/start', null, { phone: u.phone });
    const { data } = await api('POST', '/v1/auth/otp/verify', null, { phone: u.phone, code: OTP });
    assert(data.isNew && data.token, 'new account with token');
    Object.assign(u, { id: data.userId, token: data.token });
  }
  const bad = await api('POST', '/v1/auth/otp/verify', null, { phone: alex.phone, code: '123456' }, [401]);
  assert(bad.data.error === 'bad_code', 'wrong code rejected');
});

await step('adults-only gate rejects an under-18 birth date', async () => {
  const minor = new Date();
  minor.setUTCFullYear(minor.getUTCFullYear() - 17);
  const r = await api('PUT', '/v1/me/profile', alex.token, { displayName: 'Kid', birthDate: minor.toISOString().slice(0, 10), intents: ['platonic'] }, [403]);
  assert(r.data.error === 'under_18', 'under_18 error');
});

await step('profiles are created', async () => {
  await api('PUT', '/v1/me/profile', alex.token, { displayName: 'Alex', birthDate: '1999-04-02', intents: ['platonic', 'romantic'], games: ['four-up'], vibeTags: ['competitive'] });
  await api('PUT', '/v1/me/profile', blair.token, { displayName: 'Blair', birthDate: '1997-11-20', intents: ['platonic'], games: ['four-up'] });
  const me = (await api('GET', '/v1/me', alex.token)).data;
  assert(me.age >= 18 && me.tier === 'V0', 'profile readable, tier V0');
});

await step('swiping requires verification tier V1', async () => {
  const r = await api('GET', '/v1/swipe/deck', alex.token, null, [403]);
  assert(r.data.error === 'verification_required' && r.data.need === 'V1', 'V1 required');
  for (const u of [alex, blair]) {
    const { data } = await api('POST', '/v1/me/verify/liveness', u.token);
    assert(data.tier === 'V1', 'dev liveness stub grants V1');
    u.token = data.token;
  }
});

await step('realtime channels connect for both players', async () => {
  await chatConnect(alex);
  await chatConnect(blair);
});

await step('deck shows intent-compatible players; mutual right swipe creates a match', async () => {
  const deck = (await api('GET', '/v1/swipe/deck', alex.token)).data;
  assert(deck.some((p) => p.userId === blair.id), 'Blair is in Alex deck (shared platonic intent)');
  const first = (await api('POST', '/v1/swipe', alex.token, { targetId: blair.id, direction: 'right' })).data;
  assert(!first.matched, 'one-sided swipe is not a match');
  const second = (await api('POST', '/v1/swipe', blair.token, { targetId: alex.id, direction: 'right' })).data;
  assert(second.matched && second.threadId, 'mutual swipe matches');
  alex.threadId = blair.threadId = second.threadId;
  await waitFor(eventOf(alex, 'mutual_match'), 'Alex mutual_match push');
  await waitFor(eventOf(blair, 'mutual_match'), 'Blair mutual_match push');
});

await step('chat: trash talk delivered, threat blocked, phone number blurred', async () => {
  const a = await join(alex.socket.channel(`thread:${alex.threadId}`));
  const b = await join(blair.socket.channel(`thread:${blair.threadId}`));
  const received = [];
  b.channel.on('msg', (m) => received.push(m));

  const ok = await push(a.channel, 'msg', { body: "you're getting cooked at Four Up" });
  assert(ok.ok && ok.r.action === 'allow', 'trash talk allowed');
  const threat = await push(a.channel, 'msg', { body: "I'm going to find you after this" });
  assert(!threat.ok && threat.r.error === 'blocked', 'threat blocked before delivery');
  const pii = await push(b.channel, 'msg', { body: 'text me 214-555-0100' });
  assert(pii.ok && pii.r.action === 'blur', 'phone number delivered blurred');
  await waitFor(() => received.find((m) => m.body.includes('cooked')), 'Blair receives message');
  assert(!received.some((m) => m.body.includes('find you')), 'blocked message never delivered');

  // Outsiders cannot join someone else's thread.
  const outsider = { phone: `+1214${runId}03` };
  await api('POST', '/v1/auth/otp/start', null, { phone: outsider.phone });
  outsider.token = (await api('POST', '/v1/auth/otp/verify', null, { phone: outsider.phone, code: OTP })).data.token;
  const s = new Socket(CHAT_WS, { params: { token: outsider.token }, transport: WebSocket });
  s.connect();
  const denied = await join(s.channel(`thread:${alex.threadId}`)).then(() => false, (e) => e.reason === 'not_a_member');
  s.disconnect();
  assert(denied, 'non-member cannot join thread');
});

let session1;
await step('challenge → accept opens a game session and pushes match_found', async () => {
  const ch = (await api('POST', '/v1/challenges', alex.token, { toUserId: blair.id, gameId: 'four-up' })).data;
  await waitFor(eventOf(blair, 'challenge_received', (p) => p.id === ch.id), 'challenge_received push');
  session1 = (await api('POST', `/v1/challenges/${ch.id}/accept`, blair.token)).data;
  assert(session1.state === 'active' && session1.players[0] === alex.id, 'session open, challenger is seat 0');
  await waitFor(eventOf(alex, 'match_found', (p) => p.id === session1.id), 'match_found push to challenger');
  const again = await api('POST', `/v1/challenges/${ch.id}/accept`, blair.token, null, [409]);
  assert(again.data.error === 'challenge_not_open', 'double accept is refused');
});

async function playMoves(sessionId, players, script) {
  const conns = await Promise.all(players.map((u) => gameConnect(u, sessionId)));
  const bySeat = Object.fromEntries(conns.map((g) => [g.seat, g]));
  for (const [seat, column] of script) {
    const g = bySeat[seat];
    const before = g.msgs.filter((m) => m.type === 'state').length;
    g.ws.send(JSON.stringify({ type: 'move', move: { column } }));
    await waitFor(() => g.msgs.filter((m) => m.type === 'state').length > before, `state after move ${column}`);
  }
  return { conns, bySeat };
}

/** Opens both players' sockets on a session; `act` sends a move and waits for the reply. */
async function table(sessionId, players) {
  const conns = await Promise.all(players.map((u) => gameConnect(u, sessionId)));
  const of = (u) => conns[players.indexOf(u)];
  const latest = (u) => [...of(u).msgs].reverse().find((m) => m.type === 'state' || m.type === 'hello').session;
  // Moves are acted one at a time, so the reply to a move is the first state with one more move in it
  // (other broadcasts may still be in flight on this socket).
  let moves = 0;
  async function act(u, move, expectError) {
    const g = of(u);
    const before = g.msgs.length;
    g.ws.send(JSON.stringify({ type: 'move', move }));
    const reply = await waitFor(
      () => g.msgs.slice(before).find((m) => m.type === 'error' || (!expectError && m.type === 'state' && m.session.moves > moves)),
      'move reply',
    );
    if (expectError) assert(reply.type === 'error' && reply.error === expectError, `expected ${expectError}, got ${JSON.stringify(reply)}`);
    else {
      assert(reply.type === 'state', `move rejected: ${JSON.stringify(reply)}`);
      moves = reply.session.moves;
    }
    return reply;
  }
  const ended = (u) => waitFor(() => of(u).msgs.find((m) => m.type === 'end'), 'end event', 20_000);
  const close = () => conns.forEach((g) => g.ws.close());
  return { of, latest, act, ended, close };
}

/** Challenge → accept: the challenger is seat 0. */
async function challengeAndAccept(from, to, gameId) {
  const ch = (await api('POST', '/v1/challenges', from.token, { toUserId: to.id, gameId })).data;
  return (await api('POST', `/v1/challenges/${ch.id}/accept`, to.token)).data;
}

await step('server-authoritative play: illegal moves rejected, game won by seat 0', async () => {
  const { conns, bySeat } = await playMoves(session1.id, [alex, blair], []);
  bySeat[1].ws.send(JSON.stringify({ type: 'move', move: { column: 0 } }));
  await waitFor(() => bySeat[1].msgs.find((m) => m.type === 'error' && m.error === 'not_your_turn'), 'out-of-turn rejected');
  for (const [seat, column] of [[0, 0], [1, 1], [0, 0], [1, 1], [0, 0], [1, 1], [0, 0]]) {
    const before = bySeat[seat].msgs.length;
    bySeat[seat].ws.send(JSON.stringify({ type: 'move', move: { column } }));
    await waitFor(() => bySeat[seat].msgs.length > before, 'move ack');
  }
  const end = await waitFor(() => bySeat[1].msgs.find((m) => m.type === 'end'), 'end event');
  assert(end.winnerSeat === 0 && !end.draw, 'seat 0 wins');
  conns.forEach((g) => g.ws.close());
});

await step('result pays XP and BP per the Spec 02 formula and moves ratings', async () => {
  const a = await waitFor(eventOf(alex, 'game_result', (p) => p.sessionId === session1.id), 'Alex game_result');
  const b = await waitFor(eventOf(blair, 'game_result', (p) => p.sessionId === session1.id), 'Blair game_result');
  assert(a.outcome === 'win' && a.xp === 30 && a.bp === 10 && a.ratingDelta > 0, `winner payout ${JSON.stringify(a)}`);
  assert(b.outcome === 'loss' && b.xp === 15 && b.bp === 3 && b.ratingDelta < 0, `loser payout ${JSON.stringify(b)}`);
  const w = (await api('GET', '/v1/me/wallet', alex.token)).data;
  assert(w.xp === 30 && w.bp === 10 && w.ratings[0].gameId === 'four-up' && w.ratings[0].rating > 1500, 'wallet reflects ledger');
});

let session2;
await step('skill queue: Go matchmaker pairs both players and core-api opens the session', async () => {
  await api('POST', '/v1/queue', alex.token, { gameId: 'four-up' });
  await api('POST', '/v1/queue', blair.token, { gameId: 'four-up' });
  const m = await waitFor(eventOf(alex, 'match_found', (p) => p.id !== session1.id), 'queue match_found', 15_000);
  await waitFor(eventOf(blair, 'match_found', (p) => p.id === m.id), 'queue match_found to Blair');
  session2 = m;
  assert(session2.players.includes(alex.id) && session2.players.includes(blair.id), 'both seated');
});

/** Each player drops one disc (so the game counts as played), then `quitter` resigns. */
async function oneEachThenResign(sessionId, quitter, other) {
  const [gq, go] = await Promise.all([gameConnect(quitter, sessionId), gameConnect(other, sessionId)]);
  const bySeat = { [gq.seat]: gq, [go.seat]: go };
  for (const seat of [0, 1]) {
    const g = bySeat[seat];
    const before = g.msgs.length;
    g.ws.send(JSON.stringify({ type: 'move', move: { column: seat } }));
    await waitFor(() => g.msgs.slice(before).find((m) => m.type === 'state'), 'move ack');
  }
  gq.ws.send(JSON.stringify({ type: 'resign' }));
  return [gq, go];
}

await step('resign hands the win to the opponent; repeat game pays half BP (diminishing returns)', async () => {
  const [ga, gb] = await oneEachThenResign(session2.id, alex, blair);
  const end = await waitFor(() => gb.msgs.find((m) => m.type === 'end'), 'end after resign');
  assert(end.winnerSeat === gb.seat, 'Blair wins by resignation');
  const b = await waitFor(eventOf(blair, 'game_result', (p) => p.sessionId === session2.id), 'Blair result');
  assert(b.outcome === 'win' && b.bp === 5, `2nd game vs same opponent pays 10 × 0.5 = 5 BP, got ${b.bp}`);
  [ga, gb].forEach((g) => g.ws.close());
});

await step('an instant resignation is a no-contest: nothing paid, nothing posted (anti-farming)', async () => {
  const s = await challengeAndAccept(alex, blair, 'four-up');
  const g = await gameConnect(alex, s.id);
  g.ws.send(JSON.stringify({ type: 'resign' }));
  await waitFor(() => g.msgs.find((m) => m.type === 'end'), 'end');
  const r = await waitFor(eventOf(blair, 'game_result', (p) => p.sessionId === s.id), 'result');
  assert(r.xp === 0 && r.bp === 0 && r.ratingDelta === 0, `no-contest pays nothing: ${JSON.stringify(r)}`);
  const feed = (await api('GET', '/v1/feed', blair.token)).data;
  assert(!feed.posts.some((p) => p.sessionId === s.id), 'no feed card');
  g.ws.close();
});

await step('leaderboard ranks both players from Redis', async () => {
  const lb = (await api('GET', '/v1/leaderboards/four-up', alex.token)).data;
  const ids = lb.map((e) => e.userId);
  assert(ids.includes(alex.id) && ids.includes(blair.id), 'both on leaderboard');
  assert(lb.every((e, i) => i === 0 || lb[i - 1].rating >= e.rating), 'sorted by rating');
});


// ====================== Silver ======================

await step('Silver catalog: eight titles, ranked and for-fun', async () => {
  const games = (await api('GET', '/v1/games', alex.token)).data;
  const ids = games.map((g) => g.id).sort();
  assert(
    JSON.stringify(ids) ===
      JSON.stringify(['chess', 'chess-bullet', 'dots-and-boxes', 'four-up', 'trivia-burst', 'twenty-questions', 'two-truths', 'would-you-rather']),
    `catalog ${ids}`,
  );
  assert(games.find((g) => g.id === 'would-you-rather').rated === false, 'WYR is unrated');
  assert(games.find((g) => g.id === 'chess').rated === true, 'chess is ranked');
});

await step('bios are screened: a phone number in a bio is refused', async () => {
  const r = await api('PUT', '/v1/me/profile', alex.token, { displayName: 'Alex', birthDate: '1999-04-02', intents: ['platonic', 'romantic'], bio: 'call me 214-555-0100' }, [422]);
  assert(r.data.error === 'text_blocked', 'bio blocked');
});

const silverSessions = {};
await step("chess: fool's mate ends by checkmate with the clocks running", async () => {
  const s = await challengeAndAccept(alex, blair, 'chess');
  silverSessions.chess = s;
  const t = await table(s.id, [alex, blair]);
  const hello = t.latest(alex);
  assert(hello.deadline > Date.now() && hello.awaiting[0] === 0, 'white to move with a live clock');
  await t.act(blair, { from: 'e7', to: 'e5' }, 'not_your_turn');
  await t.act(alex, { from: 'f2', to: 'f3' });
  await t.act(blair, { from: 'e7', to: 'e5' });
  await t.act(alex, { from: 'e2', to: 'e5' }, 'illegal_move');
  await t.act(alex, { from: 'g2', to: 'g4' });
  await t.act(blair, { from: 'd8', to: 'h4' });
  const end = await t.ended(alex);
  assert(end.winnerSeat === 1 && end.reason === 'checkmate', `end ${JSON.stringify(end)}`);
  const r = await waitFor(eventOf(blair, 'game_result', (p) => p.sessionId === s.id), 'chess result');
  assert(r.outcome === 'win' && r.rated && r.reason === 'checkmate' && r.ratingDelta > 0, `result ${JSON.stringify(r)}`);
  t.close();
});

await step('trivia: answers hidden, a timed-out round is closed by the server sweeper, 12 rounds complete', async () => {
  const s = await challengeAndAccept(alex, blair, 'trivia-burst');
  silverSessions.trivia = s;
  const t = await table(s.id, [alex, blair]);
  const first = t.latest(alex);
  assert(!JSON.stringify(first).includes('"answer"'), 'no answers in the player view');
  assert(first.state.question && first.state.round === 0, 'question 1 shown');
  // Round 1: only Alex answers; the round must close on its own at the deadline.
  await sleep(Math.max(0, first.state.roundStartedAt - Date.now()) + 50);
  await t.act(blair, { choice: 9 }, 'bad_move_shape');
  const mine = await t.act(alex, { choice: 0 });
  assert(mine.session.state.myPick === 0 && mine.session.awaiting.join() === '1', 'own pick shown, waiting on Blair');
  const blairSees = await waitFor(() => t.of(blair).msgs.filter((m) => m.type === 'state').at(-1), 'Blair update');
  assert(blairSees.session.state.myPick === null && blairSees.session.state.answered[0] === true, 'Blair sees that Alex answered, not what');
  await waitFor(() => t.latest(blair).state.round === 1, 'sweeper closes round 1', 15_000);
  for (let round = 1; round < 12; round++) {
    const v = await waitFor(() => (t.latest(alex).state.round === round ? t.latest(alex) : null), `round ${round + 1}`);
    await sleep(Math.max(0, v.state.roundStartedAt - Date.now()) + 50);
    await t.act(alex, { choice: round % 4 });
    await t.act(blair, { choice: (round + 1) % 4 });
  }
  const end = await t.ended(alex);
  const final = t.latest(alex).state;
  assert(final.history.length === 12 && final.history[0].picks[1] === null, 'Blair missed round 1');
  assert(Array.isArray(end.scores) && end.scores.length === 2, 'scores reported');
  t.close();
});

await step('would you rather: match % with no winner pays XP only and moves no rating', async () => {
  const s = await challengeAndAccept(blair, alex, 'would-you-rather');
  silverSessions.wyr = s;
  const t = await table(s.id, [blair, alex]);
  for (let i = 0; i < 10; i++) {
    await t.act(blair, { choice: 'a' });
    await t.act(alex, { choice: i < 7 ? 'a' : 'b' });
  }
  const end = await t.ended(alex);
  assert(end.winnerSeat === null && !end.draw && end.scores[0] === 7, `end ${JSON.stringify(end)}`);
  const view = t.latest(alex).state;
  assert(view.history.length === 10 && view.history[0].picks.join() === 'a,a', 'picks revealed at the end');
  const r = await waitFor(eventOf(alex, 'game_result', (p) => p.sessionId === s.id), 'WYR result');
  assert(r.outcome === 'complete' && r.xp === 20 && r.bp === 0 && r.rated === false && r.ratingDelta === 0, `result ${JSON.stringify(r)}`);
  const w = (await api('GET', '/v1/me/wallet', alex.token)).data;
  assert(!w.ratings.some((x) => x.gameId === 'would-you-rather'), 'no rating row for an unrated title');
  t.close();
});

await step('two truths: statements screened, the lie stays hidden until the end', async () => {
  const s = await challengeAndAccept(alex, blair, 'two-truths');
  silverSessions.twoTruths = s;
  const t = await table(s.id, [alex, blair]);
  await t.act(alex, { kind: 'write', statements: ['My number is 214-555-0100', 'I can juggle', 'I have a twin'], lie: 2 }, 'text_blocked');
  await t.act(alex, { kind: 'write', statements: ['I ran a marathon', 'I can juggle', 'I have a twin'], lie: 2 });
  assert(t.latest(blair).state.sets[0] === null, 'Blair cannot see Alex statements while writing');
  await t.act(blair, { kind: 'write', statements: ['I have been to Japan', 'I hate pizza', 'I play the drums'], lie: 1 });
  const guessView = await waitFor(() => (t.latest(blair).state.phase === 'guess' ? t.latest(blair) : null), 'guess phase');
  assert(guessView.state.sets[0].statements.length === 3 && !('lie' in guessView.state.sets[0]), 'statements shown without the lie');
  await t.act(alex, { kind: 'guess', guess: 1 }); // right
  await t.act(blair, { kind: 'guess', guess: 0 }); // wrong
  const end = await t.ended(blair);
  assert(end.winnerSeat === 0 && end.scores.join() === '2,0', `end ${JSON.stringify(end)}`);
  const r = await waitFor(eventOf(alex, 'game_result', (p) => p.sessionId === s.id), 'two truths result');
  assert(r.outcome === 'win' && r.rated === false && r.bp === 0 && r.xp === 30, `XP only: ${JSON.stringify(r)}`);
  t.close();
});

await step('20 questions: the secret is hidden from the asker; an exact guess wins', async () => {
  const s = await challengeAndAccept(alex, blair, 'twenty-questions');
  silverSessions.tq = s;
  const t = await table(s.id, [alex, blair]);
  const answererSeat = t.latest(alex).state.answerer;
  const [answerer, asker] = answererSeat === 0 ? [alex, blair] : [blair, alex];
  await t.act(answerer, { kind: 'secret', secret: 'Pizza', category: 'thing' });
  assert(t.latest(asker).state.secret === null && t.latest(answerer).state.secret === 'Pizza', 'secret hidden from asker');
  await t.act(asker, { kind: 'question', text: 'Can you eat it?' });
  await t.act(answerer, { kind: 'reply', reply: 'yes' });
  await t.act(asker, { kind: 'guess', text: 'pizza!' });
  const end = await t.ended(asker);
  assert(end.winnerSeat === 1 - answererSeat && end.reason === 'guessed', `end ${JSON.stringify(end)}`);
  assert(t.latest(asker).state.secret === 'Pizza', 'secret revealed at the end');
  t.close();
});

let casey;
await step('feed: result cards, reactions, screened comments, follows, rematch', async () => {
  const feed = (await api('GET', '/v1/feed', alex.token)).data;
  const chessPost = feed.posts.find((p) => p.sessionId === silverSessions.chess.id);
  assert(chessPost && chessPost.reason === 'checkmate' && chessPost.winnerSeat === 1, 'chess result card');
  assert(chessPost.players.map((p) => p.displayName).join() === 'Alex,Blair' && chessPost.players[1].ratingDelta > 0, 'names and rating moves');
  const wyrPost = feed.posts.find((p) => p.sessionId === silverSessions.wyr.id);
  assert(wyrPost && wyrPost.rated === false && wyrPost.players[0].ratingDelta === null, 'unrated card');
  assert(feed.posts.length >= 6, `feed has every game: ${feed.posts.length}`);

  const reacted = (await api('PUT', `/v1/posts/${chessPost.id}/reaction`, blair.token, { kind: 'fire' })).data;
  assert(reacted.reactions.fire === 1 && reacted.myReaction === 'fire', 'reaction counted');
  const switched = (await api('PUT', `/v1/posts/${chessPost.id}/reaction`, blair.token, { kind: 'skull' })).data;
  assert(!switched.reactions.fire && switched.reactions.skull === 1, 'one reaction per person');

  await api('POST', `/v1/posts/${chessPost.id}/comments`, alex.token, { body: 'run it back, you got lucky' });
  const threat = await api('POST', `/v1/posts/${chessPost.id}/comments`, alex.token, { body: "I'm going to find you" }, [422]);
  assert(threat.data.error === 'text_blocked', 'threat comment blocked');
  const comments = (await api('GET', `/v1/posts/${chessPost.id}/comments`, blair.token)).data;
  assert(comments.length === 1 && comments[0].displayName === 'Alex', 'one comment visible');

  const rm = (await api('POST', `/v1/sessions/${silverSessions.chess.id}/rematch`, alex.token)).data;
  assert(rm.toUserId === blair.id && rm.gameId === 'chess', 'rematch challenge');
  await waitFor(eventOf(blair, 'challenge_received', (p) => p.id === rm.id), 'rematch push');
  const twice = await api('POST', `/v1/sessions/${silverSessions.chess.id}/rematch`, alex.token, null, [409]);
  assert(twice.data.error === 'rematch_already_offered', 'one open rematch at a time');

  // A stranger sees nothing until they follow.
  casey = { phone: `+1214${runId}05` };
  await api('POST', '/v1/auth/otp/start', null, { phone: casey.phone });
  Object.assign(casey, (await api('POST', '/v1/auth/otp/verify', null, { phone: casey.phone, code: OTP })).data);
  casey.id = casey.userId;
  await api('PUT', '/v1/me/profile', casey.token, { displayName: 'Casey', birthDate: '1995-01-01', intents: ['platonic'] });
  assert((await api('GET', '/v1/feed', casey.token)).data.posts.length === 0, 'empty feed before following');
  await api('GET', `/v1/posts/${chessPost.id}/comments`, casey.token, null, [404]);
  const counts = (await api('PUT', `/v1/follows/${alex.id}`, casey.token)).data;
  assert(counts.followers === 1 && counts.iFollow, 'follow counted');
  const caseyFeed = (await api('GET', '/v1/feed', casey.token)).data;
  assert(caseyFeed.posts.some((p) => p.id === chessPost.id), 'followed player’s results appear');
});

await step('feed pages with a stable cursor', async () => {
  // Pad Alex's history past one page with quick resignations.
  for (let i = 0; i < 16; i++) {
    const s = await challengeAndAccept(alex, blair, 'four-up');
    const conns = await oneEachThenResign(s.id, alex, blair);
    await waitFor(() => conns[0].msgs.find((m) => m.type === 'end'), 'resign end');
    conns.forEach((g) => g.ws.close());
  }
  const ids = new Set();
  let next = null;
  let pages = 0;
  do {
    const page = (await api('GET', `/v1/feed${next ? `?before=${encodeURIComponent(next)}` : ''}`, alex.token)).data;
    page.posts.forEach((p) => ids.add(p.id));
    next = page.next;
    pages++;
  } while (next && pages < 10);
  assert(pages >= 2 && ids.size >= 22, `paged ${ids.size} posts over ${pages} pages`);
});


let pendingMeet;
await step('Level 4: V3 + certified venue rules, QR check-in by staff, attested result, Shield, prompts', async () => {
  if (REMOTE || !INTERNAL_TOKEN) {
    console.log('    (skipped: needs the internal token to onboard a venue)');
    return;
  }
  // Venue staff member.
  const dana = { phone: `+1214${runId}06` };
  await api('POST', '/v1/auth/otp/start', null, { phone: dana.phone });
  Object.assign(dana, (await api('POST', '/v1/auth/otp/verify', null, { phone: dana.phone, code: OTP })).data);
  await api('PUT', '/v1/me/profile', dana.token, { displayName: 'Dana', birthDate: '1990-05-05', intents: ['platonic'] });

  const onboard = async (body) => {
    const res = await fetch(`${CORE}/internal/venues`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-internal-token': INTERNAL_TOKEN },
      body: JSON.stringify({ city: 'Dallas', lat: 32.78, lng: -96.8, ownerUserId: dana.userId, ...body }),
    });
    assert(res.status === 201, `venue onboarding ${res.status}`);
    return res.json();
  };
  const certified = await onboard({ name: 'Pin Palace', address: '100 Elm St', games: ['bowling', 'pool-8-ball'], safeCertified: true });
  const corner = await onboard({ name: 'Corner Bar', address: '200 Main St', games: ['darts-501'] });
  const listed = (await api('GET', '/v1/venues?game=bowling', alex.token)).data;
  assert(listed.length === 1 && listed[0].id === certified.id, 'venues filter by game');

  const soon = (s) => new Date(Date.now() + s * 1000).toISOString();
  const slot = (await api('POST', `/v1/venues/${certified.id}/slots`, dana.token, { gameId: 'bowling', startsAt: soon(25), endsAt: soon(3600), capacity: 2 })).data;
  const cornerSlot = (await api('POST', `/v1/venues/${corner.id}/slots`, dana.token, { gameId: 'darts-501', startsAt: soon(7200), endsAt: soon(9000), capacity: 1 })).data;
  await api('POST', `/v1/venues/${certified.id}/slots`, alex.token, { gameId: 'bowling', startsAt: soon(60), endsAt: soon(600), capacity: 1 }, [403]);

  // Both players must be V3.
  const v1 = await api('POST', '/v1/bookings', alex.token, { slotId: slot.id, guestId: blair.id }, [403]);
  assert(v1.data.error === 'verification_required' && v1.data.need === 'V3', 'host needs V3');
  alex.token = (await api('POST', '/v1/me/verify/liveness', alex.token, { tier: 'V3' })).data.token;
  const guestTier = await api('POST', '/v1/bookings', alex.token, { slotId: slot.id, guestId: blair.id }, [403]);
  assert(guestTier.data.error === 'opponent_not_verified', 'guest needs V3 too');
  blair.token = (await api('POST', '/v1/me/verify/liveness', blair.token, { tier: 'V3' })).data.token;

  const uncert = await api('POST', '/v1/bookings', alex.token, { slotId: cornerSlot.id, guestId: blair.id }, [403]);
  assert(uncert.data.error === 'certified_venue_required', 'first meets only at certified venues');

  const booking = (await api('POST', '/v1/bookings', alex.token, { slotId: slot.id, guestId: blair.id, sharePlan: true })).data;
  assert(booking.state === 'invited' && booking.venue.name === 'Pin Palace', 'booking invites the guest');
  await waitFor(eventOf(blair, 'booking_invite', (p) => p.id === booking.id), 'booking_invite push');
  await api('PUT', '/v1/me/emergency-contacts', blair.token, { contacts: [{ name: 'Sam', phone: '+12145550199' }] });
  const confirmed = (await api('POST', `/v1/bookings/${booking.id}/accept`, blair.token, { sharePlan: true })).data;
  assert(confirmed.state === 'confirmed', 'guest accepted');
  const slots = (await api('GET', `/v1/venues/${certified.id}/slots`, alex.token)).data;
  assert(slots.find((s) => s.id === slot.id).available === 1, 'one table left');

  // QR check-in: only staff can scan; tokens are signed, single-purpose, and short-lived.
  const qrA = (await api('GET', `/v1/bookings/${booking.id}/checkin-token`, alex.token)).data;
  const qrB = (await api('GET', `/v1/bookings/${booking.id}/checkin-token`, blair.token)).data;
  await api('POST', `/v1/venues/${certified.id}/checkins`, casey.token, { token: qrA.token }, [403]);
  const forged = await api('POST', `/v1/venues/${certified.id}/checkins`, dana.token, { token: alex.token }, [400]);
  assert(forged.data.error === 'invalid_or_expired_code', 'an access token is not a check-in code');
  const wrongVenue = await api('POST', `/v1/venues/${corner.id}/checkins`, dana.token, { token: qrA.token }, [400]);
  assert(wrongVenue.data.error === 'wrong_venue', 'codes only work at the booked venue');
  const early = await api('POST', `/v1/venues/${certified.id}/bookings/${booking.id}/result`, dana.token, { winnerUserId: blair.id, scores: [150, 182] }, [409]);
  assert(early.data.error === 'both_players_must_check_in', 'no result before both check in');
  const one = (await api('POST', `/v1/venues/${certified.id}/checkins`, dana.token, { token: qrA.token })).data;
  assert(one.hostCheckedIn && !one.guestCheckedIn && one.checkedIn.displayName === 'Alex', 'host checked in');
  const both = (await api('POST', `/v1/venues/${certified.id}/checkins`, dana.token, { token: qrB.token })).data;
  assert(both.state === 'checked_in', 'both checked in');

  // Attested result: strongest verification, posts to the feed.
  const noScores = await api('POST', `/v1/venues/${certified.id}/bookings/${booking.id}/result`, dana.token, { winnerUserId: blair.id }, [400]);
  assert(noScores.data.error === 'scores_required', 'bowling needs scores');
  const res = (await api('POST', `/v1/venues/${certified.id}/bookings/${booking.id}/result`, dana.token, { winnerUserId: blair.id, scores: [150, 182] })).data;
  const blairEv = res.events[1];
  assert(blairEv.outcome === 'win' && blairEv.rated && blairEv.reason === 'venue_attested' && blairEv.ratingDelta > 0, `attested ${JSON.stringify(blairEv)}`);
  const again = await api('POST', `/v1/venues/${certified.id}/bookings/${booking.id}/result`, dana.token, { winnerUserId: alex.id, scores: [200, 100] }, [409]);
  assert(again.data.error === 'already_recorded', 'a result is attested once');
  const feed = (await api('GET', '/v1/feed', alex.token)).data;
  const card = feed.posts.find((p) => p.sessionId === res.sessionId);
  assert(card && card.gameName === 'Bowling' && card.scores.join() === '150,182', 'venue result card');
  const lb = (await api('GET', '/v1/leaderboards/bowling', alex.token)).data;
  assert(lb[0].userId === blair.id, 'venue leaderboard');

  // Shield and private feedback.
  const out = (await api('POST', `/v1/bookings/${booking.id}/safety`, blair.token, { kind: 'get_me_out' })).data;
  assert(out.actions.includes('venue_staff_notified'), 'staff told discreetly');
  const alert = (await api('POST', `/v1/bookings/${booking.id}/safety`, blair.token, { kind: 'alert_contacts' })).data;
  assert(alert.actions.includes('contacts_alerted:1'), 'emergency contact alerted');
  await api('POST', `/v1/bookings/${booking.id}/safety`, casey.token, { kind: 'ok' }, [404]);
  await api('POST', `/v1/bookings/${booking.id}/feedback`, alex.token, { feltSafe: true });

  // A second meet, booked and confirmed, to show that a block cancels it.
  const slot2 = (await api('POST', `/v1/venues/${certified.id}/slots`, dana.token, { gameId: 'pool-8-ball', startsAt: soon(7200), endsAt: soon(9000), capacity: 1 })).data;
  pendingMeet = (await api('POST', '/v1/bookings', alex.token, { slotId: slot2.id, guestId: blair.id })).data;
  await api('POST', `/v1/bookings/${pendingMeet.id}/accept`, blair.token, {});

  // The sweeper sends the "Are you OK?" prompt when the slot starts.
  await waitFor(eventOf(alex, 'safety_check', (p) => p.bookingId === booking.id && p.phase === 'start'), 'start-of-meet prompt', 40_000);
});

await step('outsiders cannot open someone else’s game socket; internal APIs need the service token', async () => {
  const outsider = { phone: `+1214${runId}04` };
  outsider.token = (await (async () => {
    await api('POST', '/v1/auth/otp/start', null, { phone: outsider.phone });
    return (await api('POST', '/v1/auth/otp/verify', null, { phone: outsider.phone, code: OTP })).data.token;
  })());
  const rejected = await gameConnect(outsider, session1.id).then(() => false, () => true);
  assert(rejected, 'non-player rejected from game socket');
  // Locally the service answers 401; behind the ALB the path is not routed at all (404).
  const internal = await api('POST', '/internal/results', null, {}, [401, 404]);
  assert(internal.status === 404 || internal.data.error === 'internal_only', 'internal endpoint protected');
});

await step('in-app report reaches the safety queue with a response clock', async () => {
  const r = (await api('POST', '/v1/reports', alex.token, { subjectType: 'user', subjectId: blair.id, category: 'harassment', details: 'e2e' })).data;
  assert(r.severity === 'medium' && r.resolveDue, 'report triaged with SLA');
});

await step('TAKE IT DOWN request works without an account and sets a 48 h deadline', async () => {
  const res = await fetch(`${SAFETY}/v1/takedown`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      contentUrl: 'https://beef.app/m/abc', requesterName: 'Jordan Doe', requesterEmail: 'jordan@example.com',
      isDepictedPerson: true, statement: 'This intimate image of me was shared without my consent.', signature: 'Jordan Doe',
    }),
  });
  const t = await res.json();
  assert(res.status === 201 && t.ticket.startsWith('TD-'), 'ticket issued');
  const hours = (Date.parse(t.removeBy) - Date.now()) / 36e5;
  assert(hours > 47.9 && hours <= 48, 'deadline is 48 h');
  const status = await (await fetch(`${SAFETY}/v1/takedown/${t.ticket}`)).json();
  assert(status.status === 'received', 'status lookup by ticket');
});

await step('evidence persisted: move log in DynamoDB, chat history on rejoin', async () => {
  if (!REMOTE) await checkMoveLog();
  const { resp } = await join(blair.socket.channel(`thread:${blair.threadId}`));
  assert(resp.messages.length === 2 && resp.messages[0].body.includes('cooked'), 'history excludes the blocked message');
});

async function checkMoveLog() {
  const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: 'us-east-2', endpoint: DDB, credentials: { accessKeyId: 'local', secretAccessKey: 'local' } }));
  const get = (id) => waitFor(async () => (await ddb.send(new GetCommand({ TableName: MOVE_LOG_TABLE, Key: { session_id: id } }))).Item, 'move log');
  const item = await get(session1.id);
  assert(item.log.filter((e) => e.kind === 'move').length === 7 && item.game_id === 'four-up' && typeof item.seed === 'number', 'replayable log');
  // Replaying each stored log with the shared rules reproduces the recorded result exactly,
  // timers included (the trivia round the sweeper closed is a log entry like any move).
  for (const id of [session1.id, silverSessions.chess.id, silverSessions.trivia.id, silverSessions.tq.id]) {
    const it = await get(id);
    const rules = getRules(it.game_id);
    const m = replayMatch(rules, Number(it.seed), it.players.length, Number(it.started_at), it.log, it.options ?? undefined);
    const state = m.state;
    const done = rules.outcome(state).done || m.ending !== null;
    assert(done, `${it.game_id} replays to the end`);
    const winner = m.ending ? m.ending.winner : rules.outcome(state).winner;
    assert(winner === (it.winner_seat ?? null), `${it.game_id} replay winner ${winner} vs recorded ${it.winner_seat}`);
  }
}

await step('blocks: hidden from the feed, no challenges, chat closed, never paired in the queue', async () => {
  await api('PUT', `/v1/blocks/${alex.id}`, blair.token);
  const feed = (await api('GET', '/v1/feed', alex.token)).data;
  assert(!feed.posts.some((p) => p.players.some((x) => x.userId === blair.id)), 'no shared posts in the blocked person’s feed');
  const caseyFeed = (await api('GET', '/v1/feed', casey.token)).data;
  assert(caseyFeed.posts.some((p) => p.players.some((x) => x.userId === blair.id)), 'third parties are unaffected');
  const ch = await api('POST', '/v1/challenges', alex.token, { toUserId: blair.id, gameId: 'four-up' }, [403]);
  assert(ch.data.error === 'not_matched', 'challenge refused without revealing the block');
  await api('PUT', `/v1/follows/${blair.id}`, alex.token, null, [404]);
  assert(!(await api('GET', '/v1/threads', alex.token)).data.some((t) => t.id === alex.threadId), 'thread hidden');
  // Chat membership is cached for up to 60 s; a fresh socket on another node would refuse at once.
  if (pendingMeet) {
    const meets = (await api('GET', '/v1/bookings', alex.token)).data;
    assert(meets.find((b) => b.id === pendingMeet.id).state === 'cancelled', 'a block cancels upcoming meets');
  }
  const pending = (await api('GET', '/v1/challenges', alex.token)).data;
  assert(!pending.some((c) => c.toUserId === blair.id || c.fromUserId === blair.id), 'open challenges cancelled');

  const before = alex.events.filter((e) => e.ev === 'match_found').length;
  await api('POST', '/v1/queue', alex.token, { gameId: 'four-up' });
  await api('POST', '/v1/queue', blair.token, { gameId: 'four-up' });
  await sleep(4000);
  assert(alex.events.filter((e) => e.ev === 'match_found').length === before, 'blocked players never paired');
  await api('DELETE', '/v1/queue/four-up', alex.token);
  await api('DELETE', '/v1/queue/four-up', blair.token);
});

alex.socket.disconnect();
blair.socket.disconnect();
console.log(`\nBronze + Silver e2e passed: ${passed} steps`);
process.exit(0);
