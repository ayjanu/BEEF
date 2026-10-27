import type { GameManifest } from './types.ts';

/**
 * Level 4 "BEEF!" titles, played in person at partner venues (Spec 02 and 05).
 * The game engine does not host these: venue staff check both players in and
 * attest the result, which is the strongest verification BEEF has (Spec 02,
 * strength 1.5). They have manifests so ratings, leaderboards and the feed
 * treat them like any other title.
 */
export interface VenueGameManifest extends GameManifest {
  /** How staff report the result: just the winner, or per-player scores too. */
  scoring: 'winner' | 'score';
}

const venue = (id: string, name: string, scoring: 'winner' | 'score'): VenueGameManifest => ({
  id,
  name,
  level: 4,
  formats: ['1v1'],
  minPlayers: 2,
  maxPlayers: 2,
  chance: 'none',
  turnBased: true,
  rulesVersion: 1,
  rated: true,
  verification: 'venue',
  userText: false,
  scoring,
});

export const VENUE_GAMES: readonly VenueGameManifest[] = [
  venue('pool-8-ball', 'Pool (8-ball)', 'winner'),
  venue('darts-501', 'Darts (501)', 'winner'),
  venue('bowling', 'Bowling', 'score'),
  venue('table-tennis', 'Table Tennis', 'score'),
  venue('cornhole', 'Cornhole', 'score'),
  venue('arcade-hoops', 'Arcade Hoops', 'score'),
];

export const venueGames: Readonly<Record<string, VenueGameManifest>> = Object.freeze(
  Object.fromEntries(VENUE_GAMES.map((g) => [g.id, g])),
);
