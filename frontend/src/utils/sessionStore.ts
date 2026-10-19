// Persistent client-side session store (localStorage).
// Survives reload / logout / return-later: same user id, same per-mode
// transcript + brief + timer, so coaching continues exactly where it left off.

export interface PersistedMessage {
  id: string;
  role: 'agent' | 'user' | 'system';
  text: string;
  ts: string; // ISO
}

export interface PersistedBrief {
  objective: string;
  context: string;
  opening: string;
  focus: string[];
  ready: boolean;
}

export interface PersistedSession {
  mode: string;
  restSessionId: string | null;
  messages: PersistedMessage[];
  brief: PersistedBrief | null;
  elapsed: number;
  status: 'active' | 'ended';
  updatedAt: number;
}

export interface PersistedProfile {
  displayName: string;
  level: string;
  totalSessions: number;
  totalMinutes: number;
  strengths: string[];
  focusNext: string[];
  updatedAt: number;
}

const UID_KEY = 'gravitas-user-id';
const PROFILE_KEY = 'gravitas-profile';
const sessionKey = (mode: string) => `gravitas-session-${mode}`;
const ALL_KEY = 'gravitas-session-index';

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function readIndex(): string[] {
  if (!canUseStorage()) return [];
  try {
    const raw = window.localStorage.getItem(ALL_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function writeIndex(modes: string[]) {
  if (!canUseStorage()) return;
  try {
    window.localStorage.setItem(ALL_KEY, JSON.stringify([...new Set(modes)]));
  } catch { /* quota / private mode — non-fatal */ }
}

/** Stable identity across reloads. Pass an optional display name seed. */
export function getUserId(): string {
  if (!canUseStorage()) return `web-user-${Date.now()}`;
  try {
    let id = window.localStorage.getItem(UID_KEY);
    if (!id) {
      id = `web-user-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      window.localStorage.setItem(UID_KEY, id);
    }
    return id;
  } catch {
    return `web-user-${Date.now()}`;
  }
}

export function loadSession(mode: string): PersistedSession | null {
  if (!canUseStorage()) return null;
  try {
    const raw = window.localStorage.getItem(sessionKey(mode));
    if (!raw) return null;
    const data = JSON.parse(raw) as PersistedSession;
    if (!data || !Array.isArray(data.messages)) return null;
    // Ignore ancient sessions (> 30 days) to avoid stale coaching context
    if (data.updatedAt && Date.now() - data.updatedAt > 30 * 24 * 3600 * 1000) return null;
    return data;
  } catch {
    return null;
  }
}

export function saveSession(s: Omit<PersistedSession, 'updatedAt'>) {
  if (!canUseStorage()) return;
  try {
    const payload: PersistedSession = { ...s, updatedAt: Date.now() };
    // Cap transcript so storage never blows up (keep most recent 200)
    if (payload.messages.length > 200) {
      payload.messages = payload.messages.slice(payload.messages.length - 200);
    }
    window.localStorage.setItem(sessionKey(s.mode), JSON.stringify(payload));
    const idx = readIndex();
    if (!idx.includes(s.mode)) writeIndex([...idx, s.mode]);
  } catch { /* non-fatal */ }
}

export function clearSession(mode: string) {
  if (!canUseStorage()) return;
  try {
    window.localStorage.removeItem(sessionKey(mode));
    writeIndex(readIndex().filter((m) => m !== mode));
  } catch { /* non-fatal */ }
}

export interface SessionSummary {
  mode: string;
  messageCount: number;
  preview: string;
  elapsed: number;
  status: 'active' | 'ended';
  updatedAt: number;
}

/** All modes with saved progress, newest first — powers "Continue your journey". */
export function listSessions(): SessionSummary[] {
  const out: SessionSummary[] = [];
  for (const mode of readIndex()) {
    const s = loadSession(mode);
    if (!s || s.messages.length === 0) continue;
    const lastUser = [...s.messages].reverse().find((m) => m.role !== 'system');
    out.push({
      mode: s.mode,
      messageCount: s.messages.length,
      preview: lastUser ? lastUser.text.slice(0, 90) : '',
      elapsed: s.elapsed,
      status: s.status,
      updatedAt: s.updatedAt,
    });
  }
  return out.sort((a, b) => b.updatedAt - a.updatedAt);
}

export function loadProfile(): PersistedProfile | null {
  if (!canUseStorage()) return null;
  try {
    const raw = window.localStorage.getItem(PROFILE_KEY);
    return raw ? (JSON.parse(raw) as PersistedProfile) : null;
  } catch {
    return null;
  }
}

export function saveProfile(p: Omit<PersistedProfile, 'updatedAt'>) {
  if (!canUseStorage()) return;
  try {
    window.localStorage.setItem(PROFILE_KEY, JSON.stringify({ ...p, updatedAt: Date.now() }));
  } catch { /* non-fatal */ }
}
