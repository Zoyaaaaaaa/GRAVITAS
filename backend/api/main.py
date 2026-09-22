from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict, Any
import uuid
try:
    from ..core.config import settings
except ImportError:
    # Fallback for standalone execution
    from dotenv import load_dotenv
    load_dotenv(".env")
    import os
    class Settings:
        livekit_url = os.getenv("LIVEKIT_URL", "")
        livekit_api_key = os.getenv("LIVEKIT_API_KEY", "")
        livekit_api_secret = os.getenv("LIVEKIT_API_SECRET", "")
        database_url = os.getenv("DATABASE_URL", "sqlite:///./gravitas.db")
        redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
        secret_key = os.getenv("SECRET_KEY", "dev-secret-key")
        host = os.getenv("HOST", "0.0.0.0")
        port = int(os.getenv("PORT", "8000"))
    settings = Settings()

try:
    from ..models.enums import Mode
except ImportError:
    # Fallback for standalone execution
    from enum import Enum
    class Mode(Enum):
        STORYTELLING = "storytelling"
        CRITICAL_THINKING = "critical_thinking"
        NEGOTIATION = "negotiation"
        INTERVIEW = "interview"
        EXECUTIVE_PRESENCE = "executive_presence"
        DEVILS_ADVOCATE = "devils_advocate"
        PERSUASION = "persuasion"
        REAL_WORLD = "real_world"
        RAPID_RESPONSE = "rapid_response"
        STORY_TO_STRATEGY = "story_to_strategy"
        HIGH_PRESSURE = "high_pressure"
        ANSWER_ARCHITECT = "answer_architect"
        PROFESSIONAL_IDENTITY = "professional_identity"

try:
    from ..orchestrator.orchestrator import Orchestrator
except ImportError:
    # Fallback for standalone execution
    class Orchestrator:
        def __init__(self):
            self.sessions = {}
        def start_session(self, user_id, mode):
            return type('Session', (), {'id': 'test', 'user_id': user_id, 'mode': mode, 'state': type('State', (), {'value': 'active'})})()
        def get_session(self, session_id):
            return None
        def select_scenario(self, session, user_profile):
            return type('Scenario', (), {'id': 'test', 'context': 'test', 'opening_move': 'test', 'duration_minutes': 10})()
        def initialize_scenario(self, session, scenario):
            pass
        def handle_user_turn(self, session, user_input):
            return "Response"

try:
    from ..scenarios.scenario_engine import ScenarioEngine
except ImportError:
    # Fallback for standalone execution
    class ScenarioEngine:
        pass

try:
    from ..memory.memory_manager import MemoryManager
except ImportError:
    # Fallback for standalone execution
    class MemoryManager:
        async def connect(self):
            pass
        async def disconnect(self):
            pass
        async def load_user_profile(self, user_id):
            return None
        async def get_user_weaknesses(self, user_id):
            return []

try:
    from ..events.event_system import event_system, Event
except ImportError:
    # Fallback for standalone execution
    class Event:
        def __init__(self, id, user_id, session_id, event_type, data):
            self.id = id
            self.user_id = user_id
            self.session_id = session_id
            self.event_type = event_type
            self.data = data
    class EventSystem:
        def __init__(self):
            self.running = False
        async def emit(self, event):
            pass
        async def process_events(self):
            pass
        def stop(self):
            pass
    event_system = EventSystem()

try:
    from ..models.event import EventType
except ImportError:
    # Fallback for standalone execution
    from enum import Enum
    class EventType(Enum):
        SESSION_STARTED = "session_started"
        SCENARIO_STARTED = "scenario_started"
        USER_TURN_COMPLETED = "user_turn_completed"
from datetime import datetime


app = FastAPI(title="Gravitas API")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize components
orchestrator = Orchestrator()
scenario_engine = ScenarioEngine()
memory_manager = MemoryManager()

# WebSocket connections
active_connections: Dict[str, WebSocket] = {}


@app.on_event("startup")
async def startup_event():
    """Initialize components on startup"""
    await memory_manager.connect()
    # Start event processor
    import asyncio
    asyncio.create_task(event_system.process_events())


@app.on_event("shutdown")
async def shutdown_event():
    """Clean up on shutdown"""
    await memory_manager.disconnect()
    event_system.stop()


@app.get("/")
async def root():
    """Health check endpoint"""
    return {"status": "healthy", "service": "gravitas-api"}


@app.get("/modes")
async def get_modes():
    """Get available coaching modes"""
    return {
        "modes": [
            {"value": mode.value, "label": mode.value.replace("_", " ").title()}
            for mode in Mode
        ]
    }


@app.post("/session/start")
async def start_session(user_id: str, mode: Mode):
    """Start a new coaching session"""
    try:
        session = await orchestrator.start_session(user_id, mode)
        
        # Emit event
        await event_system.emit(Event(
            id=str(uuid.uuid4()),
            user_id=user_id,
            session_id=session.id,
            event_type=EventType.SESSION_STARTED,
            data={"mode": mode.value}
        ))
        
        return {
            "session_id": session.id,
            "mode": mode.value,
            "state": session.state.value
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/session/{session_id}/scenario")
async def select_scenario(session_id: str, difficulty: str = "intermediate"):
    """Select and start a scenario for the session"""
    try:
        session = orchestrator.get_session(session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        
        # Load user profile
        user_profile = await memory_manager.load_user_profile(session.user_id)
        
        # Select scenario
        try:
            from ..models.enums import Difficulty
        except ImportError:
            # Fallback for standalone execution
            from enum import Enum
            class Difficulty(Enum):
                BEGINNER = "beginner"
                INTERMEDIATE = "intermediate"
                ADVANCED = "advanced"
                EXPERT = "expert"
        scenario = await orchestrator.select_scenario(
            session,
            user_profile or None
        )
        
        # Initialize scenario state
        await orchestrator.initialize_scenario(session, scenario)
        
        # Emit event
        await event_system.emit(Event(
            id=str(uuid.uuid4()),
            user_id=session.user_id,
            session_id=session_id,
            event_type=EventType.SCENARIO_STARTED,
            data={"scenario_id": scenario.id, "difficulty": difficulty}
        ))
        
        return {
            "scenario_id": scenario.id,
            "context": scenario.context,
            "opening_move": scenario.opening_move,
            "duration_minutes": scenario.duration_minutes
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/session/{session_id}/turn")
async def handle_turn(session_id: str, user_input: str):
    """Handle a user turn in the conversation"""
    try:
        session = orchestrator.get_session(session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        
        response = await orchestrator.handle_user_turn(session, user_input)
        
        # Emit event
        await event_system.emit(Event(
            id=str(uuid.uuid4()),
            user_id=session.user_id,
            session_id=session_id,
            event_type=EventType.USER_TURN_COMPLETED,
            data={"input_length": len(user_input)}
        ))
        
        return {
            "response": response,
            "state": session.state.value,
            "turn": session.scenario_state.current_turn if session.scenario_state else 0
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/session/{session_id}")
async def get_session(session_id: str):
    """Get session details"""
    session = orchestrator.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    return {
        "session_id": session.id,
        "user_id": session.user_id,
        "mode": session.mode.value if session.mode else None,
        "state": session.state.value,
        "current_scenario_id": session.current_scenario_id,
        "turn_count": session.scenario_state.current_turn if session.scenario_state else 0
    }


@app.get("/user/{user_id}/profile")
async def get_user_profile(user_id: str):
    """Get user skill profile"""
    profile = await memory_manager.load_user_profile(user_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    return profile.model_dump()


@app.get("/user/{user_id}/weaknesses")
async def get_user_weaknesses(user_id: str):
    """Get user's weakest skills"""
    weaknesses = await memory_manager.get_user_weaknesses(user_id)
    return {
        "weaknesses": [
            {"category": w[0], "skill": w[1], "score": w[2]}
            for w in weaknesses
        ]
    }


@app.get("/livekit/token")
async def get_livekit_token(user_id: str, room_name: str):
    """Generate a LiveKit access token for a user to join a room"""
    try:
        from livekit.api import AccessToken, VideoGrants
        from datetime import timedelta
        
        # Create access token
        token = AccessToken(settings.livekit_api_key, settings.livekit_api_secret)
        token.with_identity(user_id)
        token.with_name(f"User-{user_id}")
        
        # Grant video permissions
        grant = VideoGrants(
            room_join=True,
            room=room_name,
            can_publish=True,
            can_subscribe=True,
        )
        token.with_grants(grant)
        
        # Set token expiration (1 hour)
        token.with_ttl(timedelta(hours=1))
        
        jwt_token = token.to_jwt()

        # Explicitly dispatch the voice agent into this room.
        # Without this, the frontend creates a random room that no worker
        # ever joins, so the user sits alone (no STT, no TTS).
        try:
            from livekit.api import LiveKitAPI, CreateAgentDispatchRequest
            api_url = settings.livekit_url.replace("wss://", "https://").replace("ws://", "http://")
            lkapi = LiveKitAPI(url=api_url, api_key=settings.livekit_api_key, api_secret=settings.livekit_api_secret)
            try:
                await lkapi.agent_dispatch.create_dispatch(
                    CreateAgentDispatchRequest(room=room_name, agent_name="GravitasVoice")
                )
            finally:
                try:
                    await lkapi.aclose()
                except Exception:
                    pass
        except Exception as dispatch_err:
            # Don't fail the token request if the voice worker is offline;
            # log so the operator knows to start `python -m api.livekit_server`.
            print(f"Agent dispatch failed (is livekit_server running?): {dispatch_err}")
        
        return {
            "token": jwt_token,
            "room_name": room_name,
            "user_id": user_id
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.websocket("/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    """WebSocket endpoint for real-time communication"""
    await websocket.accept()
    active_connections[session_id] = websocket
    
    try:
        while True:
            data = await websocket.receive_json()
            
            if data["type"] == "user_turn":
                response = await handle_turn(session_id, data["input"])
                await websocket.send_json({
                    "type": "agent_response",
                    "data": response
                })
            elif data["type"] == "ping":
                await websocket.send_json({"type": "pong"})
                
    except WebSocketDisconnect:
        del active_connections[session_id]
    except Exception as e:
        print(f"WebSocket error: {e}")
        if session_id in active_connections:
            del active_connections[session_id]


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=settings.host, port=settings.port)
