import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Zap, Clock, Trophy, Users } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';

interface ChallengeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSendChallenge: (gameType: string) => void;
  opponent: {
    name: string;
    avatar: string;
  };
}

const challengeCategories = [
  {
    id: 'shade',
    name: 'Shade',
    level: 'Level 1',
    description: 'Mobile Games',
    icon: '🎮',
    color: 'from-purple-500 to-blue-500',
    games: [
      { id: 'chess', name: 'Chess', icon: '♟️', duration: '15-30 min', difficulty: 'Medium' },
      { id: 'poker', name: 'Poker', icon: '🃏', duration: '10-20 min', difficulty: 'Hard' },
      { id: 'word-hunt', name: 'Word Hunt', icon: '🔤', duration: '5-10 min', difficulty: 'Easy' },
      { id: 'sea-battle', name: 'Sea Battle', icon: '🚢', duration: '10-15 min', difficulty: 'Medium' }
    ]
  },
  {
    id: 'personal',
    name: 'Now It\'s Personal',
    level: 'Level 2',
    description: 'Mind Games',
    icon: '🧠',
    color: 'from-blue-500 to-cyan-500',
    games: [
      { id: 'trivia', name: 'Trivia Battle', icon: '🧠', duration: '10-15 min', difficulty: 'Medium' },
      { id: 'would-you-rather', name: 'Would You Rather', icon: '🤔', duration: '5-10 min', difficulty: 'Easy' },
      { id: 'truth-dare', name: 'Truth or Dare', icon: '😈', duration: '15-30 min', difficulty: 'Hard' },
      { id: 'riddles', name: 'Riddle Master', icon: '🔍', duration: '10-20 min', difficulty: 'Hard' }
    ]
  },
  {
    id: 'prove',
    name: 'Prove It!',
    level: 'Level 3',
    description: 'Physical Challenges',
    icon: '💪',
    color: 'from-orange-500 to-red-500',
    games: [
      { id: 'pushups', name: 'Push-up Battle', icon: '💪', duration: '5-10 min', difficulty: 'Hard' },
      { id: 'running', name: 'Speed Run', icon: '🏃', duration: '10-15 min', difficulty: 'Medium' },
      { id: 'flexibility', name: 'Flexibility Test', icon: '🤸', duration: '5-10 min', difficulty: 'Easy' },
      { id: 'dancing', name: 'Dance Off', icon: '💃', duration: '10-20 min', difficulty: 'Medium' }
    ]
  },
  {
    id: 'beef',
    name: 'BEEF!',
    level: 'Level 4',
    description: 'Meet in Person',
    icon: '🔥',
    color: 'from-red-500 to-pink-500',
    games: [
      { id: 'pool', name: 'Pool Tournament', icon: '🎱', duration: '30-60 min', difficulty: 'Medium' },
      { id: 'bowling', name: 'Bowling Match', icon: '🎳', duration: '45-90 min', difficulty: 'Easy' },
      { id: 'mini-golf', name: 'Mini Golf', icon: '⛳', duration: '30-45 min', difficulty: 'Easy' },
      { id: 'arcade', name: 'Arcade Battle', icon: '🕹️', duration: '20-40 min', difficulty: 'Medium' }
    ]
  }
];

export function ChallengeModal({ isOpen, onClose, onSendChallenge, opponent }: ChallengeModalProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedGame, setSelectedGame] = useState<string | null>(null);

  const handleSendChallenge = () => {
    if (selectedGame) {
      const game = challengeCategories
        .flatMap(cat => cat.games)
        .find(g => g.id === selectedGame);
      
      if (game) {
        onSendChallenge(game.name);
        setSelectedCategory(null);
        setSelectedGame(null);
      }
    }
  };

  const selectedCategoryData = challengeCategories.find(cat => cat.id === selectedCategory);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-beef-card border-beef-red/30 text-white max-w-md mx-auto max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-3">
            <Zap className="w-6 h-6 text-beef-red" />
            <span>Send Challenge</span>
          </DialogTitle>
          <div className="flex items-center space-x-2 text-beef-muted">
            <div className="w-6 h-6 bg-beef-accent rounded-full flex items-center justify-center text-sm">
              {opponent.avatar}
            </div>
            <span>to {opponent.name}</span>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {!selectedCategory ? (
            /* Category Selection */
            <div className="space-y-3">
              <h3 className="text-white font-semibold">Choose Challenge Type</h3>
              {challengeCategories.map((category) => (
                <motion.button
                  key={category.id}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setSelectedCategory(category.id)}
                  className="w-full text-left"
                >
                  <div className={`bg-gradient-to-r ${category.color} p-1 rounded-xl`}>
                    <div className="bg-beef-card rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="text-2xl">{category.icon}</div>
                          <div>
                            <h4 className="text-white font-semibold">{category.name}</h4>
                            <p className="text-beef-muted text-sm">{category.description}</p>
                          </div>
                        </div>
                        <Badge className={`bg-gradient-to-r ${category.color} text-white border-0`}>
                          {category.level}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </motion.button>
              ))}
            </div>
          ) : !selectedGame ? (
            /* Game Selection */
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSelectedCategory(null)}
                  className="text-beef-muted hover:text-white"
                >
                  <X className="w-5 h-5" />
                </Button>
                <div>
                  <h3 className="text-white font-semibold">{selectedCategoryData?.name}</h3>
                  <p className="text-beef-muted text-sm">Choose your challenge</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 gap-3">
                {selectedCategoryData?.games.map((game) => (
                  <motion.button
                    key={game.id}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setSelectedGame(game.id)}
                    className="p-4 bg-beef-blue rounded-xl text-left hover:bg-beef-red/20 transition-colors border border-beef-red/30"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-3">
                        <div className="text-2xl">{game.icon}</div>
                        <div>
                          <h4 className="text-white font-semibold">{game.name}</h4>
                          <div className="flex items-center space-x-4 text-xs text-beef-muted">
                            <div className="flex items-center space-x-1">
                              <Clock className="w-3 h-3" />
                              <span>{game.duration}</span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <Trophy className="w-3 h-3" />
                              <span>{game.difficulty}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.button>
                ))}
              </div>
            </div>
          ) : (
            /* Challenge Confirmation */
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSelectedGame(null)}
                  className="text-beef-muted hover:text-white"
                >
                  <X className="w-5 h-5" />
                </Button>
                <h3 className="text-white font-semibold">Confirm Challenge</h3>
              </div>

              {(() => {
                const game = selectedCategoryData?.games.find(g => g.id === selectedGame);
                return (
                  <div className="bg-beef-blue rounded-xl p-6 border border-beef-red/30">
                    <div className="text-center mb-4">
                      <div className="text-4xl mb-2">{game?.icon}</div>
                      <h4 className="text-white font-bold text-lg">{game?.name}</h4>
                      <Badge className={`bg-gradient-to-r ${selectedCategoryData?.color} text-white border-0 mt-2`}>
                        {selectedCategoryData?.level}
                      </Badge>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between py-2 border-b border-beef-red/20">
                        <div className="flex items-center space-x-2">
                          <Clock className="w-4 h-4 text-beef-accent" />
                          <span className="text-beef-muted">Duration</span>
                        </div>
                        <span className="text-white">{game?.duration}</span>
                      </div>
                      
                      <div className="flex items-center justify-between py-2 border-b border-beef-red/20">
                        <div className="flex items-center space-x-2">
                          <Trophy className="w-4 h-4 text-beef-gold" />
                          <span className="text-beef-muted">Difficulty</span>
                        </div>
                        <span className="text-white">{game?.difficulty}</span>
                      </div>
                      
                      <div className="flex items-center justify-between py-2">
                        <div className="flex items-center space-x-2">
                          <Users className="w-4 h-4 text-beef-red" />
                          <span className="text-beef-muted">Opponent</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <div className="w-5 h-5 bg-beef-accent rounded-full flex items-center justify-center text-xs">
                            {opponent.avatar}
                          </div>
                          <span className="text-white">{opponent.name}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex space-x-3 mt-6">
                      <Button
                        variant="outline"
                        onClick={() => setSelectedGame(null)}
                        className="flex-1 border-beef-red/30 text-beef-muted"
                      >
                        Back
                      </Button>
                      <Button
                        onClick={handleSendChallenge}
                        className="flex-1 bg-beef-red hover:bg-beef-red/90 text-white"
                      >
                        <Zap className="w-4 h-4 mr-2" />
                        Send Challenge
                      </Button>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}