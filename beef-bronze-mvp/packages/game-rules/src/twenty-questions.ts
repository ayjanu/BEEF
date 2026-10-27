import type { GameRules, Seat } from './types.ts';

/**
 * 20 Questions, 1v1. The seed picks who thinks of the secret (the answerer).
 * The asker gets 20 tries: each is a yes/no question or a guess. A guess that
 * matches the secret (ignoring case, punctuation and leading articles) wins on
 * the spot without the answerer's say-so; any other guess goes to the
 * answerer, who may accept it as a synonym. Twenty misses and the answerer
 * wins. The secret stays hidden from the asker until the end.
 *
 * Replies are self-reported, so the game is unrated (XP only).
 */
export const TQ_MAX_TRIES = 20;
export const TQ_CATEGORIES = ['person', 'place', 'thing', 'animal'] as const;
export type TqCategory = (typeof TQ_CATEGORIES)[number];
export type TqReply = 'yes' | 'no' | 'sometimes' | 'unknown';

export type TqMove =
  | { kind: 'secret'; secret: string; category: TqCategory }
  | { kind: 'question'; text: string }
  | { kind: 'guess'; text: string }
  | { kind: 'reply'; reply: TqReply };

export interface TqEntry {
  kind: 'question' | 'guess';
  text: string;
  reply: TqReply | null;
}

export interface TqState {
  answerer: Seat;
  secret: string | null;
  category: TqCategory | null;
  phase: 'secret' | 'ask' | 'answer' | 'done';
  qa: TqEntry[];
  result: { winner: Seat; reason: 'guessed' | 'guess_accepted' | 'stumped' | 'resignation' } | null;
}

const asker = (s: TqState): Seat => 1 - s.answerer;
const REPLIES: TqReply[] = ['yes', 'no', 'sometimes', 'unknown'];

/** "The Eiffel Tower!" and "eiffel tower" are the same guess. */
export function normalizeGuess(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/^\s*(the|a|an)\s+/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const len = (t: unknown, min: number, max: number) =>
  typeof t === 'string' && t.trim().length >= min && t.trim().length <= max;

function afterMiss(s: TqState, qa: TqEntry[]): TqState {
  if (qa.length >= TQ_MAX_TRIES) return { ...s, qa, phase: 'done', result: { winner: s.answerer, reason: 'stumped' } };
  return { ...s, qa, phase: 'ask' };
}

export const twentyQuestions: GameRules<TqState, TqMove> = {
  manifest: {
    id: 'twenty-questions',
    name: '20 Questions',
    level: 1,
    formats: ['1v1'],
    minPlayers: 2,
    maxPlayers: 2,
    chance: 'none',
    turnBased: true,
    rulesVersion: 1,
    rated: false,
    verification: 'server',
    userText: true,
    turnTimeoutMs: 24 * 60 * 60 * 1000,
  },

  init: (seed) => ({
    answerer: (seed >>> 0) % 2,
    secret: null,
    category: null,
    phase: 'secret',
    qa: [],
    result: null,
  }),

  awaiting(s) {
    if (s.phase === 'done') return [];
    return [s.phase === 'ask' ? asker(s) : s.answerer];
  },

  validate(s, move, seat) {
    if (s.phase === 'done') return 'game_over';
    if (!twentyQuestions.awaiting(s).includes(seat)) return 'not_your_turn';
    const m = move as TqMove;
    if (!m || typeof m.kind !== 'string') return 'bad_move_shape';
    switch (s.phase) {
      case 'secret':
        if (m.kind !== 'secret') return 'wrong_phase';
        if (!TQ_CATEGORIES.includes(m.category)) return 'bad_move_shape';
        if (!len(m.secret, 1, 40) || normalizeGuess(m.secret) === '') return 'secret_length';
        return null;
      case 'ask':
        if (m.kind === 'question') return len(m.text, 3, 140) ? null : 'question_length';
        if (m.kind === 'guess') return len(m.text, 1, 40) ? null : 'guess_length';
        return 'wrong_phase';
      case 'answer': {
        if (m.kind !== 'reply' || !REPLIES.includes(m.reply)) return m.kind === 'reply' ? 'bad_move_shape' : 'wrong_phase';
        const last = s.qa[s.qa.length - 1]!;
        if (last.kind === 'guess' && m.reply !== 'yes' && m.reply !== 'no') return 'guess_needs_yes_or_no';
        return null;
      }
    }
  },

  apply(s, m) {
    switch (m.kind) {
      case 'secret':
        return { ...s, secret: m.secret.trim(), category: m.category, phase: 'ask' };
      case 'question':
        return { ...s, qa: [...s.qa, { kind: 'question', text: m.text.trim(), reply: null }], phase: 'answer' };
      case 'guess': {
        const text = m.text.trim();
        if (normalizeGuess(text) === normalizeGuess(s.secret!)) {
          return {
            ...s,
            qa: [...s.qa, { kind: 'guess', text, reply: 'yes' }],
            phase: 'done',
            result: { winner: asker(s), reason: 'guessed' },
          };
        }
        return { ...s, qa: [...s.qa, { kind: 'guess', text, reply: null }], phase: 'answer' };
      }
      case 'reply': {
        const qa = s.qa.slice();
        const last = { ...qa[qa.length - 1]!, reply: m.reply };
        qa[qa.length - 1] = last;
        if (last.kind === 'guess' && m.reply === 'yes') {
          return { ...s, qa, phase: 'done', result: { winner: asker(s), reason: 'guess_accepted' } };
        }
        return afterMiss(s, qa);
      }
    }
  },

  outcome: (s) => (s.result ? { done: true, winner: s.result.winner, draw: false } : { done: false, winner: null, draw: false }),

  view(s, seat) {
    return { ...s, secret: seat === s.answerer ? s.secret : null, triesLeft: TQ_MAX_TRIES - s.qa.length };
  },

  resign: (s, seat) => ({ ...s, phase: 'done', result: { winner: 1 - seat, reason: 'resignation' } }),

  userTexts(m) {
    if (m.kind === 'secret') return [m.secret];
    if (m.kind === 'question' || m.kind === 'guess') return [m.text];
    return [];
  },
};
