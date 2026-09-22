from abc import ABC, abstractmethod
from typing import Optional, Dict, Any

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


class BaseAgent(Agent, ABC):
    """Base class for all specialist agents"""
    
    def __init__(self, role: str, instructions: str):
        try:
            super().__init__(instructions=instructions)
        except:
            self.instructions = instructions
        self.role = role
        self.context: Dict[str, Any] = {}
    
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
        """Build the complete system prompt with context"""
        context = additional_context or {}
        context.update(self.context)
        
        prompt = self.instructions
        
        if context:
            prompt += "\n\nCONTEXT:\n"
            for key, value in context.items():
                prompt += f"{key}: {value}\n"
        
        return prompt
