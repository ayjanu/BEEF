import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Heart, Zap, MapPin, Star, Trophy, Settings } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { useApiCall } from '../../hooks/useApiCall';
import { apiClient } from '../../lib/api-client';
import { toast } from 'sonner';

// Fallback profiles for when backend is unavailable
const fallbackProfiles = [
  {
    id: 1,
    name: 'Alex Thunder',
    age: 24,
    distance: '2.3 mi',
    avatar: '⚡',
    bio: 'Chess master seeking worthy opponents. Level 4 bowling champion.',
    interests: ['Chess', 'Strategy', 'Bowling', 'Pool'],
    level: 4,
    wins: 127,
    rating: 1850,
    badges: ['♟️', '🎯', '🏆'],
    prompt: 'My go-to victory dance is...',
    promptAnswer: 'The classic checkmate shimmy 💃',
    images: ['⚡', '♟️', '🎱']
  },
  {
    id: 2,
    name: 'Maya Storm',
    age: 22,
    distance: '1.8 mi',
    avatar: '🌪️',
    bio: 'Mind games and physical challenges are my specialty. Always up for a good competition!',
    interests: ['Trivia', 'Push-ups', 'Art', 'Dancing'],
    level: 3,
    wins: 89,
    rating: 1650,
    badges: ['🧠', '💪', '🎨'],
    prompt: 'I\'m most competitive when...',
    promptAnswer: 'Someone says they can draw better than me 🎨',
    images: ['🌪️', '🎨', '💪']
  },
  {
    id: 3,
    name: 'Jordan Blaze',
    age: 26,
    distance: '3.1 mi',
    avatar: '🔥',
    bio: 'IRL meetups preferred. Arcade games and sports challenges are my domain.',
    interests: ['Arcade', 'Basketball', 'Mini Golf', 'Pool'],
    level: 4,
    wins: 156,
    rating: 1920,
    badges: ['🎮', '🏀', '🏆'],
    prompt: 'My ideal BEEF date would be...',
    promptAnswer: 'Arcade competition followed by victory pizza 🍕',
    images: ['🔥', '🏀', '🎮']
  }
];

export function MatchmakingTab() {
  const [currentProfileIndex, setCurrentProfileIndex] = useState(0);
  const [dragDirection, setDragDirection] = useState<'left' | 'right' | null>(null);

  // Load matchmaking profiles from backend
  const {
    data: backendProfiles,
    loading: profilesLoading,
    execute: loadProfiles
  } = useApiCall(apiClient.getMatchmakingProfiles, {
    showErrorToast: false
  });

  useEffect(() => {
    loadProfiles();
  }, []);

  // Use backend profiles if available, otherwise fallback
  const profiles = backendProfiles && backendProfiles.length > 0 ? backendProfiles : fallbackProfiles;
  const currentProfile = profiles[currentProfileIndex];

  const handleSwipe = async (direction: 'left' | 'right') => {
    if (!currentProfile) return;

    setDragDirection(direction);

    // Call backend API for like/pass
    if (direction === 'right') {
      const response = await apiClient.likeProfile(currentProfile.id);
      if (response.success && response.data?.isMatch) {
        toast.success(`🎉 It's a match! You can now challenge ${currentProfile.name}!`);
      }
    } else {
      await apiClient.passProfile(currentProfile.id);
    }

    setTimeout(() => {
      setCurrentProfileIndex((prev) => (prev + 1) % profiles.length);
      setDragDirection(null);
    }, 300);
  };

  if (profilesLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-beef-dark via-beef-blue to-beef-dark flex items-center justify-center">
        <div className="text-white">Loading profiles...</div>
      </div>
    );
  }

  if (!currentProfile) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-beef-dark via-beef-blue to-beef-dark relative overflow-hidden">
      {/* Header */}
      <div className="p-6 pb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Discover</h1>
          <p className="text-beef-muted">Find your next challenger</p>
        </div>
        <Button variant="outline" size="icon" className="border-beef-red/30 text-beef-accent">
          <Settings className="w-5 h-5" />
        </Button>
      </div>

      {/* Profile Card Stack */}
      <div className="px-6 flex-1 flex items-center justify-center relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentProfile.id}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ 
              scale: 1, 
              opacity: 1,
              x: dragDirection === 'left' ? -300 : dragDirection === 'right' ? 300 : 0,
              rotate: dragDirection === 'left' ? -30 : dragDirection === 'right' ? 30 : 0
            }}
            exit={{ 
              scale: 0.8, 
              opacity: 0,
              x: dragDirection === 'left' ? -300 : 300,
              rotate: dragDirection === 'left' ? -30 : 30
            }}
            transition={{ type: "spring", bounce: 0.4, duration: 0.6 }}
            drag="x"
            dragConstraints={{ left: -100, right: 100 }}
            onDragEnd={(event, info) => {
              if (info.offset.x > 100) {
                handleSwipe('right');
              } else if (info.offset.x < -100) {
                handleSwipe('left');
              }
            }}
            className="w-full max-w-sm mx-auto cursor-grab active:cursor-grabbing"
          >
            <div className="bg-beef-card rounded-3xl overflow-hidden border border-beef-red/30 shadow-2xl">
              {/* Profile Header */}
              <div className="relative h-80 bg-gradient-to-br from-beef-blue to-beef-card">
                {/* Main Avatar */}
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                  <div className="w-32 h-32 bg-beef-red rounded-full flex items-center justify-center text-6xl shadow-lg">
                    {currentProfile.avatar}
                  </div>
                </div>
                
                {/* Level Badge */}
                <div className="absolute top-4 right-4">
                  <Badge className="bg-beef-red text-white border-0">
                    Level {currentProfile.level}
                  </Badge>
                </div>

                {/* Distance */}
                <div className="absolute top-4 left-4 flex items-center space-x-1 bg-beef-card/80 backdrop-blur-sm rounded-full px-3 py-1">
                  <MapPin className="w-3 h-3 text-beef-accent" />
                  <span className="text-beef-accent text-sm">{currentProfile.distance}</span>
                </div>

                {/* Additional Images */}
                <div className="absolute bottom-4 left-4 flex space-x-2">
                  {currentProfile.images.slice(1).map((img, index) => (
                    <div 
                      key={index}
                      className="w-12 h-12 bg-beef-card rounded-xl flex items-center justify-center text-lg border border-beef-red/30"
                    >
                      {img}
                    </div>
                  ))}
                </div>
              </div>

              {/* Profile Info */}
              <div className="p-6">
                {/* Name and Stats */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="text-2xl font-bold text-white">
                      {currentProfile.name}, {currentProfile.age}
                    </h2>
                    <div className="flex items-center space-x-1">
                      <Star className="w-4 h-4 text-beef-gold fill-current" />
                      <span className="text-beef-gold font-semibold">{currentProfile.rating}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-1">
                      <Trophy className="w-4 h-4 text-beef-accent" />
                      <span className="text-beef-accent text-sm">{currentProfile.wins} wins</span>
                    </div>
                    <div className="flex space-x-1">
                      {currentProfile.badges.map((badge, index) => (
                        <span key={index} className="text-lg">{badge}</span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Bio */}
                <p className="text-beef-muted mb-4">{currentProfile.bio}</p>

                {/* Interests */}
                <div className="mb-4">
                  <div className="flex flex-wrap gap-2">
                    {currentProfile.interests.map((interest, index) => (
                      <Badge 
                        key={index}
                        variant="outline" 
                        className="border-beef-accent text-beef-accent"
                      >
                        {interest}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Prompt */}
                <div className="bg-beef-blue rounded-xl p-4">
                  <h4 className="text-white font-semibold mb-2">{currentProfile.prompt}</h4>
                  <p className="text-beef-muted">{currentProfile.promptAnswer}</p>
                </div>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Action Buttons */}
      <div className="p-6 flex items-center justify-center space-x-8">
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => handleSwipe('left')}
          className="w-16 h-16 bg-gray-600 hover:bg-gray-500 rounded-full flex items-center justify-center shadow-lg transition-all"
        >
          <X className="w-8 h-8 text-white" />
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => handleSwipe('right')}
          className="w-20 h-20 bg-beef-red hover:bg-beef-red/90 rounded-full flex items-center justify-center shadow-lg transition-all"
        >
          <Zap className="w-10 h-10 text-white" />
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.9 }}
          className="w-16 h-16 bg-beef-accent hover:bg-beef-accent/90 rounded-full flex items-center justify-center shadow-lg transition-all"
        >
          <Heart className="w-8 h-8 text-white" />
        </motion.button>
      </div>

      {/* Swipe Indicators */}
      <div className="absolute top-1/2 left-8 transform -translate-y-1/2">
        <motion.div
          animate={{ 
            opacity: dragDirection === 'left' ? 1 : 0,
            scale: dragDirection === 'left' ? 1.2 : 1
          }}
          className="bg-red-500 text-white px-4 py-2 rounded-full font-bold transform -rotate-12"
        >
          NOPE
        </motion.div>
      </div>

      <div className="absolute top-1/2 right-8 transform -translate-y-1/2">
        <motion.div
          animate={{ 
            opacity: dragDirection === 'right' ? 1 : 0,
            scale: dragDirection === 'right' ? 1.2 : 1
          }}
          className="bg-beef-red text-white px-4 py-2 rounded-full font-bold transform rotate-12"
        >
          CHALLENGE!
        </motion.div>
      </div>
    </div>
  );
}