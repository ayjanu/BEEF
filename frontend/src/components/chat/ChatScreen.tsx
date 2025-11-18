import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Send, Gamepad2, Camera, Mic, Plus, Trophy, Zap, Video, Image, MapPin } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { ChallengeModal } from './ChallengeModal';

interface ChatScreenProps {
  opponent: {
    id: string;
    name: string;
    avatar: string;
    status: 'online' | 'playing' | 'offline';
  };
  onBack: () => void;
  onStartGame: (gameType: string) => void;
}

interface Message {
  id: string;
  type: 'text' | 'game-invite' | 'game-result' | 'media' | 'challenge' | 'system';
  content: string;
  sender: 'player' | 'opponent' | 'system';
  timestamp: Date;
  gameData?: {
    gameType: string;
    score?: string;
    status: 'pending' | 'active' | 'completed';
  };
  mediaData?: {
    type: 'image' | 'video';
    url: string;
    caption?: string;
  };
}

const initialMessages: Message[] = [
  {
    id: '1',
    type: 'system',
    content: 'Match started! Good luck to both players.',
    sender: 'system',
    timestamp: new Date(Date.now() - 3600000)
  },
  {
    id: '2',
    type: 'text',
    content: 'Hey! Ready for some epic games? 🔥',
    sender: 'opponent',
    timestamp: new Date(Date.now() - 3000000)
  },
  {
    id: '3',
    type: 'text',
    content: 'Absolutely! What should we start with?',
    sender: 'player',
    timestamp: new Date(Date.now() - 2900000)
  },
  {
    id: '4',
    type: 'game-invite',
    content: 'Chess Battle',
    sender: 'opponent',
    timestamp: new Date(Date.now() - 2800000),
    gameData: {
      gameType: 'chess',
      status: 'completed'
    }
  },
  {
    id: '5',
    type: 'game-result',
    content: 'Chess match completed',
    sender: 'system',
    timestamp: new Date(Date.now() - 1800000),
    gameData: {
      gameType: 'chess',
      score: 'You won!',
      status: 'completed'
    }
  },
  {
    id: '6',
    type: 'text',
    content: 'Great game! Want to try something physical now?',
    sender: 'player',
    timestamp: new Date(Date.now() - 1700000)
  },
  {
    id: '7',
    type: 'challenge',
    content: 'Push-up Challenge',
    sender: 'opponent',
    timestamp: new Date(Date.now() - 600000),
    gameData: {
      gameType: 'pushups',
      status: 'pending'
    }
  }
];

export function ChatScreen({ opponent, onBack, onStartGame }: ChatScreenProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [inputMessage, setInputMessage] = useState('');
  const [showChallengeModal, setShowChallengeModal] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = () => {
    if (!inputMessage.trim()) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      type: 'text',
      content: inputMessage,
      sender: 'player',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, newMessage]);
    setInputMessage('');
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const handleGameInvite = (gameType: string) => {
    const gameInviteMessage: Message = {
      id: Date.now().toString(),
      type: 'game-invite',
      content: `${gameType} Challenge`,
      sender: 'player',
      timestamp: new Date(),
      gameData: {
        gameType: gameType.toLowerCase(),
        status: 'pending'
      }
    };

    setMessages(prev => [...prev, gameInviteMessage]);
    setShowChallengeModal(false);
  };

  const renderMessage = (message: Message) => {
    const isPlayer = message.sender === 'player';
    const isSystem = message.sender === 'system';

    if (isSystem) {
      return (
        <div className="flex justify-center my-4">
          <div className="futuristic-card px-4 py-2 rounded-full">
            <span className="text-beef-muted text-sm holographic-text">{message.content}</span>
          </div>
        </div>
      );
    }

    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`flex ${isPlayer ? 'justify-end' : 'justify-start'} mb-4`}
      >
        <div className={`max-w-[80%] ${isPlayer ? 'order-2' : 'order-1'}`}>
          {!isPlayer && (
            <div className="flex items-center mb-2">
              <div className="w-6 h-6 bg-beef-accent rounded-full flex items-center justify-center text-sm mr-2 cyber-glow">
                {opponent.avatar}
              </div>
              <span className="text-beef-muted text-sm">{opponent.name}</span>
            </div>
          )}
          
          <div className={`p-4 rounded-2xl relative overflow-hidden ${
            isPlayer 
              ? 'cyber-button text-white rounded-br-md' 
              : 'futuristic-card text-white rounded-bl-md'
          } ${message.type === 'game-invite' || message.type === 'challenge' ? 'holographic-border' : ''}`}>
            
            {(message.type === 'game-invite' || message.type === 'challenge') && (
              <div className="absolute inset-0 shimmer opacity-10" />
            )}
            
            <div className="relative z-10">
              {message.type === 'text' && (
                <p>{message.content}</p>
              )}

              {(message.type === 'game-invite' || message.type === 'challenge') && (
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <Gamepad2 className="w-5 h-5 text-cyber-blue cyber-glow" />
                    <span className="font-semibold holographic-text">{message.content}</span>
                  </div>
                  {message.gameData?.status === 'pending' && !isPlayer && (
                    <div className="flex space-x-2">
                      <Button 
                        size="sm" 
                        className="cyber-button text-white"
                        onClick={() => onStartGame(message.gameData!.gameType)}
                      >
                        Accept
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="border-cyber-pink/30 text-cyber-pink hover:cyber-glow"
                      >
                        Decline
                      </Button>
                    </div>
                  )}
                  {message.gameData?.status === 'pending' && isPlayer && (
                    <div className="text-cyber-blue text-sm holographic-text">
                      Waiting for response...
                    </div>
                  )}
                </div>
              )}

              {message.type === 'game-result' && (
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Trophy className="w-5 h-5 text-cyber-green cyber-glow" />
                    <span className="font-semibold">{message.content}</span>
                  </div>
                  <div className="text-cyber-green font-bold holographic-text">{message.gameData?.score}</div>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="border-cyber-blue text-cyber-blue w-full hover:cyber-glow"
                  >
                    Play Again
                  </Button>
                </div>
              )}

              {message.type === 'media' && message.mediaData && (
                <div className="space-y-2">
                  <div className="futuristic-card rounded-xl p-4 text-center">
                    {message.mediaData.type === 'image' ? (
                      <div className="text-4xl">🖼️</div>
                    ) : (
                      <div className="text-4xl">🎥</div>
                    )}
                    <p className="text-sm text-beef-muted mt-2">
                      {message.mediaData.type === 'image' ? 'Image' : 'Video'}
                    </p>
                  </div>
                  {message.mediaData.caption && (
                    <p className="text-sm">{message.mediaData.caption}</p>
                  )}
                </div>
              )}
            </div>
          </div>
          
          <div className={`text-xs text-beef-muted mt-1 ${isPlayer ? 'text-right' : 'text-left'}`}>
            {formatTime(message.timestamp)}
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-beef-dark via-beef-blue to-beef-dark flex flex-col relative">
      {/* Futuristic background effects */}
      <div className="absolute inset-0 cyber-grid opacity-20" />
      <div className="absolute inset-0 energy-field" />
      
      {/* Header */}
      <div className="p-6 pb-4 border-b border-cyber-blue/20 relative z-10">
        <div className="futuristic-card p-4 rounded-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Button variant="ghost" size="icon" onClick={onBack} className="text-white hover:cyber-glow">
                <ArrowLeft className="w-6 h-6" />
              </Button>
              <div className="flex items-center space-x-3">
                <div className="relative">
                  <div className="w-10 h-10 bg-beef-accent rounded-full flex items-center justify-center cyber-glow">
                    {opponent.avatar}
                  </div>
                  <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-beef-card ${
                    opponent.status === 'online' ? 'bg-cyber-green cyber-glow' :
                    opponent.status === 'playing' ? 'bg-beef-red beef-glow' : 'bg-gray-500'
                  }`} />
                </div>
                <div>
                  <h2 className="text-white font-semibold">{opponent.name}</h2>
                  <p className="text-beef-muted text-sm capitalize holographic-text">{opponent.status}</p>
                </div>
              </div>
            </div>
            <div className="flex space-x-2">
              <Button variant="ghost" size="icon" className="text-cyber-blue hover:cyber-glow">
                <Video className="w-5 h-5" />
              </Button>
              <Button variant="ghost" size="icon" className="text-cyber-pink hover:cyber-glow">
                <Gamepad2 className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 relative z-10">
        {messages.map(message => renderMessage(message))}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Actions */}
      <AnimatePresence>
        {showQuickActions && (
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            className="px-6 py-4 border-t border-cyber-blue/20 relative z-10"
          >
            <div className="futuristic-card p-4 rounded-xl">
              <div className="grid grid-cols-4 gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowChallengeModal(true)}
                  className="border-cyber-pink/30 text-cyber-pink hover:cyber-glow"
                >
                  <Zap className="w-4 h-4 mr-1" />
                  Challenge
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-cyber-blue/30 text-cyber-blue hover:cyber-glow"
                >
                  <Camera className="w-4 h-4 mr-1" />
                  Photo
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-cyber-green/30 text-cyber-green hover:cyber-glow"
                >
                  <Video className="w-4 h-4 mr-1" />
                  Video
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-electric-violet/30 text-electric-violet hover:cyber-glow"
                >
                  <MapPin className="w-4 h-4 mr-1" />
                  Location
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input Area */}
      <div className="p-6 border-t border-cyber-blue/20 relative z-10">
        <div className="futuristic-card p-4 rounded-xl">
          <div className="flex items-center space-x-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowQuickActions(!showQuickActions)}
              className={`${showQuickActions ? 'text-cyber-pink cyber-glow' : 'text-beef-muted'} hover:text-white`}
            >
              <Plus className={`w-6 h-6 transition-transform ${showQuickActions ? 'rotate-45' : ''}`} />
            </Button>
            
            <div className="flex-1 relative">
              <Input
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                placeholder="Type a message..."
                className="bg-beef-card border-cyber-blue/30 text-white placeholder:text-beef-muted pr-12 focus:neon-border"
              />
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 transform -translate-y-1/2 text-beef-muted hover:text-cyber-blue hover:cyber-glow"
              >
                <Mic className="w-4 h-4" />
              </Button>
            </div>
            
            <Button 
              onClick={sendMessage}
              disabled={!inputMessage.trim()}
              className="cyber-button text-white disabled:opacity-50"
            >
              <Send className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Challenge Modal */}
      <ChallengeModal
        isOpen={showChallengeModal}
        onClose={() => setShowChallengeModal(false)}
        onSendChallenge={handleGameInvite}
        opponent={opponent}
      />
    </div>
  );
}