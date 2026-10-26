import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Settings, Trophy, Star, MapPin, Edit, Share, Users, TrendingUp, Award, Crown } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { useAuthStore } from '../../store/useAuthStore';
import { useApiCall } from '../../hooks/useApiCall';
import { apiClient } from '../../lib/api-client';

// TODO: Replace mock data with API responses
const achievements = [
  { id: 1, name: 'Chess Master', icon: '♟️', description: 'Win 50 chess games', progress: 100, unlocked: true },
  { id: 2, name: 'Speed Demon', icon: '⚡', description: 'Win 25 rapid games', progress: 100, unlocked: true },
  { id: 3, name: 'Social Butterfly', icon: '🦋', description: 'Add 50 friends', progress: 89, unlocked: false },
  { id: 4, name: 'Venue Explorer', icon: '🏢', description: 'Visit 10 Level 4 venues', progress: 70, unlocked: false },
  { id: 5, name: 'Streak Legend', icon: '🔥', description: 'Maintain 10-game win streak', progress: 80, unlocked: false },
  { id: 6, name: 'Tournament King', icon: '👑', description: 'Win 5 tournaments', progress: 60, unlocked: false }
];

const leaderboards = [
  { category: 'Chess', rank: 15, rating: 1850, change: '+12' },
  { category: 'Pool', rank: 8, rating: 1920, change: '+25' },
  { category: 'Trivia', rank: 23, rating: 1680, change: '-8' },
  { category: 'Overall', rank: 12, rating: 1850, change: '+18' }
];

export function ProfileTab() {
  const [activeTab, setActiveTab] = useState('stats');
  const { user } = useAuthStore();

  // Load player stats from backend
  const {
    data: playerStats,
    loading: statsLoading,
    execute: loadStats
  } = useApiCall(apiClient.getPlayerStats, {
    showErrorToast: true
  });

  // Load game history from backend
  const {
    data: gameHistory,
    loading: historyLoading,
    execute: loadHistory
  } = useApiCall(() => apiClient.getGameHistory(1, 10), {
    showErrorToast: true
  });

  // Load achievements from backend
  const {
    data: userAchievements,
    loading: achievementsLoading,
    execute: loadAchievements
  } = useApiCall(apiClient.getAchievements, {
    showErrorToast: true
  });

  useEffect(() => {
    // Load all profile data on mount
    loadStats();
    loadHistory();
    loadAchievements();
  }, []);

  // Use backend data if available, fallback to user store
  const displayName = user?.displayName || 'Player';
  const username = user?.username || '@player';
  const rating = user?.mmr || playerStats?.rating || 0;

  // Calculate stats from playerStats or use defaults
  const wins = playerStats?.wins || 0;
  const losses = playerStats?.losses || 0;
  const totalGames = wins + losses;
  const winRate = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;
  const streak = playerStats?.currentStreak || 0;
  const level = playerStats?.level || 1;

  return (
    <div className="min-h-screen bg-gradient-to-br from-beef-dark via-beef-blue to-beef-dark">
      {/* Header */}
      <div className="p-6 pb-4">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-white">Profile</h1>
          <div className="flex space-x-2">
            <Button variant="outline" size="icon" className="border-beef-red/30 text-beef-accent">
              <Share className="w-5 h-5" />
            </Button>
            <Button variant="outline" size="icon" className="border-beef-red/30 text-beef-accent">
              <Settings className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Profile Header */}
        <div className="bg-beef-card rounded-2xl p-6 border border-beef-red/30 mb-6">
          <div className="flex items-center space-x-4 mb-4">
            <div className="relative">
              <div className="w-20 h-20 bg-beef-red rounded-full flex items-center justify-center text-3xl">
                ⚡
              </div>
              <div className="absolute -bottom-1 -right-1 bg-beef-accent rounded-full p-1">
                <Crown className="w-4 h-4 text-white" />
              </div>
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-white">{displayName}</h2>
              <p className="text-beef-muted">{username}</p>
              <div className="flex items-center space-x-3 mt-2">
                <Badge className="bg-beef-red text-white border-0">
                  Level {level}
                </Badge>
                <div className="flex items-center space-x-1">
                  <Star className="w-4 h-4 text-beef-gold fill-current" />
                  <span className="text-beef-gold font-semibold">{rating}</span>
                </div>
              </div>
            </div>
            <Button size="sm" className="bg-beef-accent hover:bg-beef-accent/90 text-white">
              <Edit className="w-4 h-4 mr-2" />
              Edit
            </Button>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-beef-red">{wins}</div>
              <div className="text-beef-muted text-sm">Wins</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-beef-accent">{winRate}%</div>
              <div className="text-beef-muted text-sm">Win Rate</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-beef-gold">{streak}</div>
              <div className="text-beef-muted text-sm">Streak</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 bg-beef-card border border-beef-red/30">
            <TabsTrigger value="stats" className="data-[state=active]:bg-beef-red data-[state=active]:text-white">
              Stats
            </TabsTrigger>
            <TabsTrigger value="achievements" className="data-[state=active]:bg-beef-red data-[state=active]:text-white">
              Badges
            </TabsTrigger>
            <TabsTrigger value="history" className="data-[state=active]:bg-beef-red data-[state=active]:text-white">
              History
            </TabsTrigger>
            <TabsTrigger value="leaderboards" className="data-[state=active]:bg-beef-red data-[state=active]:text-white">
              Ranks
            </TabsTrigger>
          </TabsList>

          {/* Stats Tab */}
          <TabsContent value="stats" className="mt-6 space-y-4">
            {/* Detailed Stats */}
            <div className="bg-beef-card rounded-xl p-6 border border-beef-red/30">
              <h3 className="text-white font-semibold mb-4 flex items-center">
                <TrendingUp className="w-5 h-5 mr-2 text-beef-accent" />
                Performance
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-beef-muted">Total Games</span>
                    <span className="text-white">{statsLoading ? '...' : totalGames}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-beef-muted">Wins</span>
                    <span className="text-beef-red">{statsLoading ? '...' : wins}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-beef-muted">Losses</span>
                    <span className="text-white">{statsLoading ? '...' : losses}</span>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-beef-muted">Win Rate</span>
                    <span className="text-beef-accent">{statsLoading ? '...' : `${winRate}%`}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-beef-muted">Current Streak</span>
                    <span className="text-beef-gold">{statsLoading ? '...' : streak}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-beef-muted">Rating</span>
                    <span className="text-beef-gold">{statsLoading ? '...' : rating}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Social Stats */}
            <div className="bg-beef-card rounded-xl p-6 border border-beef-red/30">
              <h3 className="text-white font-semibold mb-4 flex items-center">
                <Users className="w-5 h-5 mr-2 text-beef-accent" />
                Social
              </h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-xl font-bold text-beef-red">{userStats.friends}</div>
                  <div className="text-beef-muted text-sm">Friends</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-beef-accent">{userStats.followers}</div>
                  <div className="text-beef-muted text-sm">Followers</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-white">{userStats.following}</div>
                  <div className="text-beef-muted text-sm">Following</div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Achievements Tab */}
          <TabsContent value="achievements" className="mt-6 space-y-3">
            {achievements.map((achievement, index) => (
              <motion.div
                key={achievement.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`bg-beef-card rounded-xl p-4 border ${
                  achievement.unlocked ? 'border-beef-gold' : 'border-beef-red/30'
                } relative overflow-hidden`}
              >
                {achievement.unlocked && (
                  <div className="absolute top-2 right-2">
                    <Award className="w-5 h-5 text-beef-gold" />
                  </div>
                )}
                <div className="flex items-center space-x-4">
                  <div className={`text-3xl ${achievement.unlocked ? 'grayscale-0' : 'grayscale'}`}>
                    {achievement.icon}
                  </div>
                  <div className="flex-1">
                    <h4 className={`font-semibold ${achievement.unlocked ? 'text-beef-gold' : 'text-white'}`}>
                      {achievement.name}
                    </h4>
                    <p className="text-beef-muted text-sm">{achievement.description}</p>
                    <div className="mt-2">
                      <div className="w-full bg-beef-blue rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full ${
                            achievement.unlocked ? 'bg-beef-gold' : 'bg-beef-red'
                          }`}
                          style={{ width: `${achievement.progress}%` }}
                        />
                      </div>
                      <span className="text-xs text-beef-muted">{achievement.progress}%</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history" className="mt-6 space-y-3">
            {historyLoading ? (
              <div className="text-center text-beef-muted py-8">Loading game history...</div>
            ) : gameHistory?.games && gameHistory.games.length > 0 ? (
              gameHistory.games.map((game: any, index: number) => (
                <motion.div
                  key={game.id || index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="bg-beef-card rounded-xl p-4 border border-beef-red/30"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className={`w-3 h-3 rounded-full ${
                        game.result === 'win' ? 'bg-green-500' : 'bg-red-500'
                      }`} />
                      <div>
                        <h4 className="text-white font-semibold">{game.gameMode || 'Game'}</h4>
                        <p className="text-beef-muted text-sm">vs {game.opponent || 'Unknown'}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`font-semibold ${
                        game.result === 'win' ? 'text-green-500' : 'text-red-500'
                      }`}>
                        {game.result === 'win' ? 'Victory' : 'Defeat'}
                      </div>
                      <div className="text-beef-muted text-sm">{game.playedAt || 'Recently'}</div>
                    </div>
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="text-center text-beef-muted py-8">No game history yet. Play your first game!</div>
            )}
          </TabsContent>

          {/* Leaderboards Tab */}
          <TabsContent value="leaderboards" className="mt-6 space-y-3">
            {leaderboards.map((board, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-beef-card rounded-xl p-4 border border-beef-red/30"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-beef-red rounded-full flex items-center justify-center">
                      <span className="text-white font-bold text-sm">#{board.rank}</span>
                    </div>
                    <div>
                      <h4 className="text-white font-semibold">{board.category}</h4>
                      <p className="text-beef-muted text-sm">Rating: {board.rating}</p>
                    </div>
                  </div>
                  <div className={`font-semibold ${
                    board.change.startsWith('+') ? 'text-green-500' : 'text-red-500'
                  }`}>
                    {board.change}
                  </div>
                </div>
              </motion.div>
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}