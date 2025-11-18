import React, { useState, useEffect } from 'react';
import { WelcomeScreen } from './onboarding/WelcomeScreen';
import { RegistrationFlow } from './onboarding/RegistrationFlow';
import { MainApp } from './MainApp';
import { useAuthStore } from '../store/useAuthStore';

export type AppState = 'welcome' | 'registration' | 'main';

export function BeefApp() {
  const { isAuthenticated, isLoading, loadUser } = useAuthStore();
  const [appState, setAppState] = useState<AppState>('welcome');

  // Check for existing authentication on mount
  useEffect(() => {
    const checkAuth = async () => {
      await loadUser();
    };
    checkAuth();
  }, [loadUser]);

  // Update app state based on authentication status
  useEffect(() => {
    if (isAuthenticated) {
      setAppState('main');
    }
  }, [isAuthenticated]);

  const handleGetStarted = () => {
    setAppState('registration');
  };

  const handleRegistrationComplete = () => {
    setAppState('main');
  };

  const handleSignIn = () => {
    // In a real app, this would show a sign-in modal/screen
    // For now, redirect to registration which can handle both
    setAppState('registration');
  };

  // Show loading state while checking authentication
  if (isLoading && appState === 'welcome') {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground overflow-hidden">
      {appState === 'welcome' && (
        <WelcomeScreen
          onGetStarted={handleGetStarted}
          onSignIn={handleSignIn}
        />
      )}
      {appState === 'registration' && (
        <RegistrationFlow onComplete={handleRegistrationComplete} />
      )}
      {appState === 'main' && <MainApp />}
    </div>
  );
}