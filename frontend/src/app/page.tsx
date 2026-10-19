'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import ModeCard from '@/components/ModeCard';
import { Mode } from '@/types';
import { getUserId, listSessions, loadProfile, SessionSummary, PersistedProfile } from '@/utils/sessionStore';
import { Mic, ArrowRight, Crown, History, User } from 'lucide-react';

export default function Home() {
  const router = useRouter();
  const [isStarting, setIsStarting] = useState<Mode | null>(null);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [profile, setProfile] = useState<PersistedProfile | null>(null);

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

  useEffect(() => {
    getUserId(); // ensure stable identity exists
    setSessions(listSessions());
    setProfile(loadProfile());
  }, []);

  const progressFor = (mode: Mode) => {
    const s = sessions.find((x) => x.mode === mode);
    return s ? { messages: s.messageCount, status: s.status } : null;
  };

  const handleModeSelect = (mode: Mode) => {
    setIsStarting(mode);
    setTimeout(() => {
      router.push(`/session/${mode}`);
    }, 1400);
  };

  const timeAgo = (ts: number) => {
    const mins = Math.floor((Date.now() - ts) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  const prettyMode = (m: string) => m.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());

  return (
    <main className="min-h-screen relative overflow-hidden bg-[#0B0B0F] text-[#F5F1E8]">
      {/* Ambient */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-48 left-1/2 -translate-x-1/2 w-[1000px] h-[560px] rounded-full blur-3xl opacity-25" style={{ background: 'radial-gradient(closest-side, #C9A96A55, transparent)' }} />
        <div className="absolute bottom-0 inset-x-0 h-72 opacity-20" style={{ background: 'linear-gradient(to top, #C9A96A22, transparent)' }} />
      </div>
      <div className="absolute inset-0 pointer-events-none opacity-[0.35]" style={{ backgroundImage: 'radial-gradient(#ffffff08 1px, transparent 1px)', backgroundSize: '26px 26px' }} />

      <div className="relative z-10 max-w-6xl mx-auto px-6 md:px-10 py-10">
        {/* Top bar: brand + profile */}
        <div className="flex items-center justify-between border-b border-white/10 pb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full border border-[#C9A96A]/50 bg-[#C9A96A]/10 flex items-center justify-center">
              <Crown className="w-5 h-5 text-[#E8D9B8]" />
            </div>
            <div>
              <p className="text-[11px] tracking-[0.35em] uppercase text-[#C9A96A]">Gravitas</p>
              <p className="text-xs text-white/40 tracking-[0.2em] uppercase">Private Coaching Atelier</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-full border border-white/10 bg-white/[0.03] pl-2 pr-4 py-1.5">
            <div className="w-8 h-8 rounded-full border border-[#C9A96A]/40 bg-[#C9A96A]/10 flex items-center justify-center">
              <User className="w-4 h-4 text-[#E8D9B8]" />
            </div>
            <div className="text-left">
              <p className="text-sm text-[#F5F1E8] leading-none">{profile?.displayName ?? 'Welcome'}</p>
              <p className="text-[10px] tracking-[0.25em] uppercase text-[#C9A96A] mt-1">{profile ? `${profile.level} · ${profile.totalSessions} sessions` : 'Your private studio'}</p>
            </div>
          </div>
        </div>

        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="text-center mt-12 mb-10"
        >
          <p className="text-[11px] tracking-[0.4em] uppercase text-[#C9A96A]">Elite Communication Coaching</p>
          <h1 className="font-serif text-5xl md:text-6xl mt-3">Speak with weight.</h1>
          <p className="text-white/50 max-w-xl mx-auto mt-4 leading-relaxed">
            Private coaching across story, negotiation, and presence. Your progress is kept —
            leave anytime, return later, and continue exactly where you left off.
          </p>
        </motion.div>

        {/* Continue your journey */}
        {sessions.length > 0 && !isStarting && (
          <motion.section
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="mb-12"
          >
            <div className="flex items-center gap-2 text-[11px] tracking-[0.3em] uppercase text-white/45 mb-4">
              <History className="w-4 h-4 text-[#C9A96A]" /> Continue your journey
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {sessions.slice(0, 4).map((s) => (
                <button
                  key={s.mode}
                  onClick={() => handleModeSelect(s.mode as Mode)}
                  className="text-left rounded-2xl border border-[#C9A96A]/30 bg-gradient-to-b from-[#C9A96A]/10 to-transparent p-5 hover:border-[#C9A96A]/60 transition-colors group"
                >
                  <div className="flex items-center justify-between">
                    <p className="font-serif text-xl">{prettyMode(s.mode)}</p>
                    <span className="text-[11px] text-white/40">{timeAgo(s.updatedAt)} · {s.messageCount} exchanges</span>
                  </div>
                  {s.preview && <p className="text-sm text-white/55 mt-2 line-clamp-2 font-serif italic">“{s.preview}…”</p>}
                  <span className="inline-block mt-3 text-[11px] tracking-[0.25em] uppercase text-[#C9A96A] group-hover:translate-x-1 transition-transform">
                    {s.status === 'active' ? 'Resume session →' : 'Revisit session →'}
                  </span>
                </button>
              ))}
            </div>
          </motion.section>
        )}

        {/* Loading state */}
        {isStarting ? (
          <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-10">
            <div className="inline-block rounded-2xl border border-[#C9A96A]/30 bg-white/[0.03] px-14 py-12">
              <div className="flex flex-col items-center space-y-5">
                <div className="relative">
                  <div className="absolute inset-0 bg-[#C9A96A]/40 rounded-full blur-xl animate-pulse" />
                  <Mic className="w-12 h-12 text-[#E8D9B8] relative z-10" />
                </div>
                <h3 className="font-serif text-2xl">Preparing your {prettyMode(isStarting)}</h3>
                <p className="text-sm text-white/50">Restoring your history and setting the room…</p>
                <div className="w-56 h-1 bg-white/10 rounded-full overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: '100%' }} transition={{ duration: 1.4 }} className="h-full bg-[#C9A96A]" />
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }}>
            <h2 className="text-[11px] tracking-[0.35em] uppercase text-center mb-6 text-white/45">
              Choose your arena
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {modes.map((mode, index) => (
                <ModeCard
                  key={mode}
                  mode={mode}
                  onSelect={handleModeSelect}
                  delay={Math.min(index * 0.06, 0.5)}
                  progress={progressFor(mode)}
                />
              ))}
            </div>
          </motion.div>
        )}

        <footer className="text-center text-white/30 text-xs mt-14 tracking-[0.2em] uppercase">
          Gravitas · Crafted for distinction
        </footer>
      </div>
    </main>
  );
}
