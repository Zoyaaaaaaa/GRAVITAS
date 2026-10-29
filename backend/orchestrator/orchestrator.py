from typing import Dict, Any, Optional
from enum import Enum
import asyncio
import uuid
try:
    from livekit.agents import AgentSession
except ImportError:
    AgentSession = None  # Fallback for testing without LiveKit

from ..models.enums import Mode, SessionState
from ..models.session import Session
from ..models.scenario import Scenario, ScenarioState
from ..models.skill_profile import SkillProfile
from ..agents.interview_agent import InterviewAgent
from ..agents.negotiation_agent import NegotiationAgent
from ..agents.storytelling_agent import StorytellingAgent
from ..agents.critical_thinking_agent import CriticalThinkingAgent
from ..agents.evaluator_agent import EvaluatorAgent
from ..agents.coach_agent import CoachAgent


class Orchestrator:
    """Central orchestrator that manages session flow and agent routing"""
    
    def __init__(self):
        self.agents = {
            Mode.INTERVIEW: InterviewAgent(),
            Mode.NEGOTIATION: NegotiationAgent(),
            Mode.STORYTELLING: StorytellingAgent(),
            Mode.CRITICAL_THINKING: CriticalThinkingAgent(),
        }
        self.evaluator = EvaluatorAgent()
        self.coach = CoachAgent()
        self.active_sessions: Dict[str, Session] = {}
    
    async def start_session(self, user_id: str, mode: Mode) -> Session:
        """Start a new coaching session"""
        session = Session(
            id=f"session_{user_id}_{uuid.uuid4().hex}",
            user_id=user_id,
            mode=mode,
            state=SessionState.DISCOVERY
        )
        
        self.active_sessions[session.id] = session
        return session
    
    async def select_scenario(self, session: Session, user_profile: SkillProfile) -> Scenario:
        """Select appropriate scenario based on mode and user skill level"""
        # This would query the scenario database
        # For now, return a placeholder
        scenario = Scenario(
            id="placeholder_scenario",
            type="interview",
            mode=session.mode,
            difficulty="intermediate",
            objective="practice interviewing",
            opponent="recruiter",
            opponent_personality="professional",
            user_role="candidate",
            user_objective="answer questions effectively",
            opponent_objective="evaluate candidate",
            what_opponent_knows=[],
            what_opponent_doesnt_know=[],
            user_leverage=[],
            opponent_leverage=[],
            likely_objections=[],
            opponent_emotional_state="neutral",
            hidden_information=[],
            success_criteria=[],
            escalation_rules=[],
            constraints=[],
            context="Practice scenario",
            opening_move="Tell me about yourself"
        )
        
        session.current_scenario_id = scenario.id
        session.state = SessionState.SCENARIO_SETUP
        return scenario
    
    async def initialize_scenario(self, session: Session, scenario: Scenario) -> ScenarioState:
        """Initialize scenario state"""
        scenario_state = ScenarioState(
            scenario_id=scenario.id
        )
        
        session.scenario_state = scenario_state
        session.state = SessionState.ROLEPLAY
        return scenario_state
    
    async def handle_user_turn(self, session: Session, user_input: str) -> str:
        """Handle a user turn in the conversation"""
        if session.state not in [SessionState.ROLEPLAY, SessionState.ESCALATION]:
            return "Not in a roleplay state"
        
        # Get the appropriate agent
        agent = self.agents.get(session.mode)
        if not agent:
            return "Mode not supported"
        
        # Build context (agents expect plain dicts, not pydantic models)
        scenario_state = session.scenario_state
        if scenario_state is None:
            scenario_ctx: Dict[str, Any] = {}
        elif hasattr(scenario_state, "model_dump"):
            scenario_ctx = scenario_state.model_dump()
        elif hasattr(scenario_state, "dict"):
            scenario_ctx = scenario_state.dict()
        elif isinstance(scenario_state, dict):
            scenario_ctx = scenario_state
        else:
            scenario_ctx = {}
        context = {
            "scenario": scenario_ctx,
            "session_id": session.id,
            "user_id": session.user_id
        }
        
        # Handle the turn
        response = await agent.handle_turn(user_input, context)
        
        # Update transcript
        session.transcript.append({
            "speaker": "user",
            "text": user_input,
            "timestamp": asyncio.get_event_loop().time()
        })
        session.transcript.append({
            "speaker": "agent",
            "text": response,
            "timestamp": asyncio.get_event_loop().time()
        })
        
        # Update scenario state
        if session.scenario_state:
            session.scenario_state.current_turn += 1
            session.scenario_state.last_agent_response = response
        
        # Check if scenario should complete
        if await self._should_complete_scenario(session):
            session.state = SessionState.SCENARIO_COMPLETE
            return await self.complete_scenario(session)
        
        return response
    
    async def _should_complete_scenario(self, session: Session) -> bool:
        """Determine if scenario should complete"""
        if not session.scenario_state:
            return False
        
        # Check turn limits, success criteria, etc.
        if session.scenario_state.current_turn >= 10:
            return True
        
        return False
    
    async def complete_scenario(self, session: Session) -> str:
        """Complete the scenario and run evaluation"""
        session.state = SessionState.EVALUATION
        
        # Run evaluation
        evaluation = await self.evaluator.evaluate_transcript(
            session.transcript,
            {"scenario_id": session.current_scenario_id}
        )
        
        session.evaluation_results = evaluation
        
        # Generate coaching
        coaching = await self.coach.generate_coaching(
            evaluation,
            {"user_id": session.user_id}
        )
        
        session.coaching_feedback = coaching
        
        # Recommend next scenario
        next_scenario = await self.coach.recommend_next_scenario(
            evaluation,
            {"user_id": session.user_id}
        )
        
        session.next_scenario_recommendation = next_scenario
        
        session.state = SessionState.COACHING
        
        return f"Scenario complete. {coaching}"
    
    async def transition_state(self, session: Session, new_state: SessionState):
        """Transition session to a new state"""
        session.state = new_state
    
    def get_session(self, session_id: str) -> Optional[Session]:
        """Get an active session"""
        return self.active_sessions.get(session_id)
