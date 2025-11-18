import React from 'react';
import { Button } from '../ui/button';
import { motion } from 'motion/react';
import { Play, User, Gamepad2, Zap } from 'lucide-react';

interface WelcomeScreenProps {
  onGetStarted: () => void;
  onSignIn: () => void;
}

export function WelcomeScreen({ onGetStarted, onSignIn }: WelcomeScreenProps) {
  return (
    <div className="relative h-screen bg-gradient-to-br from-beef-dark via-beef-blue to-beef-dark overflow-hidden">
      {/* Background Animation */}
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/4 w-32 h-32 bg-beef-red/20 rounded-full blur-xl animate-pulse" />
        <div className="absolute bottom-1/3 right-1/4 w-48 h-48 bg-beef-accent/15 rounded-full blur-2xl animate-pulse delay-1000" />
        <div className="absolute top-1/2 left-1/2 w-24 h-24 bg-beef-gold/20 rounded-full blur-lg animate-pulse delay-500" />
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-center h-full px-6 text-center">
        {/* Logo/Brand */}
        <motion.div 
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ duration: 1, type: "spring", bounce: 0.5 }}
          className="mb-8"
        >
          <div className="relative">
            <div className="text-6xl font-bold text-beef-red mb-2 tracking-wider">
              BEEF
            </div>
            <div className="text-beef-accent text-sm tracking-widest">
              BATTLE • EVOLVE • EXCEL • FLEX
            </div>
          </div>
        </motion.div>

        {/* Animated Icons */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.8 }}
          className="flex items-center justify-center space-x-8 mb-8"
        >
          <motion.div
            animate={{ 
              rotate: [0, 10, -10, 0],
              scale: [1, 1.1, 1]
            }}
            transition={{ 
              duration: 2, 
              repeat: Infinity,
              repeatType: "reverse" 
            }}
            className="p-4 bg-beef-card rounded-xl border border-beef-red/30"
          >
            <Gamepad2 className="w-8 h-8 text-beef-red" />
          </motion.div>
          
          <motion.div
            animate={{ 
              y: [0, -10, 0],
              scale: [1, 1.1, 1]
            }}
            transition={{ 
              duration: 2, 
              repeat: Infinity,
              delay: 0.3 
            }}
            className="p-4 bg-beef-card rounded-xl border border-beef-accent/30"
          >
            <Zap className="w-8 h-8 text-beef-accent" />
          </motion.div>
          
          <motion.div
            animate={{ 
              rotate: [0, -10, 10, 0],
              scale: [1, 1.1, 1]
            }}
            transition={{ 
              duration: 2, 
              repeat: Infinity,
              delay: 0.6 
            }}
            className="p-4 bg-beef-card rounded-xl border border-beef-gold/30"
          >
            <User className="w-8 h-8 text-beef-gold" />
          </motion.div>
        </motion.div>

        {/* Tagline */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.8 }}
          className="mb-12 space-y-2"
        >
          <h1 className="text-2xl font-bold text-white">
            Challenge. Compete. Connect.
          </h1>
          <p className="text-beef-muted text-lg">
            From mind games to IRL showdowns
          </p>
        </motion.div>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2, duration: 0.8 }}
          className="space-y-4 w-full max-w-sm"
        >
          <Button 
            onClick={onGetStarted}
            className="w-full h-14 text-lg font-semibold bg-beef-red hover:bg-beef-red/90 text-white border-0 rounded-2xl shadow-lg shadow-beef-red/25 transition-all duration-300 hover:shadow-beef-red/40 hover:scale-105"
          >
            <Play className="w-5 h-5 mr-2" />
            Get Started
          </Button>
          
          <button
            onClick={onSignIn}
            className="w-full text-beef-accent hover:text-white transition-colors duration-300 py-3"
          >
            Already have an account? Sign In
          </button>
        </motion.div>

        {/* Social Login Hint */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.6, duration: 0.8 }}
          className="mt-8 text-sm text-beef-muted"
        >
          Sign up with Apple, Google, or Facebook
        </motion.div>
      </div>
    </div>
  );
}