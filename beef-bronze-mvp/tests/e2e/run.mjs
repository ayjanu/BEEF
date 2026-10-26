#!/usr/bin/env node
/**
 * BEEF Bronze end-to-end test (Spec 07 exit test).
 *
 * Drives the full loop through public interfaces only, exactly as the app does:
 * sign-up → adults-only gate → profile → verification tier gate → swipe →
 * mutual match → chat with safety screening → challenge → play Four Up on the
 * game engine → result → XP/BP/rating → skill queue via the Go matchmaker →
 * resign → diminishing returns → leaderboard → report → TAKE IT DOWN intake →
 * move log and chat history persisted in DynamoDB.
 *
 * Point it at any environment with CORE_URL, GAME_WS_URL, CHAT_WS_URL, SAFETY_URL.
 */
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { Socket } from 'phoenix';

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
  for (const ev of ['mutual_match', 'challenge_received', 'match_found', 'game_result']) {
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

console.log(`BEEF Bronze e2e against ${CORE}`);

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

await step('resign hands the win to the opponent; repeat game pays half BP (diminishing returns)', async () => {
  const [ga, gb] = await Promise.all([gameConnect(alex, session2.id), gameConnect(blair, session2.id)]);
  ga.ws.send(JSON.stringify({ type: 'resign' }));
  const end = await waitFor(() => gb.msgs.find((m) => m.type === 'end'), 'end after resign');
  assert(end.winnerSeat === gb.seat, 'Blair wins by resignation');
  const b = await waitFor(eventOf(blair, 'game_result', (p) => p.sessionId === session2.id), 'Blair result');
  assert(b.outcome === 'win' && b.bp === 5, `2nd game vs same opponent pays 10 × 0.5 = 5 BP, got ${b.bp}`);
  [ga, gb].forEach((g) => g.ws.close());
});

await step('leaderboard ranks both players from Redis', async () => {
  const lb = (await api('GET', '/v1/leaderboards/four-up', alex.token)).data;
  const ids = lb.map((e) => e.userId);
  assert(ids.includes(alex.id) && ids.includes(blair.id), 'both on leaderboard');
  assert(lb.every((e, i) => i === 0 || lb[i - 1].rating >= e.rating), 'sorted by rating');
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
  const item = await waitFor(async () => (await ddb.send(new GetCommand({ TableName: MOVE_LOG_TABLE, Key: { session_id: session1.id } }))).Item, 'move log');
  assert(item.moves.length === 7 && item.game_id === 'four-up' && typeof item.seed === 'number', 'replayable log');
}

alex.socket.disconnect();
blair.socket.disconnect();
console.log(`\nBronze e2e passed: ${passed} steps`);
process.exit(0);
