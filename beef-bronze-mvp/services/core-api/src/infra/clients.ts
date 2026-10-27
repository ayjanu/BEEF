import { Logger } from '@nestjs/common';
import type { RealtimeEventName, SessionOpen } from '@beef/contracts';
import type { Config } from '../config.ts';

/**
 * Thin HTTP clients for the other Bronze services. Every call carries the
 * internal token and a timeout; nothing here retries silently.
 */
export class ServiceClients {
  private readonly log = new Logger('ServiceClients');

  constructor(private readonly cfg: Config) {}

  private async call(base: string, path: string, init: RequestInit & { timeoutMs?: number } = {}) {
    const res = await fetch(new URL(path, base), {
      ...init,
      headers: {
        'content-type': 'application/json',
        'x-internal-token': this.cfg.INTERNAL_TOKEN,
        ...(init.headers ?? {}),
      },
      signal: AbortSignal.timeout(init.timeoutMs ?? 3000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`${init.method ?? 'GET'} ${base}${path} -> ${res.status} ${body.slice(0, 200)}`);
    }
    return res.status === 204 ? null : res.json();
  }

  openGameSession(body: SessionOpen) {
    return this.call(this.cfg.GAME_ENGINE_URL, '/internal/sessions', { method: 'POST', body: JSON.stringify(body) });
  }

  enqueue(ticket: { userId: string; gameId: string; rating: number; rd: number; region: string }) {
    return this.call(this.cfg.MATCHMAKING_URL, '/v1/tickets', { method: 'POST', body: JSON.stringify(ticket) });
  }

  dequeue(userId: string, gameId: string) {
    const q = new URLSearchParams({ gameId });
    return this.call(this.cfg.MATCHMAKING_URL, `/v1/tickets/${userId}?${q}`, { method: 'DELETE' });
  }

  /** Text moderation verdict. Throws when the safety service is unreachable: callers decide to fail closed. */
  async classifyText(text: string, context: 'bio' | 'comment' | 'chat'): Promise<{ action: 'allow' | 'blur' | 'block'; labels: string[] }> {
    return (await this.call(this.cfg.SAFETY_URL, '/v1/classify/text', {
      method: 'POST',
      body: JSON.stringify({ text, context }),
      timeoutMs: 1500,
    })) as { action: 'allow' | 'blur' | 'block'; labels: string[] };
  }

  createReport(body: Record<string, unknown>) {
    return this.call(this.cfg.SAFETY_URL, '/v1/reports', { method: 'POST', body: JSON.stringify(body) });
  }

  /** Push an event to users' realtime channels. Best effort: a missed push falls back to polling. */
  async notify(userIds: string[], event: RealtimeEventName, payload: unknown): Promise<void> {
    try {
      await this.call(this.cfg.CHAT_URL, '/internal/notify', {
        method: 'POST',
        body: JSON.stringify({ userIds, event, payload }),
      });
    } catch (err) {
      this.log.warn(`notify ${event} failed: ${(err as Error).message}`);
    }
  }
}

export const CLIENTS = Symbol('CLIENTS');
