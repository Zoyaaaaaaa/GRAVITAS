'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import VoiceInterface, { TranscriptMsg } from '@/components/VoiceInterface';
import { Mode } from '@/types';
import { ArrowLeft, Clock, Target, ScrollText, Sparkles, SendHorizonal, Crown } from 'lucide-react';

interface SessionPageProps {
  params: {
    mode: Mode;
  };
}

interface ChatMessage {
  id: string;
  role: 'agent' | 'user' | 'system';
  text: string;
  ts: Date;
}

interface SessionBrief {
  objective: string;
  context: string;
  opening: string;
  focus: string[];
  ready: boolean;
}

const MODE_META: Record<string, { title: string; focus: string[]; brief: string }> = {
  storytelling: { title: 'Storytelling', focus: ['Narrative arc', 'Presence', 'Emotional impact'], brief: 'Shape a compelling narrative with a clear arc — hook, tension, resolution.' },
  critical_thinking: { title: 'Critical Thinking', focus: ['Assumptions', 'Evidence', 'Counterarguments'], brief: 'Reason rigorously: surface assumptions, weigh evidence, steelman objections.' },
  negotiation: { title: 'Negotiation', focus: ['Anchoring', 'Concessions', 'Leverage'], brief: 'Anchor with confidence, trade concessions deliberately, read leverage.' },
  interview: { title: 'Interview', focus: ['Structure', 'Specificity', 'Credibility'], brief: 'Answer with structure and proof — concise stories that land your value.' },
  executive_presence: { title: 'Executive Presence', focus: ['Composure', 'Clarity', 'Authority'], brief: 'Command the room: calm pace, decisive language, quiet authority.' },
  devils_advocate: { title: "Devil's Advocate", focus: ['Challenge', 'Logic', 'Composure'], brief: 'Defend your thinking under rigorous, good-faith challenge.' },
  persuasion_lab: { title: 'Persuasion Lab', focus: ['Framing', 'Audience', 'Call to action'], brief: 'Frame the message for the audience and close with a clear ask.' },
  persuasion: { title: 'Persuasion Lab', focus: ['Framing', 'Audience', 'Call to action'], brief: 'Frame the message for the audience and close with a clear ask.' },
  real_world_scenario: { title: 'Real-World Scenario', focus: ['Adaptability', 'Judgment', 'Tone'], brief: 'Navigate an authentic professional situation with poise.' },
  real_world: { title: 'Real-World Scenario', focus: ['Adaptability', 'Judgment', 'Tone'], brief: 'Navigate an authentic professional situation with poise.' },
  rapid_response: { title: 'Rapid Response', focus: ['Composure', 'Conciseness', 'Structure'], brief: 'Think fast and answer cleanly under time pressure.' },
  story_to_strategy: { title: 'Story to Strategy', focus: ['Insight', 'Narrative', 'Action'], brief: 'Turn experience into a reusable strategic story bank.' },
  high_pressure: { title: 'High Pressure', focus: ['Composure', 'Boundaries', 'Clarity'], brief: 'Hold your ground in difficult conversations with grace.' },
  answer_architect: { title: 'Answer Architect', focus: ['Structure', 'Precision', 'Impact'], brief: 'Architect the perfect answer — structured, precise, memorable.' },
  professional_identity: { title: 'Professional Identity', focus: ['Coherence', 'Credibility', 'Narrative'], brief: 'Craft a coherent professional narrative that carries weight.' },
};

function toBackendMode(mode: string): string | null {
  const map: Record<string, string> = {
    persuasion_lab: 'persuasion',
    real_world_scenario: 'real_world',
  };
  const m = map[mode] ?? mode;
  const valid = ['storytelling','critical_thinking','negotiation','interview','executive_presence','devils_advocate','persuasion','real_world','rapid_response','story_to_strategy','high_pressure','answer_architect','professional_identity'];
  return valid.includes(m) ? m : null;
}

function formatTime(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatClock(d: Date) {
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

let msgSeq = 0;
const nextId = () => `m-${Date.now()}-${msgSeq++}`;

export default function SessionPage({ params }: SessionPageProps) {
  const router = useRouter();
  const mode = params.mode;
  const meta = MODE_META[mode] ?? { title: mode.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()), focus: ['Clarity', 'Confidence', 'Presence'], brief: 'Practice clear and compelling communication.' };

  const [isSessionActive, setIsSessionActive] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [interim, setInterim] = useState<{ role: 'agent' | 'user'; text: string } | null>(null);
  const [composer, setComposer] = useState('');
  const [sending, setSending] = useState(false);
  const [brief, setBrief] = useState<SessionBrief>({ objective: meta.brief, context: '', opening: '', focus: meta.focus, ready: false });
  const [voiceState, setVoiceState] = useState<'connecting' | 'live' | 'offline'>('connecting');

  const userIdRef = useRef(`web-user-${Date.now()}`);
  const restSessionIdRef = useRef<string | null>(null);
  const seenSegmentsRef = useRef<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Session timer
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime((p) => p + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  // Auto-scroll conversation
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, interim]);

  // Greet immediately so the screen is never empty, then prepare full briefing.
  useEffect(() => {
    const greet: ChatMessage = {
      id: nextId(),
      role: 'agent',
      text: `Good evening — welcome to your ${meta.title} session. I am Gravitas, your coach. Speak whenever you're ready; I'm connecting your voice now and preparing today's scenario.`,
      ts: new Date(),
    };
    setMessages([greet]);
    setInterim({ role: 'agent', text: 'Preparing your session…' });

    let cancelled = false;
    (async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL;
        const backendMode = toBackendMode(mode);
        if (!apiUrl || !backendMode) {
          if (!cancelled) setInterim(null);
          return;
        }
        const userId = userIdRef.current;
        const startRes = await fetch(`${apiUrl}/session/start?user_id=${encodeURIComponent(userId)}&mode=${encodeURIComponent(backendMode)}`, { method: 'POST' });
        if (!startRes.ok) throw new Error(`start: ${startRes.status}`);
        const startData = await startRes.json();
        restSessionIdRef.current = startData.session_id;

        const scRes = await fetch(`${apiUrl}/session/${startData.session_id}/scenario`, { method: 'POST' });
        if (!scRes.ok) throw new Error(`scenario: ${scRes.status}`);
        const sc = await scRes.json();
        if (cancelled) return;
        setBrief({
          objective: sc.context || meta.brief,
          context: sc.context || '',
          opening: sc.opening_move || '',
          focus: meta.focus,
          ready: true,
        });
        setInterim(null);
        if (sc.opening_move) {
          setMessages((prev) => [...prev, { id: nextId(), role: 'agent', text: sc.opening_move, ts: new Date() }]);
        }
      } catch (e) {
        console.warn('Session briefing unavailable, voice continues:', e);
        if (!cancelled) {
          setBrief((b) => ({ ...b, ready: true }));
          setInterim(null);
        }
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const appendMessage = useCallback((role: 'agent' | 'user' | 'system', text: string) => {
    const clean = text.trim();
    if (!clean) return;
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.role === role && last.text === clean) return prev; // dedupe repeats
      return [...prev, { id: nextId(), role, text: clean, ts: new Date() }];
    });
  }, []);

  const handleTranscript = useCallback((msg: TranscriptMsg) => {
    if (!msg.final) {
      setInterim({ role: msg.role, text: msg.text });
      return;
    }
    if (msg.segmentId) {
      if (seenSegmentsRef.current.has(msg.segmentId)) return;
      seenSegmentsRef.current.add(msg.segmentId);
    }
    setInterim(null);
    if (msg.role === 'agent') setVoiceState('live');
    appendMessage(msg.role, msg.text);
  }, [appendMessage]);

  const handleToggleMute = useCallback(() => {}, []);

  const handleEndSession = useCallback(() => {
    setIsSessionActive(false);
    setInterim(null);
  }, []);

  const sendComposer = useCallback(async () => {
    const text = composer.trim();
    if (!text || sending) return;
    setComposer('');
    appendMessage('user', text);
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    const sid = restSessionIdRef.current;
    if (!apiUrl || !sid) return; // voice remains the primary channel
    setSending(true);
    try {
      const res = await fetch(`${apiUrl}/session/${encodeURIComponent(sid)}/turn?user_input=${encodeURIComponent(text)}`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        if (data.response) appendMessage('agent', String(data.response));
      }
    } catch (e) {
      console.warn('Text turn failed, voice continues:', e);
    } finally {
      setSending(false);
    }
  }, [composer, sending, appendMessage]);

  return (
    <div className="min-h-screen relative overflow-hidden bg-[#0B0B0F] text-[#F5F1E8]">
      {/* Ambient elegance: soft vignette + champagne glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[500px] rounded-full blur-3xl opacity-25" style={{ background: 'radial-gradient(closest-side, #C9A96A55, transparent)' }} />
        <div className="absolute bottom-0 inset-x-0 h-64 opacity-20" style={{ background: 'linear-gradient(to top, #C9A96A22, transparent)' }} />
      </div>
      <div className="absolute inset-0 pointer-events-none opacity-[0.35]" style={{ backgroundImage: 'radial-gradient(#ffffff08 1px, transparent 1px)', backgroundSize: '26px 26px' }} />

      <div className="relative z-10 max-w-6xl mx-auto px-6 md:px-10 py-8">
        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between border-b border-white/10 pb-6 mb-8"
        >
          <button onClick={() => router.push('/')} className="group flex items-center gap-2 text-sm tracking-[0.18em] uppercase text-white/50 hover:text-[#E8D9B8] transition-colors">
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            <span>Atelier</span>
          </button>
          <div className="text-center">
            <p className="text-[11px] tracking-[0.35em] uppercase text-[#C9A96A]">Gravitas · Private Coaching</p>
            <h1 className="font-serif text-3xl md:text-4xl mt-1 text-[#F5F1E8]">{meta.title}</h1>
          </div>
          <div className="flex items-center gap-2 text-sm text-white/60 tabular-nums">
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs tracking-widest uppercase ${voiceState === 'live' ? 'border-emerald-300/30 text-emerald-200' : 'border-[#C9A96A]/40 text-[#E8D9B8]'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${voiceState === 'live' ? 'bg-emerald-300 animate-pulse' : 'bg-[#C9A96A] animate-pulse'}`} />
              {voiceState === 'live' ? 'Live' : 'Connecting'}
            </span>
            <span className="inline-flex items-center gap-1.5 text-white/50"><Clock className="w-4 h-4" />{formatTime(currentTime)}</span>
          </div>
        </motion.header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Brief rail */}
          <motion.aside
            initial={{ opacity: 0, x: -18 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15 }}
            className="space-y-6"
          >
            <div className="rounded-2xl border border-[#C9A96A]/25 bg-gradient-to-b from-[#C9A96A]/10 to-transparent p-6">
              <div className="flex items-center gap-2 text-[#C9A96A] text-[11px] tracking-[0.3em] uppercase"><Crown className="w-4 h-4" /> Session Brief</div>
              <p className="font-serif text-xl leading-relaxed mt-3 text-[#F5F1E8]">{brief.objective}</p>
              {brief.context && brief.context !== brief.objective && (
                <p className="text-sm leading-relaxed text-white/55 mt-3">{brief.context}</p>
              )}
              {!brief.ready && <p className="text-xs text-white/40 mt-3 italic">Preparing your scenario…</p>}
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
              <div className="flex items-center gap-2 text-[11px] tracking-[0.3em] uppercase text-white/45"><Target className="w-4 h-4 text-[#C9A96A]" /> Tonight's Focus</div>
              <ul className="mt-4 space-y-2.5">
                {brief.focus.map((f) => (
                  <li key={f} className="flex items-center gap-3 text-sm text-white/75">
                    <span className="w-1 h-1 rounded-full bg-[#C9A96A]" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
              <div className="flex items-center gap-2 text-[11px] tracking-[0.3em] uppercase text-white/45"><ScrollText className="w-4 h-4 text-[#C9A96A]" /> Etiquette</div>
              <p className="text-sm leading-relaxed text-white/55 mt-3">Speak naturally — your words appear below as live captions. You may also write; your coach replies in kind.</p>
            </div>
          </motion.aside>

          {/* Conversation */}
          <motion.section
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="lg:col-span-2 rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur flex flex-col overflow-hidden"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
              <div className="flex items-center gap-2 text-[11px] tracking-[0.3em] uppercase text-white/45"><Sparkles className="w-4 h-4 text-[#C9A96A]" /> Conversation</div>
              <div className="text-xs text-white/35 font-serif italic">with your Gravitas coach</div>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-6 space-y-5 min-h-[380px] max-h-[520px] elegant-scroll">
              <AnimatePresence initial={false}>
                {messages.map((m) => (
                  <motion.div
                    key={m.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex items-end gap-3 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    {m.role !== 'user' && (
                      <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 border border-[#C9A96A]/50 bg-gradient-to-br from-[#C9A96A]/30 to-transparent">
                        <span className="font-serif text-[#E8D9B8] text-sm">G</span>
                      </div>
                    )}
                    <div className={`max-w-[80%] ${m.role === 'user' ? 'items-end' : 'items-start'} flex flex-col`}>
                      <div className={`px-5 py-3.5 leading-relaxed text-[15px] ${
                        m.role === 'user'
                          ? 'rounded-2xl rounded-br-sm bg-[#C9A96A] text-[#0B0B0F] font-medium'
                          : 'rounded-2xl rounded-bl-sm border border-white/10 bg-white/[0.05] text-[#F5F1E8] font-serif'
                      }`}>
                        {m.text}
                      </div>
                      <span className="text-[11px] text-white/30 mt-1.5 tracking-wide">
                        {m.role === 'user' ? 'You' : 'Gravitas'} · {formatClock(m.ts)}
                      </span>
                    </div>
                    {m.role === 'user' && (
                      <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 border border-white/15 bg-white/5">
                        <span className="text-xs text-white/70">You</span>
                      </div>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>

              {interim && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 text-sm text-white/45 italic font-serif">
                  <span className="flex gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#C9A96A] animate-bounce" />
                    <span className="w-1.5 h-1.5 rounded-full bg-[#C9A96A] animate-bounce" style={{ animationDelay: '0.15s' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-[#C9A96A] animate-bounce" style={{ animationDelay: '0.3s' }} />
                  </span>
                  {interim.text}
                </motion.div>
              )}

              {!isSessionActive && (
                <div className="text-center border-t border-white/10 pt-6">
                  <p className="font-serif text-xl text-[#E8D9B8]">Session concluded with grace.</p>
                  <p className="text-sm text-white/45 mt-1">Return to the atelier whenever you're ready to continue.</p>
                  <button onClick={() => router.push('/')} className="mt-4 text-xs tracking-[0.25em] uppercase border border-[#C9A96A]/40 text-[#E8D9B8] rounded-full px-6 py-2.5 hover:bg-[#C9A96A]/10 transition-colors">
                    Return to Atelier
                  </button>
                </div>
              )}
            </div>

            {/* Composer */}
            <div className="border-t border-white/10 p-4 bg-black/20">
              <div className="flex items-center gap-3">
                <input
                  value={composer}
                  onChange={(e) => setComposer(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') sendComposer(); }}
                  type="text"
                  placeholder="Write to your coach — or simply speak…"
                  disabled={!isSessionActive}
                  className="flex-1 bg-white/[0.04] border border-white/10 rounded-full px-5 py-3 text-[15px] text-[#F5F1E8] placeholder-white/30 focus:outline-none focus:border-[#C9A96A]/60 transition-colors disabled:opacity-40"
                />
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={sendComposer}
                  disabled={!isSessionActive || !composer.trim() || sending}
                  className="w-11 h-11 rounded-full bg-[#C9A96A] text-[#0B0B0F] flex items-center justify-center hover:bg-[#E8D9B8] transition-colors disabled:opacity-30"
                  aria-label="Send message"
                >
                  <SendHorizonal className="w-5 h-5" />
                </motion.button>
              </div>
            </div>
          </motion.section>
        </div>
      </div>

      {/* Voice controls */}
      {isSessionActive && (
        <VoiceInterface
          isSessionActive={isSessionActive}
          onToggleMute={handleToggleMute}
          onEndSession={handleEndSession}
          mode={mode}
          onTranscript={handleTranscript}
        />
      )}
    </div>
  );
}
