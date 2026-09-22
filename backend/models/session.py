from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from datetime import datetime
from .enums import Mode, SessionState, Difficulty
from .scenario import ScenarioState


class Session(BaseModel):
    """User session data"""
    id: str
    user_id: str
    mode: Optional[Mode] = None
    state: SessionState = SessionState.IDLE
    current_scenario_id: Optional[str] = None
    scenario_state: Optional[ScenarioState] = None
    transcript: List[Dict[str, Any]] = []
    evaluation_results: Optional[Dict[str, Any]] = None
    coaching_feedback: Optional[str] = None
    skill_updates: Optional[Dict[str, Any]] = None
    next_scenario_recommendation: Optional[str] = None
    started_at: datetime = Field(default_factory=datetime.utcnow)
    ended_at: Optional[datetime] = None
    metadata: Dict[str, Any] = {}
    
    class Config:
        json_schema_extra = {
            "example": {
                "id": "session_123",
                "user_id": "user_456",
                "mode": Mode.NEGOTIATION,
                "state": SessionState.ROLEPLAY,
                "current_scenario_id": "salary_negotiation_1",
                "transcript": [
                    {"speaker": "agent", "text": "What are your salary expectations?", "timestamp": "2024-01-01T10:00:00"},
                    {"speaker": "user", "text": "I'm looking for 150k", "timestamp": "2024-01-01T10:00:15"}
                ]
            }
        }
