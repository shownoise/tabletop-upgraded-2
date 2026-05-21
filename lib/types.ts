import type { GoalId, AssessmentEvent } from "@/lib/engine/types"
export type { GoalId }

export type Role =
  | 'it_manager'
  | 'ciso'
  | 'head_of_comms'
  | 'legal'
  | 'ceo'
  | 'cfo'
  | 'system_admin'
  | 'hr_lead'
  | 'ops_manager'

export const ROLE_META: Record<Role, {
  label: string
  team: 'crisis_management' | 'technical_it'
  description: string
  authorities: string[]
  notResponsibleFor: string
}> = {
  ceo: {
    label: 'CEO',
    team: 'crisis_management',
    description: 'Executive decisions, board communication',
    authorities: [
      'Beslissen over betaling losgeld (of weigering)',
      'Openbare communicatie autoriseren',
      'Communicatie naar board en aandeelhouders',
      'Escalatie naar overheid of politie',
      'Noodsituatie intern uitroepen',
    ],
    notResponsibleFor: 'Technische maatregelen, GDPR-meldingen opstellen',
  },
  ciso: {
    label: 'CISO',
    team: 'crisis_management',
    description: 'Security strategy, incident coordination',
    authorities: [
      'Coördineren van de incidentrespons',
      'Aanbevelen van isolatie en containment-maatregelen',
      'Aansturing externe IR-partij',
      'Technische risicoafweging naar directie communiceren',
      'Beslissen over beveiligingsmaatregelen',
    ],
    notResponsibleFor: 'Definitieve betaling losgeld, juridische meldingen',
  },
  cfo: {
    label: 'CFO',
    team: 'crisis_management',
    description: 'Financial decisions, insurance, ransom',
    authorities: [
      'Goedkeuren van financiële noodbesluiten',
      'Contact met verzekeraar opnemen',
      'Financiële schade inschatten en rapporteren',
      'Advies over losgeldsituatie geven aan CEO',
    ],
    notResponsibleFor: 'Technische herstelstappen, communicatie naar pers',
  },
  legal: {
    label: 'Legal',
    team: 'crisis_management',
    description: 'Compliance, regulatory notifications',
    authorities: [
      'AP-melding coördineren (GDPR: binnen 72 uur)',
      'NIS2-meldplicht bewaken richting NCSC',
      'Juridisch advies over aansprakelijkheid geven',
      'Contractuele verplichtingen richting klanten beoordelen',
    ],
    notResponsibleFor: 'Technische en financiële beslissingen',
  },
  head_of_comms: {
    label: 'Head of Communications',
    team: 'crisis_management',
    description: 'Internal and external communications',
    authorities: [
      'Interne communicatie naar medewerkers verzorgen',
      'Perscommunicatie afstemmen met CEO',
      'Social media bewaken en reageren',
      'Woordvoerder namens de organisatie',
    ],
    notResponsibleFor: 'Technische en financiële beslissingen',
  },
  hr_lead: {
    label: 'HR Lead',
    team: 'crisis_management',
    description: 'Employee communication and insider threat cases',
    authorities: [
      'Medewerkerscommunicatie coördineren',
      'Insider threat-onderzoek initiëren (samen met Legal)',
      'Crisisopvang en welzijn medewerkers organiseren',
    ],
    notResponsibleFor: 'Technische en financiële beslissingen, perscommunicatie',
  },
  ops_manager: {
    label: 'Operations Manager',
    team: 'crisis_management',
    description: 'Business continuity and operational impact',
    authorities: [
      'Operationele impact inschatten en rapporteren',
      'Noodprocedures en handmatige processen activeren',
      'Herstelprioriteiten op basis van bedrijfskriticaliteit bepalen',
      'Coördineren met externe partners en leveranciers',
    ],
    notResponsibleFor: 'Technische herstelstappen, financiële goedkeuring',
  },
  it_manager: {
    label: 'IT Manager',
    team: 'technical_it',
    description: 'IT infrastructure, systems isolation',
    authorities: [
      'Systemen isoleren en netwerk segmenteren',
      'IT-infrastructuur monitoren en beheren',
      'Backups inventariseren en herstelbaarheid bepalen',
      'Technische maatregelen coördineren',
    ],
    notResponsibleFor: 'Businessbeslissingen, communicatie naar pers of board',
  },
  system_admin: {
    label: 'System Administrator',
    team: 'technical_it',
    description: 'Technical validation, logs, backups, infrastructure',
    authorities: [
      'Logs en forensische data veiligstellen',
      'Backupsystemen controleren en herstellen',
      'Technische validatie van containment-stappen uitvoeren',
    ],
    notResponsibleFor: 'Businessbeslissingen, communicatie',
  },
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

export interface LearningObjective {
  id: string
  description: string
  module: ModuleId
  measuredBy: 'decision' | 'timing' | 'special' | 'manual'
  triggerActionIds?: string[]
  triggerSpecialType?: SpecialType
  achieved?: boolean
  achievedAt?: string
}

export interface FacilitatorRoundScore {
  roundIndex: number
  score: -1 | 0 | 1
  scoredAt: string
}

export interface SpecialScore {
  type: SpecialType
  score: number
  completedAt: string
}

export interface SessionReport {
  sessionId: string
  generatedAt: string
  mode: SimulationMode
  totalRounds: number
  totalDecisions: number
  scores: {
    decisionQuality: number
    processAdherence: number
    roleCompliance: number
    facilitatorScore: number
    objectivesAchieved: number
    objectivesTotal: number
  }
  perRound: Array<{
    roundIndex: number
    roundTitle: string
    decisions: SubmittedDecision[]
    flags: GovernanceFlag[]
    facilitatorScore?: -1 | 0 | 1
  }>
  perObjective: Array<{
    roundIndex: number
    objective: LearningObjective
    achieved: boolean
    achievedAt?: string
  }>
  topFlags: GovernanceFlag[]
  recommendations: string[]
  facilitatorRoundScores?: FacilitatorRoundScore[]
  specialScores?: SpecialScore[]
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
  // Legacy channels (render layer supports both sets)
  | "whatsapp"
  | "slack"
  | "siem_alert"
  | "news_ticker"
  | "system_alert"
  | "raw"
  // New scenario channels
  | "email"
  | "sms"
  | "phone"
  | "teams"
  | "siem"
  | "edr"
  | "news"
  | "memo"
  | "ransom_note"

// ─── New scenario-architecture types ───

export type ScenarioType =
  | 'ransomware_double_extortion'
  | 'insider_threat'
  | 'bec_cfo_fraud'
  | 'supply_chain_compromise'

export type DecisionFramework =
  | 'bob'
  | 'ooda'
  | 'dair'
  | 'nist_ir'
  | 'free'

export type ObservationLens =
  | 'symptoms'
  | 'impact'
  | 'external_reactions'
  | 'attacker_voice'

export type ModuleId =
  | 'detection_sensemaking'
  | 'triage_containment'
  | 'business_continuity'
  | 'crisis_communication'
  | 'legal_regulatory'
  | 'ransom_negotiation'
  | 'recovery_lessons'
  | 'insider_investigation'
  | 'supply_chain_response'
  | 'forensic_attribution'

export type EmotionalTone =
  | 'clinical'
  | 'urgent'
  | 'panicked'
  | 'menacing'
  | 'professional'

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
  targetTeam?: 'all' | 'crisis_management' | 'technical_it'
  targetRoles?: Role[]   // if set, ONLY these roles see this inject (overrides targetTeam)
  nis2Relevant?: boolean
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
  learningObjectives?: LearningObjective[]
}

export interface Scenario {
  scenario_title: string
  scenario_summary: string
  rounds: Round[]
}

export type AiIntensity = 'off' | 'lean' | 'full'
export type SpecialsMode = 'off' | 'static' | 'ai'
export type SpecialType = 'ransomware_negotiation' | 'ap_notification' | 'journalist_qa'

export interface SpecialChoice {
  id: string
  label: string
  quality: 'bad' | 'neutral' | 'good'
  scoreImpact: number   // -2 to +2
  hint: string          // brief rationale shown after selection
}

export interface SpecialMessage {
  id: string
  sender: 'counterpart' | 'participant'
  participantId?: string
  participantName?: string
  text: string
  timestamp: string
  // set on participant messages (scripted: chosen, ai: evaluated)
  choiceQuality?: 'bad' | 'neutral' | 'good'
  scoreImpact?: number
  aiEvaluationHint?: string
  // choices offered to participant at this turn (set on counterpart messages, scripted only)
  choices?: SpecialChoice[]
}

export interface SpecialEvent {
  id: string
  type: SpecialType
  mode: 'static' | 'ai'
  status: 'active' | 'completed'
  assignedParticipantId?: string
  assignedParticipantName?: string
  assignedRole?: Role
  triggeredAt: number
  completedAt?: number
  messages: SpecialMessage[]
  formData?: Record<string, string>
  totalScore?: number       // cumulative score from choices
  currentTurnIndex?: number // which scripted turn we're on
}

export type ITMaturity = 'low' | 'medium' | 'high'
export type SecurityCapability =
  | 'no_soc'
  | 'small_it'
  | 'outsourced_it'
  | 'it_mssp'
  | 'it_ir_retainer'
export type TeamStructure =
  | 'crisis_only'
  | 'it_only'
  | 'crisis_it'
  | 'full'
export type ExerciseGoal =
  | 'nis2_readiness'
  | 'board_decisions'
  | 'crisis_comms'
  | 'ransomware_tabletop'
  | 'technical_containment'
  | 'supplier_incident'
  | 'data_breach'
export type DifficultyLevel = 'beginner' | 'intermediate' | 'advanced'
export type RealismLevel = 'standard' | 'high' | 'extreme'

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
  aiIntensity?: AiIntensity
  specialsMode?: SpecialsMode
  itMaturity?: ITMaturity
  securityCapability?: SecurityCapability
  existingPlans?: string[]
  exerciseGoal?: ExerciseGoal
  teamStructure?: TeamStructure
  teamCount?: number
  roundCount?: number
  timerPerRound?: number
  difficulty?: DifficultyLevel
  realism?: RealismLevel
  dynamicBranching?: boolean
  selectedRoles?: Role[]
  decisionFramework?: DecisionFramework
  goalId?: GoalId
}

export interface Participant {
  id: string
  name: string
  team?: string
  role?: Role
  joinedAt: number
  readyAt?: number
}

export interface ActivePhaseState {
  roundNumber: number
  phaseIndex: number
  phaseStartedAt: number   // unix ms — extending shifts this forward by +120000
  extended: boolean
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
  | "special_triggered"
  | "special_completed"

export interface TimelineEvent {
  id: string
  timestamp: number
  type: TimelineEventType
  data: Record<string, unknown>
}

export interface RoleDocument {
  id: string
  targetRole: Role
  title: string
  type: 'policy' | 'checklist' | 'template' | 'plan' | 'reference'
  content: string   // markdown-lite text shown to participant
  referenceTag?: string  // e.g. 'insurance', 'gdpr', 'ransom' — matches inject/decision context
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
  startedAt?: number
  roundStartedAt?: number
  // New fields — all optional for backward compat
  mode?: SimulationMode
  roundPhase?: RoundPhase
  submittedDecisions?: SubmittedDecision[]
  governanceFlags?: GovernanceFlag[]
  specialEvents?: SpecialEvent[]
  documents?: RoleDocument[]
  facilitatorRoundScores?: FacilitatorRoundScore[]
  specialScores?: SpecialScore[]
  assessmentEvents?: AssessmentEvent[]
  activeDiscussionPhase?: ActivePhaseState
  currentDiscussionPrompt?: string
  currentDiscussionPhaseIndex?: number
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
  | "special_triggered"
  | "special_message"
  | "special_completed"
  | "discussion_phase_changed"
  | "participant_ready"

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
