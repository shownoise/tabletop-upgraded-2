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
} from "@/lib/types"

export type GraphNodeType = "start" | "round" | "inject" | "decision" | "special" | "outcome"
export type GraphEdgeType = "sequence" | "branch" | "outcome" | "inject"

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
}

export interface InjectNodeData extends Omit<Inject, "id"> {
  kind: "inject"
}

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
}
