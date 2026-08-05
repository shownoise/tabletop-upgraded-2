import type { GoalId } from "@/lib/engine/types"
import type { ScenarioGraph } from "@/lib/graph/types"
import type { SupervisionArea } from "@/lib/engine/supervision"
export type { GoalId }

// 8 playable roles — the client organisation's crisis-management + IT seats.
// External actors (IR retainer, MSP partner, insurer, AP, NCSC, police, media)
// are NEVER roles here — they appear only as inject sources or notification recipients.
// `system_admin` was merged into `it_manager` (they collapsed to the same spec role IT_LEAD).
export type Role =
  | 'it_manager'
  | 'ciso'
  | 'head_of_comms'
  | 'legal'
  | 'ceo'
  | 'cfo'
  | 'hr_lead'
  | 'ops_manager'

// Domain grouping — used by distributeRoles() as a tie-breaker so related work
// lands together before falling back to pure workload balancing. UI labels are Dutch.
export type RoleDomain = 'leadership' | 'technical' | 'legal' | 'financial' | 'communication' | 'people' | 'operations'

export interface RoleMeta {
  label: string       // Dutch label — shown in UI
  team: 'crisis_management' | 'technical_it'
  domain: RoleDomain  // primary work-area, used by distributeRoles tie-breaking
  description: string
  authorities: string[]
  notResponsibleFor: string
  isTopDecisionMaker?: boolean  // never handed off by distributeRoles
  // One-line Dutch mandate summary — surfaced to a participant taking over the
  // role in a solo/understaffed session so they can quickly adopt its perspective.
  mandateSummary: string
}

export const ROLE_META: Record<Role, RoleMeta> = {
  ceo: {
    label: 'CEO',
    team: 'crisis_management',
    domain: 'leadership',
    isTopDecisionMaker: true,
    description: 'Directiebesluiten, communicatie naar board',
    mandateSummary: 'Eindverantwoordelijk voor strategische keuzes, board-communicatie en het autoriseren van onomkeerbare stappen.',
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
    domain: 'technical',
    description: 'Beveiligingsstrategie, coördinatie incidentrespons',
    mandateSummary: 'Coördineert incidentrespons, weegt technische risico\'s af en stuurt de externe IR-partij aan.',
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
    domain: 'financial',
    description: 'Financiële besluiten, verzekering, losgeld',
    mandateSummary: 'Bewaakt financiële impact, activeert verzekering en adviseert over losgeld- en herstelbudget.',
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
    domain: 'legal',
    description: 'Compliance, meldplichten aan toezichthouders',
    mandateSummary: 'Bewaakt meldplichten (AVG 72u, NIS2 24u) en beoordeelt aansprakelijkheid en klantverplichtingen.',
    authorities: [
      'AP-melding coördineren (AVG: binnen 72 uur)',
      'NIS2-meldplicht bewaken richting NCSC',
      'Juridisch advies over aansprakelijkheid geven',
      'Contractuele verplichtingen richting klanten beoordelen',
    ],
    notResponsibleFor: 'Technische en financiële beslissingen',
  },
  head_of_comms: {
    label: 'Hoofd Communicatie',
    team: 'crisis_management',
    domain: 'communication',
    description: 'Interne en externe communicatie',
    mandateSummary: 'Regisseert interne en externe boodschap, treedt op als woordvoerder en bewaakt de reputatie.',
    authorities: [
      'Interne communicatie naar medewerkers verzorgen',
      'Perscommunicatie afstemmen met CEO',
      'Social media bewaken en reageren',
      'Woordvoerder namens de organisatie',
    ],
    notResponsibleFor: 'Technische en financiële beslissingen',
  },
  hr_lead: {
    label: 'HR-manager',
    team: 'crisis_management',
    domain: 'people',
    description: 'Medewerkerscommunicatie en insider-threat casussen',
    mandateSummary: 'Zorgt voor medewerkers en welzijn, en trekt insider-onderzoek samen met Legal.',
    authorities: [
      'Medewerkerscommunicatie coördineren',
      'Insider threat-onderzoek initiëren (samen met Legal)',
      'Crisisopvang en welzijn medewerkers organiseren',
    ],
    notResponsibleFor: 'Technische en financiële beslissingen, perscommunicatie',
  },
  ops_manager: {
    label: 'Operationeel manager',
    team: 'crisis_management',
    domain: 'operations',
    description: 'Bedrijfscontinuïteit en operationele impact',
    mandateSummary: 'Houdt primaire processen draaiend, activeert workarounds en bepaalt herstelprioriteit.',
    authorities: [
      'Operationele impact inschatten en rapporteren',
      'Noodprocedures en handmatige processen activeren',
      'Herstelprioriteiten op basis van bedrijfskriticaliteit bepalen',
      'Coördineren met externe partners en leveranciers',
    ],
    notResponsibleFor: 'Technische herstelstappen, financiële goedkeuring',
  },
  it_manager: {
    label: 'IT-manager',
    team: 'technical_it',
    domain: 'technical',
    description: 'IT-infrastructuur, systeem-isolatie, back-up en herstel',
    mandateSummary: 'Isoleert systemen, borgt back-ups en logs, en coördineert technisch herstel.',
    authorities: [
      'Systemen isoleren en netwerk segmenteren',
      'IT-infrastructuur monitoren en beheren',
      'Backups inventariseren en herstelbaarheid bepalen',
      'Technische maatregelen coördineren',
      'Logs en forensische data veiligstellen',
    ],
    notResponsibleFor: 'Businessbeslissingen, communicatie naar pers of board',
  },
}

// Minimum staffing to run a session — belongs to the role model, not to individual
// scenarios. If fewer roles are joined the session can still start, but distributeRoles
// warns and the coverage metric drops.
export const MINIMUM_STAFFING: readonly Role[] = ['ceo', 'ciso', 'legal'] as const

export type SimulationMode = 'event' | 'training'

// Canonical four-phase round model. Every round has these four phases in this order.
// No BOB/OODA sub-phase state, no `lock` UI phase — event-mode locking is an atomic
// server-side transition between DECISION and REVIEW inside submitDecision/finalizeRound.
export type RoundPhase = 'inject' | 'discussion' | 'decision' | 'review'

export const ROUND_PHASE_LABELS_NL: Record<RoundPhase, string> = {
  inject:     'Inject',
  discussion: 'Discussie',
  decision:   'Beslissing',
  review:     'Review',
}

// Author-side quality ranking of a decision option — shown in review as IR-retainer
// perspective. Not a hard verdict; the score reflects awareness, justification and
// consistency, not picking a preferred side.
export type ChoiceQuality = 'best' | 'good' | 'poor' | 'wrong'

export interface RoleAction {
  id: string
  label: string
  description: string
  allowedRoles: Role[]  // empty = all roles allowed
  isRecommended?: boolean
  irPlanAligned: boolean
  consequence?: string
  qualityRank?: ChoiceQuality
  // IR-retainer commentaar — verschijnt tijdens REVIEW én in het rapport.
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

export interface IrRetainerProfile {
  name: string
  activationNumber: string
  activationEmail?: string
  scopeIncludes: string[]
  scopeExcludes: string[]
}

// ─── Regulatory notification regime (Phase 2) ───
//
// Data-driven meldplicht: authors ship one RegulatoryRegime per jurisdiction
// (default: nl_avg_nis2). At runtime the session tracks obligations per
// milestone. An inject with `triggersRegulatoryNotification: true` auto-opens
// the initial milestone; filing the initial opens the closing milestone.
// Any staffed role can file. Filed on-time / late / never gets folded back
// into the round's scoring vector via the regime's scoring config.

export type OutcomeDimensionKey = 'CONT' | 'FOR' | 'BC' | 'JUR' | 'VER' | 'KOS'

export interface RegulatoryMilestone {
  id: string                 // 'initial' | 'closing'
  label: string              // Dutch, participant-facing
  deadlineHours: number      // hours from obligation-open (exercise-time)
  purpose: string            // one-sentence Dutch description shown in UI
}

export interface RegulatoryRegime {
  id: string
  authorityLabel: string
  obligation: string
  jurisdiction: string
  milestones: RegulatoryMilestone[]        // exactly two: initial + closing
  triggerFlag: string                       // 'triggersRegulatoryNotification'
  scoring: {
    onTime:  Partial<Record<OutcomeDimensionKey, number>>
    late:    Partial<Record<OutcomeDimensionKey, number>>
    omitted: Partial<Record<OutcomeDimensionKey, number>>
  }
}

export interface RegulatoryObligationState {
  regimeId: string
  milestoneId: string
  status: 'open' | 'filed' | 'expired'
  openedAtRound: number         // 1-based round number when the obligation opened
  openedAtHour: number          // exercise-hours since incident awareness at open time
  filedAtRound?: number
  filedAtHour?: number
  filedBy?: string              // participantId
  filedByRole?: Role
  freeText?: string             // participant free-text — "Wat is er gebeurd?"
  keyPoints?: string            // second free-text field — "Wat wordt er nu gedaan?"
  expiredAtRound?: number       // filled when a still-open milestone is marked expired
}

// Phase 3 — retainer activation is now a single participant-decision that sets
// the RETAINER_ACTIVATED_FLAG capability. This snapshot records who activated
// and when so the review reveal + supervision report can grade the timing.
export interface RetainerActivation {
  activatedAtRound: number   // 1-based
  activatedByParticipantId: string
  activatedAtTs: number
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
  // Zekerheidstap 1..5 bij inzending. Wordt privé teruggetoond aan de deelnemer
  // na REVIEW; niet zichtbaar voor anderen tijdens de sessie.
  confidence?: 1 | 2 | 3 | 4 | 5
  // Deel B §4 — bij EVENT-mode: welke groep heeft dit ingezonden. Idempotency
  // is dan (groupId, roundIndex). In ASSESSMENT-mode ongebruikt.
  groupId?: string
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
    objectivesAchieved: number
    objectivesTotal: number
  }
  perRound: Array<{
    roundIndex: number
    roundTitle: string
    decisions: SubmittedDecision[]
    flags: GovernanceFlag[]
  }>
  perObjective: Array<{
    roundIndex: number
    objective: LearningObjective
    achieved: boolean
    achievedAt?: string
  }>
  topFlags: GovernanceFlag[]
  recommendations: string[]
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
  // Regulatory notification trigger — when true, firing this inject opens the
  // initial regulatory obligation on the session (see RegulatoryRegime).
  // Idempotent per session: the second inject with this flag is a no-op.
  triggersRegulatoryNotification?: boolean
  // Phase 3 — capability-gated visibility. Injects with this flag set are hidden
  // from participants until session.flags[requiresCapability] === true.
  requiresCapability?: string
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
  goalId?: GoalId
  graphId?: string
  irRetainerName?: string
  irRetainerProfile?: IrRetainerProfile
}

export interface Participant {
  id: string
  name: string
  team?: string             // legacy free-string, blijft voor backwards compat
  role?: Role
  joinedAt: number
  readyAt?: number
  // Deel B §4.1 — lid van een gestructureerde Group (EVENT-mode). Ontbrekend
  // in ASSESSMENT-mode of wanneer nog geen team gekozen is.
  groupId?: string
}

// Deel B §4 — een groep in EVENT-mode. Elke groep is één scoring-eenheid en
// bedient één iPad (notulist submitteert namens de hele groep).
export interface Group {
  id: string
  name: string
  createdAt: number
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
  | "phase_changed"
  | "participant_joined"
  | "inject_pushed"
  | "inject_advanced"
  | "surprise_inject"
  | "special_triggered"
  | "special_completed"
  | "inject_routes_plotted"
  | "inject_routes_replotted"
  | "inject_tagged"
  | "melding_filed"
  | "regulatory_obligation_opened"
  | "regulatory_obligation_filed"
  | "regulatory_obligation_expired"

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
  specialScores?: SpecialScore[]
  // Graph runtime — populated when the session was created from a scenario graph.
  graph?: ScenarioGraph
  graphState?: GraphRuntimeState
  // Locked-at-start inject → recipient routing.
  injectRoutePlan?: InjectRoutePlan
  // Whole-round phase timeline state (inject → discussion → decision → review).
  activeRoundPhaseState?: RoundPhaseState
  // Fact-check tagging (participant privately marks reliability of each inject).
  factChecks?: FactCheckEntry[]
  // Inline text-highlight annotations on inject bodies (private per participant).
  injectAnnotations?: InjectAnnotation[]
  // Regulatory notification regime — the jurisdictional obligation attached
  // to this session (default: NL AVG + NIS2). Data-driven; scenarios may override.
  regulatoryRegime?: RegulatoryRegime
  // Live obligation state — one entry per milestone opened this session.
  regulatoryObligations?: RegulatoryObligationState[]
  // Participant-initiated meldingen (Phase D — general escalation reports).
  meldingen?: FiledMelding[]
  // Anchor for meldplicht deadline countdowns.
  incidentDetectedAt?: number
  // Boolean flags for chaser conditions and generic scenario state.
  flags?: Record<string, boolean>
  // Phase 3 — snapshot of the retainer-activation decision (once set, immutable).
  retainerActivation?: RetainerActivation
  // Auditor-edited fields on the supervision report (chains, lessons).
  supervisionReportEdits?: SupervisionReportEdits
  // Slim projection of the current/peek-ahead DecisionNode for participants.
  activeDecision?: ActiveDecisionState
  // Deel B §1.2 — one-time role resolution at session_started. Immutable snapshot.
  roleResolution?: {
    effectiveOwners: Record<string, string>  // Domain → spec-RoleId (of 'NPC')
    rolCoverage: number
    distinctOwners: number
    resolvedAt: number
  }
  // Phase C2 — the computed role distribution across joined participants.
  // Immutable per-round snapshot so a mid-session recompute never mutates past rounds.
  roleDistribution?: RoleDistributionSnapshot
  // Facilitator overrides on distributeRoles output — participantId → additional role[]
  // that supersedes what the algorithm assigned.
  roleAssignmentOverrides?: Record<string, Role[]>
  // Deel B §4 — groepen (EVENT-mode).
  groups?: Group[]
  // Monotonically increasing revision — bumped on every persisted mutation.
  version?: number
}

// ─── Role distribution (Phase C2) ───

export interface RoleDistributionEntry {
  participantId: string
  participantName: string
  primaryRole: Role
  // Additional roles this participant is standing in for (empty if only primary).
  inheritedRoles: Role[]
  // Total workload weight assigned (author-defined content units).
  workload: number
}

export interface RoleDistributionSnapshot {
  computedAt: number
  entries: RoleDistributionEntry[]
  // Roles authored in the scenario but not covered by any present participant —
  // typically because MINIMUM_STAFFING is not met. Their content is dropped.
  unassignedRoles: Role[]
  // Coverage: fraction of authored roles that landed on a present participant. 0..1.
  coverage: number
}

// ─── Participant-initiated melding (Phase D) ───

export type MeldingRecipient = 'ir_retainer' | 'msp' | 'ncsc' | 'ap' | 'police' | 'insurer' | 'internal'

export interface MeldingType {
  id: string
  label: string   // Dutch — what the participant sees in the button
  triggersInjectId?: string  // authored inject in scenario data; spawned as follow-up
}

export interface MeldingMoment {
  id: string
  allowedRoles: Role[]         // empty = all roles
  recipient: MeldingRecipient
  helper?: string              // one-line Dutch hint on the participant UI
  types: MeldingType[]         // 2-3 predefined report types
  // Which round this melding-moment belongs to (round index, 0-based).
  roundIndex: number
  // Optional: only open while a specific inject is visible. Otherwise open for the whole round.
  gateInjectId?: string
}

export interface FiledMelding {
  id: string
  momentId: string
  participantId: string
  participantName: string
  role: Role
  typeId: string
  freeText?: string
  filedAt: number
  roundIndex: number
  spawnedInjectId?: string     // set when the follow-up inject was created
}

export interface ActiveDecisionPending {
  optionId: string
  optionLabel: string
  allowedRole?: Role
  // Alleen ingevuld in review-fase — de reveal.
  qualityRank?: ChoiceQuality
  facilitatorCommentary?: string
  lessonLearned?: string
}

// Sequential presentation of pending options for one participant. Enables
// solo/understaffed play: a single participant with multiple inherited roles
// works through their pending list one option at a time.
export interface ActiveDecisionParticipantPending {
  // Ordered role sequence this participant is playing this round — primary
  // role first, then each inherited role that actually has a matching option
  // in the current DecisionNode.
  roleSequence: Role[]
  // Position in roleSequence of the next role whose option the participant sees.
  currentIndex: number
  // Denominator for the "Beslissing X van Y" progress indicator.
  total: number
  // Zero-indexed count of decisions this participant has already submitted
  // for this decision node in the current round.
  completed: number
}

export interface ActiveDecisionState {
  nodeId: string
  prompt: string
  perRole: boolean
  // Full visible option set (as today, needed for facilitator view + backwards).
  options: ActiveDecisionPending[]
  // Per-participant sequential pending queue. Present when at least one
  // participant still owes a submission. Omitted per-participant once they
  // have completed all their roles.
  pendingByParticipant?: Record<string, ActiveDecisionParticipantPending>
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
  | "participant_ready"
  | "melding_filed"
  | "regulatory_obligation_opened"
  | "regulatory_obligation_filed"

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
