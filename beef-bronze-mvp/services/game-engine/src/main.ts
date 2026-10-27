import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { SessionOpen, type ResultReport } from '@beef/contracts';
import { importSPKI, jwtVerify } from 'jose';
import { Redis } from 'ioredis';
import { WebSocketServer, type WebSocket } from 'ws';
import { loadConfig } from './config.ts';
import { contentFor } from '@beef/game-rules/content';
import { Engine, type ActResult, type EndedGame, type ScreenVerdict, type StoredSession } from './engine.ts';
import { RedisStore } from './redis-store.ts';

const cfg = loadConfig();
const redis = new Redis(cfg.REDIS_URL, { maxRetriesPerRequest: 3 });
const sub = redis.duplicate();
const store = new RedisStore(redis);
const log = (msg: string, extra: Record<string, unknown> = {}) =>
  console.log(JSON.stringify({ t: new Date().toISOString(), svc: 'game-engine', msg, ...extra }));

async function screen(texts: string[], context: string): Promise<ScreenVerdict> {
  try {
    const verdicts = await Promise.all(
      texts.map(async (text) => {
        const res = await fetch(new URL('/v1/classify/text', cfg.SAFETY_URL), {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-internal-token': cfg.INTERNAL_TOKEN },
          body: JSON.stringify({ text, context }),
          signal: AbortSignal.timeout(1500),
        });
        if (!res.ok) throw new Error(`safety ${res.status}`);
        return ((await res.json()) as { action: string }).action;
      }),
    );
    return verdicts.includes('block') ? 'block' : 'allow';
  } catch (err) {
    log('safety check unavailable', { error: (err as Error).message });
    return 'unavailable';
  }
}

const engine = new Engine(store, { content: contentFor, screen });
const publicKey = await importSPKI(cfg.JWT_PUBLIC_KEY, 'ES256');
const dynamo = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: cfg.AWS_REGION, ...(cfg.DYNAMODB_ENDPOINT ? { endpoint: cfg.DYNAMODB_ENDPOINT } : {}) }),
);

// ---------- fan-out: every replica forwards session events to its own sockets ----------

/** Each socket remembers whose eyes it is, so every player gets their own view of hidden information. */
interface Conn {
  ws: WebSocket;
  seat: number;
}
const sockets = new Map<string, Set<Conn>>();
const channel = (id: string) => `ge:evt:${id}`;

/**
 * Replicas exchange the full session over Redis (internal network only) and
 * each one renders a per-seat view for its own sockets. Secrets never leave
 * the cluster before the game ends.
 */
await sub.psubscribe('ge:evt:*');
sub.on('pmessage', (_pattern, ch, message) => {
  const id = ch.slice('ge:evt:'.length);
  const conns = sockets.get(id);
  if (!conns?.size) return;
  const evt = JSON.parse(message) as { session: StoredSession; ended: Omit<EndedGame, 'session'> | null };
  for (const c of conns) {
    if (c.ws.readyState !== c.ws.OPEN) continue;
    c.ws.send(JSON.stringify({ type: 'state', session: engine.view(evt.session, c.seat) }));
    if (evt.ended) c.ws.send(JSON.stringify({ type: 'end', ...evt.ended }));
  }
});

async function broadcast(result: ActResult) {
  if (!result.ok) return;
  const { session, ended } = result;
  const endInfo = ended
    ? { winnerSeat: ended.winnerSeat, draw: ended.draw, reason: ended.reason, scores: ended.scores }
    : null;
  await redis.publish(channel(session.sessionId), JSON.stringify({ session, ended: endInfo }));
  if (ended) void finish(ended);
}

// ---------- timers: every replica sweeps; compare-and-set makes double firing harmless ----------

let sweeping = false;
setInterval(async () => {
  if (sweeping) return;
  sweeping = true;
  try {
    for (const id of await store.due(Date.now(), 100)) await broadcast(await engine.tick(id));
  } catch (err) {
    log('timer sweep failed', { error: (err as Error).message });
  } finally {
    sweeping = false;
  }
}, cfg.TIMER_SWEEP_MS).unref();

async function finish(ended: EndedGame) {
  const s = ended.session;
  // 1. Move log to DynamoDB: the replayable evidence for disputes (Spec 02).
  try {
    await dynamo.send(
      new PutCommand({
        TableName: cfg.MOVE_LOG_TABLE,
        Item: {
          session_id: s.sessionId,
          game_id: s.gameId,
          rules_version: s.rulesVersion,
          seed: s.seed,
          players: s.players,
          started_at: s.startedAt,
          // Content (question decks) is part of the evidence: replays must not depend on today's bank.
          options: s.options ?? null,
          log: s.log,
          winner_seat: ended.winnerSeat,
          draw: ended.draw,
          reason: ended.reason,
          finished_at: new Date().toISOString(),
        },
      }),
    );
  } catch (err) {
    log('move log write failed', { sessionId: s.sessionId, error: (err as Error).message });
  }
  // 2. Result to core-api, which owns ratings, XP, BP and leaderboards. Retried with backoff.
  const report: ResultReport = {
    sessionId: s.sessionId,
    gameId: s.gameId,
    players: s.players,
    winnerSeat: ended.winnerSeat,
    draw: ended.draw,
    reason: ended.reason,
    seatMoves: ended.seatMoves,
    scores: ended.scores,
    moveCount: s.log.filter((e) => e.kind === 'move').length,
    rulesVersion: s.rulesVersion,
  };
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const res = await fetch(new URL('/internal/results', cfg.CORE_API_URL), {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-internal-token': cfg.INTERNAL_TOKEN },
        body: JSON.stringify(report),
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        log('result reported', { sessionId: s.sessionId });
        return;
      }
      log('result rejected', { status: res.status, body: (await res.text()).slice(0, 200) });
      if (res.status >= 400 && res.status < 500) return;
    } catch (err) {
      log('result report failed', { attempt, error: (err as Error).message });
    }
    await new Promise((r) => setTimeout(r, 250 * 2 ** attempt));
  }
}

// ---------- internal HTTP ----------

function internalAuthorized(req: IncomingMessage): boolean {
  const got = Buffer.from(String(req.headers['x-internal-token'] ?? ''));
  const want = Buffer.from(cfg.INTERNAL_TOKEN);
  return got.length === want.length && timingSafeEqual(got, want);
}

function json(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > 64 * 1024) throw new Error('body_too_large');
    chunks.push(chunk as Buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

const server = createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && req.url === '/healthz') return json(res, 200, { ok: true });
    if (req.method === 'GET' && req.url === '/readyz') {
      await redis.ping();
      return json(res, 200, { ok: true });
    }
    if (req.method === 'POST' && req.url === '/internal/sessions') {
      if (!internalAuthorized(req)) return json(res, 401, { error: 'internal_only' });
      const parsed = SessionOpen.safeParse(await readBody(req));
      if (!parsed.success) return json(res, 400, { error: 'validation_failed' });
      const s = await engine.open(parsed.data);
      log('session opened', { sessionId: s.sessionId, gameId: s.gameId });
      return json(res, 201, engine.view(s, null));
    }
    json(res, 404, { error: 'not_found' });
  } catch (err) {
    json(res, 500, { error: (err as Error).message });
  }
});

// ---------- player WebSockets: /session/<id>?token=<jwt> ----------

const wss = new WebSocketServer({ noServer: true, maxPayload: 8 * 1024 });

server.on('upgrade', async (req, socket, head) => {
  try {
    const url = new URL(req.url ?? '', 'http://x');
    const m = /^\/session\/([0-9a-f-]{36})$/.exec(url.pathname);
    const token = url.searchParams.get('token') ?? '';
    if (!m || !token) throw new Error('bad_request');
    const { payload } = await jwtVerify(token, publicKey, { issuer: 'beef-core', audience: 'beef', algorithms: ['ES256'] });
    const sessionId = m[1]!;
    const s = await store.get(sessionId);
    if (!s || engine.seatOf(s, String(payload.sub)) < 0) throw new Error('not_a_player');
    wss.handleUpgrade(req, socket, head, (ws) => onConnect(ws, sessionId, String(payload.sub), s));
  } catch {
    socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');
    socket.destroy();
  }
});

function onConnect(ws: WebSocket, sessionId: string, userId: string, s: StoredSession) {
  const conn: Conn = { ws, seat: engine.seatOf(s, userId) };
  const set = sockets.get(sessionId) ?? new Set();
  set.add(conn);
  sockets.set(sessionId, set);
  ws.send(JSON.stringify({ type: 'hello', seat: conn.seat, session: engine.view(s, conn.seat) }));

  let alive = true;
  ws.on('pong', () => (alive = true));
  const ping = setInterval(() => {
    if (!alive) return ws.terminate();
    alive = false;
    ws.ping();
  }, 25_000);

  ws.on('message', async (data) => {
    let msg: { type?: string; move?: unknown };
    try {
      msg = JSON.parse(String(data));
    } catch {
      return ws.send(JSON.stringify({ type: 'error', error: 'bad_json' }));
    }
    const result: ActResult =
      msg.type === 'move'
        ? await engine.move(sessionId, userId, msg.move)
        : msg.type === 'resign'
          ? await engine.resign(sessionId, userId)
          : { ok: false, error: 'unknown_type' };
    if (!result.ok) return ws.send(JSON.stringify({ type: 'error', error: result.error }));
    await broadcast(result);
  });

  ws.on('close', () => {
    clearInterval(ping);
    set.delete(conn);
    if (set.size === 0) sockets.delete(sessionId);
  });
}

server.listen(cfg.PORT, '0.0.0.0', () => log(`listening on :${cfg.PORT}`));

const shutdown = () => {
  for (const ws of wss.clients) ws.close(1012, 'restarting');
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 5000).unref();
};
process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);
