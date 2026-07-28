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
  IrRetainerProfile,
  NotificationType,
} from "@/lib/types"
import type { SupervisionArea } from "@/lib/engine/supervision"

export type GraphNodeType = "start" | "round" | "inject" | "decision" | "special" | "outcome" | "chaser"
export type GraphEdgeType = "sequence" | "branch" | "outcome" | "inject"

// Opt-in aspects an author wants this node to be scored / annotated on.
// undefined = legacy node, show all fields (backwards compat).
// []        = minimal, hide every optional evaluation field.
// non-empty = only show the fields that match the listed aspects.
export type EvaluationAspect =
  | 'reliability'          // Betrouwbaarheid (BOB) select on injects
  | 'facts_assumptions'    // Span-editor for feit/aanname/misleidend
  | 'nis2'                 // nis2Relevant flag + supervision areas
  | 'decision_impact'      // scoreImpact / linkedDimension
  | 'lessons_learned'      // learning objectives / lessonLearned

export interface StartNodeData {
  kind: "start"
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
}

export interface InjectNodeData extends Omit<Inject, "id"> {
  kind: "inject"
  evaluationAspects?: EvaluationAspect[]
  dynamic?: DynamicFillConfig
}

export type DynamicFillToken = 'sector' | 'companySize' | 'crownJewels' | 'criticalSystems' | 'irRetainerName'

export interface DynamicFillConfig {
  enabled: boolean
  fillFrom: DynamicFillToken[]
}

export const DYNAMIC_FILL_TOKENS: DynamicFillToken[] = ['sector', 'companySize', 'crownJewels', 'criticalSystems', 'irRetainerName']

export interface DecisionNodeData {
  kind: "decision"
  prompt: string
  measuredBy: "participant_choice" | "facilitator_trigger"
  triggerRole?: Role
  options: Array<{
    id: string
    label: string
    roleActionId?: string
    scoreImpact?: number
    linkedDimension?: AssessmentDimensionKey
    lessonLearned?: string
  }>
  // Soft-decision: als false, blokkeert deze decision de graph-flow niet.
  // Facilitator kan Volgende ronde klikken zonder dat er is gekozen.
  // Deelnemer-keuze telt alleen voor scoring, niet voor branching.
  advancesGraph?: boolean
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
}
