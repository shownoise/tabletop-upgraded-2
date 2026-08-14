import type {
  Inject,
  RoleAction,
  LearningObjective,
  FacilitatorNotes,
  SpecialType,
  Role,
  ScenarioType,
  ChoiceQuality,
  IrRetainerProfile,
  MeldingMoment,
} from "@/lib/types"
import type { SupervisionArea } from "@/lib/engine/supervision"

export type GraphNodeType = "start" | "round" | "inject" | "decision" | "special" | "outcome" | "chaser"
export type GraphEdgeType = "sequence" | "branch" | "outcome" | "inject"

// Opt-in aspects an author wants this node to be scored / annotated on.
// undefined = legacy node, show all fields (backwards compat).
// []        = minimal, hide every optional evaluation field.
// non-empty = only show the fields that match the listed aspects.
//
// Note: 'facts_assumptions' was merged into 'reliability' — the latter now
// controls both the BOB dropdown AND the span-editor. Legacy graphs may still
// carry 'facts_assumptions' in their arrays; the inspector treats it as an
// alias for 'reliability' (see normalizeAspects in evaluation-aspects.tsx).
export type EvaluationAspect =
  | 'reliability'          // BOB-select + span-editor (feit / aanname)
  | 'facts_assumptions'    // DEPRECATED — alias for reliability, kept for backwards compat
  | 'nis2'                 // nis2Relevant flag + supervision areas
  | 'decision_impact'      // scoreImpact / linkedDimension
  | 'lessons_learned'      // learning objectives / lessonLearned

export interface StartNodeData {
  kind: "start"
}

// Deel A §5 — zes uitkomstdimensies. Vast, nooit per klant aanpassen.
export type OutcomeDimensionKey = 'CONT' | 'FOR' | 'BC' | 'JUR' | 'VER' | 'KOS'
export type OutcomeVector = Record<OutcomeDimensionKey, number>

// Deel A §7.1 — richttijd (Δ_ref) voor tempo-scoring. Als undefined valt de
// scoring terug op timerMinutes en anders op 20.
export interface RoundScoringConfig {
  designTimeMinutes?: number
  outcomeWeights?: OutcomeVector  // Deel A §5 — per-ronde weging over de 6 dimensies
}

export interface RoundNodeData {
  kind: "round"
  title: string
  situation_update: string
  timerMinutes?: number
  roleActions?: RoleAction[]
  learningObjectives?: LearningObjective[]
  facilitatorNotes?: FacilitatorNotes
  // 2-3 questions the team can discuss at round start.
  openingPrompts?: string[]
  // IR-consultant's perspective — facilitator-only.
  facilitatorPerspective?: string
  evaluationAspects?: EvaluationAspect[]
  dynamic?: DynamicFillConfig
  aiPromptTemplate?: string
  // Deel A §5/§7.1 — scoring annotation for this round. Opt-in.
  scoring?: RoundScoringConfig
  // Phase D — melding-moments open during this round. A participant can file one
  // per moment; the engine spawns the corresponding follow-up inject.
  meldingMoments?: MeldingMoment[]
  // 2-3 Dutch review questions surfaced during REVIEW phase — tied to specific
  // outcome axes for this round. Optional; falls back to generic review UI.
  reviewPrompts?: string[]
}

export interface InjectNodeData extends Omit<Inject, "id"> {
  kind: "inject"
  evaluationAspects?: EvaluationAspect[]
  dynamic?: DynamicFillConfig
  aiPromptTemplate?: string
  // Deel A §3.1 — 'crucial' telt in de D-noemer van BESLUIT + geldt als
  // materieel event voor ADAPT. Undefined → adapter inferreert uit urgency.
  importance?: 'crucial' | 'info'
  // Deel A §4.2c — misroute: welke rol had deze inject 'moeten' krijgen.
  correctRoute?: Role
  // Deel A §4.2b — asymmetrische zichtbaarheid.
  //   'shared' (default): iedereen in de sessie ziet de inject.
  //   'exclusive': alleen `targetRoles` zien 'm — anderen zien niets tot een deel-actie.
  //   Vergt bezette targetRoles; anders val terug op fallback via adaptive-routing.
  visibility?: 'shared' | 'exclusive'
  // Capability-gated visibility. Inject is hidden from participants until the
  // named flag is present-and-true on session.flags. Enables authored downstream
  // consequence for options that set a capability (e.g. retainer_activated →
  // forensic-findings inject).
  requiresCapability?: string
  // Phase 2 — auteur-geclassificeerd type informatie: feit (getoetst) of
  // aanname (ongetoetst). Alleen data, geen scoring-hook. Feeds wizard
  // feit-ratio + participant filter. 'fabel' is verwijderd 2026-08-14 —
  // leugens zijn achteraf ongetoetste aannames.
  classification?: 'feit' | 'aanname'
  // Phase 4 — één-regel facilitator-noot: waarom staat deze inject hier?
  // Facilitator-only; toParticipantState strips this. Never scored.
  facilitatorNote?: string
  // Phase 1 — auteur koppelt deze inject aan de decision die 'ie voorbereidt.
  // Framework-regel: elke decision moet minstens één setup-inject hebben in
  // dezelfde of de direct voorafgaande ronde, anders komt de keuze 'uit het
  // niets'. Alleen data — de builder toont de link, de validator waarschuwt.
  setsUpDecisionNodeId?: string
}

export type DynamicFillToken = 'sector' | 'companySize' | 'crownJewels' | 'criticalSystems' | 'irRetainerName'

export interface DynamicFillConfig {
  enabled: boolean
  fillFrom: DynamicFillToken[]
}

export const DYNAMIC_FILL_TOKENS: DynamicFillToken[] = ['sector', 'companySize', 'crownJewels', 'criticalSystems', 'irRetainerName']

// Deel A §4.1 — 10 operationele domeinen (spec §4.2a: DecisionPoint.domain).
export type SpecDomain =
  | 'CONTAINMENT' | 'FORENSIEK' | 'HERSTEL' | 'JURIDISCH'
  | 'EXTERNE_COMMS' | 'INTERNE_COMMS' | 'PERSONEEL'
  | 'BEDRIJFSPROCES' | 'GELD' | 'EXTERNE_PARTIJEN'

export interface DecisionNodeData {
  kind: "decision"
  prompt: string
  measuredBy: "participant_choice" | "facilitator_trigger"
  triggerRole?: Role
  // Deel A §4.2a — operationeel domein van dit beslispunt. Bepaalt effectiveOwner
  // via de fallbackketen (Deel B §1.1). Optioneel; adapter infereert uit
  // supervisionAreas als ontbrekend.
  scoringDomain?: SpecDomain
  // Ontwerp-eigenaar (app-rol). Undefined → adapter kiest triggerRole of eerste optie.allowedRole.
  scoringOwner?: Role
  // Consulted rollen voor debrief-context (Deel A §5.1).
  scoringConsulted?: Role[]
  options: Array<{
    id: string
    label: string
    roleActionId?: string
    // Only participants with this role see this option as selectable. Undefined =
    // any role. If the role is not present, distributeRoles() reassigns; the option
    // then becomes selectable for the inheriting participant.
    allowedRole?: Role
    qualityRank?: ChoiceQuality
    facilitatorCommentary?: string
    lessonLearned?: string
    // Deel A §5 — explicit outcome vector on the 6 dimensions (−2..+2). Required
    // in the new schema; delta-scoring reads this directly.
    outcomeVector?: OutcomeVector
    // Deel B §7.1 — implicit "no decision" option.
    implicit?: boolean
    // Session-level capability set when this option is submitted anywhere.
    // Read by chasers (via ChaserCondition.kind='flag') and by inject/option
    // visibility filters (see requiresCapability). Well-known values live as
    // constants in this file (e.g. RETAINER_ACTIVATED_FLAG).
    capabilityFlag?: string
    // Consume this option once submitted anywhere in the session. Future
    // presentations of the same DecisionNode omit this option from the visible
    // set; the historical record keeps the submission intact.
    consumesOptionAfterUse?: boolean
    // Option is hidden from participants until this capability flag is present
    // on session.flags. Enables option-tiers that only unlock after prior
    // capability-setting decisions.
    requiresCapability?: string
  }>
  // Soft-decision: als false, blokkeert deze decision de graph-flow niet.
  // Facilitator kan Volgende ronde klikken zonder dat er is gekozen.
  // Deelnemer-keuze telt alleen voor scoring, niet voor branching.
  advancesGraph?: boolean
  // perRole=true: participants submitten zelf, elke rol kiest onafhankelijk.
  // perRole=false (default): facilitator-triggered single pick.
  perRole?: boolean
  supervisionAreas?: SupervisionArea[]
}

export interface ChaserCondition {
  kind: 'regulatory_obligation_open' | 'decision_not_taken' | 'flag'
  // For 'regulatory_obligation_open': the milestone id (e.g. 'initial' | 'closing').
  milestoneId?: string
  roleActionId?: string
  key?: string
  value?: boolean
  afterRoundNumber?: number
}

// WHY: single source of truth for the retainer-activation flag so authors and
// engine code stay in sync when the identifier is customised later.
export const RETAINER_ACTIVATED_FLAG = 'retainer_activated' as const

export interface ChaserNodeData {
  kind: "chaser"
  inject: InjectNodeData
  condition: ChaserCondition
}

export interface SpecialNodeData {
  kind: "special"
  type: SpecialType
  assignedRole?: Role
  thresholds: Array<{
    id: string
    label: string
    predicate: { op: "<" | "<=" | ">" | ">=" | "=="; value: number }
  }>
}

export interface OutcomeNodeData {
  kind: "outcome"
  key: string
  label: string
  narrative: string
  lessonLearned?: string
  // Cumulative-score range that triggers this outcome. If features.scoring is on
  // and the graph has multiple outcomes with scoreRange, the engine automatically
  // picks the outcome whose range contains the total score.
  // min inclusive, max inclusive. Both optional — omit max for "≥ min", omit min for "≤ max".
  scoreRange?: { min?: number; max?: number }
}

export type GraphNodeData =
  | StartNodeData
  | RoundNodeData
  | InjectNodeData
  | DecisionNodeData
  | SpecialNodeData
  | OutcomeNodeData
  | ChaserNodeData

export interface GraphNode {
  id: string
  type: GraphNodeType
  position: { x: number; y: number }
  data: GraphNodeData
}

export interface GraphEdge {
  id: string
  source: string
  target: string
  sourceHandle?: string
  targetHandle?: string
  type: GraphEdgeType
  label?: string
}

// Retainer is always Eye Security in this app (v2). Kept as a data constant so
// the engine, coverage checks, and templates all read from one source.
export const EYE_SECURITY_RETAINER: IrRetainerProfile = {
  name: "Eye Security",
  activationNumber: "+31 (0)88 6600 700",
  scopeIncludes: ["Forensics", "Containment support", "Coordinatie NCSC/AP-meldingen", "Communicatie-advies"],
  scopeExcludes: ["Losgeld-onderhandeling zonder schriftelijke opdracht", "Herstel via derde partij"],
}

// Per-graph feature toggles — author decides which mechanics are in play for
// this specific scenario. Kept intentionally coarse: turn a whole mechanic on
// or off, no fine-grained knobs. undefined = all-on (backwards compat).
export interface GraphFeatures {
  reliability: boolean  // BOB-tags + span-editor beschikbaar op injects
  compliance: boolean   // Meldplicht + coverage panel actief
  scoring: boolean      // Score-dimensies + score-based outcome selection actief
}

export const DEFAULT_FEATURES: GraphFeatures = {
  reliability: false,   // opt-in — te specialistisch als default
  compliance: true,
  scoring: true,
}

export interface RoleBriefing {
  text: string
  playbookGaps?: string[]
}

// Phase 5 — premade "noise" injects the facilitator can drop into a live session
// during DISCUSSION. Context-only: never scored, never a scenario event. Authored
// inside the ScenarioGraph so scope stays scenario-local.
export interface PremadeInject {
  id: string
  label: string
  channel: InjectNodeData['channel']
  urgency?: InjectNodeData['urgency']
  classification?: 'feit' | 'aanname'
  senderName?: string
  title: string
  content: string
  targetRoles?: Role[]
  facilitatorNote?: string
}

export interface ScenarioGraph {
  id: string
  name: string
  version: number
  scenarioType: ScenarioType
  nodes: GraphNode[]
  edges: GraphEdge[]
  createdAt: number
  updatedAt: number
  // IR retainer branding (facilitated by X) — verschijnt in participant chrome
  irRetainerName?: string
  // Crisis playbook / IR plan — verschijnt rechts bij elke participant tijdens de sessie.
  // Bevat opzettelijk zowel feiten als aannames (BOB-training: verifieer voor je erop handelt).
  irPlaybook?: string
  irRetainerProfile?: IrRetainerProfile
  features?: GraphFeatures
  // Phase 3 — per-role opening briefing (mandate + playbook gaps). Rendered
  // once at session start (opening-briefing) and retrievable mid-session.
  // Optional per role: missing entries fall back to ROLE_META.mandateSummary.
  roleBriefings?: Partial<Record<Role, RoleBriefing>>
  // Phase 5 — ad-hoc noise injects the facilitator can fire during DISCUSSION.
  // Scenario-scoped, never scored — pure situational context.
  injectLibrary?: PremadeInject[]
  // Phase 1 — target aantal opties per rol per decision. Gebruikt door de
  // builder om per-rol pills te kleuren (groen ≥ target, amber daaronder,
  // rood bij 0). Undefined → default van 4 (Phase 9's wizard-config vult 'm).
  expectedOptionsPerRole?: number
  // Phase 9 — seed used by the wizard for reproducibility. Present when the
  // graph was compiled by runWizardPipeline. Not consumed by the runtime.
  wizardSeed?: string
  // Phase 9 — publication status. The wizard writes 'draft' — never 'published'.
  // The builder promotes to 'published' via a separate action.
  publishStatus?: 'draft' | 'published'
}

// Phase 1 — default threshold for "genoeg opties per rol" pill coloring in the
// builder. Exposed so validate.ts and the inspector can agree without the
// value drifting between call sites.
export const DEFAULT_EXPECTED_OPTIONS_PER_ROLE = 4
