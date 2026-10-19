'use client';

import { motion } from 'framer-motion';
import { Mode } from '@/types';
import { BookOpen, Brain, Scale, Briefcase, Crown, Zap, MessageSquare, Clock, RefreshCw, Building, AlertTriangle, Sparkles, User, History } from 'lucide-react';

interface ModeCardProps {
  mode: Mode;
  onSelect: (mode: Mode) => void;
  delay: number;
  progress?: { messages: number; status: 'active' | 'ended' } | null;
}

const modeIcons: Record<Mode, React.ReactNode> = {
  storytelling: <BookOpen className="w-6 h-6" />,
  critical_thinking: <Brain className="w-6 h-6" />,
  negotiation: <Scale className="w-6 h-6" />,
  interview: <Briefcase className="w-6 h-6" />,
  executive_presence: <Crown className="w-6 h-6" />,
  devils_advocate: <Zap className="w-6 h-6" />,
  persuasion_lab: <MessageSquare className="w-6 h-6" />,
  real_world_scenario: <Clock className="w-6 h-6" />,
  rapid_response: <RefreshCw className="w-6 h-6" />,
  story_to_strategy: <Building className="w-6 h-6" />,
  high_pressure: <AlertTriangle className="w-6 h-6" />,
  answer_architect: <Sparkles className="w-6 h-6" />,
  professional_identity: <User className="w-6 h-6" />,
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

export default function ModeCard({ mode, onSelect, delay, progress }: ModeCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => onSelect(mode)}
      className="group cursor-pointer rounded-2xl border border-white/10 bg-white/[0.03] p-6 hover:border-[#C9A96A]/50 hover:bg-[#C9A96A]/[0.06] transition-all duration-300 relative overflow-hidden"
    >
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[#C9A96A]/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      {progress && progress.messages > 0 && (
        <span className="absolute top-4 right-4 inline-flex items-center gap-1 text-[10px] tracking-[0.2em] uppercase text-[#E8D9B8] border border-[#C9A96A]/40 rounded-full px-2.5 py-1 bg-[#C9A96A]/10">
          <History className="w-3 h-3" />
          {progress.status === 'active' ? `Continue · ${progress.messages}` : `${progress.messages} msgs`}
        </span>
      )}
      <div className="flex flex-col items-start space-y-4">
        <div className="p-3 rounded-xl border border-[#C9A96A]/30 bg-[#C9A96A]/10 text-[#E8D9B8] group-hover:bg-[#C9A96A]/20 transition-colors">
          {modeIcons[mode]}
        </div>
        <div>
          <h3 className="font-serif text-xl text-[#F5F1E8]">
            {modeTitles[mode]}
          </h3>
          <p className="text-sm text-white/50 mt-1.5 leading-relaxed">
            {modeDescriptions[mode]}
          </p>
        </div>
        <span className="text-[11px] tracking-[0.25em] uppercase text-[#C9A96A] opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all">
          {progress && progress.messages > 0 ? 'Resume session →' : 'Begin session →'}
        </span>
      </div>
    </motion.div>
  );
}
