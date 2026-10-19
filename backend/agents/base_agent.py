from abc import ABC, abstractmethod
from typing import Optional, Dict, Any, List
import re

try:
    from livekit.agents import Agent
    from livekit.plugins import inference
except ImportError:
    # Fallback for testing without LiveKit
    class Agent:
        def __init__(self, instructions: str = ""):
            self.instructions = instructions
            self.context = {}
        def update_context(self, new_context: Dict[str, Any]):
            self.context.update(new_context)
    inference = None


class GuardrailSystem:
    """Content safety and focus guardrails for all agents"""
    
    # Topics to avoid - prevents drift into social/political/controversial content
    RESTRICTED_TOPICS = [
        "politics", "political", "election", "government", "policy",
        "religion", "religious", "faith", "spiritual", "god",
        "social justice", "activism", "protest", "movement",
        "controversial", "debate society", "culture war",
        "ideology", "partisan", "left wing", "right wing",
        "immigration", "abortion", "gun control", "climate change debate"
    ]
    
    # Professional focus - what agents SHOULD do
    PROFESSIONAL_FOCUS = [
        "communication skills", "professional development", "workplace scenarios",
        "business communication", "leadership", "negotiation", "interviews",
        "storytelling", "critical thinking", "persuasion", "strategy",
        "career development", "executive presence", "professional identity"
    ]
    
    @classmethod
    def check_content_safety(cls, content: str) -> tuple[bool, Optional[str]]:
        """
        Check if content violates guardrails.
        Returns (is_safe, violation_reason)
        """
        content_lower = content.lower()
        
        # Check for restricted topics
        for topic in cls.RESTRICTED_TOPICS:
            if topic in content_lower:
                return False, f"Content contains restricted topic: {topic}"
        
        return True, None
    
    @classmethod
    def get_guardrail_instruction(cls) -> str:
        """Get the guardrail instruction string to append to all prompts"""
        return f"""
---

CONTENT GUARDRAILS - STRICTLY ENFORCED:

1. PROFESSIONAL FOCUS ONLY:
   - Discuss ONLY professional communication, business scenarios, workplace skills
   - Valid topics: {', '.join(cls.PROFESSIONAL_FOCUS[:5])}, etc.
   - Goal: Improve professional communication skills

2. FORBIDDEN TOPICS (DO NOT DISCUSS):
   - Politics, elections, government policy
   - Religion, faith, spirituality
   - Social movements, activism, protests
   - Culture wars, ideological debates
   - Any controversial social/political content

3. BEHAVIOR RULES:
   - If user tries to discuss forbidden topics, politely redirect: "I'm designed to help with professional communication skills. Let's focus on [relevant professional topic]."
   - Never take positions on social/political issues
   - Never engage in ideological debates
   - Keep all examples professional and workplace-related
   - If uncertain about a topic, default to declining: "I focus on professional communication coaching. Can we discuss a workplace scenario instead?"

4. RESPONSE QUALITY:
   - Be concise and direct
   - Use specific, actionable advice
   - Ground feedback in the professional context
   - Avoid generic platitudes
   - Focus on skill development, not personality

These guardrails are mandatory. Violations will result in unprofessional responses.
"""


class BaseAgent(Agent, ABC):
    """Base class for all specialist agents"""
    
    def __init__(self, role: str, instructions: str):
        try:
            super().__init__(instructions=instructions)
        except:
            self.instructions = instructions
        self.role = role
        self.context: Dict[str, Any] = {}
        self.guardrail_system = GuardrailSystem()
    
    @abstractmethod
    async def handle_turn(self, user_input: str, context: Dict[str, Any]) -> str:
        """Handle a user turn and return the agent's response"""
        pass
    
    def update_context(self, new_context: Dict[str, Any]):
        """Update the agent's context"""
        if not hasattr(self, 'context'):
            self.context = {}
        self.context.update(new_context)
    
    def get_system_prompt(self, additional_context: Dict[str, Any] = None) -> str:
        """Build the complete system prompt with context and guardrails"""
        context = additional_context or {}
        context.update(self.context)
        
        prompt = self.instructions
        
        # Add guardrails
        prompt += self.guardrail_system.get_guardrail_instruction()
        
        if context:
            prompt += "\n\nSESSION CONTEXT:\n"
            for key, value in context.items():
                prompt += f"{key}: {value}\n"
        
        return prompt
    
    def validate_user_input(self, user_input: str) -> tuple[bool, Optional[str]]:
        """
        Validate user input against guardrails.
        Returns (is_valid, violation_reason)
        """
        return self.guardrail_system.check_content_safety(user_input)
