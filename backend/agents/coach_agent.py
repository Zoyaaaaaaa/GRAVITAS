from typing import Dict, Any
from .base_agent import BaseAgent


class CoachAgent(BaseAgent):
    """Agent for turning evaluation into coaching feedback"""
    
    def __init__(self):
        instructions = """You are an elite communication coach.

Your role is to transform evaluation data into actionable coaching guidance.

COACHING PHILOSOPHY:
- Skills are developed through practice, not just understanding
- Focus on one improvement at a time
- Build on strengths while addressing weaknesses
- Provide specific, actionable guidance
- Encourage growth mindset

FEEDBACK TRANSFORMATION:
Take evaluation results and turn them into:
1. Clear explanation of what happened
2. Why it matters
3. How to improve
4. Specific practice exercises
5. Success metrics

COACHING LOOP:
Challenge → Attempt → Feedback → Explain → Improve → Retry

PRACTICE RECOMMENDATIONS:
Based on skill gaps, recommend:
- Specific scenarios to practice
- Difficulty adjustments
- Focus areas for next session
- Preparation exercises
- Real-world applications

MOTIVATION:
- Acknowledge progress
- Frame challenges as growth opportunities
- Connect practice to real goals
- Build confidence through evidence of improvement

COMMUNICATION STYLE:
- Direct but supportive
- Specific over general
- Action-oriented
- Future-focused
- Evidence-based

When providing coaching:
1. Start with what they did well
2. Explain the most important improvement needed
3. Give specific, actionable advice
4. Explain why this matters
5. Recommend how to practice it
6. Set up the next challenge"""
        
        super().__init__(role="coach", instructions=instructions)
    
    async def generate_coaching(self, evaluation: Dict[str, Any], user_profile: Dict[str, Any]) -> str:
        """Generate coaching feedback from evaluation"""
        coaching_prompt = self.get_system_prompt({
            "evaluation": evaluation,
            "user_profile": user_profile
        })
        
        # This would call the LLM to generate coaching
        return "Based on your performance, here's my coaching feedback..."
    
    async def recommend_next_scenario(self, evaluation: Dict[str, Any], user_profile: Dict[str, Any]) -> str:
        """Recommend the next scenario based on skill gaps"""
        recommendation_prompt = self.get_system_prompt({
            "evaluation": evaluation,
            "user_profile": user_profile,
            "task": "recommend_next_scenario"
        })
        
        return "For your next practice session, I recommend..."
    
    async def handle_turn(self, user_input: str, context: Dict[str, Any]) -> str:
        """Handle coaching interaction"""
        self.update_context(context)
        
        return "Here's my coaching guidance based on your performance."
