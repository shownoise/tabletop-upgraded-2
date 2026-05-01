export type Role =
  | 'it_manager'
  | 'soc_analyst'
  | 'ciso'
  | 'head_of_comms'
  | 'legal'
  | 'ceo'
  | 'cfo'

export const ROLE_META: Record<Role, { label: string; team: 'crisis_management' | 'technical_it'; description: string }> = {
  it_manager:    { label: 'IT Manager',             team: 'technical_it',      description: 'IT infrastructure, systems isolation' },
  soc_analyst:   { label: 'SOC Analyst',            team: 'technical_it',      description: 'Security monitoring, threat analysis' },
  ciso:          { label: 'CISO',                   team: 'crisis_management', description: 'Security strategy, incident coordination' },
  head_of_comms: { label: 'Head of Communications', team: 'crisis_management', description: 'Internal and external communications' },
  legal:         { label: 'Legal',                  team: 'crisis_management', description: 'Compliance, regulatory notifications' },
  ceo:           { label: 'CEO',                    team: 'crisis_management', description: 'Executive decisions, board communication' },
  cfo:           { label: 'CFO',                    team: 'crisis_management', description: 'Financial decisions, insurance, ransom' },
}

export type SimulationMode = 'event' | 'training'
export type RoundPhase = 'inject' | 'discussion' | 'decision' | 'review'

export interface RoleAction {
  id: string
  label: string
  description: string
  allowedRoles: Role[]  // empty = all roles allowed
  isRecommended?: boolean
  irPlanAligned: boolean
  consequence?: string
}

export interface SubmittedDecision {
  participantId: string
  participantName: string
  role: Role
  roundIndex: number
  actionId: string
  actionLabel: string
  reasoning: string
  submittedAt: string
  isWrongRole: boolean
  isIrDeviation: boolean
}

export interface GovernanceFlag {
  id: string
  participantId: string
  participantName: string
  role: Role
  roundIndex: number
  type: 'wrong_role' | 'ir_plan_deviation'
  description: string
  flaggedAt: string
}

export interface SessionReport {
  sessionId: string
  generatedAt: string
  mode: SimulationMode
  totalRounds: number
  totalDecisions: number
  scores: {
    decisionQuality: number      // % recommended decisions
    processAdherence: number     // % IR-plan aligned decisions
    roleCompliance: number       // % decisions by authorized role
  }
  perRound: Array<{
    roundIndex: number
    roundTitle: string
    decisions: SubmittedDecision[]
    flags: GovernanceFlag[]
  }>
  topFlags: GovernanceFlag[]
  recommendations: string[]
}

export type Urgency = "low" | "medium" | "high" | "critical"

export type InjectType =
  | "alert"
  | "intel"
  | "media"
  | "executive"
  | "technical"
  | "regulatory"
  | "social"
  | "internal"

export type InjectChannel =
  | "whatsapp"
  | "slack"
  | "email"
  | "siem_alert"
  | "sms"
  | "phone"
  | "news_ticker"
  | "system_alert"
  | "raw"

export interface Inject {
  id: string
  type: InjectType
  channel?: InjectChannel
  title: string
  content: string
  urgency: Urgency
  source?: string
  senderName?: string
  senderHandle?: string
  timestamp?: string
}

export interface FacilitatorNotes {
  discussionGoal: string
  keyQuestions: string[]
  hints: string[]
  expectedDecisions: string[]
  redFlags: string[]
}

export interface Round {
  round_number: number
  title: string
  situation_update: string
  injects: Inject[]
  timerMinutes?: number
  facilitatorNotes?: FacilitatorNotes
  roleActions?: RoleAction[]
}

export interface Scenario {
  scenario_title: string
  scenario_summary: string
  rounds: Round[]
}

export interface ExerciseConfig {
  sector: string
  companySize: string
  criticalSystems: string
  crownJewels: string
  irMaturity: string
  scenarioType: string
  duration: string
  teams: string
  irTemplateText?: string
}

export interface Participant {
  id: string
  name: string
  team?: string
  role?: Role
  joinedAt: number
}

export interface PushedInject {
  inject: Inject
  roundIndex: number
  pushedAt: number
}

export type TimelineEventType =
  | "session_created"
  | "session_started"
  | "session_ended"
  | "round_changed"
  | "participant_joined"
  | "inject_pushed"
  | "surprise_inject"

export interface TimelineEvent {
  id: string
  timestamp: number
  type: TimelineEventType
  data: Record<string, unknown>
}

export interface SessionState {
  id: string
  joinCode: string
  config: ExerciseConfig
  scenario: Scenario
  currentRound: number
  status: "lobby" | "active" | "ended"
  participants: Participant[]
  pushedInjects: PushedInject[]
  timeline: TimelineEvent[]
  createdAt: number
  roundStartedAt?: number
  // New fields — all optional for backward compat
  mode?: SimulationMode
  roundPhase?: RoundPhase
  submittedDecisions?: SubmittedDecision[]
  governanceFlags?: GovernanceFlag[]
}

export interface PublicState {
  session: SessionState | null
}

export type LiveEventName =
  | "participant_joined"
  | "start_session"
  | "next_round"
  | "prev_round"
  | "push_inject"
  | "surprise_inject"
  | "session_ended"
  | "session_reset"
  | "phase_changed"
  | "decision_submitted"
  | "role_assigned"

export interface LiveEvent {
  name: LiveEventName
  payload: Record<string, unknown>
  ts: number
}

export type StreamMessage =
  | { type: "state"; data: PublicState }
  | { type: "event"; data: LiveEvent }

// ─── Decision mechanics ───

export interface DecisionChoice {
  participantId: string
  optionId: string
  madeAt: number
}

export interface RoundDecision {
  decisionPointId: string
  choice: DecisionChoice | null // null = not yet decided
}

// ─── Participant feedback (per round) ───

export interface ParticipantFeedback {
  participantId: string
  participantName: string
  roundIndex: number
  worked: string
  didnt: string
  gap: string
  submittedAt: number
}

// ─── Facilitator response (per round) ───

export interface FacilitatorFeedback {
  roundIndex: number
  notes: string
  submittedAt: number
}

// ─── Extended SessionState ───

export interface RoundProgress {
  roundIndex: number
  // feedback submitted per participant
  participantFeedback: ParticipantFeedback[]
  // decision made (if round has decision point)
  decision: RoundDecision | null
  // facilitator debrief done
  facilitatorDone: boolean
}
