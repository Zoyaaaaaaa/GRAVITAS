from enum import Enum


class Mode(str, Enum):
    STORYTELLING = "storytelling"
    CRITICAL_THINKING = "critical_thinking"
    NEGOTIATION = "negotiation"
    INTERVIEW = "interview"
    EXECUTIVE_PRESENCE = "executive_presence"
    DEVILS_ADVOCATE = "devils_advocate"
    PERSUASION_LAB = "persuasion_lab"
    REAL_WORLD_SCENARIO = "real_world_scenario"
    RAPID_RESPONSE = "rapid_response"
    HIGH_PRESSURE = "high_pressure"
    ANSWER_ARCHITECT = "answer_architect"
    PROFESSIONAL_IDENTITY = "professional_identity"


class SessionState(str, Enum):
    IDLE = "idle"
    DISCOVERY = "discovery"
    SCENARIO_SETUP = "scenario_setup"
    ROLEPLAY = "roleplay"
    ESCALATION = "escalation"
    SCENARIO_COMPLETE = "scenario_complete"
    EVALUATION = "evaluation"
    COACHING = "coaching"
    RETRY = "retry"
    COMPLETE = "complete"


class Difficulty(str, Enum):
    BEGINNER = "beginner"
    INTERMEDIATE = "intermediate"
    ADVANCED = "advanced"
    EXPERT = "expert"


class EventType(str, Enum):
    SESSION_STARTED = "session_started"
    MODE_SELECTED = "mode_selected"
    SCENARIO_STARTED = "scenario_started"
    USER_TURN_COMPLETED = "user_turn_completed"
    AGENT_TURN_COMPLETED = "agent_turn_completed"
    OBJECTION_RAISED = "objection_raised"
    SCENARIO_COMPLETED = "scenario_completed"
    EVALUATION_COMPLETED = "evaluation_completed"
    SKILL_UPDATED = "skill_updated"
    NEXT_SCENARIO_RECOMMENDED = "next_scenario_recommended"
