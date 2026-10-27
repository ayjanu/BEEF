/**
 * Server-only game content (question banks, prompt decks). Imported from
 * "@beef/game-rules/content" by the game engine, never by the app, so trivia
 * answers do not ship to clients. The chosen content is passed to the rules as
 * init options and stored with the match, so replays never depend on the bank.
 */
import { drawDeck } from '../rounds.ts';
import { mulberry32 } from '../rng.ts';
import { TRIVIA_ROUNDS, type TriviaOptions } from '../trivia-burst.ts';
import { WYR_ROUNDS, type WyrOptions } from '../would-you-rather.ts';
import { TRIVIA_BANK } from './trivia.ts';
import { WYR_BANK } from './would-you-rather.ts';

export { TRIVIA_BANK, WYR_BANK };

/** Init options a title needs, drawn deterministically from the session seed. Undefined when none. */
export function contentFor(gameId: string, seed: number): unknown {
  switch (gameId) {
    case 'trivia-burst': {
      const ids = drawDeck(seed, TRIVIA_BANK.map((q) => q.id), TRIVIA_ROUNDS);
      // Choices are shuffled per game, so the answer's position carries no signal.
      const rand = mulberry32(seed ^ 0x5eed);
      const opts: TriviaOptions = {
        questions: ids.map((id) => {
          const q = TRIVIA_BANK.find((x) => x.id === id)!;
          const order = [0, 1, 2, 3];
          for (let i = order.length - 1; i > 0; i--) {
            const j = Math.floor(rand() * (i + 1));
            [order[i], order[j]] = [order[j]!, order[i]!];
          }
          return { id: q.id, q: q.q, choices: order.map((k) => q.choices[k]!), answer: order.indexOf(q.answer) };
        }),
      };
      return opts;
    }
    case 'would-you-rather': {
      const ids = drawDeck(seed, WYR_BANK.map((p) => p.id), WYR_ROUNDS);
      const opts: WyrOptions = { prompts: ids.map((id) => ({ ...WYR_BANK.find((p) => p.id === id)! })) };
      return opts;
    }
    default:
      return undefined;
  }
}
