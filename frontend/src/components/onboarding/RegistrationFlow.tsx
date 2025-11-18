import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronRight, ChevronLeft, Check, MapPin, Bell } from 'lucide-react';

interface RegistrationFlowProps {
  onComplete: () => void;
}

type RegistrationStep = 'basic' | 'profile' | 'interests' | 'privacy' | 'location' | 'notifications' | 'ready';

const gameCategories = [
  { id: 'mind', name: 'Mind Games', icon: '🧠', level: 'Level 2' },
  { id: 'action', name: 'Action Games', icon: '⚡', level: 'Level 1' },
  { id: 'physical', name: 'Physical Challenges', icon: '💪', level: 'Level 3' },
  { id: 'social', name: 'Social Games', icon: '🎭', level: 'Level 2' },
  { id: 'sports', name: 'Sports & IRL', icon: '🏆', level: 'Level 4' },
  { id: 'strategy', name: 'Strategy', icon: '♟️', level: 'Level 1' },
];

export function RegistrationFlow({ onComplete }: RegistrationFlowProps) {
  const [currentStep, setCurrentStep] = useState<RegistrationStep>('basic');
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    username: '',
    mode: 'both' as 'platonic' | 'romantic' | 'both',
    privacy: 'public' as 'public' | 'private'
  });

  const steps: RegistrationStep[] = ['basic', 'profile', 'interests', 'privacy', 'location', 'notifications', 'ready'];
  const currentStepIndex = steps.indexOf(currentStep);
  const progress = ((currentStepIndex + 1) / steps.length) * 100;

  const nextStep = () => {
    const nextIndex = Math.min(currentStepIndex + 1, steps.length - 1);
    setCurrentStep(steps[nextIndex]);
  };

  const prevStep = () => {
    const prevIndex = Math.max(currentStepIndex - 1, 0);
    setCurrentStep(steps[prevIndex]);
  };

  const toggleInterest = (interestId: string) => {
    setSelectedInterests(prev => 
      prev.includes(interestId) 
        ? prev.filter(id => id !== interestId)
        : [...prev, interestId]
    );
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 'basic':
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-white mb-2">Welcome to BEEF!</h2>
              <p className="text-beef-muted">Let's get you set up</p>
            </div>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name" className="text-white">Full Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="bg-beef-card border-beef-red/30 text-white placeholder:text-beef-muted"
                  placeholder="Enter your name"
                />
              </div>
              <div>
                <Label htmlFor="email" className="text-white">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  className="bg-beef-card border-beef-red/30 text-white placeholder:text-beef-muted"
                  placeholder="Enter your email"
                />
              </div>
            </div>
          </div>
        );

      case 'profile':
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-white mb-2">Create Your Profile</h2>
              <p className="text-beef-muted">Choose your fighter identity</p>
            </div>
            <div className="space-y-4">
              <div>
                <Label htmlFor="username" className="text-white">Username</Label>
                <Input
                  id="username"
                  value={formData.username}
                  onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                  className="bg-beef-card border-beef-red/30 text-white placeholder:text-beef-muted"
                  placeholder="@username"
                />
              </div>
              <div className="text-center">
                <div className="w-24 h-24 bg-beef-card border-2 border-beef-red/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-3xl">📸</span>
                </div>
                <Button variant="outline" className="border-beef-red/30 text-beef-accent hover:bg-beef-red/10">
                  Upload Photo
                </Button>
              </div>
            </div>
          </div>
        );

      case 'interests':
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-white mb-2">What's Your Game?</h2>
              <p className="text-beef-muted">Select your favorite competition types</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {gameCategories.map((category) => (
                <motion.button
                  key={category.id}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => toggleInterest(category.id)}
                  className={`p-4 rounded-xl border-2 transition-all duration-300 ${
                    selectedInterests.includes(category.id)
                      ? 'bg-beef-red border-beef-red text-white'
                      : 'bg-beef-card border-beef-red/30 text-white hover:border-beef-red/60'
                  }`}
                >
                  <div className="text-2xl mb-2">{category.icon}</div>
                  <div className="font-semibold text-sm">{category.name}</div>
                  <div className="text-xs text-beef-accent">{category.level}</div>
                </motion.button>
              ))}
            </div>
          </div>
        );

      case 'privacy':
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-white mb-2">Privacy Settings</h2>
              <p className="text-beef-muted">How do you want to connect?</p>
            </div>
            <div className="space-y-4">
              <div>
                <Label className="text-white mb-3 block">Connection Mode</Label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { value: 'platonic', label: 'Friends Only', icon: '🤝' },
                    { value: 'romantic', label: 'Dating', icon: '💕' },
                    { value: 'both', label: 'Both', icon: '🌟' }
                  ].map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setFormData(prev => ({ ...prev, mode: option.value as any }))}
                      className={`p-4 rounded-xl border-2 text-center transition-all ${
                        formData.mode === option.value
                          ? 'bg-beef-red border-beef-red text-white'
                          : 'bg-beef-card border-beef-red/30 text-white hover:border-beef-red/60'
                      }`}
                    >
                      <div className="text-2xl mb-1">{option.icon}</div>
                      <div className="text-sm font-semibold">{option.label}</div>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-white mb-3 block">Account Visibility</Label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { value: 'public', label: 'Public Profile', desc: 'Anyone can find you' },
                    { value: 'private', label: 'Private Profile', desc: 'Only friends can see' }
                  ].map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setFormData(prev => ({ ...prev, privacy: option.value as any }))}
                      className={`p-4 rounded-xl border-2 text-left transition-all ${
                        formData.privacy === option.value
                          ? 'bg-beef-red border-beef-red text-white'
                          : 'bg-beef-card border-beef-red/30 text-white hover:border-beef-red/60'
                      }`}
                    >
                      <div className="font-semibold text-sm mb-1">{option.label}</div>
                      <div className="text-xs text-beef-muted">{option.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );

      case 'location':
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-white mb-2">Location Access</h2>
              <p className="text-beef-muted">Find competitors near you</p>
            </div>
            <div className="text-center">
              <div className="w-32 h-32 bg-beef-card border-2 border-beef-red/30 rounded-full flex items-center justify-center mx-auto mb-6">
                <MapPin className="w-12 h-12 text-beef-red" />
              </div>
              <p className="text-white mb-6">
                BEEF uses your location to match you with nearby competitors and find local venues for Level 4 challenges.
              </p>
              <Button 
                onClick={nextStep}
                className="w-full bg-beef-red hover:bg-beef-red/90 text-white"
              >
                Enable Location Services
              </Button>
            </div>
          </div>
        );

      case 'notifications':
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-white mb-2">Stay in the Game</h2>
              <p className="text-beef-muted">Get notified about challenges and matches</p>
            </div>
            <div className="text-center">
              <div className="w-32 h-32 bg-beef-card border-2 border-beef-red/30 rounded-full flex items-center justify-center mx-auto mb-6">
                <Bell className="w-12 h-12 text-beef-accent" />
              </div>
              <p className="text-white mb-6">
                Receive notifications for match invitations, game results, and when friends are online to play.
              </p>
              <Button 
                onClick={nextStep}
                className="w-full bg-beef-accent hover:bg-beef-accent/90 text-white"
              >
                Enable Notifications
              </Button>
            </div>
          </div>
        );

      case 'ready':
        return (
          <div className="space-y-6 text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", bounce: 0.5 }}
              className="w-32 h-32 bg-beef-red rounded-full flex items-center justify-center mx-auto mb-6"
            >
              <Check className="w-16 h-16 text-white" />
            </motion.div>
            <div>
              <h2 className="text-3xl font-bold text-white mb-2">You're Ready!</h2>
              <p className="text-beef-muted mb-8">Time to start your first BEEF</p>
            </div>
            <Button 
              onClick={onComplete}
              className="w-full h-14 text-lg bg-beef-red hover:bg-beef-red/90 text-white"
            >
              Find Your First Match
            </Button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-beef-dark via-beef-blue to-beef-dark p-6">
      {/* Progress Bar */}
      <div className="w-full bg-beef-card rounded-full h-2 mb-8 overflow-hidden">
        <motion.div 
          className="h-full bg-gradient-to-r from-beef-red to-beef-accent"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.5 }}
        />
      </div>

      {/* Step Content */}
      <div className="max-w-md mx-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.3 }}
          >
            {renderStepContent()}
          </motion.div>
        </AnimatePresence>

        {/* Navigation */}
        {currentStep !== 'ready' && currentStep !== 'location' && currentStep !== 'notifications' && (
          <div className="flex justify-between mt-8">
            <Button
              variant="outline"
              onClick={prevStep}
              disabled={currentStepIndex === 0}
              className="border-beef-red/30 text-beef-accent hover:bg-beef-red/10"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Back
            </Button>
            
            <Button
              onClick={nextStep}
              className="bg-beef-red hover:bg-beef-red/90 text-white"
            >
              Next
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}