from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
from typing import Dict, Any
import uuid
import asyncio
import os

from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import structlog
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.asyncio import AsyncioIntegration

from ..core.config import settings
from ..models.enums import Mode, Difficulty
from ..orchestrator.orchestrator import Orchestrator
from ..scenarios.scenario_engine import ScenarioEngine
from ..memory.memory_manager import MemoryManager
from ..events.event_system import event_system, Event
from ..models.event import EventType


# Structured logging
structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.UnicodeDecoder(),
        structlog.processors.JSONRenderer()
    ],
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
    wrapper_class=structlog.stdlib.BoundLogger,
    cache_logger_on_first_use=True,
)
logger = structlog.get_logger()


# Sentry initialization
if settings.secret_key and settings.secret_key != "dev-secret-key":
    sentry_sdk.init(
        dsn=os.getenv("SENTRY_DSN"),
        integrations=[
            FastApiIntegration(),
            AsyncioIntegration(),
        ],
        traces_sample_rate=0.1,
        profiles_sample_rate=0.1,
        environment=os.getenv("ENVIRONMENT", "development"),
    )


# Rate limiter
limiter = Limiter(key_func=get_remote_address)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager"""
    logger.info("starting_application")
    await memory_manager.connect()
    asyncio.create_task(event_system.process_events())
    yield
    logger.info("shutting_down_application")
    await memory_manager.disconnect()
    event_system.stop()


app = FastAPI(title="Gravitas API", lifespan=lifespan)

# Rate limiting
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request logging middleware
@app.middleware("http")
async def log_requests(request: Request, call_next):
    import time
    start_time = time.time()
    response = await call_next(request)
    process_time = time.time() - start_time
    logger.info(
        "http_request",
        method=request.method,
        path=request.url.path,
        status_code=response.status_code,
        duration_ms=round(process_time * 1000, 2),
    )
    return response

# Initialize components
orchestrator = Orchestrator()
scenario_engine = ScenarioEngine()
memory_manager = MemoryManager()

# WebSocket connections
active_connections: Dict[str, WebSocket] = {}


@app.get("/")
@limiter.limit("60/minute")
async def root(request: Request):
    """Health check endpoint"""
    return {"status": "healthy", "service": "gravitas-api"}


@app.get("/health")
@limiter.limit("60/minute")
async def health_check(request: Request):
    """Detailed health check for load balancers"""
    return {
        "status": "healthy",
        "service": "gravitas-api",
        "database": "connected" if memory_manager.redis_client else "disconnected",
        "version": "1.0.0"
    }


@app.get("/modes")
@limiter.limit("30/minute")
async def get_modes(request: Request):
    """Get available coaching modes"""
    return {
        "modes": [
            {"value": mode.value, "label": mode.value.replace("_", " ").title()}
            for mode in Mode
        ]
    }


@app.post("/session/start")
@limiter.limit("10/minute")
async def start_session(request: Request, user_id: str, mode: Mode):
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
        logger.error("session_start_failed", user_id=user_id, mode=mode.value, error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/session/{session_id}/scenario")
@limiter.limit("10/minute")
async def select_scenario(request: Request, session_id: str, difficulty: str = "intermediate"):
    """Select and start a scenario for the session"""
    try:
        session = orchestrator.get_session(session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        
        # Load user profile
        user_profile = await memory_manager.load_user_profile(session.user_id)
        
        # Select scenario
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
        logger.error("scenario_select_failed", session_id=session_id, error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


async def process_user_turn(session_id: str, user_input: str) -> Dict[str, Any]:
    """Process a user turn - shared logic for HTTP and WebSocket"""
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


@app.post("/session/{session_id}/turn")
@limiter.limit("30/minute")
async def handle_turn(request: Request, session_id: str, user_input: str):
    """Handle a user turn in the conversation"""
    try:
        return await process_user_turn(session_id, user_input)
    except HTTPException:
        raise
    except Exception as e:
        logger.error("turn_failed", session_id=session_id, error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/session/{session_id}")
@limiter.limit("30/minute")
async def get_session(request: Request, session_id: str):
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
@limiter.limit("30/minute")
async def get_user_profile(request: Request, user_id: str):
    """Get user skill profile"""
    profile = await memory_manager.load_user_profile(user_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    return profile.model_dump()


@app.get("/user/{user_id}/weaknesses")
@limiter.limit("30/minute")
async def get_user_weaknesses(request: Request, user_id: str):
    """Get user's weakest skills"""
    weaknesses = await memory_manager.get_user_weaknesses(user_id)
    return {
        "weaknesses": [
            {"category": w[0], "skill": w[1], "score": w[2]}
            for w in weaknesses
        ]
    }


@app.get("/livekit/token")
@limiter.limit("10/minute")
async def get_livekit_token(request: Request, user_id: str, room_name: str):
    """Generate a LiveKit access token for a user to join a room"""
    # LiveKit disabled - using browser voice fallback instead
    raise HTTPException(status_code=503, detail="LiveKit not configured. Use browser voice fallback instead.")


@app.websocket("/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    """WebSocket endpoint for real-time communication"""
    await websocket.accept()
    active_connections[session_id] = websocket
    
    try:
        while True:
            data = await websocket.receive_json()
            
            if data["type"] == "user_turn":
                result = await process_user_turn(session_id, data["input"])
                await websocket.send_json({
                    "type": "agent_response",
                    "data": result
                })
            elif data["type"] == "ping":
                await websocket.send_json({"type": "pong"})
                
    except WebSocketDisconnect:
        if session_id in active_connections:
            del active_connections[session_id]
    except Exception as e:
        logger.error("websocket_error", session_id=session_id, error=str(e))
        if session_id in active_connections:
            del active_connections[session_id]


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=settings.host, port=settings.port)