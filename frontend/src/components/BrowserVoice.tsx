'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Mic, MicOff, Volume2, VolumeX, AlertTriangle } from 'lucide-react';

export type FallbackState = 'idle' | 'listening' | 'unsupported' | 'denied' | 'error';

interface BrowserVoiceProps {
  /** Session live AND fallback mode enabled */
  active: boolean;
  /** Final user transcript → page sends it via REST turn */
  onUserText: (text: string) => void;
  /** Latest unspoken agent message; vocalized once on change */
  speak: { id: string; text: string } | null;
  onSpoken?: (id: string) => void;
  autoSpeak?: boolean;
  onState?: (s: FallbackState) => void;
}

/**
 * Quota-free voice I/O using built-in browser speech services.
 * Used when the LiveKit inference gateway is rate-limited (429):
 * capture via Web Speech API, playback via speechSynthesis,
 * brain via the local REST orchestrator (no gateway involved).
 */
export default function BrowserVoice({ active, onUserText, speak, onSpoken, autoSpeak = true, onState }: BrowserVoiceProps) {
  const [state, setState] = useState<FallbackState>('idle');
  const [interim, setInterim] = useState('');
  const [muted, setMuted] = useState(false);
  const recogRef = useRef<{ stop: () => void; start: () => void; abort?: () => void } | null>(null);
  const stopRef = useRef(false);
  const onUserTextRef = useRef(onUserText);
  onUserTextRef.current = onUserText;
  const onSpokenRef = useRef(onSpoken);
  onSpokenRef.current = onSpoken;

  const setBoth = useCallback((s: FallbackState) => {
    setState(s);
    onState?.(s);
  }, [onState]);

  // ---- capture: Web Speech API ----
  useEffect(() => {
    if (!active) {
      stopRef.current = true;
      try { recogRef.current?.stop(); } catch { /* noop */ }
      recogRef.current = null;
      setBoth('idle');
      setInterim('');
      return;
    }
    const SR = (window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown }).SpeechRecognition
      ?? (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition;
    if (!SR) {
      setBoth('unsupported');
      return;
    }
    stopRef.current = false;
    let recog: {
      continuous: boolean; interimResults: boolean; lang: string;
      onresult: ((e: { results: ArrayLike<{ isFinal: boolean; [i: number]: { transcript: string } }> }) => void) | null;
      onerror: ((e: { error?: string }) => void) | null;
      onend: (() => void) | null;
      start: () => void; stop: () => void;
    };
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recog = new (SR as any)();
    } catch {
      setBoth('error');
      return;
    }
    recog.continuous = true;
    recog.interimResults = true;
    recog.lang = 'en-US';
    recog.onresult = (e) => {
      let interimText = '';
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i];
        const transcript = r[0]?.transcript ?? '';
        if (r.isFinal) {
          const clean = transcript.trim();
          if (clean) {
            setInterim('');
            onUserTextRef.current(clean);
          }
        } else {
          interimText += transcript;
        }
      }
      setInterim(interimText);
    };
    recog.onerror = (e) => {
      if (e?.error === 'not-allowed' || e?.error === 'service-not-allowed') {
        setBoth('denied');
      }
    };
    recog.onend = () => {
      // Chrome auto-stops on silence — restart while still active
      if (!stopRef.current && active) {
        try { recog.start(); } catch { /* already started */ }
      }
    };
    recogRef.current = recog;
    try {
      recog.start();
      setBoth('listening');
    } catch {
      setBoth('error');
    }
    return () => {
      stopRef.current = true;
      try { recog.stop(); } catch { /* noop */ }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  // ---- playback: speechSynthesis ----
  useEffect(() => {
    if (!active || !autoSpeak || muted || !speak) return;
    if (!('speechSynthesis' in window)) return;
    const id = speak.id;
    const text = speak.text.slice(0, 600); // keep spoken replies snappy
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'en-US';
    utter.rate = 1.02;
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find((v) => v.lang.startsWith('en') && /natural|neural|premium|samantha|zira|google uk english female/i.test(v.name))
      ?? voices.find((v) => v.lang.startsWith('en'));
    if (preferred) utter.voice = preferred;
    utter.onend = () => onSpokenRef.current?.(id);
    utter.onerror = () => onSpokenRef.current?.(id);
    window.speechSynthesis.speak(utter);
    // Safety: never leave an id un-acked (would block the next reply)
    const t = setTimeout(() => onSpokenRef.current?.(id), 30000);
    return () => {
      clearTimeout(t);
      window.speechSynthesis.cancel();
    };
  }, [active, autoSpeak, muted, speak]);

  // Warm up voices (Chrome loads them async)
  useEffect(() => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
    }
    return () => { try { window.speechSynthesis?.cancel(); } catch { /* noop */ } };
  }, []);

  if (!active) return null;

  return (
    <div className="border-t border-[#C9A96A]/25 bg-[#C9A96A]/[0.06] px-5 py-3">
      <div className="flex items-center gap-3">
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${state === 'listening' ? 'bg-emerald-300 animate-pulse' : state === 'denied' || state === 'unsupported' || state === 'error' ? 'bg-red-400' : 'bg-[#C9A96A]'}`} />
        <p className="text-xs text-white/60 flex-1 truncate">
          {state === 'listening' && (interim ? <span className="italic font-serif text-white/80">“{interim}”</span> : 'Browser voice live — speak naturally, no quota needed.')}
          {state === 'idle' && 'Starting browser voice…'}
          {state === 'denied' && 'Mic blocked — allow microphone in the address bar, then toggle browser voice off/on.'}
          {state === 'unsupported' && 'This browser has no built-in speech recognition — use Chrome or Edge.'}
          {state === 'error' && 'Speech service hiccup — toggle browser voice off/on.'}
        </p>
        {(state === 'unsupported' || state === 'denied') && <AlertTriangle className="w-4 h-4 text-red-300 flex-shrink-0" />}
        <button
          onClick={() => setMuted((m) => !m)}
          className="p-2 rounded-full border border-white/10 text-white/60 hover:text-[#E8D9B8] hover:border-[#C9A96A]/50 transition-colors"
          aria-label={muted ? 'Unmute browser voice' : 'Mute browser voice'}
          title={muted ? 'Unmute spoken replies' : 'Mute spoken replies'}
        >
          {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>
        <span className="hidden sm:inline text-[10px] tracking-[0.25em] uppercase text-[#C9A96A]">
          {muted ? <span className="inline-flex items-center gap-1"><MicOff className="w-3 h-3" />muted</span> : <span className="inline-flex items-center gap-1"><Mic className="w-3 h-3" />live captions</span>}
        </span>
      </div>
    </div>
  );
}
