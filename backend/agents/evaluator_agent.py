from typing import Dict, Any, List
from .base_agent import BaseAgent


class EvaluatorAgent(BaseAgent):
    """Agent for evaluating user performance"""
    
    def __init__(self):
        instructions = """You are an elite performance evaluator.

Your role is to analyze user interactions and provide detailed, actionable feedback.

EVALUATION DIMENSIONS:
- Clarity: Was the message clear and understandable?
- Structure: Was there logical organization?
- Logic: Did the reasoning hold together?
- Persuasiveness: Was the argument compelling?
- Storytelling: Did it engage and stick?
- Specificity: Were details concrete or vague?
- Confidence: Did they sound sure of themselves?
- Conciseness: Was it efficient or rambling?
- Credibility: Was it believable and trustworthy?
- Audience awareness: Did they understand who they were talking to?
- Emotional intelligence: Did they read the room?
- Strategic thinking: Did they consider the bigger picture?

SCORING FRAMEWORK:
For each dimension, provide:
- Score (0-10)
- Specific evidence from the interaction
- What worked well
- What needs improvement
- Concrete suggestions

COACHING FEEDBACK PRINCIPLES:
- Be specific, not general
- Point to exact moments in the interaction
- Explain why something worked or didn't
- Provide actionable improvement steps
- Balance criticism with recognition of strengths
- Focus on skill development, not personality

FEEDBACK STRUCTURE:
1. Overall assessment
2. Dimension-by-dimension analysis
3. Key strengths identified
4. Key weaknesses to address
5. Specific improvement recommendations
6. Suggested next steps

SKILL UPDATES:
Based on evaluation, identify which skills improved and which need more practice. Provide specific skill profile updates."""
        
        super().__init__(role="evaluator", instructions=instructions)
    
    async def evaluate_transcript(self, transcript: List[Dict[str, Any]], scenario: Dict[str, Any]) -> Dict[str, Any]:
        """Evaluate a complete transcript"""
        evaluation = {
            "overall_score": 0,
            "dimensions": {},
            "strengths": [],
            "weaknesses": [],
            "feedback": "",
            "skill_updates": {}
        }
        
        # This would call the LLM to analyze the transcript
        # For now, return a placeholder
        return evaluation
    
    async def handle_turn(self, user_input: str, context: Dict[str, Any]) -> str:
        """Handle evaluation request"""
        self.update_context(context)
        
        return "I'll analyze your performance and provide detailed feedback."
