export type GoalId =
  | 'decision_making'
  | 'crisis_management'
  | 'ransomware_simulation'
  | 'business_continuity'
  | 'regulatory_compliance'
  | 'supply_chain_crisis'
  | 'partner_mix'

export type CapabilityId =
  | 'governance_decisions'
  | 'crisis_communication'
  | 'business_continuity'
  | 'legal_compliance'
  | 'ransom_negotiation'
  | 'reputation_management'
  | 'supply_chain_response'
  | 'gamification'

export type AssessmentDimensionId =
  | 'decision_speed'
  | 'decision_quality'
  | 'escalation_timing'
  | 'communication_clarity'
  | 'compliance_awareness'
  | 'mandate_clarity'
  | 'dilemma_participation'
  | 'framework_adherence'

export type RoundActionType =
  | 'open_discussion'
  | 'structured_framework'
  | 'dilemma_card'
  | 'facilitator_halt'
  | 'decision_log'

export type DocTemplateId =
  | 'role_card'
  | 'decision_log'
  | 'ir_checklist'
  | 'comms_template'
  | 'legal_checklist'
  | 'escalation_matrix'

export type GamificationMode = 'subtle' | 'active' | 'competitive'

export interface GamificationConfig {
  mode: GamificationMode
  pointsTracked: boolean
  pointsVisible: boolean
  leaderboardEnabled: boolean
  speedBonusEnabled: boolean
  dilemmaCardsEnabled: boolean
  twistsEnabled: boolean
}

export const POINT_EVENTS = {
  dilemma_voted_fast: 5,
  decision_logged: 10,
  escalation_correct: 15,
  compliance_identified: 20,
  twist_handled: 25,
  communication_approved: 15,
} as const

export type PointEventKey = keyof typeof POINT_EVENTS

export interface AssessmentEvent {
  timestamp: number
  dimensionId: AssessmentDimensionId
  roundNumber: number
  value: number
  source: 'facilitator' | 'system' | 'participant_vote'
  note?: string
  participantId?: string
  lesson?: string
  scoreImpact?: number
}

export interface SessionAssessment {
  sessionId: string
  goalId: GoalId
  events: AssessmentEvent[]
  dimensionScores: Partial<Record<AssessmentDimensionId, number>>
  overallScore: number
  advice: AssessmentAdvice[]
}

export interface AssessmentAdvice {
  dimensionId: AssessmentDimensionId
  observation: string
  recommendation: string
  priority: 'high' | 'medium' | 'low'
}

export interface AssessmentControl {
  dimensionId: AssessmentDimensionId
  label: string
  value: number
}

export interface DiscussionPhase {
  id: string
  name: string
  durationSeconds: number
  participantPrompt: string
  facilitatorHint: string
  assessmentTrigger?: {
    dimensionId: AssessmentDimensionId
    autoScore?: number
  }
}

export interface DilemmaOption {
  label: string
  consequence: string
}

export interface DilemmaCard {
  id: string
  capability: CapabilityId
  question: string
  optionA: DilemmaOption
  optionB: DilemmaOption
  postRevealContext: string
  assessmentDimension: AssessmentDimensionId
  availableInGoals: GoalId[]
}

export interface FacilitatorRoundContext {
  roundNumber: number
  activeCapabilities: CapabilityId[]
  currentPhase?: DiscussionPhase
  observationPrompts: string[]
  complianceTriggers: string[]
  mandateChecks: string[]
  assessmentControls: AssessmentControl[]
  notes: string
}
