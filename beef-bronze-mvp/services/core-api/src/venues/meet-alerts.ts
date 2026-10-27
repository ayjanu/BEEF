import { Inject, Injectable, Logger } from '@nestjs/common';
import { DB, type Db } from '../infra/db.ts';
import { CLIENTS, type ServiceClients } from '../infra/clients.ts';

/** Sends a player's meet plan (who, where, when) to their emergency contacts. */
@Injectable()
export class MeetAlerts {
  private readonly log = new Logger('MeetAlerts');

  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(CLIENTS) private readonly clients: ServiceClients,
  ) {}

  /** Returns how many contacts were reached. `b` is a booking row joined with its slot and venue. */
  async alertContacts(userId: string, b: { name: string; address: string; starts_at: Date }): Promise<number> {
    const contacts = (await this.db.query('SELECT name, phone FROM emergency_contacts WHERE user_id = $1 ORDER BY position', [userId])).rows;
    const who = (await this.db.query('SELECT display_name FROM profiles WHERE user_id = $1', [userId])).rows[0]?.display_name ?? 'Your contact';
    const when = b.starts_at.toISOString().slice(11, 16);
    let sent = 0;
    for (const c of contacts) {
      try {
        await this.clients.sendSms(
          c.phone,
          `BEEF safety alert about ${who}. Meet plan: ${b.name}, ${b.address}, ${when} UTC. Please try to reach them.`,
        );
        sent++;
      } catch (err) {
        this.log.error(`safety SMS failed: ${(err as Error).message}`);
      }
    }
    return sent;
  }
}
