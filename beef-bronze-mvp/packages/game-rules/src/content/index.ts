/**
 * Server-only game content (question banks, prompt decks). Imported from
 * "@beef/game-rules/content" by the game engine, never by the app, so trivia
 * answers do not ship to clients. The chosen content is passed to the rules as
 * init options and stored with the match, so replays never depend on the bank.
 */
import { drawDeck } from '../rounds.ts';
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
      const opts: TriviaOptions = { questions: ids.map((id) => {
        const q = TRIVIA_BANK.find((x) => x.id === id)!;
        return { ...q, choices: [...q.choices] };
      }) };
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
