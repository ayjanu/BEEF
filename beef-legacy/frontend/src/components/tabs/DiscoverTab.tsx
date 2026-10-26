import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Search, Filter, Trophy, Users, MapPin, Zap } from 'lucide-react';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { useApiCall } from '../../hooks/useApiCall';
import { apiClient } from '../../lib/api-client';
import { useAuthStore } from '../../store/useAuthStore';
import { toast } from 'sonner';

const gameLevels = [
  {
    id: 'shade',
    name: 'Shade',
    level: 'Level 1',
    description: 'Mobile Games',
    icon: '🎮',
    color: 'from-purple-500 to-blue-500',
    games: ['Chess', 'Poker', 'Blackjack', 'Word Hunt', 'Sea Battle', '4 in a Row']
  },
  {
    id: 'personal',
    name: 'Now It\'s Personal',
    level: 'Level 2', 
    description: 'Mind Games',
    icon: '🧠',
    color: 'from-blue-500 to-cyan-500',
    games: ['Would You Rather', '20 Questions', 'Truth or Dare', 'Trivia', 'Riddles', 'Memory']
  },
  {
    id: 'prove',
    name: 'Prove It!',
    level: 'Level 3',
    description: 'Physical Challenges',
    icon: '💪',
    color: 'from-orange-500 to-red-500',
    games: ['Push-ups', 'Running', 'Handstand', 'Flexibility', 'Dancing', 'Tricks']
  },
  {
    id: 'beef',
    name: 'BEEF!',
    level: 'Level 4',
    description: 'Meet in Person',
    icon: '🔥',
    color: 'from-red-500 to-pink-500',
    games: ['Pool', 'Bowling', 'Mini Golf', 'Arcade', 'Sports', 'Challenges']
  }
];

const quickMatches = [
  { game: 'Chess', players: 42, level: '1', urgent: true },
  { game: 'Would You Rather', players: 18, level: '2', urgent: false },
  { game: 'Push-up Challenge', players: 7, level: '3', urgent: true },
  { game: 'Pool Tournament', players: 23, level: '4', urgent: false },
];

export function DiscoverTab({ onStartGame }: { onStartGame?: (gameType: string) => void }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLevel, setSelectedLevel] = useState<string | null>(null);
  const [isInQueue, setIsInQueue] = useState(false);
  const { user } = useAuthStore();

  // Load live games
  const {
    data: liveGames,
    loading: liveGamesLoading,
    execute: loadLiveGames
  } = useApiCall(apiClient.getLiveGames, {
    showErrorToast: false
  });

  // Load nearby venues
  const {
    data: nearbyVenues,
    loading: venuesLoading,
    execute: loadVenues
  } = useApiCall(() => {
    // TODO: Get user's actual location
    return apiClient.getNearbyVenues({ lat: 37.7749, lng: -122.4194 });
  }, {
    showErrorToast: false
  });

  useEffect(() => {
    loadLiveGames();
    loadVenues();
  }, []);

  // Handle joining matchmaking queue
  const handleJoinQueue = async (gameMode: string, levelId: string) => {
    if (!user?.region) {
      toast.error('Please set your region in profile settings');
      return;
    }

    setIsInQueue(true);
    const response = await apiClient.joinQueue({
      region: user.region,
      gameMode: gameMode
    });

    if (response.success) {
      toast.success('Joined matchmaking queue! Finding opponents...');
      if (onStartGame) {
        onStartGame(gameMode);
      }
    } else {
      setIsInQueue(false);
      toast.error(response.error?.message || 'Failed to join queue');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-beef-dark via-beef-blue to-beef-dark">
      {/* Header */}
      <div className="p-6 pb-4">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Discover</h1>
            <p className="text-beef-muted">Find your next challenge</p>
          </div>
          <Button variant="outline" size="icon" className="border-beef-red/30 text-beef-accent">
            <Filter className="w-5 h-5" />
          </Button>
        </div>

        {/* Search Bar */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-beef-muted" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search games, players, venues..."
            className="pl-10 bg-beef-card border-beef-red/30 text-white placeholder:text-beef-muted"
          />
        </div>

        {/* Quick Match Section */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Quick Match</h2>
            <Badge className="bg-beef-red text-white">Live</Badge>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {quickMatches.map((match, index) => (
              <motion.div
                key={index}
                whileTap={{ scale: 0.95 }}
                className={`p-4 rounded-xl bg-beef-card border ${
                  match.urgent ? 'border-beef-red' : 'border-beef-red/30'
                } relative overflow-hidden cursor-pointer`}
              >
                {match.urgent && (
                  <div className="absolute top-2 right-2">
                    <div className="w-2 h-2 bg-beef-red rounded-full animate-pulse" />
                  </div>
                )}
                <div className="text-white font-semibold text-sm mb-1">{match.game}</div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Users className="w-4 h-4 text-beef-accent" />
                    <span className="text-beef-muted text-sm">{match.players}</span>
                  </div>
                  <Badge variant="outline" className="border-beef-accent text-beef-accent text-xs">
                    Lv {match.level}
                  </Badge>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Game Levels */}
      <div className="px-6 space-y-4">
        <h2 className="text-lg font-semibold text-white mb-4">Choose Your Level</h2>
        {gameLevels.map((level, index) => (
          <motion.div
            key={level.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setSelectedLevel(selectedLevel === level.id ? null : level.id)}
            className={`rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 ${
              selectedLevel === level.id ? 'scale-105 shadow-lg shadow-beef-red/20' : 'scale-100'
            }`}
          >
            <div className={`bg-gradient-to-r ${level.color} p-1`}>
              <div className="bg-beef-card rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <div className="text-2xl">{level.icon}</div>
                    <div>
                      <h3 className="text-white font-bold">{level.name}</h3>
                      <p className="text-beef-muted text-sm">{level.description}</p>
                    </div>
                  </div>
                  <Badge className={`bg-gradient-to-r ${level.color} text-white border-0`}>
                    {level.level}
                  </Badge>
                </div>

                {selectedLevel === level.id && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                    className="border-t border-beef-red/20 pt-3"
                  >
                    <div className="grid grid-cols-3 gap-2">
                      {level.games.map((game, gameIndex) => (
                        <motion.button
                          key={gameIndex}
                          whileTap={{ scale: 0.95 }}
                          className="p-2 bg-beef-blue rounded-lg text-white text-sm hover:bg-beef-red/20 transition-colors"
                        >
                          {game}
                        </motion.button>
                      ))}
                    </div>
                    <Button
                      className="w-full mt-3 bg-beef-red hover:bg-beef-red/90 text-white"
                      onClick={() => handleJoinQueue('ranked-1v1', level.id)}
                      disabled={isInQueue}
                    >
                      <Zap className="w-4 h-4 mr-2" />
                      {isInQueue ? 'Searching...' : 'Enter Matchmaking'}
                    </Button>
                  </motion.div>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Level 4 Venues */}
      <div className="p-6 mt-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Nearby Venues</h2>
          <Badge variant="outline" className="border-beef-accent text-beef-accent">
            Level 4
          </Badge>
        </div>
        <div className="space-y-3">
          {[
            { name: 'Strike Zone Bowling', distance: '0.3 mi', activity: 'Bowling • Pool' },
            { name: 'GameTime Arcade', distance: '0.8 mi', activity: 'Arcade • Mini Golf' },
            { name: 'Sports Complex', distance: '1.2 mi', activity: 'Basketball • Tennis' }
          ].map((venue, index) => (
            <motion.div
              key={index}
              whileTap={{ scale: 0.98 }}
              className="flex items-center justify-between p-4 bg-beef-card rounded-xl border border-beef-red/30 cursor-pointer"
            >
              <div className="flex items-center space-x-3">
                <MapPin className="w-5 h-5 text-beef-accent" />
                <div>
                  <div className="text-white font-semibold">{venue.name}</div>
                  <div className="text-beef-muted text-sm">{venue.activity}</div>
                </div>
              </div>
              <div className="text-beef-accent text-sm">{venue.distance}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}