from pydantic import BaseModel, Field
from typing import Dict, Optional
from datetime import datetime


class SkillMetrics(BaseModel):
    """Metrics for specific skills"""
    hook: int = Field(default=5, ge=0, le=10)
    structure: int = Field(default=5, ge=0, le=10)
    specificity: int = Field(default=5, ge=0, le=10)
    emotional_impact: int = Field(default=5, ge=0, le=10)
    clarity: int = Field(default=5, ge=0, le=10)
    logic: int = Field(default=5, ge=0, le=10)
    confidence: int = Field(default=5, ge=0, le=10)
    conciseness: int = Field(default=5, ge=0, le=10)
    credibility: int = Field(default=5, ge=0, le=10)
    audience_awareness: int = Field(default=5, ge=0, le=10)
    emotional_intelligence: int = Field(default=5, ge=0, le=10)
    strategic_thinking: int = Field(default=5, ge=0, le=10)


class NegotiationSkills(BaseModel):
    """Negotiation-specific skills"""
    anchoring: int = Field(default=5, ge=0, le=10)
    concessions: int = Field(default=5, ge=0, le=10)
    questioning: int = Field(default=5, ge=0, le=10)
    leverage_identification: int = Field(default=5, ge=0, le=10)
    preparation: int = Field(default=5, ge=0, le=10)
    timing: int = Field(default=5, ge=0, le=10)
    framing: int = Field(default=5, ge=0, le=10)
    silence_usage: int = Field(default=5, ge=0, le=10)


class StorytellingSkills(BaseModel):
    """Storytelling-specific skills"""
    narrative_structure: int = Field(default=5, ge=0, le=10)
    character_development: int = Field(default=5, ge=0, le=10)
    tension_building: int = Field(default=5, ge=0, le=10)
    emotional_contrast: int = Field(default=5, ge=0, le=10)
    authenticity: int = Field(default=5, ge=0, le=10)
    relevance: int = Field(default=5, ge=0, le=10)
    memorability: int = Field(default=5, ge=0, le=10)


class CriticalThinkingSkills(BaseModel):
    """Critical thinking-specific skills"""
    assumption_identification: int = Field(default=5, ge=0, le=10)
    evidence_evaluation: int = Field(default=5, ge=0, le=10)
    counterargument_generation: int = Field(default=5, ge=0, le=10)
    logical_structure: int = Field(default=5, ge=0, le=10)
    bias_recognition: int = Field(default=5, ge=0, le=10)
    causal_reasoning: int = Field(default=5, ge=0, le=10)


class SkillProfile(BaseModel):
    """Complete user skill profile"""
    user_id: str
    overall_metrics: SkillMetrics
    negotiation_skills: NegotiationSkills
    storytelling_skills: StorytellingSkills
    critical_thinking_skills: CriticalThinkingSkills
    total_sessions: int = 0
    last_updated: datetime = Field(default_factory=datetime.utcnow)
    
    class Config:
        json_schema_extra = {
            "example": {
                "user_id": "user_123",
                "overall_metrics": {
                    "hook": 6,
                    "structure": 7,
                    "specificity": 4,
                    "emotional_impact": 5
                },
                "negotiation_skills": {
                    "anchoring": 8,
                    "concessions": 4,
                    "questioning": 6
                },
                "storytelling_skills": {
                    "narrative_structure": 7,
                    "character_development": 5
                },
                "critical_thinking_skills": {
                    "assumption_identification": 7,
                    "evidence_evaluation": 6
                },
                "total_sessions": 15
            }
        }
