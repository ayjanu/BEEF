import { Inject, Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { RealtimeEvent } from '@beef/contracts';
import type { Redis } from 'ioredis';
import { DB, type Db } from '../infra/db.ts';
import { REDIS } from '../infra/redis.ts';
import { CLIENTS, type ServiceClients } from '../infra/clients.ts';
import { CONFIG, type Config } from '../config.ts';
import { MeetAlerts } from './meet-alerts.ts';
import { ESCALATION_WINDOW_MS, nextEscalation } from './meet-safety.ts';

/**
 * Level 4 timers (Spec 04, "During the meet"): "Are you OK?" prompts at the
 * start and planned end, no-show marking, and the two-stage escalation when a
 * checked-in player does not answer after the meet. Runs on every core-api
 * replica; a Redis lock keeps one sweep at a time, and every step is guarded
 * in SQL so a repeat is harmless.
 */
@Injectable()
export class SafetySweep implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly log = new Logger('SafetySweep');
  private timer?: NodeJS.Timeout;

  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(REDIS) private readonly redis: Redis,
    @Inject(CLIENTS) private readonly clients: ServiceClients,
    @Inject(CONFIG) private readonly cfg: Config,
    private readonly alerts: MeetAlerts,
  ) {}

  onApplicationBootstrap() {
    this.timer = setInterval(() => void this.run(), this.cfg.SAFETY_SWEEP_MS);
    this.timer.unref();
  }

  onApplicationShutdown() {
    clearInterval(this.timer);
  }

  async run(now = Date.now()): Promise<void> {
    const lock = await this.redis.set('lock:safety-sweep', '1', 'PX', Math.max(this.cfg.SAFETY_SWEEP_MS, 5_000), 'NX');
    if (lock !== 'OK') return;
    try {
      await this.prompts();
      await this.noShows();
      await this.escalations(now);
    } catch (err) {
      this.log.error(`safety sweep failed: ${(err as Error).message}`);
    } finally {
      await this.redis.del('lock:safety-sweep');
    }
  }

  private async prompts() {
    for (const phase of ['start', 'end'] as const) {
      const col = phase === 'start' ? 'start_prompted_at' : 'end_prompted_at';
      const at = phase === 'start' ? 's.starts_at' : 's.ends_at';
      const due = (
        await this.db.query(
          `UPDATE bookings b SET ${col} = now()
           FROM venue_slots s
           WHERE s.id = b.slot_id AND b.${col} IS NULL AND ${at} <= now() AND ${at} > now() - interval '1 hour'
             AND b.state IN ('confirmed', 'checked_in', 'completed')
           RETURNING b.id, b.host_id, b.guest_id`,
        )
      ).rows;
      for (const b of due) {
        await this.clients.notify([b.host_id, b.guest_id], RealtimeEvent.safetyCheck, { bookingId: b.id, phase });
      }
    }
  }

  private async noShows() {
    await this.db.query(
      `UPDATE bookings b SET state = 'no_show'
       FROM venue_slots s
       WHERE s.id = b.slot_id AND b.state = 'confirmed' AND s.ends_at < now()`,
    );
    await this.db.query(
      `UPDATE bookings b SET state = 'cancelled'
       FROM venue_slots s
       WHERE s.id = b.slot_id AND b.state = 'invited' AND s.starts_at < now()`,
    );
  }

  private async escalations(now: number) {
    // Players who actually met (checked in) and whose meet ended recently.
    const rows = (
      await this.db.query(
        `SELECT b.*, s.starts_at, s.ends_at, v.name, v.address, p.user_id AS player,
                (SELECT coalesce(max(stage), 0) FROM meet_escalations e WHERE e.booking_id = b.id AND e.user_id = p.user_id) AS stage,
                EXISTS (SELECT 1 FROM safety_events se WHERE se.booking_id = b.id AND se.user_id = p.user_id
                        AND se.kind IN ('ok', 'get_me_out', 'alert_contacts', 'emergency') AND se.created_at >= s.ends_at) AS answered
         FROM bookings b
         JOIN venue_slots s ON s.id = b.slot_id
         JOIN venues v ON v.id = s.venue_id
         CROSS JOIN LATERAL (VALUES (b.host_id), (b.guest_id)) AS p(user_id)
         WHERE b.state IN ('checked_in', 'completed')
           AND b.host_checked_in_at IS NOT NULL AND b.guest_checked_in_at IS NOT NULL
           AND s.ends_at < to_timestamp($1 / 1000.0)
           AND s.ends_at > to_timestamp($1 / 1000.0) - make_interval(secs => $2 / 1000.0)`,
        [now, ESCALATION_WINDOW_MS],
      )
    ).rows;
    for (const r of rows) {
      const step = nextEscalation({ endsAt: r.ends_at.getTime(), answeredAfterEnd: r.answered, stage: r.stage }, now);
      if (step === 0) continue;
      const claimed = await this.db.query(
        `INSERT INTO meet_escalations (booking_id, user_id, stage) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
        [r.id, r.player, step],
      );
      if (claimed.rowCount === 0) continue;
      await this.db.query(`INSERT INTO safety_events (booking_id, user_id, kind, note) VALUES ($1, $2, 'no_response_escalation', $3)`, [
        r.id,
        r.player,
        `stage ${step}`,
      ]);
      if (step === 1) {
        // Push is the stage-1 channel: the player's own number is stored only as a keyed hash, so a
        // direct SMS to them needs the SMS provider's number-on-file feature (Gold).
        await this.clients.notify([r.player], RealtimeEvent.safetyCheck, { bookingId: r.id, phase: 'reminder' });
      } else {
        const shared = r.player === r.host_id ? r.host_share_plan : r.guest_share_plan;
        const reached = shared ? await this.alerts.alertContacts(r.player, r) : 0;
        await this.clients
          .createReport({
            reporterId: r.player,
            subjectType: 'booking',
            subjectId: r.id,
            category: 'in_person',
            details: `No answer to the end-of-meet check-in 30 min after ${r.name}. Contacts alerted: ${reached}.`,
          })
          .catch((err) => this.log.error(`escalation report failed: ${(err as Error).message}`));
        this.log.warn(`booking ${r.id}: stage 2 escalation for a player (contacts alerted: ${reached})`);
      }
    }
  }
}
