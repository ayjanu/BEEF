import React from 'react';
import { motion } from 'motion/react';
import { MessageCircle, Gamepad2, Video, Phone, MoreVertical, Clock } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';

const activeChats = [
  {
    id: 1,
    name: 'Alex Thunder',
    avatar: '⚡',
    lastMessage: 'Ready for that chess rematch?',
    time: '2m',
    unread: 2,
    status: 'online',
    currentGame: 'Chess',
    level: 1
  },
  {
    id: 2,
    name: 'Maya Storm',
    avatar: '🌪️',
    lastMessage: 'That was an epic push-up battle!',
    time: '15m',
    unread: 0,
    status: 'playing',
    currentGame: 'Would You Rather',
    level: 2
  },
  {
    id: 3,
    name: 'Jordan Blaze',
    avatar: '🔥',
    lastMessage: 'Pool hall at 8pm?',
    time: '1h',
    unread: 1,
    status: 'offline',
    currentGame: null,
    level: 4
  },
  {
    id: 4,
    name: 'Sam Lightning',
    avatar: '⚡',
    lastMessage: 'Good game! Let\'s try trivia next',
    time: '3h',
    unread: 0,
    status: 'online',
    currentGame: null,
    level: 2
  }
];

export function BeefsTab({ onOpenChat }: { onOpenChat?: (opponent: any) => void }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-beef-dark via-beef-blue to-beef-dark">
      {/* Header */}
      <div className="p-6 pb-4">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Active Beefs</h1>
            <p className="text-beef-muted">Your ongoing challenges</p>
          </div>
          <Button className="bg-beef-red hover:bg-beef-red/90 text-white">
            <Gamepad2 className="w-4 h-4 mr-2" />
            Quick Match
          </Button>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          {[
            { icon: MessageCircle, label: 'New Chat', color: 'bg-beef-accent' },
            { icon: Gamepad2, label: 'Challenge', color: 'bg-beef-red' },
            { icon: Video, label: 'Live Stream', color: 'bg-purple-500' },
            { icon: Phone, label: 'Voice Call', color: 'bg-green-500' }
          ].map((action, index) => (
            <motion.button
              key={index}
              whileTap={{ scale: 0.9 }}
              className={`${action.color} p-3 rounded-xl text-white text-center transition-all hover:scale-105`}
            >
              <action.icon className="w-5 h-5 mx-auto mb-1" />
              <span className="text-xs">{action.label}</span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Active Chats */}
      <div className="px-6">
        <h2 className="text-lg font-semibold text-white mb-4">Messages</h2>
        <div className="space-y-3">
          {activeChats.map((chat, index) => (
            <motion.div
              key={chat.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              whileTap={{ scale: 0.98 }}
              className="bg-beef-card rounded-xl p-4 border border-beef-red/30 cursor-pointer hover:border-beef-red/60 transition-all"
              onClick={() => onOpenChat && onOpenChat({
                id: chat.id,
                name: chat.name,
                avatar: chat.avatar,
                status: chat.status
              })}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3 flex-1">
                  {/* Avatar with Status */}
                  <div className="relative">
                    <div className="w-12 h-12 bg-beef-blue rounded-full flex items-center justify-center text-lg">
                      {chat.avatar}
                    </div>
                    <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-beef-card ${
                      chat.status === 'online' ? 'bg-green-500' :
                      chat.status === 'playing' ? 'bg-beef-red' : 'bg-gray-500'
                    }`} />
                  </div>

                  {/* Chat Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="text-white font-semibold truncate">{chat.name}</h3>
                      <div className="flex items-center space-x-2">
                        {chat.currentGame && (
                          <Badge 
                            variant="outline" 
                            className="border-beef-accent text-beef-accent text-xs"
                          >
                            Lv {chat.level}
                          </Badge>
                        )}
                        <span className="text-beef-muted text-xs">{chat.time}</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <p className="text-beef-muted text-sm truncate flex-1">
                        {chat.currentGame ? (
                          <span className="text-beef-accent">Playing {chat.currentGame}</span>
                        ) : (
                          chat.lastMessage
                        )}
                      </p>
                      {chat.unread > 0 && (
                        <div className="bg-beef-red text-white text-xs rounded-full w-5 h-5 flex items-center justify-center ml-2">
                          {chat.unread}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <Button variant="ghost" size="icon" className="text-beef-muted hover:text-white">
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Game Status */}
              {chat.currentGame && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mt-3 pt-3 border-t border-beef-red/20"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Gamepad2 className="w-4 h-4 text-beef-accent" />
                      <span className="text-sm text-white">Game in progress</span>
                    </div>
                    <Button size="sm" className="bg-beef-red hover:bg-beef-red/90 text-white">
                      Join Game
                    </Button>
                  </div>
                </motion.div>
              )}
            </motion.div>
          ))}
        </div>

        {/* Recent Activity */}
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-white mb-4">Recent Activity</h2>
          <div className="space-y-3">
            {[
              { action: 'Won a chess match against Alex Thunder', time: '1h ago', icon: '🏆' },
              { action: 'Completed push-up challenge with Maya Storm', time: '3h ago', icon: '💪' },
              { action: 'New level 4 venue unlocked nearby', time: '6h ago', icon: '🏢' }
            ].map((activity, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 + index * 0.1 }}
                className="flex items-center space-x-3 p-3 bg-beef-card/50 rounded-lg border border-beef-red/20"
              >
                <span className="text-xl">{activity.icon}</span>
                <div className="flex-1">
                  <p className="text-white text-sm">{activity.action}</p>
                  <p className="text-beef-muted text-xs flex items-center">
                    <Clock className="w-3 h-3 mr-1" />
                    {activity.time}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}