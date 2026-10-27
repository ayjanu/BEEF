/**
 * Original general-knowledge questions written for BEEF (no licensed sources).
 * Stable, checkable facts only. `answer` is the index into `choices`.
 * Silver moves the bank into the database with category packs and moderated
 * user submissions; ids here are stable so old match logs still replay.
 */
export interface TriviaQuestion {
  id: number;
  q: string;
  choices: [string, string, string, string];
  answer: 0 | 1 | 2 | 3;
}

export const TRIVIA_BANK: readonly TriviaQuestion[] = [
  { id: 1, q: 'What is the largest planet in our solar system?', choices: ['Jupiter', 'Saturn', 'Neptune', 'Earth'], answer: 0 },
  { id: 2, q: 'How many continents are there?', choices: ['5', '6', '7', '8'], answer: 2 },
  { id: 3, q: 'Which gas do plants take in for photosynthesis?', choices: ['Oxygen', 'Nitrogen', 'Carbon dioxide', 'Helium'], answer: 2 },
  { id: 4, q: 'What is the chemical symbol for gold?', choices: ['Ag', 'Au', 'Gd', 'Go'], answer: 1 },
  { id: 5, q: 'How many sides does a hexagon have?', choices: ['5', '6', '7', '8'], answer: 1 },
  { id: 6, q: 'Which planet is known as the Red Planet?', choices: ['Venus', 'Jupiter', 'Mars', 'Mercury'], answer: 2 },
  { id: 7, q: 'At what temperature does water freeze, in Fahrenheit?', choices: ['0°F', '32°F', '100°F', '212°F'], answer: 1 },
  { id: 8, q: 'Which is the longest river in South America?', choices: ['Paraná', 'Orinoco', 'Amazon', 'Magdalena'], answer: 2 },
  { id: 9, q: 'Which organ pumps blood through the human body?', choices: ['Lungs', 'Liver', 'Kidneys', 'Heart'], answer: 3 },
  { id: 10, q: 'How many minutes are in a full day?', choices: ['1,200', '1,440', '1,600', '2,400'], answer: 1 },
  { id: 11, q: 'What is the square root of 144?', choices: ['10', '11', '12', '14'], answer: 2 },
  { id: 12, q: 'Which is the largest ocean on Earth?', choices: ['Atlantic', 'Indian', 'Arctic', 'Pacific'], answer: 3 },
  { id: 13, q: 'Which of these is the hardest natural material?', choices: ['Quartz', 'Diamond', 'Granite', 'Topaz'], answer: 1 },
  { id: 14, q: 'How many players does a soccer team have on the field at once?', choices: ['9', '10', '11', '12'], answer: 2 },
  { id: 15, q: 'What is the capital of Japan?', choices: ['Osaka', 'Kyoto', 'Tokyo', 'Nagoya'], answer: 2 },
  { id: 16, q: 'Which element has atomic number 1?', choices: ['Helium', 'Hydrogen', 'Oxygen', 'Carbon'], answer: 1 },
  { id: 17, q: 'How many pieces does each player start with in chess?', choices: ['12', '14', '16', '18'], answer: 2 },
  { id: 18, q: 'What is the capital of Texas?', choices: ['Dallas', 'Houston', 'Austin', 'San Antonio'], answer: 2 },
  { id: 19, q: 'How many bones are in the adult human body?', choices: ['186', '206', '226', '246'], answer: 1 },
  { id: 20, q: 'Which is the fastest land animal?', choices: ['Lion', 'Pronghorn', 'Cheetah', 'Greyhound'], answer: 2 },
  { id: 21, q: 'How many degrees are in a right angle?', choices: ['45', '90', '180', '360'], answer: 1 },
  { id: 22, q: 'What is 15% of 200?', choices: ['15', '20', '30', '35'], answer: 2 },
  { id: 23, q: 'Which planet is best known for its bright ring system?', choices: ['Saturn', 'Mars', 'Venus', 'Mercury'], answer: 0 },
  { id: 24, q: 'How many strings does a standard guitar have?', choices: ['4', '5', '6', '7'], answer: 2 },
  { id: 25, q: 'What is the smallest prime number?', choices: ['0', '1', '2', '3'], answer: 2 },
  { id: 26, q: 'How many pins are set up in ten-pin bowling?', choices: ['8', '9', '10', '12'], answer: 2 },
  { id: 27, q: 'What is a perfect score in ten-pin bowling?', choices: ['200', '250', '300', '350'], answer: 2 },
  { id: 28, q: 'Kangaroos are native to which country?', choices: ['South Africa', 'Australia', 'Brazil', 'India'], answer: 1 },
  { id: 29, q: 'At what temperature does water boil at sea level, in Celsius?', choices: ['90°C', '100°C', '110°C', '212°C'], answer: 1 },
  { id: 30, q: 'How many sides does an octagon have?', choices: ['6', '7', '8', '10'], answer: 2 },
  { id: 31, q: 'What is the capital of Canada?', choices: ['Toronto', 'Vancouver', 'Ottawa', 'Montreal'], answer: 2 },
  { id: 32, q: 'Who painted the Mona Lisa?', choices: ['Michelangelo', 'Leonardo da Vinci', 'Raphael', 'Rembrandt'], answer: 1 },
  { id: 33, q: 'How many cards are in a standard deck, without jokers?', choices: ['48', '50', '52', '54'], answer: 2 },
  { id: 34, q: 'Which blood type can be given to almost anyone as red cells?', choices: ['A positive', 'AB positive', 'O negative', 'B negative'], answer: 2 },
  { id: 35, q: 'What is the largest hot desert in the world?', choices: ['Gobi', 'Kalahari', 'Mojave', 'Sahara'], answer: 3 },
  { id: 36, q: 'How many hours are in a week?', choices: ['148', '158', '168', '178'], answer: 2 },
];
