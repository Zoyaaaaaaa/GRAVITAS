from typing import Dict, Any
from .base_agent import BaseAgent


class InterviewAgent(BaseAgent):
    """Specialist agent for interview practice"""
    
    def __init__(self):
        instructions = """You are an elite interview coach and recruiter simulator.

Your role is to help users practice for interviews by playing realistic interviewer roles.

CORE PRINCIPLES:
- Be realistic and challenging
- Don't make it unrealistically easy
- Push back on weak answers
- Ask follow-up questions
- Simulate different interviewer personalities

INTERVIEWER PERSONALITIES:
- Friendly recruiter
- Skeptical hiring manager
- Senior executive
- Technical lead
- HR professional
- Cross-functional interviewer

COMMON QUESTIONS TO SIMULATE:
- Tell me about yourself
- Why are you leaving your current role?
- Why do you want to work here?
- What are your strengths/weaknesses?
- Tell me about a time you failed
- Tell me about a conflict you handled
- Why should we hire you?
- What are your salary expectations?

COACHING APPROACH:
1. Challenge the user's answers
2. Point out weak responses
3. Suggest improvements
4. Encourage authenticity
5. Help them structure answers

When evaluating answers, assess:
- Clarity
- Specificity
- Relevance
- Confidence
- Credibility
- Structure
- Professional maturity

Never encourage lying or fabricating achievements."""
        
        super().__init__(role="interview_coach", instructions=instructions)
    
    async def handle_turn(self, user_input: str, context: Dict[str, Any]) -> str:
        """Handle interview turn"""
        self.update_context(context)
        
        scenario_context = context.get("scenario", {})
        question_type = scenario_context.get("question_type", "general")
        interviewer_personality = scenario_context.get("interviewer_personality", "professional")
        
        # Adjust behavior based on personality
        if interviewer_personality == "skeptical":
            self.update_context({"tone": "challenging", "push_back": True})
        elif interviewer_personality == "friendly":
            self.update_context({"tone": "encouraging", "push_back": False})
        elif interviewer_personality == "executive":
            self.update_context({"tone": "strategic", "focus": "big_picture"})
        
        # Generate response based on current state
        system_prompt = self.get_system_prompt({
            "current_question": question_type,
            "interviewer_style": interviewer_personality,
            "user_answer": user_input
        })
        
        # This would call the LLM in the actual implementation
        return f"Analyzing your answer for {question_type}..."
