import type { GameRules, Seat } from './types.ts';

/**
 * Dots and Boxes on a 6×6 box grid (7×7 dots). Drawing the fourth side of a
 * box claims it and earns another turn. Most boxes wins; 18–18 is a draw.
 */
export const BOXES = 6;

export interface DotsState {
  /** h[r][c]: horizontal line from dot (r,c) to (r,c+1); r 0..6, c 0..5 */
  h: boolean[][];
  /** v[r][c]: vertical line from dot (r,c) to (r+1,c); r 0..5, c 0..6 */
  v: boolean[][];
  /** owner[r][c]: seat that closed the box, or -1 */
  owner: number[][];
  scores: [number, number];
  turn: Seat;
}

export interface DotsMove {
  o: 'h' | 'v';
  r: number;
  c: number;
}

const grid = <T>(rows: number, cols: number, v: T): T[][] =>
  Array.from({ length: rows }, () => Array.from({ length: cols }, () => v));

function isMove(m: unknown): m is DotsMove {
  const x = m as DotsMove;
  return !!x && (x.o === 'h' || x.o === 'v') && Number.isInteger(x.r) && Number.isInteger(x.c);
}

function inRange(m: DotsMove): boolean {
  return m.o === 'h'
    ? m.r >= 0 && m.r <= BOXES && m.c >= 0 && m.c < BOXES
    : m.r >= 0 && m.r < BOXES && m.c >= 0 && m.c <= BOXES;
}

const closed = (s: Pick<DotsState, 'h' | 'v'>, r: number, c: number) =>
  !!(s.h[r]?.[c] && s.h[r + 1]?.[c] && s.v[r]?.[c] && s.v[r]?.[c + 1]);

const done = (s: DotsState) => s.scores[0] + s.scores[1] === BOXES * BOXES;

export const dotsAndBoxes: GameRules<DotsState, DotsMove> = {
  manifest: {
    id: 'dots-and-boxes',
    name: 'Dots and Boxes',
    level: 1,
    formats: ['1v1'],
    minPlayers: 2,
    maxPlayers: 2,
    chance: 'none',
    turnBased: true,
    rulesVersion: 1,
    rated: true,
    verification: 'server',
    userText: false,
    turnTimeoutMs: 24 * 60 * 60 * 1000,
  },

  init() {
    return {
      h: grid(BOXES + 1, BOXES, false),
      v: grid(BOXES, BOXES + 1, false),
      owner: grid(BOXES, BOXES, -1),
      scores: [0, 0],
      turn: 0,
    };
  },

  awaiting: (s) => (done(s) ? [] : [s.turn]),

  validate(s, move, seat) {
    if (done(s)) return 'game_over';
    if (seat !== s.turn) return 'not_your_turn';
    if (!isMove(move)) return 'bad_move_shape';
    if (!inRange(move)) return 'line_out_of_range';
    if ((move.o === 'h' ? s.h : s.v)[move.r]?.[move.c]) return 'line_taken';
    return null;
  },

  apply(s, m, seat) {
    const h = s.h.map((row) => row.slice());
    const v = s.v.map((row) => row.slice());
    const owner = s.owner.map((row) => row.slice());
    const scores: [number, number] = [s.scores[0], s.scores[1]];
    (m.o === 'h' ? h : v)[m.r]![m.c] = true;

    // The boxes this line borders.
    const candidates: Array<[number, number]> =
      m.o === 'h' ? [[m.r - 1, m.c], [m.r, m.c]] : [[m.r, m.c - 1], [m.r, m.c]];
    let claimed = 0;
    for (const [r, c] of candidates) {
      if (r < 0 || c < 0 || r >= BOXES || c >= BOXES) continue;
      if (owner[r]![c] === -1 && closed({ h, v }, r, c)) {
        owner[r]![c] = seat;
        scores[seat as 0 | 1] += 1;
        claimed++;
      }
    }
    return { h, v, owner, scores, turn: claimed > 0 ? seat : 1 - seat };
  },

  outcome(s) {
    if (!done(s)) return { done: false, winner: null, draw: false, scores: [...s.scores] };
    const [a, b] = s.scores;
    return { done: true, winner: a === b ? null : a > b ? 0 : 1, draw: a === b, scores: [a, b] };
  },
};
