import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Heart, MessageCircle, Share, Eye, Trophy, Zap, Users, Play } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';

const feedPosts = [
  {
    id: 1,
    type: 'victory',
    user: { name: 'Alex Thunder', avatar: '⚡', verified: true },
    content: 'Just dominated a 20-person chess tournament! 🏆',
    image: null,
    stats: { likes: 156, comments: 23, shares: 12, views: 890 },
    timestamp: '2h ago',
    level: 1,
    game: 'Chess Tournament'
  },
  {
    id: 2,
    type: 'challenge',
    user: { name: 'Maya Storm', avatar: '🌪️', verified: false },
    content: 'Side-by-side art challenge results! Who drew it better? 🎨',
    image: '🎨',
    stats: { likes: 89, comments: 45, shares: 8, views: 456 },
    timestamp: '4h ago',
    level: 2,
    game: 'Art Challenge',
    poll: { option1: '62%', option2: '38%' }
  },
  {
    id: 3,
    type: 'livestream',
    user: { name: 'Jordan Blaze', avatar: '🔥', verified: true },
    content: 'LIVE: Epic pool battle at Downtown Billiards! 🎱',
    image: null,
    stats: { likes: 234, comments: 67, shares: 19, views: 1247 },
    timestamp: '6h ago',
    level: 4,
    game: 'Pool',
    isLive: true,
    viewers: 89
  },
  {
    id: 4,
    type: 'achievement',
    user: { name: 'Sam Lightning', avatar: '⚡', verified: false },
    content: 'Unlocked "Speed Demon" badge - 50 wins in rapid-fire games! ⚡',
    image: null,
    stats: { likes: 67, comments: 12, shares: 4, views: 234 },
    timestamp: '8h ago',
    level: 1,
    game: 'Multiple Games'
  }
];

const stories = [
  { id: 1, user: 'Alex Thunder', avatar: '⚡', hasNew: true },
  { id: 2, user: 'Maya Storm', avatar: '🌪️', hasNew: true },
  { id: 3, user: 'Jordan Blaze', avatar: '🔥', hasNew: false },
  { id: 4, user: 'Sam Lightning', avatar: '⚡', hasNew: true },
  { id: 5, user: 'Riley Flash', avatar: '💫', hasNew: false },
];

export function FeedTab() {
  const [feedFilter, setFeedFilter] = useState<'friends' | 'trending' | 'local'>('friends');

  return (
    <div className="min-h-screen bg-gradient-to-br from-beef-dark via-beef-blue to-beef-dark">
      {/* Header */}
      <div className="p-6 pb-4">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-white">Feed</h1>
          <div className="flex space-x-2">
            {[
              { key: 'friends', label: 'Friends' },
              { key: 'trending', label: 'Trending' },
              { key: 'local', label: 'Local' }
            ].map((filter) => (
              <Button
                key={filter.key}
                variant={feedFilter === filter.key ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFeedFilter(filter.key as any)}
                className={feedFilter === filter.key ? 
                  'bg-beef-red hover:bg-beef-red/90 text-white' : 
                  'border-beef-red/30 text-beef-accent hover:bg-beef-red/10'
                }
              >
                {filter.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Stories */}
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-beef-muted mb-3 uppercase tracking-wide">
            Daily Highlights
          </h2>
          <div className="flex space-x-4 overflow-x-auto pb-2">
            {stories.map((story) => (
              <motion.div
                key={story.id}
                whileTap={{ scale: 0.95 }}
                className="flex-shrink-0 text-center cursor-pointer"
              >
                <div className={`w-16 h-16 rounded-full p-1 ${
                  story.hasNew ? 'bg-gradient-to-r from-beef-red to-beef-accent' : 'bg-beef-card'
                }`}>
                  <div className="w-full h-full bg-beef-card rounded-full flex items-center justify-center text-lg">
                    {story.avatar}
                  </div>
                </div>
                <p className="text-xs text-beef-muted mt-1 truncate w-16">
                  {story.user.split(' ')[0]}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Feed Posts */}
      <div className="px-6 space-y-6">
        {feedPosts.map((post, index) => (
          <motion.div
            key={post.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="bg-beef-card rounded-2xl border border-beef-red/30 overflow-hidden"
          >
            {/* Post Header */}
            <div className="p-4 pb-3">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <div className="relative">
                    <div className="w-10 h-10 bg-beef-blue rounded-full flex items-center justify-center">
                      {post.user.avatar}
                    </div>
                    {post.user.verified && (
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-beef-accent rounded-full flex items-center justify-center">
                        <span className="text-xs">✓</span>
                      </div>
                    )}
                  </div>
                  <div>
                    <h3 className="text-white font-semibold">{post.user.name}</h3>
                    <div className="flex items-center space-x-2">
                      <span className="text-beef-muted text-sm">{post.timestamp}</span>
                      <Badge 
                        variant="outline" 
                        className="border-beef-accent text-beef-accent text-xs"
                      >
                        Lv {post.level}
                      </Badge>
                    </div>
                  </div>
                </div>
                {post.isLive && (
                  <div className="flex items-center space-x-1 bg-beef-red px-2 py-1 rounded-full">
                    <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                    <span className="text-white text-xs font-semibold">LIVE</span>
                  </div>
                )}
              </div>

              {/* Post Content */}
              <p className="text-white mb-3">{post.content}</p>

              {/* Post Media/Visual */}
              {post.image && (
                <div className="bg-beef-blue rounded-xl p-8 mb-3 text-center">
                  <div className="text-4xl mb-2">{post.image}</div>
                  {post.poll && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-white">Option A</span>
                        <span className="text-beef-accent">{post.poll.option1}</span>
                      </div>
                      <div className="w-full bg-beef-card rounded-full h-2">
                        <div 
                          className="bg-beef-red h-2 rounded-full" 
                          style={{ width: post.poll.option1 }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-white">Option B</span>
                        <span className="text-beef-accent">{post.poll.option2}</span>
                      </div>
                      <div className="w-full bg-beef-card rounded-full h-2">
                        <div 
                          className="bg-beef-accent h-2 rounded-full" 
                          style={{ width: post.poll.option2 }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {post.isLive && (
                <div className="bg-beef-blue rounded-xl p-4 mb-3">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-2">
                      <Eye className="w-4 h-4 text-beef-accent" />
                      <span className="text-white text-sm">{post.viewers} watching</span>
                    </div>
                    <Button size="sm" className="bg-beef-red hover:bg-beef-red/90 text-white">
                      <Play className="w-3 h-3 mr-1" />
                      Watch
                    </Button>
                  </div>
                  <div className="text-center text-6xl">🎱</div>
                </div>
              )}

              {/* Game Context */}
              <div className="flex items-center space-x-2 mb-3">
                <Zap className="w-4 h-4 text-beef-accent" />
                <span className="text-beef-accent text-sm font-semibold">{post.game}</span>
              </div>
            </div>

            {/* Post Actions */}
            <div className="border-t border-beef-red/20 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-6">
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    className="flex items-center space-x-2 text-beef-muted hover:text-beef-red transition-colors"
                  >
                    <Heart className="w-5 h-5" />
                    <span className="text-sm">{post.stats.likes}</span>
                  </motion.button>
                  
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    className="flex items-center space-x-2 text-beef-muted hover:text-beef-accent transition-colors"
                  >
                    <MessageCircle className="w-5 h-5" />
                    <span className="text-sm">{post.stats.comments}</span>
                  </motion.button>
                  
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    className="flex items-center space-x-2 text-beef-muted hover:text-white transition-colors"
                  >
                    <Share className="w-5 h-5" />
                    <span className="text-sm">{post.stats.shares}</span>
                  </motion.button>
                </div>
                
                <div className="flex items-center space-x-1 text-beef-muted text-sm">
                  <Eye className="w-4 h-4" />
                  <span>{post.stats.views}</span>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Load More */}
      <div className="p-6">
        <Button 
          variant="outline" 
          className="w-full border-beef-red/30 text-beef-accent hover:bg-beef-red/10"
        >
          Load More Posts
        </Button>
      </div>
    </div>
  );
}