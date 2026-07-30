import type {
  Inject,
  RoleAction,
  LearningObjective,
  FacilitatorNotes,
  SpecialType,
  Role,
  ScenarioType,
  AssessmentDimensionKey,
  BobPhase,
  ChoiceQuality,
  IrRetainerProfile,
  NotificationType,
  ScoreImpacts,
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
  | 'reliability'          // BOB-select + span-editor (feit / aanname / misleidend)
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
  // BOB-fase — verschijnt als subtiel badge bij participants
  bobPhase?: BobPhase
  // 2-3 vragen die het team direct kan bespreken bij ronde-start
  openingPrompts?: string[]
  // "Vanuit IR-perspectief" — alleen zichtbaar voor facilitator (jij als IR-consultant)
  facilitatorPerspective?: string
  evaluationAspects?: EvaluationAspect[]
  dynamic?: DynamicFillConfig
  // Optionele prompt-template die bij sessie-start naar Claude wordt gestuurd.
  // Ondergaat éérst dynamic-fill van tokens ({{sector}} etc.), daarna wordt
  // de gerichte prompt naar Claude gestuurd; de response vervangt title +
  // situation_update. Bij fout blijft de originele tekst staan.
  aiPromptTemplate?: string
  // Deel A §5/§7.1 — scoring-annotatie voor deze ronde. Opt-in.
  scoring?: RoundScoringConfig
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
    // allowedRole: alleen deze rol ziet deze optie als kiesbaar. Als er
    // niemand met deze rol is geïnnjoined + geen fallback → optie wordt
    // voor iedereen kiesbaar (in de participant view).
    // Undefined = beschikbaar voor alle rollen.
    allowedRole?: Role
    scoreImpact?: number                       // legacy single-dim
    linkedDimension?: AssessmentDimensionKey   // legacy single-dim
    scoreImpacts?: ScoreImpacts                // new: multi-dim trade-off
    qualityRank?: ChoiceQuality
    facilitatorCommentary?: string
    lessonLearned?: string
    // Deel A §5 — expliciete outcomeVector −2..+2 per dimensie. Als undefined
    // valt de scoring-adapter terug op scoreImpacts+qualityRank inferentie.
    outcomeVector?: OutcomeVector
    // Deel B §7.1 — impliciete "geen besluit" optie.
    implicit?: boolean
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
  kind: 'notification_missing' | 'decision_not_taken' | 'flag'
  type?: NotificationType
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
  scoreImpact?: number
  linkedDimension?: AssessmentDimensionKey
  lessonLearned?: string
  // Cumulatieve-score bandbreedte die deze outcome triggert. Als features.scoring
  // aan staat en de graph meerdere outcomes met scoreRange heeft, kiest de engine
  // automatisch de outcome waar de totaalscore in valt.
  // min inclusief, max inclusief. Beide optioneel — laat max weg voor "≥ min",
  // laat min weg voor "≤ max".
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

export type MeldplichtProfile = 'personal_data_only' | 'critical_service_only' | 'both'

export interface MeldplichtConfig {
  enabled: boolean
  incidentDetectedAt: 'start' | 'round_1' | 'round_2' | 'round_3'
  ncsc24hEnabled: boolean
  ncsc72hEnabled: boolean
  ncscFinalEnabled: boolean
  apEnabled: boolean
  chasersEnabled: boolean
  incidentProfile?: MeldplichtProfile
}

export const DEFAULT_MELDPLICHT: MeldplichtConfig = {
  enabled: true,
  incidentDetectedAt: 'round_1',
  ncsc24hEnabled: true,
  ncsc72hEnabled: true,
  ncscFinalEnabled: false,
  apEnabled: true,
  chasersEnabled: true,
  incidentProfile: 'both',
}

// Derive the individual toggle booleans from an incidentProfile choice.
// Author picks a profile; engine reads the derived booleans.
export function meldplichtFromProfile(profile: MeldplichtProfile, base: Partial<MeldplichtConfig> = {}): MeldplichtConfig {
  const derived: Omit<MeldplichtConfig, 'incidentDetectedAt' | 'enabled' | 'incidentProfile'> = profile === 'personal_data_only'
    ? { apEnabled: true, ncsc24hEnabled: false, ncsc72hEnabled: false, ncscFinalEnabled: false, chasersEnabled: true }
    : profile === 'critical_service_only'
      ? { apEnabled: false, ncsc24hEnabled: true, ncsc72hEnabled: true, ncscFinalEnabled: true, chasersEnabled: true }
      : { apEnabled: true, ncsc24hEnabled: true, ncsc72hEnabled: true, ncscFinalEnabled: true, chasersEnabled: true }
  return {
    enabled: base.enabled ?? true,
    incidentDetectedAt: base.incidentDetectedAt ?? 'round_1',
    incidentProfile: profile,
    ...derived,
  }
}

// Retainer is always Eye Security in this app (v2). Kept as a data constant so
// the engine, coverage checks, and templates all read from one source.
export const EYE_SECURITY_RETAINER: IrRetainerProfile = {
  name: "Eye Security",
  activationNumber: "+31 (0)88 6600 700",
  authorizedActivators: ["CISO", "IT Manager", "CEO"],
  slaMinutesToFirstContact: 15,
  handoffChecklist: [
    "Incident samenvatting (wat, waar, wanneer)",
    "Getroffen systemen en gebruikers",
    "Reeds genomen containment-stappen",
    "Beschikbare logs en toegangen voor forensics",
    "Contactpersoon 24/7",
  ],
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
  // Bevat opzettelijk zowel bruikbare als misleidende info (BOB-training: pas op wat je gelooft).
  irPlaybook?: string
  meldplicht?: MeldplichtConfig
  irRetainerProfile?: IrRetainerProfile
  features?: GraphFeatures
}
