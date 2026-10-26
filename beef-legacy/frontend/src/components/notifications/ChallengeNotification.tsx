import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Zap, X, Clock, Trophy } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';

interface ChallengeNotificationProps {
  isVisible: boolean;
  challenge: {
    id: string;
    from: {
      name: string;
      avatar: string;
    };
    game: {
      name: string;
      icon: string;
      level: number;
      duration: string;
    };
    timestamp: Date;
  };
  onAccept: () => void;
  onDecline: () => void;
  onDismiss: () => void;
}

export function ChallengeNotification({ 
  isVisible, 
  challenge, 
  onAccept, 
  onDecline, 
  onDismiss 
}: ChallengeNotificationProps) {
  return (
    <AnimatePresence>
      {isVisible && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            onClick={onDismiss}
          />
          
          {/* Notification */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: -50 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: -50 }}
            transition={{ type: "spring", bounce: 0.4, duration: 0.6 }}
            className="fixed top-20 left-1/2 transform -translate-x-1/2 w-full max-w-sm mx-4 z-50"
          >
            <div className="bg-beef-card border-2 border-beef-red rounded-2xl p-6 shadow-2xl">
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <motion.div
                    animate={{ 
                      scale: [1, 1.2, 1],
                      rotate: [0, 10, -10, 0]
                    }}
                    transition={{ 
                      duration: 2, 
                      repeat: Infinity 
                    }}
                  >
                    <Zap className="w-6 h-6 text-beef-red" />
                  </motion.div>
                  <span className="text-beef-red font-bold">Challenge Received!</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onDismiss}
                  className="text-beef-muted hover:text-white h-8 w-8"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              {/* Challenge Details */}
              <div className="bg-beef-blue rounded-xl p-4 mb-4">
                <div className="flex items-center space-x-3 mb-3">
                  <div className="w-10 h-10 bg-beef-accent rounded-full flex items-center justify-center">
                    {challenge.from.avatar}
                  </div>
                  <div>
                    <h3 className="text-white font-semibold">{challenge.from.name}</h3>
                    <p className="text-beef-muted text-sm">wants to challenge you!</p>
                  </div>
                </div>

                <div className="text-center py-4">
                  <div className="text-4xl mb-2">{challenge.game.icon}</div>
                  <h4 className="text-white font-bold">{challenge.game.name}</h4>
                  <Badge className="bg-beef-red text-white border-0 mt-2">
                    Level {challenge.game.level}
                  </Badge>
                </div>

                <div className="flex items-center justify-center space-x-4 text-sm text-beef-muted">
                  <div className="flex items-center space-x-1">
                    <Clock className="w-3 h-3" />
                    <span>{challenge.game.duration}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Trophy className="w-3 h-3" />
                    <span>Competitive</span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex space-x-3">
                <Button
                  variant="outline"
                  onClick={onDecline}
                  className="flex-1 border-beef-red/30 text-beef-red hover:bg-beef-red/10"
                >
                  Decline
                </Button>
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="flex-1"
                >
                  <Button
                    onClick={onAccept}
                    className="w-full bg-beef-red hover:bg-beef-red/90 text-white font-semibold"
                  >
                    <Zap className="w-4 h-4 mr-2" />
                    Accept Challenge
                  </Button>
                </motion.div>
              </div>

              {/* Timer */}
              <div className="mt-4 text-center">
                <p className="text-beef-muted text-xs">
                  Challenge expires in 2 minutes
                </p>
                <div className="w-full bg-beef-blue rounded-full h-1 mt-2">
                  <motion.div
                    className="bg-beef-red h-1 rounded-full"
                    initial={{ width: "100%" }}
                    animate={{ width: "0%" }}
                    transition={{ duration: 120, ease: "linear" }}
                  />
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}