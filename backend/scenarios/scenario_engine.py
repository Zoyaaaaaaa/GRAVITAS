from typing import Dict, List, Optional
from ..models.scenario import Scenario
from ..models.enums import Mode, Difficulty


class ScenarioEngine:
    """Engine for managing and selecting scenarios"""
    
    def __init__(self):
        self.scenarios: Dict[str, Scenario] = {}
        self._load_default_scenarios()
    
    def _load_default_scenarios(self):
        """Load default scenarios"""
        # Interview scenarios
        self.scenarios["interview_tell_yourself_1"] = Scenario(
            id="interview_tell_yourself_1",
            type="interview",
            mode=Mode.INTERVIEW,
            difficulty=Difficulty.BEGINNER,
            objective="Practice telling your story concisely",
            opponent="friendly_recruiter",
            opponent_personality="warm, encouraging, professional",
            user_role="candidate",
            user_objective="Introduce yourself effectively",
            opponent_objective="Get to know the candidate",
            what_opponent_knows=["resume basics"],
            what_opponent_doesnt_know=["personal story", "motivations"],
            user_leverage=["unique experience", "skills"],
            opponent_leverage=["job market knowledge"],
            likely_objections=["rambling", "vague answers"],
            opponent_emotional_state="curious, open",
            hidden_information=["company culture details"],
            success_criteria=["concise introduction", "relevant highlights", "clear motivation"],
            escalation_rules=[
                {"condition": "user rambles", "action": "politely interrupt and redirect"},
                {"condition": "user is vague", "action": "ask for specific examples"}
            ],
            constraints=["keep under 2 minutes", "be authentic"],
            context="You're in an initial screening call with a friendly recruiter",
            opening_move="Tell me about yourself and what brings you here today.",
            duration_minutes=5
        )
        
        # Negotiation scenarios
        self.scenarios["negotiation_salary_1"] = Scenario(
            id="negotiation_salary_1",
            type="salary_negotiation",
            mode=Mode.NEGOTIATION,
            difficulty=Difficulty.INTERMEDIATE,
            objective="Negotiate salary effectively",
            opponent="skeptical_recruiter",
            opponent_personality="professional, cost-conscious, fair but firm",
            user_role="candidate",
            user_objective="Negotiate higher compensation",
            opponent_objective="Fill position within budget",
            what_opponent_knows=["current salary", "market rates"],
            what_opponent_doesnt_know=["other offers", "minimum acceptable"],
            user_leverage=["unique skills", "competing interviews"],
            opponent_leverage=["budget constraints", "other candidates"],
            likely_objections=["budget limits", "internal equity", "market data"],
            opponent_emotional_state="neutral, slightly pressured by hiring needs",
            hidden_information=["hiring urgency", "actual budget range"],
            success_criteria=["defend anchor", "ask for specific amount", "avoid early concession"],
            escalation_rules=[
                {"condition": "user concedes quickly", "action": "push harder on budget"},
                {"condition": "user stays firm", "action": "offer alternative benefits"}
            ],
            constraints=["must remain professional", "cannot lie about offers"],
            context="You're negotiating salary for a senior engineering role",
            opening_move="We're excited about your candidacy. What are your salary expectations?",
            duration_minutes=10
        )
        
        # Storytelling scenarios
        self.scenarios["storytelling_failure_1"] = Scenario(
            id="storytelling_failure_1",
            type="storytelling",
            mode=Mode.STORYTELLING,
            difficulty=Difficulty.INTERMEDIATE,
            objective="Tell a compelling failure story",
            opponent="interviewer",
            opponent_personality="curious, looking for growth mindset",
            user_role="candidate",
            user_objective="Share a failure that shows learning",
            opponent_objective="Assess resilience and growth",
            what_opponent_knows=["nothing about this story"],
            what_opponent_doesnt_know=["the specific failure", "what you learned"],
            user_leverage=["authentic learning", "improvement"],
            opponent_leverage=["judgment of character"],
            likely_objections=["blaming others", "no learning"],
            opponent_emotional_state="neutral, evaluating",
            hidden_information=["cultural fit assessment"],
            success_criteria=["ownership of failure", "clear learning", "positive outcome"],
            escalation_rules=[
                {"condition": "user blames others", "action": "ask about personal responsibility"},
                {"condition": "no clear learning", "action": "ask what you'd do differently"}
            ],
            constraints=["be authentic", "show growth"],
            context="Tell me about a time you failed and what you learned",
            opening_move="Tell me about a significant failure in your career and what you learned from it.",
            duration_minutes=8
        )
    
    def get_scenario(self, scenario_id: str) -> Optional[Scenario]:
        """Get a scenario by ID"""
        return self.scenarios.get(scenario_id)
    
    def get_scenarios_by_mode(self, mode: Mode) -> List[Scenario]:
        """Get all scenarios for a specific mode"""
        return [s for s in self.scenarios.values() if s.mode == mode]
    
    def get_scenarios_by_difficulty(self, difficulty: Difficulty) -> List[Scenario]:
        """Get all scenarios for a specific difficulty level"""
        return [s for s in self.scenarios.values() if s.difficulty == difficulty]
    
    def select_scenario(
        self,
        mode: Mode,
        difficulty: Difficulty,
        user_skill_level: Dict[str, int]
    ) -> Scenario:
        """Select an appropriate scenario based on mode, difficulty, and user skills"""
        candidates = self.get_scenarios_by_mode(mode)
        
        # Filter by difficulty
        if difficulty != Difficulty.BEGINNER:
            candidates = [s for s in candidates if s.difficulty == difficulty]
        
        # Select based on skill gaps (simplified)
        if candidates:
            return candidates[0]
        
        # Fallback to any scenario in the mode
        mode_scenarios = self.get_scenarios_by_mode(mode)
        if mode_scenarios:
            return mode_scenarios[0]
        
        # Ultimate fallback
        return list(self.scenarios.values())[0]
    
    def add_scenario(self, scenario: Scenario):
        """Add a new scenario"""
        self.scenarios[scenario.id] = scenario
    
    def remove_scenario(self, scenario_id: str):
        """Remove a scenario"""
        if scenario_id in self.scenarios:
            del self.scenarios[scenario_id]
