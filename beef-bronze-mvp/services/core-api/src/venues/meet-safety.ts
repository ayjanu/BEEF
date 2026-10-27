/**
 * The end-of-meet check-in from Spec 04, as pure decisions so they are unit
 * tested without a clock or database:
 *
 *   at the planned end      → prompt both players "Are you OK?"
 *   15 min, no "ok"         → stage 1: push + SMS to the player
 *   30 min, still no "ok"   → stage 2: alert their emergency contacts (if they
 *                             opted in) and open a critical in-person review
 */
export const STAGE1_AFTER_END_MS = 15 * 60_000;
export const STAGE2_AFTER_END_MS = 30 * 60_000;
/** Escalations stop after this: a meet from yesterday is handled by the 30-day report window. */
export const ESCALATION_WINDOW_MS = 6 * 60 * 60_000;

export interface PlayerMeetState {
  endsAt: number;
  /** The player confirmed "I'm OK" (or used the Shield) after the planned end. */
  answeredAfterEnd: boolean;
  /** Highest escalation stage already taken for this player (0 = none). */
  stage: 0 | 1 | 2;
}

export function nextEscalation(p: PlayerMeetState, now: number): 0 | 1 | 2 {
  if (p.answeredAfterEnd) return 0;
  const since = now - p.endsAt;
  if (since < STAGE1_AFTER_END_MS || since > ESCALATION_WINDOW_MS) return 0;
  if (since >= STAGE2_AFTER_END_MS && p.stage < 2) return 2;
  if (p.stage < 1) return 1;
  return 0;
}

/** Check-in is open from 30 minutes before the slot until it ends. */
export const CHECKIN_OPENS_BEFORE_MS = 30 * 60_000;
export function checkinOpen(startsAt: number, endsAt: number, now: number): boolean {
  return now >= startsAt - CHECKIN_OPENS_BEFORE_MS && now <= endsAt;
}

/** Spec 04: a pair's first two in-person meets must be at Safe-Beef Certified venues. */
export const CERTIFIED_MEETS_REQUIRED = 2;
export function needsCertifiedVenue(previousMeetsTogether: number): boolean {
  return previousMeetsTogether < CERTIFIED_MEETS_REQUIRED;
}

/** Two "I didn't feel safe" ratings from different people put a player in front of a human. */
export const UNSAFE_RATINGS_FOR_REVIEW = 2;
