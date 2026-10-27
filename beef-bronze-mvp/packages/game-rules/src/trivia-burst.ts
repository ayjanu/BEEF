import type { GameRules } from './types.ts';

/**
 * Trivia Burst: 12 multiple-choice questions, everyone answers at once, 10 s
 * per question. Correct answers score 100 plus up to 50 for speed. Most points
 * wins; a tie at the top is a draw.
 *
 * The questions (with answers) arrive as init options chosen by the server, so
 * the question bank never ships inside the app. `view` hides the current
 * answer and other players' picks until the round closes.
 */
export const TRIVIA_ROUNDS = 12;
export const TRIVIA_ROUND_MS = 10_000;
/** Pause between rounds so players see the answer before the next question. */
export const TRIVIA_REVEAL_MS = 3_000;

export interface TriviaQuestionData {
  id: number;
  q: string;
  choices: string[];
  answer: number;
}

export interface TriviaOptions {
  questions: TriviaQuestionData[];
}

export interface TriviaPick {
  choice: number;
  at: number;
}

export interface TriviaState {
  questions: TriviaQuestionData[];
  round: number;
  roundStartedAt: number;
  picks: Array<TriviaPick | null>;
  scores: number[];
  history: Array<{ id: number; answer: number; picks: Array<number | null>; points: number[] }>;
}

export interface TriviaMove {
  choice: number;
}

const finished = (s: TriviaState) => s.round >= s.questions.length;

export function triviaPoints(pick: TriviaPick | null, answer: number, roundStartedAt: number): number {
  if (!pick || pick.choice !== answer) return 0;
  const left = Math.max(0, TRIVIA_ROUND_MS - (pick.at - roundStartedAt));
  return 100 + Math.floor((50 * left) / TRIVIA_ROUND_MS);
}

function closeRound(s: TriviaState, now: number): TriviaState {
  const q = s.questions[s.round]!;
  const points = s.picks.map((p) => triviaPoints(p, q.answer, s.roundStartedAt));
  return {
    ...s,
    round: s.round + 1,
    roundStartedAt: now + TRIVIA_REVEAL_MS,
    picks: s.picks.map(() => null),
    scores: s.scores.map((v, i) => v + points[i]!),
    history: [...s.history, { id: q.id, answer: q.answer, picks: s.picks.map((p) => p?.choice ?? null), points }],
  };
}

export const triviaBurst: GameRules<TriviaState, TriviaMove, TriviaOptions> = {
  manifest: {
    id: 'trivia-burst',
    name: 'Trivia Burst',
    level: 1,
    formats: ['1v1', 'ffa'],
    minPlayers: 2,
    maxPlayers: 4,
    chance: 'low',
    turnBased: false,
    rulesVersion: 1,
    rated: true,
    verification: 'server',
    userText: false,
  },

  init(_seed, playerCount, now, options) {
    const questions = options?.questions ?? [];
    if (questions.length < TRIVIA_ROUNDS) throw new Error(`trivia-burst needs ${TRIVIA_ROUNDS} questions`);
    return {
      questions: questions.slice(0, TRIVIA_ROUNDS),
      round: 0,
      roundStartedAt: now + TRIVIA_REVEAL_MS,
      picks: Array.from({ length: playerCount }, () => null),
      scores: Array.from({ length: playerCount }, () => 0),
      history: [],
    };
  },

  awaiting: (s) => (finished(s) ? [] : s.picks.flatMap((p, seat) => (p ? [] : [seat]))),

  validate(s, move, seat, ctx) {
    if (finished(s)) return 'game_over';
    const m = move as TriviaMove;
    const q = s.questions[s.round]!;
    if (!m || !Number.isInteger(m.choice) || m.choice < 0 || m.choice >= q.choices.length) return 'bad_move_shape';
    if (ctx.now < s.roundStartedAt) return 'round_not_started';
    if (ctx.now >= s.roundStartedAt + TRIVIA_ROUND_MS) return 'time_expired';
    if (s.picks[seat]) return 'already_answered';
    return null;
  },

  apply(s, m, seat, ctx) {
    const picks = s.picks.slice();
    picks[seat] = { choice: m.choice, at: ctx.now };
    const next = { ...s, picks };
    return picks.every(Boolean) ? closeRound(next, ctx.now) : next;
  },

  outcome(s) {
    if (!finished(s)) return { done: false, winner: null, draw: false, scores: [...s.scores] };
    const top = Math.max(...s.scores);
    const leaders = s.scores.flatMap((v, i) => (v === top ? [i] : []));
    return { done: true, winner: leaders.length === 1 ? leaders[0]! : null, draw: leaders.length > 1, scores: [...s.scores] };
  },

  view(s, seat) {
    const q = s.questions[s.round];
    return {
      round: s.round,
      rounds: s.questions.length,
      roundStartedAt: s.roundStartedAt,
      roundEndsAt: s.roundStartedAt + TRIVIA_ROUND_MS,
      question: q ? { id: q.id, q: q.q, choices: q.choices } : null,
      answered: s.picks.map(Boolean),
      myPick: seat === null ? null : (s.picks[seat]?.choice ?? null),
      scores: s.scores,
      history: s.history,
    };
  },

  deadline: (s) => (finished(s) ? null : s.roundStartedAt + TRIVIA_ROUND_MS),
  onDeadline: (s, now) => closeRound(s, now),
};

