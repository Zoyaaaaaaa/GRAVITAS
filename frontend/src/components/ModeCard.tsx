'use client';

import { motion } from 'framer-motion';
import { Mode } from '@/types';
import { BookOpen, Brain, Scale, Briefcase, Crown, Zap, MessageSquare, Clock, RefreshCw, Building, AlertTriangle, Sparkles, User } from 'lucide-react';

interface ModeCardProps {
  mode: Mode;
  title: string;
  description: string;
  icon: React.ReactNode;
  onSelect: (mode: Mode) => void;
  delay: number;
}

const modeIcons: Record<Mode, React.ReactNode> = {
  storytelling: <BookOpen className="w-8 h-8" />,
  critical_thinking: <Brain className="w-8 h-8" />,
  negotiation: <Scale className="w-8 h-8" />,
  interview: <Briefcase className="w-8 h-8" />,
  executive_presence: <Crown className="w-8 h-8" />,
  devils_advocate: <Zap className="w-8 h-8" />,
  persuasion_lab: <MessageSquare className="w-8 h-8" />,
  real_world_scenario: <Clock className="w-8 h-8" />,
  rapid_response: <RefreshCw className="w-8 h-8" />,
  story_to_strategy: <Building className="w-8 h-8" />,
  high_pressure: <AlertTriangle className="w-8 h-8" />,
  answer_architect: <Sparkles className="w-8 h-8" />,
  professional_identity: <User className="w-8 h-8" />,
};

const modeDescriptions: Record<Mode, string> = {
  storytelling: 'Transform ideas into compelling narratives that stick',
  critical_thinking: 'Strengthen reasoning and argumentation skills',
  negotiation: 'Master strategic negotiation and value creation',
  interview: 'Practice high-pressure interview scenarios',
  executive_presence: 'Develop commanding leadership communication',
  devils_advocate: 'Challenge your thinking with rigorous debate',
  persuasion_lab: 'Learn to communicate ideas through different lenses',
  real_world_scenario: 'Simulate authentic professional situations',
  rapid_response: 'Train quick thinking under pressure',
  story_to_strategy: 'Build a strategic story bank from your experiences',
  high_pressure: 'Handle difficult conversations with confidence',
  answer_architect: 'Structure perfect answers to tough questions',
  professional_identity: 'Craft a coherent professional narrative',
};

const modeTitles: Record<Mode, string> = {
  storytelling: 'Storytelling',
  critical_thinking: 'Critical Thinking',
  negotiation: 'Negotiation',
  interview: 'Interview',
  executive_presence: 'Executive Presence',
  devils_advocate: "Devil's Advocate",
  persuasion_lab: 'Persuasion Lab',
  real_world_scenario: 'Real-World Scenario',
  rapid_response: 'Rapid Response',
  story_to_strategy: 'Story to Strategy',
  high_pressure: 'High Pressure',
  answer_architect: 'Answer Architect',
  professional_identity: 'Professional Identity',
};

export default function ModeCard({ mode, onSelect, delay }: Omit<ModeCardProps, 'title' | 'description' | 'icon'>) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      whileHover={{ scale: 1.05, y: -5 }}
      whileTap={{ scale: 0.95 }}
      onClick={() => onSelect(mode)}
      className="mode-card group"
    >
      <div className="flex flex-col items-center text-center space-y-4">
        <div className="p-4 rounded-full bg-gradient-to-br from-primary-500/20 to-accent-500/20 group-hover:from-primary-500/40 group-hover:to-accent-500/40 transition-all duration-300">
          <div className="text-gradient">
            {modeIcons[mode]}
          </div>
        </div>
        <h3 className="text-xl font-bold text-white group-hover:text-gradient transition-all duration-300">
          {modeTitles[mode]}
        </h3>
        <p className="text-sm text-gray-300 group-hover:text-white transition-all duration-300">
          {modeDescriptions[mode]}
        </p>
      </div>
    </motion.div>
  );
}
