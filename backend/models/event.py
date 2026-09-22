from pydantic import BaseModel, Field
from typing import Dict, Any, Optional
from datetime import datetime
from .enums import EventType


class Event(BaseModel):
    """Event for analytics and tracking"""
    id: str
    user_id: str
    session_id: str
    event_type: EventType
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    data: Dict[str, Any] = {}
    metadata: Dict[str, Any] = {}
    
    class Config:
        json_schema_extra = {
            "example": {
                "id": "evt_123",
                "user_id": "user_123",
                "session_id": "session_456",
                "event_type": EventType.SCENARIO_STARTED,
                "data": {
                    "scenario_id": "salary_negotiation_1",
                    "mode": "negotiation",
                    "difficulty": "intermediate"
                }
            }
        }
