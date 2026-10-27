import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Inject,
  Logger,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { venueGames } from '@beef/game-rules';
import {
  BookingAcceptRequest,
  BookingCreateRequest,
  CheckinRequest,
  EmergencyContactsRequest,
  MeetFeedbackRequest,
  RealtimeEvent,
  SafetyEventRequest,
  SlotCreateRequest,
  StaffFlagRequest,
  VenueCreateRequest,
  VenueResultRequest,
  type Booking,
  type CheckinToken,
  type Tier,
  type Venue,
  type VenueSlot,
} from '@beef/contracts';
import { DB, withTx, type Db, type Tx } from '../infra/db.ts';
import { CLIENTS, type ServiceClients } from '../infra/clients.ts';
import { TOKENS, type TokenService } from '../auth/jwt.ts';
import { CurrentUser, InternalGuard, UserGuard, ZodPipe, requireTier, tierAtLeast, type AuthedUser } from '../common/http.ts';
import { pairKey } from '../match/match.controller.ts';
import { isBlockedBetween } from '../social/blocks.ts';
import { ResultsService } from '../games/results.service.ts';
import { UNSAFE_RATINGS_FOR_REVIEW, checkinOpen, needsCertifiedVenue } from './meet-safety.ts';
import { MeetAlerts } from './meet-alerts.ts';

/** Level 4 needs V3 for both players (Spec 04, "Before the meet"). */
const L4_TIER: Tier = 'V3';
const CHECKIN_TTL_S = 120;
const ACTIVE = `('invited', 'confirmed', 'checked_in')`;

export function toVenue(r: Record<string, any>): Venue {
  return {
    id: r.id,
    name: r.name,
    address: r.address,
    city: r.city,
    lat: r.lat,
    lng: r.lng,
    games: r.games,
    safeCertified: r.safe_certified,
  };
}

const BOOKING_SELECT = `
  SELECT b.*, s.venue_id, s.game_id, s.starts_at, s.ends_at, s.capacity,
         v.name, v.address, v.city, v.lat, v.lng, v.games, v.safe_certified, v.id AS v_id
  FROM bookings b
  JOIN venue_slots s ON s.id = b.slot_id
  JOIN venues v ON v.id = s.venue_id`;

function toBooking(r: Record<string, any>): Booking {
  return {
    id: r.id,
    state: r.state,
    venue: toVenue({ ...r, id: r.v_id }),
    slot: {
      id: r.slot_id,
      venueId: r.venue_id,
      gameId: r.game_id,
      startsAt: r.starts_at.toISOString(),
      endsAt: r.ends_at.toISOString(),
      capacity: r.capacity,
    },
    hostId: r.host_id,
    guestId: r.guest_id,
    hostCheckedIn: !!r.host_checked_in_at,
    guestCheckedIn: !!r.guest_checked_in_at,
    sessionId: r.session_id,
  };
}

async function loadBooking(db: Db | Tx, id: string, lock = false): Promise<Record<string, any>> {
  const r = (await db.query(`${BOOKING_SELECT} WHERE b.id = $1 ${lock ? 'FOR UPDATE OF b' : ''}`, [id])).rows[0];
  if (!r) throw new NotFoundException({ error: 'not_found' });
  return r;
}

const isPlayer = (b: Record<string, any>, userId: string) => b.host_id === userId || b.guest_id === userId;

/**
 * A meet goes ahead only while both players are active and neither has blocked
 * the other. Checked at every step (accept, QR, staff scan), not just at booking.
 */
async function assertMeetAllowed(db: Db | Tx, b: Record<string, any>): Promise<void> {
  const active = Number(
    (await db.query(`SELECT count(*) FROM users WHERE id = ANY($1) AND status = 'active'`, [[b.host_id, b.guest_id]])).rows[0].count,
  );
  if (active !== 2 || (await isBlockedBetween(db, b.host_id, b.guest_id))) {
    throw new ConflictException({ error: 'booking_not_open' });
  }
}

/** Player-facing Level 4: find venues and slots, book with a match, check in by QR, stay safe. */
@Controller('v1')
@UseGuards(UserGuard)
export class VenuesController {
  private readonly log = new Logger('VenuesController');

  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(CLIENTS) private readonly clients: ServiceClients,
    @Inject(TOKENS) private readonly tokens: TokenService,
    private readonly alerts: MeetAlerts,
  ) {}

  @Get('venue-games')
  venueGames() {
    return Object.values(venueGames);
  }

  @Get('venues')
  async venues(@Query('game') game?: string): Promise<Venue[]> {
    const rows = (
      await this.db.query(
        `SELECT * FROM venues WHERE status = 'active' AND ($1::text IS NULL OR $1 = ANY(games))
         ORDER BY safe_certified DESC, name LIMIT 100`,
        [game ?? null],
      )
    ).rows;
    return rows.map(toVenue);
  }

  @Get('venues/:id/slots')
  async slots(@Param('id', ParseUUIDPipe) id: string): Promise<VenueSlot[]> {
    const rows = (
      await this.db.query(
        `SELECT s.*, s.capacity - (SELECT count(*) FROM bookings b WHERE b.slot_id = s.id AND b.state IN ${ACTIVE})::int AS available
         FROM venue_slots s JOIN venues v ON v.id = s.venue_id
         WHERE s.venue_id = $1 AND v.status = 'active' AND s.starts_at > now()
         ORDER BY s.starts_at LIMIT 100`,
        [id],
      )
    ).rows;
    return rows.map((r) => ({
      id: r.id,
      venueId: r.venue_id,
      gameId: r.game_id,
      startsAt: r.starts_at.toISOString(),
      endsAt: r.ends_at.toISOString(),
      capacity: r.capacity,
      available: r.available,
    }));
  }

  // ---------- bookings ----------

  @Post('bookings')
  @HttpCode(201)
  async book(
    @CurrentUser() user: AuthedUser,
    @Body(new ZodPipe(BookingCreateRequest)) body: BookingCreateRequest & { sharePlan: boolean },
  ): Promise<Booking> {
    requireTier(user, L4_TIER);
    if (body.guestId === user.id) throw new BadRequestException({ error: 'cannot_book_self' });
    const guest = (await this.db.query(`SELECT tier FROM users WHERE id = $1 AND status = 'active'`, [body.guestId])).rows[0];
    // Blocked or unmatched people look the same as "not matched" so a block is not revealed.
    const matched = await this.db.query('SELECT 1 FROM threads WHERE pair_key = $1', [pairKey(user.id, body.guestId)]);
    if (!guest || matched.rowCount === 0 || (await isBlockedBetween(this.db, user.id, body.guestId))) {
      throw new ForbiddenException({ error: 'not_matched' });
    }
    if (!tierAtLeast(guest.tier, L4_TIER)) throw new ForbiddenException({ error: 'opponent_not_verified', need: L4_TIER });

    const id = await withTx(this.db, async (tx) => {
      // Lock the slot so two bookings cannot take the last table.
      const slot = (
        await tx.query(
          `SELECT s.*, v.safe_certified, v.status FROM venue_slots s JOIN venues v ON v.id = s.venue_id
           WHERE s.id = $1 FOR UPDATE OF s`,
          [body.slotId],
        )
      ).rows[0];
      if (!slot || slot.status !== 'active') throw new NotFoundException({ error: 'not_found' });
      if (slot.starts_at.getTime() <= Date.now()) throw new ConflictException({ error: 'slot_started' });
      const taken = Number(
        (await tx.query(`SELECT count(*) FROM bookings WHERE slot_id = $1 AND state IN ${ACTIVE}`, [slot.id])).rows[0].count,
      );
      if (taken >= slot.capacity) throw new ConflictException({ error: 'slot_full' });

      const meets = Number(
        (
          await tx.query(
            `SELECT count(*) FROM bookings
             WHERE state = 'completed' AND ((host_id = $1 AND guest_id = $2) OR (host_id = $2 AND guest_id = $1))`,
            [user.id, body.guestId],
          )
        ).rows[0].count,
      );
      if (needsCertifiedVenue(meets) && !slot.safe_certified) {
        throw new ForbiddenException({ error: 'certified_venue_required' });
      }
      const overlap = await tx.query(
        `SELECT 1 FROM bookings b JOIN venue_slots s ON s.id = b.slot_id
         WHERE b.state IN ${ACTIVE} AND (b.host_id = ANY($1) OR b.guest_id = ANY($1))
           AND s.starts_at < $3 AND s.ends_at > $2 LIMIT 1`,
        [[user.id, body.guestId], slot.starts_at, slot.ends_at],
      );
      if ((overlap.rowCount ?? 0) > 0) throw new ConflictException({ error: 'already_booked_then' });

      return (
        await tx.query(
          `INSERT INTO bookings (slot_id, host_id, guest_id, host_share_plan) VALUES ($1, $2, $3, $4) RETURNING id`,
          [slot.id, user.id, body.guestId, body.sharePlan],
        )
      ).rows[0].id as string;
    });
    const booking = toBooking(await loadBooking(this.db, id));
    await this.clients.notify([body.guestId], RealtimeEvent.bookingInvite, booking);
    return booking;
  }

  @Post('bookings/:id/accept')
  @HttpCode(200)
  async accept(
    @CurrentUser() user: AuthedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(BookingAcceptRequest)) body: { sharePlan: boolean },
  ): Promise<Booking> {
    requireTier(user, L4_TIER);
    const pending = await loadBooking(this.db, id);
    if (pending.guest_id !== user.id) throw new NotFoundException({ error: 'not_found' });
    await assertMeetAllowed(this.db, pending);
    const r = await this.db.query(
      `UPDATE bookings b SET state = 'confirmed', guest_share_plan = $3
       FROM venue_slots s
       WHERE b.id = $1 AND b.guest_id = $2 AND b.state = 'invited' AND s.id = b.slot_id AND s.starts_at > now()`,
      [id, user.id, body.sharePlan],
    );
    if (r.rowCount === 0) throw new ConflictException({ error: 'booking_not_open' });
    const booking = toBooking(await loadBooking(this.db, id));
    await this.clients.notify([booking.hostId], RealtimeEvent.bookingUpdate, booking);
    return booking;
  }

  @Post('bookings/:id/cancel')
  @HttpCode(200)
  async cancel(@CurrentUser() user: AuthedUser, @Param('id', ParseUUIDPipe) id: string): Promise<Booking> {
    const r = await this.db.query(
      `UPDATE bookings b SET state = 'cancelled'
       FROM venue_slots s
       WHERE b.id = $1 AND $2 IN (b.host_id, b.guest_id) AND b.state IN ('invited', 'confirmed')
         AND s.id = b.slot_id AND s.starts_at > now()`,
      [id, user.id],
    );
    if (r.rowCount === 0) throw new ConflictException({ error: 'booking_not_cancellable' });
    const booking = toBooking(await loadBooking(this.db, id));
    await this.clients.notify([booking.hostId, booking.guestId].filter((u) => u !== user.id), RealtimeEvent.bookingUpdate, booking);
    return booking;
  }

  @Get('bookings')
  async mine(@CurrentUser() user: AuthedUser): Promise<Booking[]> {
    const rows = (
      await this.db.query(
        `${BOOKING_SELECT} WHERE $1 IN (b.host_id, b.guest_id) AND s.ends_at > now() - interval '30 days'
         ORDER BY s.starts_at DESC LIMIT 50`,
        [user.id],
      )
    ).rows;
    return rows.map(toBooking);
  }

  /** The QR the player shows venue staff. Short-lived so a screenshot is useless later. */
  @Get('bookings/:id/checkin-token')
  async checkinToken(@CurrentUser() user: AuthedUser, @Param('id', ParseUUIDPipe) id: string): Promise<CheckinToken> {
    const b = await loadBooking(this.db, id);
    if (!isPlayer(b, user.id)) throw new NotFoundException({ error: 'not_found' });
    if (b.state !== 'confirmed' && b.state !== 'checked_in') throw new ConflictException({ error: 'booking_not_confirmed' });
    if (!checkinOpen(b.starts_at.getTime(), b.ends_at.getTime(), Date.now())) {
      throw new ConflictException({ error: 'checkin_not_open' });
    }
    await assertMeetAllowed(this.db, b);
    return {
      token: await this.tokens.signCheckin(user.id, id, CHECKIN_TTL_S),
      expiresAt: new Date(Date.now() + CHECKIN_TTL_S * 1000).toISOString(),
    };
  }

  // ---------- in-person safety (Spec 04) ----------

  @Put('me/emergency-contacts')
  async setContacts(
    @CurrentUser() user: AuthedUser,
    @Body(new ZodPipe(EmergencyContactsRequest)) body: EmergencyContactsRequest,
  ) {
    await withTx(this.db, async (tx) => {
      await tx.query('DELETE FROM emergency_contacts WHERE user_id = $1', [user.id]);
      for (const [i, c] of body.contacts.entries()) {
        await tx.query('INSERT INTO emergency_contacts (user_id, position, name, phone) VALUES ($1, $2, $3, $4)', [
          user.id,
          i + 1,
          c.name,
          c.phone,
        ]);
      }
    });
    // Phone numbers are not echoed back in full.
    return { contacts: body.contacts.map((c) => ({ name: c.name, phone: `…${c.phone.slice(-4)}` })) };
  }

  /** Shield button. Always answers quickly; slow side effects never block the person asking for help. */
  @Post('bookings/:id/safety')
  @HttpCode(201)
  async shield(
    @CurrentUser() user: AuthedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(SafetyEventRequest)) body: SafetyEventRequest,
  ) {
    const b = await loadBooking(this.db, id);
    if (!isPlayer(b, user.id)) throw new NotFoundException({ error: 'not_found' });
    await this.db.query('INSERT INTO safety_events (booking_id, user_id, kind) VALUES ($1, $2, $3)', [id, user.id, body.kind]);
    const actions: string[] = [];

    if (body.kind === 'get_me_out') {
      // Discreet: venue staff get a push; the other player is not told.
      const staff = (await this.db.query('SELECT user_id FROM venue_staff WHERE venue_id = $1', [b.venue_id])).rows.map((r) => r.user_id);
      await this.clients.notify(staff, RealtimeEvent.safetyCheck, { bookingId: id, kind: 'get_me_out', userId: user.id });
      actions.push('venue_staff_notified', 'fake_call');
    }
    if (body.kind === 'alert_contacts' || body.kind === 'emergency') {
      actions.push(`contacts_alerted:${await this.alerts.alertContacts(user.id, b as { name: string; address: string; starts_at: Date })}`);
    }
    if (body.kind === 'emergency') {
      // The app opens the dialer with 911; this opens a critical human review in parallel.
      // Gold wires the professional dispatch API (Noonlight-style) here.
      await this.clients
        .createReport({
          reporterId: user.id,
          subjectType: 'booking',
          subjectId: id,
          category: 'in_person',
          details: `Shield: emergency at ${b.name}, ${b.address}`,
        })
        .catch((err) => this.log.error(`emergency report failed for ${id}: ${(err as Error).message}`));
      actions.push('dial_911', 'critical_review');
    }
    return { recorded: true, actions };
  }

  /** "Did you feel safe?" Private; two "no" from different people opens a review. */
  @Post('bookings/:id/feedback')
  @HttpCode(201)
  async feedback(
    @CurrentUser() user: AuthedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(MeetFeedbackRequest)) body: MeetFeedbackRequest,
  ) {
    const b = await loadBooking(this.db, id);
    if (!isPlayer(b, user.id)) throw new NotFoundException({ error: 'not_found' });
    if (!b.host_checked_in_at || !b.guest_checked_in_at) throw new ConflictException({ error: 'meet_did_not_happen' });
    const subject = b.host_id === user.id ? b.guest_id : b.host_id;
    await this.db.query(
      `INSERT INTO meet_feedback (booking_id, rater_id, subject_id, felt_safe) VALUES ($1, $2, $3, $4)
       ON CONFLICT (booking_id, rater_id) DO UPDATE SET felt_safe = EXCLUDED.felt_safe, created_at = now()`,
      [id, user.id, subject, body.feltSafe],
    );
    if (!body.feltSafe) {
      const raters = Number(
        (await this.db.query('SELECT count(DISTINCT rater_id) FROM meet_feedback WHERE subject_id = $1 AND NOT felt_safe', [subject])).rows[0]
          .count,
      );
      if (raters >= UNSAFE_RATINGS_FOR_REVIEW) {
        await this.clients
          .createReport({
            reporterId: user.id,
            subjectType: 'user',
            subjectId: subject,
            category: 'in_person',
            details: `${raters} different people said they did not feel safe meeting this player.`,
          })
          .catch((err) => this.log.error(`review report failed: ${(err as Error).message}`));
      }
    }
    return { recorded: true };
  }
}

/** Venue staff tools (the partner portal's API): slots, QR check-in, attested results, flags. */
@Controller('v1/venues/:venueId')
@UseGuards(UserGuard)
export class VenueStaffController {
  private readonly log = new Logger('VenueStaffController');

  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(CLIENTS) private readonly clients: ServiceClients,
    @Inject(TOKENS) private readonly tokens: TokenService,
    private readonly results: ResultsService,
  ) {}

  private async requireStaff(venueId: string, userId: string) {
    const r = await this.db.query('SELECT role FROM venue_staff WHERE venue_id = $1 AND user_id = $2', [venueId, userId]);
    if (r.rowCount === 0) throw new ForbiddenException({ error: 'venue_staff_only' });
  }

  @Post('slots')
  @HttpCode(201)
  async createSlot(
    @CurrentUser() user: AuthedUser,
    @Param('venueId', ParseUUIDPipe) venueId: string,
    @Body(new ZodPipe(SlotCreateRequest)) body: SlotCreateRequest,
  ): Promise<VenueSlot> {
    await this.requireStaff(venueId, user.id);
    const venue = (await this.db.query('SELECT games FROM venues WHERE id = $1', [venueId])).rows[0];
    if (!venue.games.includes(body.gameId) || !venueGames[body.gameId]) {
      throw new BadRequestException({ error: 'game_not_offered' });
    }
    const starts = Date.parse(body.startsAt);
    const ends = Date.parse(body.endsAt);
    if (ends <= starts || ends - starts > 6 * 3_600_000) throw new BadRequestException({ error: 'bad_slot_window' });
    if (starts <= Date.now()) throw new BadRequestException({ error: 'slot_in_past' });
    const r = (
      await this.db.query(
        `INSERT INTO venue_slots (venue_id, game_id, starts_at, ends_at, capacity) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [venueId, body.gameId, body.startsAt, body.endsAt, body.capacity],
      )
    ).rows[0];
    return {
      id: r.id,
      venueId,
      gameId: r.game_id,
      startsAt: r.starts_at.toISOString(),
      endsAt: r.ends_at.toISOString(),
      capacity: r.capacity,
      available: r.capacity,
    };
  }

  @Get('bookings')
  async bookings(@CurrentUser() user: AuthedUser, @Param('venueId', ParseUUIDPipe) venueId: string) {
    await this.requireStaff(venueId, user.id);
    const rows = (
      await this.db.query(
        `${BOOKING_SELECT} WHERE s.venue_id = $1 AND s.ends_at > now() - interval '12 hours' AND s.starts_at < now() + interval '24 hours'
           AND b.state IN ('confirmed', 'checked_in', 'completed')
         ORDER BY s.starts_at`,
        [venueId],
      )
    ).rows;
    return rows.map(toBooking);
  }

  /** Staff scan a player's QR. Both players checked in = the meet is on. */
  @Post('checkins')
  @HttpCode(200)
  async checkin(
    @CurrentUser() user: AuthedUser,
    @Param('venueId', ParseUUIDPipe) venueId: string,
    @Body(new ZodPipe(CheckinRequest)) body: CheckinRequest,
  ): Promise<Booking & { checkedIn: { userId: string; displayName: string } }> {
    await this.requireStaff(venueId, user.id);
    let claims: { userId: string; bookingId: string };
    try {
      claims = await this.tokens.verifyCheckin(body.token);
    } catch {
      throw new BadRequestException({ error: 'invalid_or_expired_code' });
    }
    const updated = await withTx(this.db, async (tx) => {
      const b = await loadBooking(tx, claims.bookingId, true);
      if (b.venue_id !== venueId) throw new BadRequestException({ error: 'wrong_venue' });
      if (!isPlayer(b, claims.userId)) throw new BadRequestException({ error: 'invalid_or_expired_code' });
      if (b.state !== 'confirmed' && b.state !== 'checked_in') throw new ConflictException({ error: 'booking_not_confirmed' });
      if (!checkinOpen(b.starts_at.getTime(), b.ends_at.getTime(), Date.now())) throw new ConflictException({ error: 'checkin_not_open' });
      await assertMeetAllowed(tx, b);
      const col = b.host_id === claims.userId ? 'host_checked_in_at' : 'guest_checked_in_at';
      await tx.query(`UPDATE bookings SET ${col} = coalesce(${col}, now()) WHERE id = $1`, [b.id]);
      await tx.query(
        `UPDATE bookings SET state = 'checked_in'
         WHERE id = $1 AND host_checked_in_at IS NOT NULL AND guest_checked_in_at IS NOT NULL`,
        [b.id],
      );
      return loadBooking(tx, b.id);
    });
    const name = (await this.db.query('SELECT display_name FROM profiles WHERE user_id = $1', [claims.userId])).rows[0];
    const booking = toBooking(updated);
    await this.clients.notify([booking.hostId, booking.guestId], RealtimeEvent.bookingUpdate, booking);
    return { ...booking, checkedIn: { userId: claims.userId, displayName: name?.display_name ?? 'Player' } };
  }

  /** Staff attest the result. Strongest verification BEEF has (Spec 02: strength 1.5). */
  @Post('bookings/:bookingId/result')
  @HttpCode(201)
  async result(
    @CurrentUser() user: AuthedUser,
    @Param('venueId', ParseUUIDPipe) venueId: string,
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
    @Body(new ZodPipe(VenueResultRequest)) body: { winnerUserId: string | null; draw: boolean; scores?: number[] },
  ) {
    await this.requireStaff(venueId, user.id);
    const b = await loadBooking(this.db, bookingId);
    if (b.venue_id !== venueId) throw new NotFoundException({ error: 'not_found' });
    // Staff never attest a game they played in.
    if (isPlayer(b, user.id)) throw new ForbiddenException({ error: 'conflict_of_interest' });
    if (b.state === 'completed') throw new ConflictException({ error: 'already_recorded' });
    if (b.state !== 'checked_in') throw new ConflictException({ error: 'both_players_must_check_in' });
    const players: string[] = [b.host_id, b.guest_id];
    if (body.draw === (body.winnerUserId !== null)) throw new BadRequestException({ error: 'winner_or_draw' });
    if (body.winnerUserId && !players.includes(body.winnerUserId)) throw new BadRequestException({ error: 'winner_not_a_player' });
    const manifest = venueGames[b.game_id]!;
    if (manifest.scoring === 'score' && !body.scores) throw new BadRequestException({ error: 'scores_required' });

    // Claim the booking first so a double submit cannot record twice.
    const session = await withTx(this.db, async (tx) => {
      const claimed = await tx.query(`UPDATE bookings SET state = 'completed' WHERE id = $1 AND state = 'checked_in'`, [bookingId]);
      if (claimed.rowCount === 0) throw new ConflictException({ error: 'already_recorded' });
      const s = (
        await tx.query(
          `INSERT INTO game_sessions (game_id, rules_version, seed, players, source) VALUES ($1, $2, 0, $3, 'venue') RETURNING id`,
          [b.game_id, manifest.rulesVersion, players],
        )
      ).rows[0];
      await tx.query('UPDATE bookings SET session_id = $1 WHERE id = $2', [s.id, bookingId]);
      return s.id as string;
    });
    let recorded: Awaited<ReturnType<ResultsService['record']>>;
    try {
      recorded = await this.results.record(
      {
        sessionId: session,
        gameId: b.game_id,
        players,
        winnerSeat: body.winnerUserId ? players.indexOf(body.winnerUserId) : null,
        draw: body.draw,
        reason: 'venue_attested',
        scores: body.scores,
        moveCount: 0,
        rulesVersion: manifest.rulesVersion,
      },
      { bookingId },
    );
    } catch (err) {
      // Undo the claim so staff can submit again.
      await this.db.query(`UPDATE game_sessions SET state = 'void', ended_at = now() WHERE id = $1`, [session]);
      await this.db.query(`UPDATE bookings SET state = 'checked_in', session_id = NULL WHERE id = $1`, [bookingId]);
      throw err;
    }
    return { sessionId: session, events: recorded.events };
  }

  /** Owners add the staff who scan codes and attest results. */
  @Put('staff/:userId')
  async addStaff(
    @CurrentUser() user: AuthedUser,
    @Param('venueId', ParseUUIDPipe) venueId: string,
    @Param('userId', ParseUUIDPipe) staffId: string,
  ) {
    const r = await this.db.query(`SELECT 1 FROM venue_staff WHERE venue_id = $1 AND user_id = $2 AND role = 'owner'`, [venueId, user.id]);
    if (r.rowCount === 0) throw new ForbiddenException({ error: 'venue_owner_only' });
    await this.db.query(
      `INSERT INTO venue_staff (venue_id, user_id, role) VALUES ($1, $2, 'staff') ON CONFLICT DO NOTHING`,
      [venueId, staffId],
    );
    return { added: true };
  }

  @Post('flags')
  @HttpCode(201)
  async flag(
    @CurrentUser() user: AuthedUser,
    @Param('venueId', ParseUUIDPipe) venueId: string,
    @Body(new ZodPipe(StaffFlagRequest)) body: StaffFlagRequest,
  ) {
    await this.requireStaff(venueId, user.id);
    const b = await loadBooking(this.db, body.bookingId);
    if (b.venue_id !== venueId || !isPlayer(b, body.userId)) throw new NotFoundException({ error: 'not_found' });
    await this.db.query(`INSERT INTO safety_events (booking_id, user_id, kind, note) VALUES ($1, $2, 'staff_flag', $3)`, [
      b.id,
      body.userId,
      body.note,
    ]);
    const report = await this.clients.createReport({
      reporterId: user.id,
      subjectType: 'user',
      subjectId: body.userId,
      category: 'in_person',
      details: `Venue staff flag at ${b.name}: ${body.note}`,
    });
    return { flagged: true, report };
  }
}

/**
 * Venue onboarding. Silver has no self-serve partner signup (the MSA is
 * signed offline, Spec 05), so ops create venues through this internal API.
 */
@Controller('internal/venues')
@UseGuards(InternalGuard)
export class InternalVenuesController {
  constructor(@Inject(DB) private readonly db: Db) {}

  @Post()
  @HttpCode(201)
  async create(@Body(new ZodPipe(VenueCreateRequest)) body: VenueCreateRequest & { timezone: string; safeCertified: boolean }): Promise<Venue> {
    const unknown = body.games.filter((g) => !venueGames[g]);
    if (unknown.length) throw new BadRequestException({ error: 'not_venue_games', games: unknown });
    return withTx(this.db, async (tx) => {
      const owner = await tx.query(`SELECT 1 FROM users WHERE id = $1 AND status = 'active'`, [body.ownerUserId]);
      if (owner.rowCount === 0) throw new NotFoundException({ error: 'owner_not_found' });
      const v = (
        await tx.query(
          `INSERT INTO venues (name, address, city, lat, lng, timezone, games, safe_certified)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
          [body.name, body.address, body.city, body.lat, body.lng, body.timezone, body.games, body.safeCertified],
        )
      ).rows[0];
      await tx.query(`INSERT INTO venue_staff (venue_id, user_id, role) VALUES ($1, $2, 'owner')`, [v.id, body.ownerUserId]);
      return toVenue(v);
    });
  }
}
