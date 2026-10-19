# Gravitas — System Architecture

> Audience: senior technical review. This document describes the system **as built and
> verified** (Sept 2026): three runtime processes, the LiveKit voice pipeline, the
> coaching agent, session persistence, and known failure modes.

## 1. Overview

Gravitas is an AI communication-coaching platform with **real-time voice interaction**.
A user picks a coaching arena (negotiation, interview, storytelling, …), joins a
voice room, and converses with a LiveKit voice agent backed by specialist coaching
logic. The web UI shows live captions, a prepared session brief, and persists all
progress so a user can leave and resume exactly where they stopped.

**Design principle:** Agent = behavior · Scenario = situation · Session = state ·
Orchestrator = routing · Memory = progress · Voice worker = realtime I/O.

## 2. Runtime topology (3 processes)

| # | Process | Command | Port / Identity | Role |
|---|---------|---------|-----------------|------|
| 1 | Backend API | `venv\Scripts\python -m api.main` (from `backend/`) | `:8000` (FastAPI + uvicorn) | REST sessions/scenarios/turns, profiles, LiveKit token minting + agent dispatch |
| 2 | Voice worker | `venv\Scripts\python -m api.livekit_server dev` (from `backend/`) | Agent name `GravitasVoice` on LiveKit Cloud | Joins rooms, runs STT → LLM → TTS, executes coaching turns |
| 3 | Frontend | `npm run dev` (from `frontend/`) | `:3000` (Next.js 14) | Atelier home, session page, voice controls, live captions |

`start.bat` launches all three (each in its own window) and **must use the project
venv** — the system Python does not have `livekit-agents`, which previously caused
`ModuleNotFoundError: No module named 'livekit.agents'`. Backend and worker share
the same `backend/venv`.

External dependencies: **LiveKit Cloud** (rooms, media, agent dispatch, inference
gateway) and optionally Redis/Postgres via `REDIS_URL` / `DATABASE_URL`.

## 3. End-to-end flows

### 3.1 Web session bootstrap (REST)

```
Browser (session/[mode]) ──POST /session/start?user_id=&mode=──▶ FastAPI
        │                              Orchestrator.start_session() → session id (state: discovery)
        │                    ──POST /session/{id}/scenario───────▶ Orchestrator.select_scenario()
        │                              + initialize_scenario() → { context, opening_move, duration }
        └── renders Session Brief rail + opening message                    (state: roleplay)
```

Mode mapping: the URL uses `persuasion_lab` / `real_world_scenario`; the API enum
uses `persuasion` / `real_world` — the frontend maps them before calling.

### 3.2 Voice join (the critical path — previously broken, now verified)

```
VoiceInterface ──GET /livekit/token?user_id=&room_name=──▶ FastAPI
        │   1. mints AccessToken (VideoGrants: room_join/publish/subscribe, TTL 1h)
        │   2. LiveKitAPI.agent_dispatch.create_dispatch(room, agent_name="GravitasVoice")
        │      (without this the random room gravitas-<mode>-<ts> stays empty — the old bug)
        ▼
room.connect(url, token) → setMicrophoneEnabled(true)   // mic was never published before
room.startAudio()                                        // Chrome autoplay unlock
attach remote <audio> into DOM container                 // return value was discarded before
TranscriptionReceived ──▶ live captions
```

Verified live: token endpoint returns JWT, dispatch succeeds with no error, and a
probe room showed the worker auto-joining as `agent-AJ_…`.

### 3.3 Voice turn (inside the worker, `backend/api/livekit_server.py`)

```
mic audio ──▶ STT deepgram/nova-3 ──▶ on_user_turn_completed(new_message)
        │         content may be str | list | dict → _extract_text() normalizes
        │         (a list payload previously crashed with 'list' has no attribute 'lower')
        ├─ awaiting_mode? parse mode → start_coaching_session(mode)
        │     → orchestrator.start_session + select_scenario + initialize_scenario
        │     → update_instructions(opening_move)
        └─ else handle_coaching_turn() → orchestrator.handle_user_turn() → next instructions
                                                     │
AgentSession(LLM google/gemma-4-31b-it, TTS cartesia/sonic-3, VAD,
             TurnDetector, preemptive_generation) ──┴──▶ speaks reply
```

Noise cancellation (`ai_coustics`) is **optional** — the worker boots with plain
`RoomOptions` when the plugin isn't installed instead of crashing on import.

### 3.4 Greeting (both sides always start together)

The frontend room name carries the mode (`gravitas-negotiation-…`). On job entry
the worker parses it (`mode_from_room_name`), pre-builds the full coaching
scenario, and calls `session.generate_reply()` with a greet-then-deliver-opening
instruction. If no mode is found it greets and asks which arena the user wants.
The web UI independently shows an instant local greeting so the screen is never
empty, then appends the real scenario opening from REST.

### 3.5 Text turns + persistence (resume)

```
composer ──▶ append locally ──POST /session/{id}/turn──▶ orchestrator.handle_user_turn
                                                        → specialist agent reply
localStorage (frontend/src/utils/sessionStore.ts):
  gravitas-user-id          stable identity (was regenerated per visit — nothing could resume)
  gravitas-session-<mode>   transcript + brief + timer + restSessionId + status (≤200 msgs)
  gravitas-profile          level / sessions / minutes / focus-next
```

On return: transcript + brief + clock restore instantly, a "Welcome back"
message is appended, the stored REST session is verified (`GET /session/{id}`,
renewed if 404), and a **Resumed** badge shows. Ended sessions revive live
coaching instead of staying dead. Saves happen on every message, every 15 s, on
tab-hide and unload. Home page "Continue your journey" cards + per-arena
`Continue · N` badges are driven by the same store.

## 4. Backend module map (`backend/`)

| Module | Responsibility |
|--------|----------------|
| `api/main.py` | FastAPI app: `/modes`, `/session/start`, `/session/{id}/scenario`, `/session/{id}/turn`, `/session/{id}`, `/user/{id}/profile`, `/user/{id}/weaknesses`, `/livekit/token` (+dispatch), `/ws/{id}` |
| `api/livekit_server.py` | `VoiceGatewayAgent` + `LiveKitVoiceServer` + `entrypoint` (rtc_session `GravitasVoice`) |
| `orchestrator/orchestrator.py` | Session lifecycle, scenario selection/init, turn routing to specialist agents, completion → evaluation → coaching |
| `agents/` | `interview`, `negotiation`, `storytelling`, `critical_thinking`, `evaluator`, `coach` (agents expect **plain-dict** context — orchestrator converts `ScenarioState` via `model_dump()`) |
| `scenarios/` | Scenario engine (currently returns placeholder scenarios) |
| `memory/` | User profiles / weaknesses (`REDIS_URL`) |
| `events/` | Analytics/debug event bus |
| `models/` | `Session`, `Scenario`/`ScenarioState`, `SkillProfile`, `Event`, enums |

**Import discipline (lesson learned):** running as `python -m api.*` from `backend/`
breaks `from ..x import y`. `main.py` and `livekit_server.py` now retry absolute
imports (`from orchestrator…`) via a `sys.path` bootstrap and only then use
stubs — with console banners (`orchestrator (absolute)` vs `STUB`). The silent
stub fallback previously broke `/session/start` with
`'Session' object can't be awaited` (sync stub vs awaited call).

## 5. Frontend module map (`frontend/src/`)

| Path | Responsibility |
|------|----------------|
| `app/page.tsx` | Atelier home: brand/profile bar, resume cards, arena grid, loader |
| `app/session/[mode]/page.tsx` | Session page: brief rail, live conversation, composer, resume/profile logic |
| `components/VoiceInterface.tsx` | Room lifecycle, mic publish, remote-audio attach, `startAudio`, real mic meter (`AudioContext` analyser), `TranscriptionReceived` → `onTranscript` |
| `components/ModeCard.tsx` | Arena cards with resume badges |
| `utils/sessionStore.ts` | localStorage persistence layer |
| `types/index.ts` | `Mode`, `Session`, `Scenario`, `SkillProfile` |

## 6. Configuration

Backend (`backend/.env`): `LIVEKIT_URL` (wss), `LIVEKIT_API_KEY`,
`LIVEKIT_API_SECRET`, `DATABASE_URL`, `REDIS_URL`, `OPENAI_API_KEY`
(currently placeholder), `GOOGLE_API_KEY` (valid AI-Studio key — verified to list
`gemini-2.5-flash`, `gemma-4-31b-it`, TTS preview models), `SECRET_KEY`, `HOST`,
`PORT`. Frontend (`frontend/.env.local`): `NEXT_PUBLIC_API_URL`,
`NEXT_PUBLIC_LIVEKIT_URL`. Inference models are LiveKit-gateway names, not
direct provider calls: STT `deepgram/nova-3`, LLM `google/gemma-4-31b-it`,
TTS `cartesia/sonic-3` voice `9626c31c-…`.

## 7. Known failure modes (observed, with cause)

| Symptom | Cause | Fix / mitigation |
|---------|-------|------------------|
| Agent never joins; user alone in room | No dispatch for random rooms; worker not started | Explicit `create_dispatch` in `/livekit/token`; `start.bat` launches worker |
| Mic not captured | `setMicrophoneEnabled(true)` never called | Called post-connect; permission errors surfaced in UI |
| Agent inaudible | `track.attach()` discarded; no `startAudio()` | Audio container in DOM; autoplay-unlock + "click to enable sound" |
| Screen shows only "Preparing…" | `/session/start` 500 (stub) + StrictMode-cancelled spinner | Real imports; no `cancelled` flag; 8–12 s fetch timeouts, always degrade to voice |
| `AttributeError: 'list' has no 'lower'` | STT content is a list of blocks | `_extract_text()` normalization |
| `'ScenarioState' has no 'get'` on `/turn` | Pydantic object passed where agents expect dicts | `model_dump()` in orchestrator |
| Nested event-loop crash on worker start | `cli.run_app()` inside `asyncio.run()` | Pre-init first, then `cli.run_app()` alone |
| **429 from `agent-gateway.livekit.cloud`** | LiveKit inference quota/rate limit (STT+LLM+TTS share it); retry storm worsens it. Persistent 429 across a day = credits exhausted, not a window | Cool down, single session, check Cloud usage/billing; **bypasses built in:** worker LLM runs direct Google Gemini (`gemini-2.5-flash` via `livekit-plugins-google`, no gateway); UI offers quota-free **browser voice** (`BrowserVoice.tsx`: Web Speech capture + speechSynthesis playback + local REST brain) |

## 8. Scaling notes

Current shape is a modular monolith + managed realtime (LiveKit Cloud) — right
for MVP. Extraction order when load grows: evaluation/coaching (heaviest,
already async-friendly) → event bus onto a queue → Redis cache for scenarios →
horizontal API replicas (sessions are in-memory in the orchestrator today, so
sticky routing or a shared session store comes first). Voice scales via LiveKit;
each room costs inference minutes — the 429 above is the first capacity signal.
