import React from 'react';
import { motion } from 'motion/react';
import { Search, MessageSquare, Eye, Zap, User } from 'lucide-react';
import { TabType } from '../MainApp';

interface BottomNavigationProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

const navItems = [
  { id: 'discover' as TabType, icon: Search, label: 'Discover' },
  { id: 'beefs' as TabType, icon: MessageSquare, label: 'Beefs' },
  { id: 'feed' as TabType, icon: Eye, label: 'Feed' },
  { id: 'matchmaking' as TabType, icon: Zap, label: 'Match' },
  { id: 'profile' as TabType, icon: User, label: 'Profile' },
];

export function BottomNavigation({ activeTab, onTabChange }: BottomNavigationProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50">
      <div className="futuristic-card m-4 p-2 rounded-2xl backdrop-blur-xl border-cyber-blue/30">
        <div className="flex justify-around items-center">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            const IconComponent = item.icon;
            
            return (
              <motion.button
                key={item.id}
                whileTap={{ scale: 0.95 }}
                whileHover={{ scale: 1.05 }}
                onClick={() => onTabChange(item.id)}
                className={`flex flex-col items-center p-3 rounded-xl transition-all duration-300 relative ${
                  isActive 
                    ? 'cyber-button text-white' 
                    : 'text-beef-muted hover:text-white hover:bg-cyber-blue/20'
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute inset-0 holographic rounded-xl opacity-20"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <IconComponent className={`w-6 h-6 mb-1 ${isActive ? 'cyber-glow' : ''}`} />
                <span className={`text-xs font-medium ${isActive ? 'holographic-text' : ''}`}>
                  {item.label}
                </span>
                {isActive && (
                  <motion.div
                    className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-cyber-pink rounded-full cyber-glow"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.1 }}
                  />
                )}
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
}