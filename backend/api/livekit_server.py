import logging
from dotenv import load_dotenv

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
    ]
)
from livekit.agents import (
    Agent,
    AgentServer,
    AgentSession,
    JobContext,
    TurnHandlingOptions,
    cli,
    inference,
    room_io,
)
try:
    from livekit.plugins import ai_coustics as _ai_coustics_module
    ai_coustics = _ai_coustics_module
    AI_COUSTICS_AVAILABLE = True
except ImportError:
    ai_coustics = None
    AI_COUSTICS_AVAILABLE = False
    logger = logging.getLogger("gravitas-voice")
    logger.warning(
        "livekit noise-cancellation plugin not installed — "
        "voice will run without AI noise cancellation. "
        "Install with: pip install livekit-plugins-noise-cancellation"
    )
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
    settings = Settings()
try:
    from ..orchestrator.orchestrator import Orchestrator
    from ..scenarios.scenario_engine import ScenarioEngine
    from ..memory.memory_manager import MemoryManager
    from ..events.event_system import event_system, Event
    from ..models.event import EventType
    from ..models.enums import Mode, SessionState
except ImportError:
    # Fallback when run as `python -m api.livekit_server` from backend/
    import os
    import sys
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    try:
        from orchestrator.orchestrator import Orchestrator
        from scenarios.scenario_engine import ScenarioEngine
        from memory.memory_manager import MemoryManager
        from events.event_system import event_system, Event
        from models.event import EventType
        from models.enums import Mode, SessionState
    except ImportError:
        # Last-resort stubs so the worker still boots for voice-only testing
        class Orchestrator:
            def __init__(self): self.sessions = {}
            async def start_session(self, user_id, mode):
                import uuid as _uuid
                return type('S', (), {'id': str(_uuid.uuid4()), 'user_id': user_id, 'mode': mode})()
            def get_session(self, sid): return None
            async def select_scenario(self, session, profile):
                return type('S', (), {'id': 's', 'opening_move': 'Hello! What skill shall we coach today?'})()
            async def initialize_scenario(self, s, sc): pass
            async def handle_user_turn(self, s, inp): return "Got it — tell me more."
        class ScenarioEngine: pass
        class MemoryManager:
            async def connect(self): pass
            async def load_user_profile(self, uid): return None
        class Event: pass
        event_system = type('E', (), {'process_events': staticmethod(lambda: __import__('asyncio').sleep(0))})()
        EventType = type('E', (), {})
import uuid

logger = logging.getLogger("gravitas-voice")

load_dotenv(".env")


class VoiceGatewayAgent(Agent):
    """Voice gateway agent that handles real-time voice interactions"""
    
    def __init__(self, orchestrator: Orchestrator, memory_manager: MemoryManager):
        super().__init__(
            instructions="""You are the voice interface for Gravitas, an elite communication coaching system.

Your role is to:
1. Provide clear, natural voice responses
2. Maintain conversation flow
3. Guide users through the coaching experience
4. Be concise and articulate

You are not the coaching agent yourself - you are the voice interface that delivers the coaching agent's responses.

Speak naturally and professionally. Match the tone suggested by the coaching context."""
        )
        self.orchestrator = orchestrator
        self.memory_manager = memory_manager
        self.current_session_id = None
        self.current_user_id = None
        self.current_mode = None
        self.awaiting_mode = True
    
    async def on_enter(self):
        """Handle session start"""
        logger.info("Voice agent entered session")
        self.awaiting_mode = True
        # Use the default behavior - the agent will respond based on its instructions
        logger.info("Agent ready to receive user input")
    
    @staticmethod
    def _extract_text(content) -> str:
        """STT content can be str, list of blocks, or dicts — normalize to str."""
        if content is None:
            return ""
        if isinstance(content, str):
            return content
        if isinstance(content, list):
            parts = []
            for item in content:
                if isinstance(item, str):
                    parts.append(item)
                elif isinstance(item, dict):
                    for key in ("text", "content", "transcript"):
                        if isinstance(item.get(key), str):
                            parts.append(item[key])
                            break
                else:
                    text = getattr(item, "text", None)
                    if isinstance(text, str):
                        parts.append(text)
                    else:
                        parts.append(str(item))
            return " ".join(p for p in parts if p).strip()
        if isinstance(content, dict):
            for key in ("text", "content", "transcript"):
                if isinstance(content.get(key), str):
                    return content[key]
            return str(content)
        text = getattr(content, "text", None)
        if isinstance(text, str):
            return text
        return str(content)

    async def on_user_turn_completed(self, turn_ctx, new_message):
        """Handle user speech input"""
        raw = getattr(new_message, "content", new_message)
        user_transcript = self._extract_text(raw)
        logger.info(f"User speech received: {user_transcript}")
        
        # If waiting for mode selection, parse and start session
        if self.awaiting_mode:
            mode = self.parse_mode_from_input(user_transcript)
            if mode:
                await self.start_coaching_session(mode)
                self.awaiting_mode = False
            else:
                logger.info("Mode not detected, asking again")
                # The LLM will handle the response based on conversation context
                return
        
        # If in active coaching session, get coaching response
        elif self.current_session_id:
            await self.handle_coaching_turn(user_transcript)
    
    def parse_mode_from_input(self, user_input) -> str:
        """Parse coaching mode from user input"""
        if not isinstance(user_input, str):
            user_input = self._extract_text(user_input)
        user_input_lower = user_input.lower()
        mode_map = {
            "storytelling": "storytelling",
            "critical thinking": "critical_thinking", 
            "negotiation": "negotiation",
            "interview": "interview",
            "executive presence": "executive_presence",
            "devil's advocate": "devils_advocate",
            "persuasion": "persuasion",
            "real world": "real_world",
            "real-world": "real_world",
        }
        
        for key, value in mode_map.items():
            if key in user_input_lower:
                return value
        return None
    
    async def start_coaching_session(self, mode: str):
        """Start a coaching session with the specified mode. Returns scenario or None."""
        try:
            try:
                from ..models.enums import Mode as _Mode
            except ImportError:
                from models.enums import Mode as _Mode
            mode_enum = _Mode(mode)
            self.current_mode = mode_enum

            # Create a session
            user_id = f"voice_user_{uuid.uuid4()}"
            session = await self.orchestrator.start_session(user_id, mode_enum)
            self.current_session_id = session.id
            self.current_user_id = user_id

            logger.info(f"Started coaching session: {session.id} with mode: {mode}")

            # Select a scenario
            user_profile = await self.memory_manager.load_user_profile(user_id)
            scenario = await self.orchestrator.select_scenario(session, user_profile)
            await self.orchestrator.initialize_scenario(session, scenario)

            logger.info(f"Scenario initialized: {scenario.id}")
            logger.info(f"Opening move: {scenario.opening_move}")

            # Update agent instructions with the opening move
            self.update_instructions(f"""You are the voice interface for Gravitas, an elite communication coaching system.

Current coaching mode: {mode}

The scenario has started. Here is the opening message you should deliver:
{scenario.opening_move}

Deliver this message naturally and professionally. Then await the user's response.""")
            self.awaiting_mode = False
            return scenario

        except Exception as e:
            logger.error(f"Error starting coaching session: {e}")
            self.update_instructions("I'm having trouble starting the coaching session. Please try again.")
    
    async def handle_coaching_turn(self, user_input: str):
        """Handle a coaching turn with user input"""
        try:
            session = self.orchestrator.get_session(self.current_session_id)
            if not session:
                logger.error(f"Session not found: {self.current_session_id}")
                self.update_instructions("I seem to have lost our session. Let's start over.")
                self.current_session_id = None
                self.awaiting_mode = True
                return
            
            # Get coaching response
            response = await self.orchestrator.handle_user_turn(session, user_input)
            logger.info(f"Coaching response received: {response[:100]}...")
            
            # Update agent instructions with the coaching response
            self.update_instructions(f"""You are the voice interface for Gravitas.

Current coaching mode: {self.current_mode.value if self.current_mode else 'unknown'}

The coaching agent has provided this response for the user:
{response}

Deliver this response naturally and professionally. Then await the user's next input.""")
            
        except Exception as e:
            logger.error(f"Error handling coaching turn: {e}")
            self.update_instructions("I'm having trouble processing that. Could you please repeat?")


class LiveKitVoiceServer:
    """LiveKit server for real-time voice coaching"""

    def __init__(self):
        self.orchestrator = Orchestrator()
        self.scenario_engine = ScenarioEngine()
        self.memory_manager = MemoryManager()
        self.server = AgentServer()
        self._job_initialized = False

    async def initialize(self):
        """Best-effort pre-init (called before cli.run_app takes the loop)."""
        try:
            await self.memory_manager.connect()
        except Exception as e:
            logger.warning(f"Memory connect failed, continuing without it: {e}")

    async def initialize_in_job(self):
        """Init inside the worker event loop (called from entrypoint, once)."""
        if self._job_initialized:
            return
        self._job_initialized = True
        try:
            await self.memory_manager.connect()
        except Exception as e:
            logger.warning(f"Memory connect failed, continuing without it: {e}")
        try:
            import asyncio
            asyncio.create_task(event_system.process_events())
        except Exception as e:
            logger.warning(f"Event system failed to start: {e}")
    
    def create_session_id(self, user_id: str) -> str:
        """Create a unique session ID"""
        return f"voice_session_{user_id}_{uuid.uuid4()}"


# Global server instance
voice_server = LiveKitVoiceServer()
orchestrator_instance = voice_server.orchestrator
memory_manager_instance = voice_server.memory_manager


def mode_from_room_name(room_name: str) -> str | None:
    """Frontend creates rooms like `gravitas-<mode>-<ts>` — recover the mode."""
    if not room_name:
        return None
    name = room_name.lower()
    candidates = [
        "critical_thinking", "executive_presence", "devils_advocate",
        "real_world", "storytelling", "negotiation", "interview",
        "persuasion", "rapid_response", "story_to_strategy",
        "high_pressure", "answer_architect", "professional_identity",
    ]
    for c in candidates:
        if c in name:
            return c
    # hyphenated fallbacks
    dash_map = {
        "critical-thinking": "critical_thinking",
        "executive-presence": "executive_presence",
        "real-world": "real_world",
    }
    for k, v in dash_map.items():
        if k in name:
            return v
    return None


def pretty_mode(mode: str) -> str:
    return mode.replace("_", " ").title()


@voice_server.server.rtc_session(agent_name="GravitasVoice")
async def entrypoint(ctx: JobContext):
    """LiveKit session entry point"""
    await voice_server.initialize_in_job()
    session = AgentSession(
        stt=inference.STT(model="deepgram/nova-3", language="en"),
        stt_context_options={"keyterm_detection": {"enabled": True}},
        llm=inference.LLM(
            model="google/gemma-4-31b-it",
        ),
        tts=inference.TTS(
            model="cartesia/sonic-3",
            voice="9626c31c-bec5-4cca-baa8-f8ba9e84c8bc",
            language="en"
        ),
        expressive=True,
        turn_handling=TurnHandlingOptions(
            turn_detection=inference.TurnDetector(),
            preemptive_generation={"enabled": True},
        ),
        vad=inference.VAD(),
    )

    if AI_COUSTICS_AVAILABLE:
        room_options = room_io.RoomOptions(
            audio_input=room_io.AudioInputOptions(
                noise_cancellation=ai_coustics.audio_enhancement(
                    model=ai_coustics.EnhancerModel.QUAIL_VF_S,
                ),
            ),
        )
    else:
        # Run without AI noise cancellation when the plugin isn't installed
        room_options = room_io.RoomOptions()

    agent = VoiceGatewayAgent(orchestrator_instance, memory_manager_instance)
    await session.start(
        agent=agent,
        room=ctx.room,
        room_options=room_options,
    )

    # Always open with a greeting so both sides start together.
    # If the room name carries the coaching mode, prepare the full
    # scenario up front and speak its opening move.
    try:
        room_name = getattr(ctx.room, "name", "") or ""
        mode = mode_from_room_name(room_name)
        if mode:
            scenario = await agent.start_coaching_session(mode)
            opening = getattr(scenario, "opening_move", "") if scenario else ""
            if opening:
                await session.generate_reply(
                    instructions=(
                        f"Greet the user warmly in one elegant sentence as their Gravitas "
                        f"{pretty_mode(mode)} coach, then deliver this session opening "
                        f"naturally and verbatim, then stop and await their reply: {opening}"
                    )
                )
            else:
                await session.generate_reply(
                    instructions=(
                        f"Greet the user warmly as their Gravitas {pretty_mode(mode)} coach, "
                        f"briefly state today's focus, then ask what situation they want to work on."
                    )
                )
        else:
            await session.generate_reply(
                instructions=(
                    "Greet the user warmly as their Gravitas communication coach, "
                    "introduce yourself in one elegant sentence, then ask which coaching "
                    "mode they want: storytelling, negotiation, interview, critical thinking, "
                    "executive presence, or persuasion."
                )
            )
    except Exception as e:
        logger.warning(f"Greeting failed, agent will greet from instructions: {e}")


def start_voice_server():
    """Start the LiveKit voice server (blocking)."""
    import asyncio
    # Init things that need a loop (memory, events) BEFORE the CLI
    # takes over the event loop. cli.run_app() manages its own loop,
    # so it must NOT be called inside asyncio.run() — that causes
    # "Cannot run the event loop while another loop is running".
    try:
        asyncio.run(voice_server.initialize())
    except RuntimeError:
        # Already in a running loop (e.g. `dev` hot-reload) — schedule instead
        loop = asyncio.get_event_loop()
        loop.create_task(voice_server.initialize())
    cli.run_app(voice_server.server)


if __name__ == "__main__":
    start_voice_server()
