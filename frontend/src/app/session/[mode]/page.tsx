'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import VoiceInterface, { TranscriptMsg } from '@/components/VoiceInterface';
import BrowserVoice from '@/components/BrowserVoice';
import { Mode } from '@/types';
import { getUserId, loadSession, saveSession, clearSession, loadProfile, saveProfile, PersistedProfile } from '@/utils/sessionStore';
import { ArrowLeft, Clock, Target, ScrollText, Sparkles, SendHorizonal, Crown, User, RotateCcw, History, Headphones } from 'lucide-react';

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
  const [resumed, setResumed] = useState(false);
  const [profile, setProfile] = useState<PersistedProfile | null>(null);
  // Quota-free fallback when the LiveKit inference gateway is 429-limited
  const [fallbackOn, setFallbackOn] = useState(false);
  const [showFallbackHint, setShowFallbackHint] = useState(false);
  const spokenRef = useRef<Set<string>>(new Set());
  const [, forceSpeakTick] = useState(0);

  const userIdRef = useRef<string>('');
  const restSessionIdRef = useRef<string | null>(null);
  const seenSegmentsRef = useRef<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const bootstrappedRef = useRef(false);

  // Stable identity — same user across reloads so history resumes
  if (!userIdRef.current && typeof window !== 'undefined') {
    userIdRef.current = getUserId();
  }

  // Session timer (persists so a return visit continues the clock)
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime((p) => p + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  // Persist progress continuously (reload / logout / crash-safe)
  useEffect(() => {
    if (!bootstrappedRef.current) return;
    if (messages.length === 0) return;
    saveSession({
      mode,
      restSessionId: restSessionIdRef.current,
      messages: messages.map((m) => ({ id: m.id, role: m.role, text: m.text, ts: m.ts.toISOString() })),
      brief: { ...brief },
      elapsed: currentTime,
      status: isSessionActive ? 'active' : 'ended',
    });
  }, [messages, brief, mode, isSessionActive]);

  // Timer checkpoint every 15s + on tab hide
  useEffect(() => {
    const checkpoint = () => {
      if (!bootstrappedRef.current || messages.length === 0) return;
      saveSession({
        mode,
        restSessionId: restSessionIdRef.current,
        messages: messages.map((m) => ({ id: m.id, role: m.role, text: m.text, ts: m.ts.toISOString() })),
        brief: { ...brief },
        elapsed: currentTime,
        status: isSessionActive ? 'active' : 'ended',
      });
    };
    const id = setInterval(checkpoint, 15000);
    const onHide = () => { if (document.visibilityState === 'hidden') checkpoint(); };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('beforeunload', checkpoint);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onHide); window.removeEventListener('beforeunload', checkpoint); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTime, messages, brief, mode, isSessionActive]);

  // Auto-scroll conversation
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, interim]);

  // Boot: resume previous state if it exists, else greet + prepare briefing.
  // Verifies the stored REST session; keeps the transcript either way.
  useEffect(() => {
    if (bootstrappedRef.current) return;
    bootstrappedRef.current = true;

    const cachedProfile = loadProfile();
    if (cachedProfile) setProfile(cachedProfile);

    const saved = loadSession(mode);
    if (saved && saved.messages.length > 0) {
      setMessages(saved.messages.map((m) => ({ id: m.id, role: m.role, text: m.text, ts: new Date(m.ts) })));
      if (saved.brief) setBrief(saved.brief);
      setCurrentTime(saved.elapsed || 0);
      restSessionIdRef.current = saved.restSessionId;
      setResumed(true);
      if (saved.status === 'ended') {
        // Keep the transcript, but revive live coaching so mic + agent
        // work immediately; the user can still start fresh from the rail.
        setIsSessionActive(true);
        setTimeout(() => {
          setMessages((prev) => [...prev, { id: nextId(), role: 'agent', text: `This session had ended — I've reopened live coaching so we can keep going from where we left off.`, ts: new Date() }]);
        }, 1200);
      }
      setTimeout(() => {
        setMessages((prev) => [...prev, { id: nextId(), role: 'agent', text: `Welcome back — I've kept everything from where we left off in ${meta.title}. ${saved.messages.length} exchanges preserved. Speak whenever you're ready, and we'll continue.`, ts: new Date() }]);
      }, 600);
    } else {
      const greet: ChatMessage = {
        id: nextId(),
        role: 'agent',
        text: `Good evening — welcome to your ${meta.title} session. I am Gravitas, your coach. Speak whenever you're ready; I'm connecting your voice now and preparing today's scenario.`,
        ts: new Date(),
      };
      setMessages([greet]);
      setInterim({ role: 'agent', text: 'Preparing your session…' });
    }

    // Note: no `cancelled` flag here on purpose. React 18 StrictMode runs
    // effects as mount → cleanup → re-run in dev; a cancelled flag would
    // orphan this run (bootstrappedRef blocks the second) and leave the
    // "Preparing…" indicator stuck forever. setState after unmount is a
    // safe no-op in React 18.
    const fetchJson = async (url: string, init?: RequestInit, timeoutMs = 12000) => {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), timeoutMs);
      try {
        const res = await fetch(url, { ...init, signal: ctrl.signal });
        return res;
      } finally {
        clearTimeout(timer);
      }
    };
    (async () => {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      const userId = userIdRef.current || getUserId();
      userIdRef.current = userId;

      // Profile (cached first, refreshed quietly)
      try {
        if (apiUrl) {
          const [profRes, weakRes] = await Promise.all([
            fetchJson(`${apiUrl}/user/${encodeURIComponent(userId)}/profile`),
            fetchJson(`${apiUrl}/user/${encodeURIComponent(userId)}/weaknesses`),
          ]);
          if (profRes.ok || weakRes.ok) {
            const prev = loadProfile();
            const totalSessions = prev?.totalSessions ?? 0;
            const totalMinutes = prev?.totalMinutes ?? 0;
            let strengths: string[] = prev?.strengths ?? [];
            let focusNext: string[] = meta.focus;
            if (weakRes.ok) {
              try {
                const w = await weakRes.json();
                if (Array.isArray(w.weaknesses) && w.weaknesses.length > 0) {
                  focusNext = w.weaknesses.slice(0, 3).map((x: { skill?: string; category?: string }) =>
                    String(x.skill ?? x.category ?? '').replace(/_/g, ' ')).filter(Boolean);
                }
              } catch { /* keep defaults */ }
            }
            const next: PersistedProfile = {
              displayName: prev?.displayName ?? 'Member',
              level: totalSessions >= 10 ? 'Principal' : totalSessions >= 4 ? 'Senior' : 'Rising',
              totalSessions, totalMinutes, strengths, focusNext,
              updatedAt: Date.now(),
            };
            setProfile(next);
            saveProfile(next);
          }
        }
      } catch { /* profile is enhancement-only */ }

      // REST session: verify stored one, else start fresh (transcript preserved)
      try {
        const backendMode = toBackendMode(mode);
        if (!apiUrl || !backendMode) {
          setBrief((b) => ({ ...b, ready: true })); setInterim(null);
          return;
        }
        let sid = restSessionIdRef.current;
        if (sid) {
          try {
            const check = await fetchJson(`${apiUrl}/session/${encodeURIComponent(sid)}`, undefined, 8000);
            if (!check.ok) {
              // Session doesn't exist on backend, clear it
              sid = null;
              restSessionIdRef.current = null;
              clearSession(mode);
            }
          } catch { sid = null; }
        }
        if (!sid) {
          const startRes = await fetchJson(`${apiUrl}/session/start?user_id=${encodeURIComponent(userId)}&mode=${encodeURIComponent(backendMode)}`, { method: 'POST' });
          if (!startRes.ok) throw new Error(`start: ${startRes.status}`);
          const startData = await startRes.json();
          sid = startData.session_id;
          restSessionIdRef.current = sid;

          const scRes = await fetchJson(`${apiUrl}/session/${sid}/scenario`, { method: 'POST' });
          if (!scRes.ok) throw new Error(`scenario: ${scRes.status}`);
          const sc = await scRes.json();
          setBrief({
            objective: sc.context || meta.brief,
            context: sc.context || '',
            opening: sc.opening_move || '',
            focus: meta.focus,
            ready: true,
          });
          setInterim(null);
          // Only speak the opening for brand-new sessions, never over a resume
          if (sc.opening_move && !saved) {
            setMessages((prev) => [...prev, { id: nextId(), role: 'agent', text: sc.opening_move, ts: new Date() }]);
          }
        } else {
          restSessionIdRef.current = sid;
          setBrief((b) => ({ ...b, ready: true })); setInterim(null);
        }
      } catch (e) {
        console.warn('Session briefing unavailable, voice continues:', e);
        setBrief((b) => ({ ...b, ready: true }));
        setInterim(null);
      }
    })();
    // No cleanup flag — see note above (StrictMode-safe by design).
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
    setProfile((prev) => {
      const base: PersistedProfile = prev ?? { displayName: 'Member', level: 'Rising', totalSessions: 0, totalMinutes: 0, strengths: [], focusNext: meta.focus, updatedAt: Date.now() };
      const next: PersistedProfile = {
        ...base,
        totalSessions: base.totalSessions + 1,
        totalMinutes: base.totalMinutes + Math.round(currentTime / 60),
        level: base.totalSessions + 1 >= 10 ? 'Principal' : base.totalSessions + 1 >= 4 ? 'Senior' : 'Rising',
      };
      saveProfile(next);
      return next;
    });
  }, [currentTime, meta.focus]);

  const handleFreshStart = useCallback(() => {
    clearSession(mode);
    window.location.reload();
  }, [mode]);

  const sendText = useCallback(async (raw: string) => {
    const text = raw.trim();
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
  }, [sending, appendMessage]);

  const sendComposer = useCallback(async () => {
    await sendText(composer);
  }, [composer, sendText]);

  // Suggest the quota-free fallback if the LiveKit agent stays silent
  const voiceStateRef = useRef(voiceState);
  voiceStateRef.current = voiceState;
  useEffect(() => {
    const t = setTimeout(() => {
      if (voiceStateRef.current !== 'live') setShowFallbackHint(true);
    }, 25000);
    return () => clearTimeout(t);
  }, []);

  // Latest unspoken agent message → vocalized once by the fallback
  const pendingSpeak = (() => {
    if (!fallbackOn) return null;
    const last = [...messages].reverse().find((m) => m.role === 'agent' && !spokenRef.current.has(m.id));
    return last ? { id: last.id, text: last.text } : null;
  })();

  const handleSpoken = useCallback((id: string) => {
    spokenRef.current.add(id);
    forceSpeakTick((t) => t + 1);
  }, []);

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
            {resumed && (
              <p className="inline-flex items-center gap-1.5 mt-2 text-[11px] tracking-[0.25em] uppercase text-[#E8D9B8]/80 border border-[#C9A96A]/30 rounded-full px-3 py-1">
                <History className="w-3.5 h-3.5" /> Resumed · continues where you left off
              </p>
            )}
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
              <button onClick={handleFreshStart} className="mt-4 inline-flex items-center gap-2 text-[11px] tracking-[0.25em] uppercase text-white/40 hover:text-[#E8D9B8] transition-colors">
                <RotateCcw className="w-3.5 h-3.5" /> Start fresh
              </button>
            </div>

            {/* Profile */}
            <div className="rounded-2xl border border-[#C9A96A]/25 bg-gradient-to-b from-[#C9A96A]/10 to-transparent p-6">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full border border-[#C9A96A]/50 bg-[#C9A96A]/15 flex items-center justify-center">
                  <User className="w-5 h-5 text-[#E8D9B8]" />
                </div>
                <div>
                  <p className="font-serif text-lg text-[#F5F1E8]">{profile?.displayName ?? 'Member'}</p>
                  <p className="text-[11px] tracking-[0.25em] uppercase text-[#C9A96A]">{profile?.level ?? 'Rising'} · {profile?.totalSessions ?? 0} sessions</p>
                </div>
              </div>
              {profile && profile.focusNext.length > 0 && (
                <div className="mt-4">
                  <p className="text-[11px] tracking-[0.3em] uppercase text-white/45">Focus next</p>
                  <ul className="mt-2 space-y-1.5">
                    {profile.focusNext.slice(0, 3).map((f) => (
                      <li key={f} className="text-sm text-white/70 capitalize">· {f}</li>
                    ))}
                  </ul>
                </div>
              )}
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

            {showFallbackHint && !fallbackOn && voiceState !== 'live' && (
              <div className="mx-6 mt-4 rounded-xl border border-[#C9A96A]/40 bg-[#C9A96A]/10 px-4 py-3 flex items-center gap-3">
                <Headphones className="w-4 h-4 text-[#E8D9B8] flex-shrink-0" />
                <p className="text-xs text-white/70 flex-1">Voice service is quiet (cloud quota). You can continue hands-free right now:</p>
                <button
                  onClick={() => { setFallbackOn(true); setShowFallbackHint(false); }}
                  className="text-[11px] tracking-[0.2em] uppercase bg-[#C9A96A] text-[#0B0B0F] rounded-full px-4 py-1.5 hover:bg-[#E8D9B8] transition-colors flex-shrink-0"
                >
                  Browser voice
                </button>
                <button onClick={() => setShowFallbackHint(false)} className="text-white/40 hover:text-white/70 text-sm flex-shrink-0" aria-label="Dismiss">✕</button>
              </div>
            )}

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

            {/* Quota-free browser voice strip */}
            {fallbackOn && (
              <BrowserVoice
                active={isSessionActive && fallbackOn}
                onUserText={(t) => { void sendText(t); }}
                speak={pendingSpeak}
                onSpoken={handleSpoken}
              />
            )}

            {/* Composer */}
            <div className="border-t border-white/10 p-4 bg-black/20">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setFallbackOn((f) => !f)}
                  title={fallbackOn ? 'Turn off browser voice' : 'Use browser voice (works without cloud quota)'}
                  aria-label="Toggle browser voice"
                  className={`w-11 h-11 rounded-full flex items-center justify-center transition-colors flex-shrink-0 ${
                    fallbackOn
                      ? 'bg-[#C9A96A] text-[#0B0B0F] hover:bg-[#E8D9B8]'
                      : 'border border-white/15 text-white/50 hover:text-[#E8D9B8] hover:border-[#C9A96A]/50'
                  }`}
                >
                  <Headphones className="w-5 h-5" />
                </button>
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
