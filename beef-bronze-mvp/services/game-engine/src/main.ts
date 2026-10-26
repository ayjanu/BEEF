import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { SessionOpen, type ResultReport } from '@beef/contracts';
import { importSPKI, jwtVerify } from 'jose';
import { Redis } from 'ioredis';
import { WebSocketServer, type WebSocket } from 'ws';
import { loadConfig } from './config.ts';
import { Engine, type EndedGame, type StoredSession } from './engine.ts';
import { RedisStore } from './redis-store.ts';

const cfg = loadConfig();
const redis = new Redis(cfg.REDIS_URL, { maxRetriesPerRequest: 3 });
const sub = redis.duplicate();
const store = new RedisStore(redis);
const engine = new Engine(store);
const publicKey = await importSPKI(cfg.JWT_PUBLIC_KEY, 'ES256');
const dynamo = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: cfg.AWS_REGION, ...(cfg.DYNAMODB_ENDPOINT ? { endpoint: cfg.DYNAMODB_ENDPOINT } : {}) }),
);

const log = (msg: string, extra: Record<string, unknown> = {}) =>
  console.log(JSON.stringify({ t: new Date().toISOString(), svc: 'game-engine', msg, ...extra }));

// ---------- fan-out: every replica forwards session events to its own sockets ----------

const sockets = new Map<string, Set<WebSocket>>();
const channel = (id: string) => `ge:evt:${id}`;

await sub.psubscribe('ge:evt:*');
sub.on('pmessage', (_pattern, ch, message) => {
  const id = ch.slice('ge:evt:'.length);
  for (const ws of sockets.get(id) ?? []) if (ws.readyState === ws.OPEN) ws.send(message);
});

const publicView = (s: StoredSession) => ({
  sessionId: s.sessionId,
  gameId: s.gameId,
  players: s.players,
  status: s.status,
  state: s.state,
  moves: s.log.length,
});

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
          moves: s.log,
          resigned_seat: s.resignedSeat,
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
    moveCount: s.log.length,
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
      return json(res, 201, publicView(s));
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
  const set = sockets.get(sessionId) ?? new Set();
  set.add(ws);
  sockets.set(sessionId, set);
  ws.send(JSON.stringify({ type: 'hello', seat: engine.seatOf(s, userId), session: publicView(s) }));

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
    const result =
      msg.type === 'move'
        ? await engine.move(sessionId, userId, msg.move)
        : msg.type === 'resign'
          ? await engine.resign(sessionId, userId)
          : ({ ok: false, error: 'unknown_type' } as const);
    if (!result.ok) return ws.send(JSON.stringify({ type: 'error', error: result.error }));
    await redis.publish(channel(sessionId), JSON.stringify({ type: 'state', session: publicView(result.session) }));
    if (result.ended) {
      const e = result.ended;
      await redis.publish(
        channel(sessionId),
        JSON.stringify({ type: 'end', winnerSeat: e.winnerSeat, draw: e.draw, resignedSeat: e.session.resignedSeat }),
      );
      void finish(e);
    }
  });

  ws.on('close', () => {
    clearInterval(ping);
    set.delete(ws);
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
