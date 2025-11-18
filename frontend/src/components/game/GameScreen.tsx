import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Users, Timer, Trophy, Zap, MessageCircle, Share, Settings } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';

interface GameScreenProps {
  gameType: string; // Accept any string and normalize it internally
  level: 1 | 2 | 3 | 4;
  opponent: {
    name: string;
    avatar: string;
    rating: number;
  };
  onBack: () => void;
  onGameEnd: (result: 'win' | 'loss' | 'draw') => void;
}

const gameConfigs = {
  chess: {
    name: 'Chess',
    icon: '♟️',
    color: 'from-gray-600 to-gray-800',
    level: 1,
    type: 'turn-based'
  },
  trivia: {
    name: 'Trivia Challenge',
    icon: '🧠',
    color: 'from-blue-500 to-purple-600',
    level: 2,
    type: 'realtime'
  },
  pushups: {
    name: 'Push-up Battle',
    icon: '💪',
    color: 'from-orange-500 to-red-600',
    level: 3,
    type: 'challenge'
  },
  pool: {
    name: 'Pool Tournament',
    icon: '🎱',
    color: 'from-green-600 to-emerald-700',
    level: 4,
    type: 'irl'
  },
  'would-you-rather': {
    name: 'Would You Rather',
    icon: '🤔',
    color: 'from-pink-500 to-rose-600',
    level: 2,
    type: 'turn-based'
  },
  'quick-match': {
    name: 'Quick Match',
    icon: '⚡',
    color: 'from-beef-red to-red-600',
    level: 1,
    type: 'realtime'
  }
} as const;

export function GameScreen({ gameType, level, opponent, onBack, onGameEnd }: GameScreenProps) {
  const [gameState, setGameState] = useState<'waiting' | 'playing' | 'paused' | 'finished'>('playing');
  const [score, setScore] = useState({ player: 0, opponent: 0 });
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [currentTurn, setCurrentTurn] = useState<'player' | 'opponent'>('player');

  // Normalize gameType and get config with fallback
  const normalizedGameType = gameType.toLowerCase().replace(/\s+/g, '-') as keyof typeof gameConfigs;
  const config = gameConfigs[normalizedGameType] || gameConfigs.chess; // fallback to chess

  useEffect(() => {
    const timer = setInterval(() => {
      if (gameState === 'playing') {
        setTimeElapsed(prev => prev + 1);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [gameState]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const renderGameContent = () => {
    switch (gameType) {
      case 'chess':
        return <ChessGame currentTurn={currentTurn} onMove={() => setCurrentTurn(currentTurn === 'player' ? 'opponent' : 'player')} />;
      case 'trivia':
        return <TriviaGame score={score} onAnswer={(correct) => setScore(prev => ({ ...prev, player: prev.player + (correct ? 1 : 0) }))} />;
      case 'pushups':
        return <PushupsChallenge score={score} onUpdate={setScore} />;
      case 'pool':
        return <PoolGame score={score} onUpdate={setScore} />;
      case 'would-you-rather':
        return <WouldYouRatherGame currentTurn={currentTurn} onAnswer={() => setCurrentTurn(currentTurn === 'player' ? 'opponent' : 'player')} />;
      case 'quick-match':
        return <QuickMatchGame score={score} onAnswer={(correct) => setScore(prev => ({ ...prev, player: prev.player + (correct ? 1 : 0) }))} />;
      default:
        return <div className="text-center text-white">Game loading...</div>;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-beef-dark via-beef-blue to-beef-dark relative">
      {/* Futuristic background effects */}
      <div className="absolute inset-0 cyber-grid opacity-30" />
      <div className="absolute inset-0 energy-field" />
      
      {/* Header */}
      <div className="p-6 pb-4 relative z-10">
        <div className="flex items-center justify-between mb-4">
          <Button variant="ghost" size="icon" onClick={onBack} className="text-white hover:cyber-glow">
            <ArrowLeft className="w-6 h-6" />
          </Button>
          <div className="flex items-center space-x-2 futuristic-card px-3 py-1 rounded-lg">
            <Timer className="w-4 h-4 text-cyber-blue" />
            <span className="text-cyber-blue font-mono holographic-text">{formatTime(timeElapsed)}</span>
          </div>
          <Button variant="ghost" size="icon" className="text-white hover:cyber-glow">
            <Settings className="w-6 h-6" />
          </Button>
        </div>

        {/* Game Header */}
        <div className={`bg-gradient-to-r ${config.color} rounded-2xl p-6 mb-6 relative overflow-hidden holographic-border`}>
          <div className="absolute inset-0 shimmer opacity-20" />
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="text-4xl cyber-glow">{config.icon}</div>
                <div>
                  <h1 className="text-xl font-bold text-white">{config.name}</h1>
                  <Badge className="bg-white/20 text-white border-0 holographic">
                    Level {config.level}
                  </Badge>
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-white holographic-text">{score.player} - {score.opponent}</div>
                <div className="text-white/80 text-sm">Score</div>
              </div>
            </div>

            {/* Players */}
            <div className="grid grid-cols-2 gap-4">
              <div className={`bg-white/10 rounded-xl p-3 futuristic-card ${currentTurn === 'player' ? 'cyber-glow neon-border' : ''}`}>
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-beef-red rounded-full flex items-center justify-center cyber-glow">
                    ⚡
                  </div>
                  <div>
                    <div className="text-white font-semibold text-sm">You</div>
                    {currentTurn === 'player' && (
                      <div className="text-cyber-blue text-xs holographic-text">Your turn</div>
                    )}
                  </div>
                </div>
              </div>
              <div className={`bg-white/10 rounded-xl p-3 futuristic-card ${currentTurn === 'opponent' ? 'cyber-glow neon-border' : ''}`}>
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-beef-accent rounded-full flex items-center justify-center cyber-glow">
                    {opponent.avatar}
                  </div>
                  <div>
                    <div className="text-white font-semibold text-sm">{opponent.name}</div>
                    {currentTurn === 'opponent' && (
                      <div className="text-cyber-blue text-xs holographic-text">Their turn</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Game Content */}
      <div className="px-6 flex-1 relative z-10">
        {renderGameContent()}
      </div>

      {/* Game Actions */}
      <div className="p-6 border-t border-cyber-blue/20 relative z-10">
        <div className="futuristic-card p-4 rounded-xl">
          <div className="flex items-center justify-around">
            <Button variant="outline" className="border-cyber-blue/30 text-cyber-blue hover:cyber-glow">
              <MessageCircle className="w-4 h-4 mr-2" />
              Chat
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setGameState(gameState === 'paused' ? 'playing' : 'paused')}
              className="border-cyber-pink/30 text-cyber-pink hover:cyber-glow"
            >
              {gameState === 'paused' ? 'Resume' : 'Pause'}
            </Button>
            <Button variant="outline" className="border-cyber-green/30 text-cyber-green hover:cyber-glow">
              <Share className="w-4 h-4 mr-2" />
              Share
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Individual Game Components
function ChessGame({ currentTurn, onMove }: { currentTurn: string; onMove: () => void }) {
  const chessBoard = Array(8).fill(null).map(() => Array(8).fill(null));
  
  return (
    <div className="space-y-4">
      <div className="bg-beef-card rounded-xl p-4 border border-beef-red/30">
        <div className="grid grid-cols-8 gap-1 aspect-square max-w-sm mx-auto">
          {chessBoard.map((row, i) => 
            row.map((_, j) => (
              <motion.button
                key={`${i}-${j}`}
                whileTap={{ scale: 0.95 }}
                onClick={onMove}
                className={`aspect-square flex items-center justify-center text-lg ${
                  (i + j) % 2 === 0 ? 'bg-beef-blue' : 'bg-beef-card'
                } hover:bg-beef-red/20 transition-colors`}
              >
                {/* Chess pieces would go here */}
                {(i === 0 || i === 7) && (j === 0 || j === 7) ? '♜' : 
                 (i === 1 || i === 6) ? '♟' : ''}
              </motion.button>
            ))
          )}
        </div>
      </div>
      <div className="text-center">
        <p className="text-beef-muted">
          {currentTurn === 'player' ? 'Your move!' : 'Waiting for opponent...'}
        </p>
      </div>
    </div>
  );
}

function TriviaGame({ score, onAnswer }: { score: { player: number; opponent: number }; onAnswer: (correct: boolean) => void }) {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [timeLeft, setTimeLeft] = useState(15);

  const questions = [
    {
      question: "Which planet is known as the Red Planet?",
      options: ["Venus", "Mars", "Jupiter", "Saturn"],
      correct: 1
    },
    {
      question: "What is the largest mammal in the world?",
      options: ["Elephant", "Blue Whale", "Giraffe", "Polar Bear"],
      correct: 1
    }
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          onAnswer(false);
          setCurrentQuestion(q => q + 1);
          return 15;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [currentQuestion, onAnswer]);

  const question = questions[currentQuestion % questions.length];

  return (
    <div className="space-y-6">
      <div className="bg-beef-card rounded-xl p-6 border border-beef-red/30">
        <div className="flex items-center justify-between mb-4">
          <Badge className="bg-beef-accent text-white">Question {currentQuestion + 1}</Badge>
          <div className="flex items-center space-x-2">
            <Timer className="w-4 h-4 text-beef-red" />
            <span className="text-beef-red font-bold">{timeLeft}s</span>
          </div>
        </div>
        <Progress value={(timeLeft / 15) * 100} className="mb-4" />
        <h3 className="text-white text-lg mb-6">{question.question}</h3>
        <div className="grid grid-cols-1 gap-3">
          {question.options.map((option, index) => (
            <motion.button
              key={index}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                onAnswer(index === question.correct);
                setCurrentQuestion(q => q + 1);
                setTimeLeft(15);
              }}
              className="p-4 bg-beef-blue rounded-xl text-white text-left hover:bg-beef-red/20 transition-colors"
            >
              <span className="font-semibold mr-3">{String.fromCharCode(65 + index)}.</span>
              {option}
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
}

function PushupsChallenge({ score, onUpdate }: { score: { player: number; opponent: number }; onUpdate: (score: { player: number; opponent: number }) => void }) {
  const [counting, setCounting] = useState(false);

  return (
    <div className="space-y-6">
      <div className="bg-beef-card rounded-xl p-6 border border-beef-red/30 text-center">
        <div className="text-6xl mb-4">💪</div>
        <h3 className="text-white text-xl mb-4">Push-up Challenge</h3>
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-beef-blue rounded-xl p-4">
            <div className="text-3xl font-bold text-beef-red">{score.player}</div>
            <div className="text-beef-muted">Your Count</div>
          </div>
          <div className="bg-beef-blue rounded-xl p-4">
            <div className="text-3xl font-bold text-beef-accent">{score.opponent}</div>
            <div className="text-beef-muted">Opponent</div>
          </div>
        </div>
        <Button 
          onClick={() => {
            setCounting(!counting);
            if (!counting) {
              onUpdate({ ...score, player: score.player + 1 });
            }
          }}
          className={`w-full h-16 text-lg ${counting ? 'bg-beef-red' : 'bg-beef-accent'} hover:opacity-90`}
        >
          {counting ? 'Stop Counting' : 'Start Push-ups'}
        </Button>
        <p className="text-beef-muted mt-4 text-sm">
          Record your push-ups and submit video proof when done!
        </p>
      </div>
    </div>
  );
}

function PoolGame({ score, onUpdate }: { score: { player: number; opponent: number }; onUpdate: (score: { player: number; opponent: number }) => void }) {
  return (
    <div className="space-y-6">
      <div className="bg-beef-card rounded-xl p-6 border border-beef-red/30 text-center">
        <div className="text-6xl mb-4">🎱</div>
        <h3 className="text-white text-xl mb-4">Pool Tournament</h3>
        <div className="bg-green-600 rounded-xl p-6 mb-6 relative">
          <div className="text-white/80 text-sm mb-2">Table View</div>
          <div className="grid grid-cols-4 gap-2">
            {Array(16).fill(null).map((_, i) => (
              <div key={i} className={`w-6 h-6 rounded-full ${i === 0 ? 'bg-white' : i < 8 ? 'bg-red-500' : 'bg-yellow-500'} mx-auto`} />
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Button 
            onClick={() => onUpdate({ ...score, player: score.player + 1 })}
            className="bg-beef-red hover:bg-beef-red/90"
          >
            Score Ball
          </Button>
          <Button 
            variant="outline"
            className="border-beef-accent text-beef-accent"
          >
            End Turn
          </Button>
        </div>
      </div>
    </div>
  );
}

function WouldYouRatherGame({ currentTurn, onAnswer }: { currentTurn: string; onAnswer: () => void }) {
  const scenarios = [
    {
      optionA: "Have the ability to fly",
      optionB: "Have the ability to read minds",
      votesA: 67,
      votesB: 33
    },
    {
      optionA: "Always be 10 minutes late",
      optionB: "Always be 20 minutes early",
      votesA: 23,
      votesB: 77
    }
  ];

  const [currentScenario, setCurrentScenario] = useState(0);
  const scenario = scenarios[currentScenario];

  return (
    <div className="space-y-6">
      <div className="bg-beef-card rounded-xl p-6 border border-beef-red/30">
        <h3 className="text-white text-xl mb-6 text-center">Would You Rather...</h3>
        <div className="space-y-4">
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              onAnswer();
              setCurrentScenario(s => s + 1);
            }}
            className="w-full p-4 bg-gradient-to-r from-beef-red to-red-600 rounded-xl text-white text-left"
          >
            <div className="font-semibold mb-2">Option A</div>
            <div>{scenario.optionA}</div>
            <div className="mt-2 text-sm opacity-80">{scenario.votesA}% chose this</div>
          </motion.button>
          
          <div className="text-center text-beef-muted font-bold">OR</div>
          
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              onAnswer();
              setCurrentScenario(s => s + 1);
            }}
            className="w-full p-4 bg-gradient-to-r from-beef-accent to-cyan-600 rounded-xl text-white text-left"
          >
            <div className="font-semibold mb-2">Option B</div>
            <div>{scenario.optionB}</div>
            <div className="mt-2 text-sm opacity-80">{scenario.votesB}% chose this</div>
          </motion.button>
        </div>
      </div>
    </div>
  );
}

function QuickMatchGame({ score, onAnswer }: { score: { player: number; opponent: number }; onAnswer: (correct: boolean) => void }) {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [timeLeft, setTimeLeft] = useState(15);

  const questions = [
    {
      question: "Which planet is known as the Red Planet?",
      options: ["Venus", "Mars", "Jupiter", "Saturn"],
      correct: 1
    },
    {
      question: "What is the largest mammal in the world?",
      options: ["Elephant", "Blue Whale", "Giraffe", "Polar Bear"],
      correct: 1
    }
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          onAnswer(false);
          setCurrentQuestion(q => q + 1);
          return 15;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [currentQuestion, onAnswer]);

  const question = questions[currentQuestion % questions.length];

  return (
    <div className="space-y-6">
      <div className="bg-beef-card rounded-xl p-6 border border-beef-red/30">
        <div className="flex items-center justify-between mb-4">
          <Badge className="bg-beef-accent text-white">Question {currentQuestion + 1}</Badge>
          <div className="flex items-center space-x-2">
            <Timer className="w-4 h-4 text-beef-red" />
            <span className="text-beef-red font-bold">{timeLeft}s</span>
          </div>
        </div>
        <Progress value={(timeLeft / 15) * 100} className="mb-4" />
        <h3 className="text-white text-lg mb-6">{question.question}</h3>
        <div className="grid grid-cols-1 gap-3">
          {question.options.map((option, index) => (
            <motion.button
              key={index}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                onAnswer(index === question.correct);
                setCurrentQuestion(q => q + 1);
                setTimeLeft(15);
              }}
              className="p-4 bg-beef-blue rounded-xl text-white text-left hover:bg-beef-red/20 transition-colors"
            >
              <span className="font-semibold mr-3">{String.fromCharCode(65 + index)}.</span>
              {option}
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
}