/**
 * Original Would You Rather prompts written for BEEF. Light, platonic-safe,
 * and about the people playing, so answers spark conversation.
 */
export interface WyrPrompt {
  id: number;
  a: string;
  b: string;
}

export const WYR_BANK: readonly WyrPrompt[] = [
  { id: 1, a: 'Always be 10 minutes early', b: 'Always be 20 minutes late' },
  { id: 2, a: 'Win every board game', b: 'Win every video game' },
  { id: 3, a: 'Live in the city', b: 'Live out in nature' },
  { id: 4, a: 'Have a rewind button for your life', b: 'Have a pause button for your life' },
  { id: 5, a: 'Only eat tacos forever', b: 'Only eat pizza forever' },
  { id: 6, a: 'Be the funniest person in the room', b: 'Be the smartest person in the room' },
  { id: 7, a: 'Travel to the past', b: 'Travel to the future' },
  { id: 8, a: 'Go on a road trip', b: 'Go on a beach vacation' },
  { id: 9, a: 'Never use social media again', b: 'Never watch another movie' },
  { id: 10, a: 'Be famous for something embarrassing', b: 'Be unknown but respected' },
  { id: 11, a: 'Have a personal chef', b: 'Have a personal driver' },
  { id: 12, a: 'Know every language', b: 'Play every instrument' },
  { id: 13, a: 'Spend a day as a cat', b: 'Spend a day as a dog' },
  { id: 14, a: 'Win a trivia night', b: 'Win a bowling league' },
  { id: 15, a: 'Wake up at 5 a.m. every day', b: 'Stay up until 3 a.m. every night' },
  { id: 16, a: 'Have unlimited free concerts', b: 'Have unlimited free sports tickets' },
  { id: 17, a: 'Be great at karaoke', b: 'Be great at dancing' },
  { id: 18, a: 'Lose your phone for a week', b: 'Lose your wallet for a week' },
  { id: 19, a: 'Only text', b: 'Only call' },
  { id: 20, a: 'Have a summer that lasts all year', b: 'Have a fall that lasts all year' },
  { id: 21, a: 'Be a world-class chef', b: 'Be a world-class athlete' },
  { id: 22, a: 'Explore the deep ocean', b: 'Explore outer space' },
  { id: 23, a: 'Give up coffee', b: 'Give up dessert' },
  { id: 24, a: 'Plan every detail of a trip', b: 'Wing the whole trip' },
  { id: 25, a: 'Read minds for a day', b: 'Be invisible for a day' },
  { id: 26, a: 'Have a big group of friends', b: 'Have a few very close friends' },
  { id: 27, a: 'Never lose at rock-paper-scissors', b: 'Never miss a free throw' },
  { id: 28, a: 'Host the party', b: 'Be a guest at the party' },
  { id: 29, a: 'Learn to surf', b: 'Learn to ski' },
  { id: 30, a: 'Always know the right thing to say', b: 'Always know the right thing to do' },
];
