'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import ModeCard from '@/components/ModeCard';
import { Mode } from '@/types';
import { Mic, ArrowRight, Sparkles } from 'lucide-react';

export default function Home() {
  const router = useRouter();
  const [selectedMode, setSelectedMode] = useState<Mode | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  const modes: Mode[] = [
    'storytelling',
    'critical_thinking',
    'negotiation',
    'interview',
    'executive_presence',
    'devils_advocate',
    'persuasion_lab',
    'real_world_scenario',
    'rapid_response',
    'story_to_strategy',
    'high_pressure',
    'answer_architect',
    'professional_identity',
  ];

  const handleModeSelect = (mode: Mode) => {
    setSelectedMode(mode);
    setIsStarting(true);
    
    // Simulate starting a session
    setTimeout(() => {
      // Navigate to the session page
      router.push(`/session/${mode}`);
    }, 2000);
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8 relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary-500/20 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent-500/20 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '1.5s' }} />
      </div>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="text-center mb-12 relative z-10"
      >
        <div className="flex items-center justify-center mb-4">
          <Sparkles className="w-8 h-8 text-gradient mr-2" />
          <h1 className="text-6xl font-display font-bold text-gradient">
            Gravitas
          </h1>
          <Sparkles className="w-8 h-8 text-gradient ml-2" />
        </div>
        <p className="text-xl text-gray-300 max-w-2xl mx-auto">
          Elite Communication Coaching
        </p>
        <p className="text-sm text-gray-400 mt-2">
          Master strategic communication, storytelling, negotiation, and professional presence
        </p>
      </motion.div>

      {/* Mode Selection Grid */}
      {!selectedMode && !isStarting && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="relative z-10 w-full max-w-6xl"
        >
          <h2 className="text-2xl font-semibold text-center mb-8 text-white">
            Choose Your Arena
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {modes.map((mode, index) => (
              <ModeCard
                key={mode}
                mode={mode}
                onSelect={handleModeSelect}
                delay={index * 0.1}
              />
            ))}
          </div>
        </motion.div>
      )}

      {/* Loading State */}
      {isStarting && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative z-10 text-center"
        >
          <div className="glass-card p-12">
            <div className="flex flex-col items-center space-y-6">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-primary-500 to-accent-500 rounded-full blur-xl opacity-50 animate-pulse" />
                <Mic className="w-16 h-16 text-gradient relative z-10" />
              </div>
              <h3 className="text-2xl font-bold text-white">
                Initializing Session
              </h3>
              <p className="text-gray-300">
                Preparing your personalized coaching experience...
              </p>
              <div className="w-64 h-2 bg-white/20 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: '100%' }}
                  transition={{ duration: 2 }}
                  className="h-full bg-gradient-to-r from-primary-500 to-accent-500"
                />
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Selected Mode Confirmation */}
      {selectedMode && !isStarting && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative z-10"
        >
          <div className="glass-card p-12 text-center">
            <h3 className="text-3xl font-bold text-gradient mb-4">
              {selectedMode.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </h3>
            <p className="text-gray-300 mb-8">
              Ready to begin your coaching session
            </p>
            <button
              onClick={() => {
                setIsStarting(true);
                setTimeout(() => {
                  router.push(`/session/${selectedMode}`);
                }, 2000);
              }}
              className="premium-button flex items-center space-x-2 mx-auto"
            >
              <span>Start Session</span>
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </motion.div>
      )}

      {/* Footer */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 1 }}
        className="absolute bottom-8 text-center text-gray-400 text-sm relative z-10"
      >
        <p>Powered by AI • Built for Excellence</p>
      </motion.div>
    </main>
  );
}
