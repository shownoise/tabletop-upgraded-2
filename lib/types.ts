import type { GoalId, AssessmentEvent } from "@/lib/engine/types"
import type { ScenarioGraph } from "@/lib/graph/types"
import type { SupervisionArea } from "@/lib/engine/supervision"
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

export const ROLE_FALLBACK: Partial<Record<Role, Role[]>> = {
  head_of_comms: ["ceo", "ciso"],
  ops_manager:   ["cfo", "ceo"],
  hr_lead:       ["legal", "ceo"],
  legal:         ["ciso", "ceo"],
  cfo:           ["ceo"],
  it_manager:    ["ciso", "system_admin"],
  system_admin:  ["it_manager", "ciso"],
  ciso:          ["it_manager", "ceo"],
  ceo:           ["ciso", "cfo"],
}

export type SimulationMode = 'event' | 'training'
// Deel B §4.2 — 'lock' is server-authoritatieve fase tussen decision en review
// waarin geen mutaties meer worden geaccepteerd (Event Mode reveal-berekening).
// In ASSESSMENT-mode blijft de flow decision → review; lock wordt geskipt.
export type RoundPhase = 'inject' | 'discussion' | 'decision' | 'lock' | 'review'

export type AssessmentDimensionKey =
  | 'decision_speed'
  | 'decision_quality'
  | 'escalation_timing'
  | 'communication_clarity'
  | 'compliance_awareness'
  | 'mandate_clarity'
  | 'dilemma_participation'
  | 'framework_adherence'

// Kwaliteits-ranking van een keuze in de dimensies-context. Author zet dit
// zodat het rapport én de review-fase kunnen laten zien welke van de opties
// achteraf de "beste" was — niet als hard oordeel maar als IR-retainer perspectief.
export type ChoiceQuality = 'best' | 'good' | 'poor' | 'wrong'

// Multi-dimensie score-map. Een keuze kan meerdere dimensies raken (bv. snel
// handelen = +decision_speed maar -compliance_awareness) — die trade-off is
// precies wat we zichtbaar willen maken.
export type ScoreImpacts = Partial<Record<AssessmentDimensionKey, number>>

export interface RoleAction {
  id: string
  label: string
  description: string
  allowedRoles: Role[]  // empty = all roles allowed
  isRecommended?: boolean
  irPlanAligned: boolean
  consequence?: string
  // Legacy single-dim scoring — blijft voor backwards compat. Voor nieuwe
  // scenario's gebruik scoreImpacts. resolveScoreImpacts() promoveert oude
  // structuur naar de map.
  scoreImpact?: number
  linkedDimension?: AssessmentDimensionKey
  // Nieuw: multi-dimensie scoring. { decision_speed: +2, compliance_awareness: -1 }
  scoreImpacts?: ScoreImpacts
  // Author markeert welke van de rol-acties de "beste" was in de dimensie-context.
  qualityRank?: ChoiceQuality
  // Facilitator/IR-retainer commentaar dat verschijnt in de review-fase én rapport.
  // "Wij snappen deze keuze wegens speed, maar wettelijk zit je bij X."
  facilitatorCommentary?: string
  lessonLearned?: string
  respondsToMisleading?: boolean
  pushesInject?: {
    title: string
    content: string
    channel?: InjectChannel
    reliability?: InjectReliability
    onlyToSubmitter?: boolean
  }
  supervisionAreas?: SupervisionArea[]
}

// Promote legacy {scoreImpact, linkedDimension} to the new map shape so that
// scoring code only has to look at scoreImpacts. Kept in one place so the
// legacy fields can be removed later without touching every consumer.
export function resolveScoreImpacts(a: Pick<RoleAction, 'scoreImpact' | 'linkedDimension' | 'scoreImpacts'>): ScoreImpacts {
  if (a.scoreImpacts && Object.keys(a.scoreImpacts).length > 0) return a.scoreImpacts
  if (typeof a.scoreImpact === 'number' && a.linkedDimension) {
    return { [a.linkedDimension]: a.scoreImpact }
  }
  return {}
}

export interface IrRetainerProfile {
  name: string
  activationNumber: string
  activationEmail?: string
  authorizedActivators: string[]
  slaMinutesToFirstContact: number
  handoffChecklist: string[]
  scopeIncludes: string[]
  scopeExcludes: string[]
}

export type NotificationType = 'ncsc_24h' | 'ncsc_72h' | 'ncsc_final' | 'ap_72h'

export type MeldplichtPromptTrigger =
  | 'inject_flagged'
  | 'decision_taken'
  | 'chaser_fired'
  | 'facilitator_manual'

export interface MeldplichtPrompt {
  id: string
  type: NotificationType
  roundNumber: number
  triggeredAt: number
  triggerReason: {
    kind: MeldplichtPromptTrigger
    sourceId?: string
    summary: string
  }
  status: 'open' | 'drafted' | 'submitted' | 'dismissed'
}

export interface NotificationDraft {
  id: string
  type: NotificationType
  createdBy: string
  createdAt: number
  submittedAt?: number
  content: {
    suspectMalicious?: string
    crossBorderImpact?: string
    responsibleContact?: string
    initialImpactAssessment?: string
    iocs?: string
    mitigations?: string
    otherFields?: Record<string, string>
  }
  score?: {
    completeness: number
    onTime: boolean
    submittedBeforeChaser: boolean
  }
}

export interface RetainerActivationState {
  chosenActivator?: string
  chosenActivatorAuthorized?: boolean
  dialedAt?: number
  handoffCompleted?: string[]
  updatedAt: number
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

export type InjectReliability = 'fact' | 'assumption' | 'misleading'

export interface InjectSpanAnnotation {
  id: string
  start: number
  end: number
  tag: InjectReliability
  authorNote?: string
}
export type BobPhase = 'beeldvorming' | 'oordeel' | 'besluit'

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
  // Drip delivery: if > 0, this inject appears X seconds after the round starts (client-side reveal).
  deliverySeconds?: number
  // BOB-training: how reliable is this info? Ground truth — hidden from participants during play,
  // revealed in the review phase.
  reliability?: InjectReliability
  // Optional per-span ground truth for annotation-level scoring (Phase D.11).
  groundTruthAnnotations?: InjectSpanAnnotation[]
  supervisionAreas?: SupervisionArea[]
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

export interface ExerciseConfig {
  sector: string
  companySize: string
  criticalSystems: string
  crownJewels: string
  scenarioType: string
  duration: string
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
  selectedRoles?: Role[]
  decisionFramework?: DecisionFramework
  goalId?: GoalId
  graphId?: string
  irRetainerName?: string
  irRetainerProfile?: IrRetainerProfile
  phaseAutoAdvance?: 'off' | 'fixed_durations' | 'fit_to_round'
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
  | "inject_advanced"
  | "surprise_inject"
  | "special_triggered"
  | "special_completed"
  | "discussion_phase_changed"
  | "inject_routes_plotted"
  | "inject_routes_replotted"
  | "inject_tagged"

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

export interface GraphBranchLogEntry {
  nodeId: string
  choseHandle: string
  trigger: 'participant_decision' | 'facilitator_manual' | 'special_score'
  triggeredAt: number
}

export interface GraphRuntimeState {
  currentNodeId: string
  pathHistory: string[]
  branchLog: GraphBranchLogEntry[]
  finalOutcome?: {
    key: string
    label: string
    narrative: string
    scoreImpact?: number
  }
}

export interface InjectRoutePlan {
  version: number
  plottedAt: number
  presentRolesAtPlot: Role[]
  routes: Record<string, Role[]>
}

export interface RoundPhaseState {
  roundNumber: number
  currentPhase: RoundPhase
  phaseStartedAt: number
  durations: Record<RoundPhase, number>
}

export type FactCheckTag = 'fact' | 'assumption' | 'misleading'

export interface FactCheckEntry {
  injectId: string
  participantId: string
  tag: FactCheckTag
  taggedAt: number
  changedCount: number
}

export interface InjectAnnotation {
  id: string
  injectId: string
  participantId: string
  start: number
  end: number
  tag: FactCheckTag
  createdAt: number
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
  // Runtime scaled duration for the active discussion phase (server computes,
  // clients render). Populated only when a phase is active.
  currentDiscussionPhaseEffectiveSeconds?: number
  currentDiscussionPhasePaused?: boolean
  phaseAutoAdvancePaused?: boolean
  // Graph runtime — populated when the session was created from a scenario graph.
  graph?: ScenarioGraph
  graphState?: GraphRuntimeState
  // Locked-at-start inject → recipient routing. Undefined for sessions predating this feature.
  injectRoutePlan?: InjectRoutePlan
  // Whole-round phase timeline state (inject → discussion → decision → review).
  activeRoundPhaseState?: RoundPhaseState
  // Fact-check tagging (participant privately marks reliability of each inject).
  factChecks?: FactCheckEntry[]
  // Inline text-highlight annotations on inject bodies (private per participant).
  injectAnnotations?: InjectAnnotation[]
  // Notification duty (Cbw/AVG meldplicht) — active gameplay.
  notifications?: NotificationDraft[]
  // Story-driven meldplicht prompts spawned by inject/decision/chaser events.
  meldplichtPrompts?: MeldplichtPrompt[]
  // Anchor for meldplicht deadline countdowns.
  incidentDetectedAt?: number
  // Boolean flags for chaser conditions and generic scenario state.
  flags?: Record<string, boolean>
  // IR-retainer activation mini-flow state.
  retainerState?: RetainerActivationState
  // Auditor-edited fields on the supervision report (chains, lessons).
  supervisionReportEdits?: SupervisionReportEdits
  // Slim projection van de huidige/peek-ahead DecisionNode voor participants.
  // Alleen aanwezig als de current round een decision heeft die participants
  // mogen zien (perRole=true én phase = decision/review), of als het huidige
  // node een decision is. Scoring-info wordt tijdens play-phase gescrubd,
  // tijdens review-fase onthuld.
  activeDecision?: ActiveDecisionState
  // Deel B §1.2 — éénmalige rolresolutie bij session_started. Immutable snapshot;
  // scoring reproduceerbaarheid vergt dat late roster-wijzigingen deze niet muteren.
  // Plain JSON (geen scoring-package types) — de app leest deze rechtstreeks
  // vanaf de state en de scoring-package construeert 'm indien nodig zelf.
  roleResolution?: {
    effectiveOwners: Record<string, string>  // Domain → spec-RoleId (of 'NPC')
    rolCoverage: number
    distinctOwners: number
    resolvedAt: number
  }
}

export interface ActiveDecisionState {
  nodeId: string
  prompt: string
  perRole: boolean
  options: Array<{
    id: string
    label: string
    allowedRole?: Role
    // Alleen ingevuld in review-fase — de reveal.
    qualityRank?: ChoiceQuality
    facilitatorCommentary?: string
    lessonLearned?: string
  }>
}

export interface SupervisionReportEdits {
  lessonEdits?: Record<string, Partial<{
    correctiveAction: string
    owner: string
    deadline: string
    priority: 'critical' | 'high' | 'medium' | 'low'
    status: 'open' | 'in_progress' | 'blocked' | 'closed'
    proofOfClosure: string
    retest: string
  }>>
  chainEdits?: Record<string, Partial<{
    correctiveAction: string
    owner: string
    deadline: string
    proofOfClosure: string
    retest: string
    priority: 'critical' | 'high' | 'medium' | 'low'
    status: 'open' | 'in_progress' | 'blocked' | 'closed'
  }>>
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
