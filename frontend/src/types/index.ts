export type Mode = 
  | 'storytelling'
  | 'critical_thinking'
  | 'negotiation'
  | 'interview'
  | 'executive_presence'
  | 'devils_advocate'
  | 'persuasion_lab'
  | 'real_world_scenario'
  | 'rapid_response'
  | 'story_to_strategy'
  | 'high_pressure'
  | 'answer_architect'
  | 'professional_identity';

export interface Session {
  id: string;
  user_id: string;
  mode: Mode | null;
  state: string;
  current_scenario_id: string | null;
  turn_count: number;
}

export interface Scenario {
  id: string;
  type: string;
  mode: Mode;
  difficulty: string;
  objective: string;
  opponent: string;
  context: string;
  opening_move: string;
  duration_minutes: number;
}

export interface SkillProfile {
  user_id: string;
  overall_metrics: {
    hook: number;
    structure: number;
    specificity: number;
    emotional_impact: number;
    clarity: number;
    logic: number;
    confidence: number;
    conciseness: number;
    credibility: number;
    audience_awareness: number;
    emotional_intelligence: number;
    strategic_thinking: number;
  };
  negotiation_skills: {
    anchoring: number;
    concessions: number;
    questioning: number;
    leverage_identification: number;
  };
  storytelling_skills: {
    narrative_structure: number;
    character_development: number;
    tension_building: number;
  };
  critical_thinking_skills: {
    assumption_identification: number;
    evidence_evaluation: number;
    counterargument_generation: number;
  };
  total_sessions: number;
}
