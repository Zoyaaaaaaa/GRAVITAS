from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
from .enums import Mode, Difficulty


class Scenario(BaseModel):
    """Data-driven scenario definition"""
    id: str
    type: str
    mode: Mode
    difficulty: Difficulty
    objective: str
    opponent: str
    opponent_personality: str
    user_role: str
    user_objective: str
    opponent_objective: str
    what_opponent_knows: List[str]
    what_opponent_doesnt_know: List[str]
    user_leverage: List[str]
    opponent_leverage: List[str]
    likely_objections: List[str]
    opponent_emotional_state: str
    hidden_information: List[str]
    success_criteria: List[str]
    escalation_rules: List[Dict[str, Any]]
    constraints: List[str]
    context: str
    opening_move: str
    duration_minutes: int = 10
    
    class Config:
        json_schema_extra = {
            "example": {
                "id": "salary_negotiation_recruiter_1",
                "type": "salary_negotiation",
                "mode": Mode.NEGOTIATION,
                "difficulty": Difficulty.INTERMEDIATE,
                "objective": "increase compensation",
                "opponent": "skeptical_recruiter",
                "opponent_personality": "professional but cost-conscious",
                "user_role": "candidate",
                "user_objective": "negotiate higher salary",
                "opponent_objective": "fill position within budget",
                "what_opponent_knows": ["user's current salary", "market rates"],
                "what_opponent_doesnt_know": ["user's other offers", "user's minimum acceptable"],
                "user_leverage": ["unique skills", "other interviews"],
                "opponent_leverage": ["budget constraints", "other candidates"],
                "likely_objections": ["budget limits", "internal equity", "market data"],
                "opponent_emotional_state": "neutral, slightly pressured",
                "hidden_information": ["hiring urgency", "actual budget range"],
                "success_criteria": ["defend anchor", "ask for specific amount", "avoid early concession"],
                "escalation_rules": [
                    {"condition": "user concedes quickly", "action": "push harder"},
                    {"condition": "user stays firm", "action": "offer alternative benefits"}
                ],
                "constraints": ["must remain professional", "cannot lie about offers"],
                "context": "You're negotiating salary with a recruiter for a senior engineering role",
                "opening_move": "We're excited about your candidacy. What are your salary expectations?",
                "duration_minutes": 10
            }
        }


class ScenarioState(BaseModel):
    """Runtime state for an active scenario"""
    scenario_id: str
    current_turn: int = 0
    user_concessions: List[str] = []
    opponent_concessions: List[str] = []
    escalation_level: int = 0
    revealed_information: List[str] = []
    trigger_words_used: List[str] = []
    last_agent_response: Optional[str] = None
    time_elapsed_seconds: int = 0
    is_complete: bool = False
    completion_reason: Optional[str] = None
