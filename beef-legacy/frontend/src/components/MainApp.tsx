import React, { useState } from 'react';
import { BottomNavigation } from './navigation/BottomNavigation';
import { DiscoverTab } from './tabs/DiscoverTab';
import { BeefsTab } from './tabs/BeefsTab';
import { FeedTab } from './tabs/FeedTab';
import { MatchmakingTab } from './tabs/MatchmakingTab';
import { ProfileTab } from './tabs/ProfileTab';
import { ChatScreen } from './chat/ChatScreen';
import { GameScreen } from './game/GameScreen';
import { ChallengeNotification } from './notifications/ChallengeNotification';

export type TabType = 'discover' | 'beefs' | 'feed' | 'matchmaking' | 'profile';
export type ScreenType = 'tabs' | 'chat' | 'game';

export function MainApp() {
  const [activeTab, setActiveTab] = useState<TabType>('discover');
  const [currentScreen, setCurrentScreen] = useState<ScreenType>('tabs');
  const [selectedChat, setSelectedChat] = useState<any>(null);
  const [selectedGame, setSelectedGame] = useState<any>(null);
  const [showChallengeNotification, setShowChallengeNotification] = useState(false);

  // Mock challenge notification data
  const mockChallenge = {
    id: '1',
    from: {
      name: 'Alex Thunder',
      avatar: '⚡'
    },
    game: {
      name: 'Chess Battle',
      icon: '♟️',
      level: 1,
      duration: '15-30 min'
    },
    timestamp: new Date()
  };

  const handleOpenChat = (opponent: any) => {
    setSelectedChat(opponent);
    setCurrentScreen('chat');
  };

  const handleStartGame = (gameType: string) => {
    // Normalize gameType to match GameScreen expectations
    let normalizedGameType: string;
    
    switch (gameType.toLowerCase()) {
      case 'quick match':
        normalizedGameType = 'quick-match';
        break;
      case 'chess battle':
        normalizedGameType = 'chess';
        break;
      case 'trivia challenge':
        normalizedGameType = 'trivia';
        break;
      case 'push-up challenge':
        normalizedGameType = 'pushups';
        break;
      case 'pool tournament':
        normalizedGameType = 'pool';
        break;
      case 'would you rather':
        normalizedGameType = 'would-you-rather';
        break;
      default:
        normalizedGameType = gameType.toLowerCase().replace(/\s+/g, '-');
    }

    setSelectedGame({
      gameType: normalizedGameType,
      level: 1,
      opponent: selectedChat || {
        name: 'Alex Thunder',
        avatar: '⚡',
        rating: 1850
      }
    });
    setCurrentScreen('game');
  };

  const handleBackToTabs = () => {
    setCurrentScreen('tabs');
    setSelectedChat(null);
    setSelectedGame(null);
  };

  const handleGameEnd = (result: 'win' | 'loss' | 'draw') => {
    // Handle game end logic
    console.log('Game ended:', result);
    setCurrentScreen('chat');
  };

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'discover':
        return <DiscoverTab onStartGame={handleStartGame} />;
      case 'beefs':
        return <BeefsTab onOpenChat={handleOpenChat} />;
      case 'feed':
        return <FeedTab />;
      case 'matchmaking':
        return <MatchmakingTab />;
      case 'profile':
        return <ProfileTab />;
      default:
        return <DiscoverTab onStartGame={handleStartGame} />;
    }
  };

  const renderCurrentScreen = () => {
    switch (currentScreen) {
      case 'chat':
        return (
          <ChatScreen
            opponent={selectedChat || {
              id: '1',
              name: 'Alex Thunder',
              avatar: '⚡',
              status: 'online' as const
            }}
            onBack={handleBackToTabs}
            onStartGame={handleStartGame}
          />
        );
      case 'game':
        return (
          <GameScreen
            gameType={selectedGame?.gameType || 'chess'}
            level={selectedGame?.level || 1}
            opponent={selectedGame?.opponent || {
              name: 'Alex Thunder',
              avatar: '⚡',
              rating: 1850
            }}
            onBack={() => setCurrentScreen('chat')}
            onGameEnd={handleGameEnd}
          />
        );
      default:
        return (
          <div className="flex-1 pb-20">
            {renderActiveTab()}
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col cyber-grid">
      {/* Futuristic background overlays */}
      <div className="fixed inset-0 energy-field pointer-events-none" />
      <div className="fixed inset-0 quantum-blur pointer-events-none opacity-50" />
      
      {/* Main Content */}
      {renderCurrentScreen()}
      
      {/* Bottom Navigation - only show on tabs screen */}
      {currentScreen === 'tabs' && (
        <BottomNavigation activeTab={activeTab} onTabChange={setActiveTab} />
      )}

      {/* Challenge Notification */}
      <ChallengeNotification
        isVisible={showChallengeNotification}
        challenge={mockChallenge}
        onAccept={() => {
          setShowChallengeNotification(false);
          handleStartGame('chess');
        }}
        onDecline={() => setShowChallengeNotification(false)}
        onDismiss={() => setShowChallengeNotification(false)}
      />

      {/* Demo button to show challenge notification */}
      {currentScreen === 'tabs' && (
        <button
          onClick={() => setShowChallengeNotification(true)}
          className="fixed top-4 right-4 cyber-button px-3 py-1 rounded-lg text-sm z-40 text-white"
        >
          Demo Challenge
        </button>
      )}
    </div>
  );
}