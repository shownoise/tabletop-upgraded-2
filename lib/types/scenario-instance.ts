import type {
  InjectChannel,
  ScenarioType,
  DecisionFramework,
  ObservationLens,
  ModuleId,
  EmotionalTone,
} from "../types"

// ─── Attack chain ───

export type Detectability = 'covert' | 'subtle' | 'noisy'

export interface AttackChainPhase {
  id: string
  t_offset: string
  technique: string
  mitre_attack?: string[]
  artifacts: string[]
  detectability: Detectability
}

export interface AttackChainTemplate {
  id: ScenarioType
  name: string
  description: string
  phases: AttackChainPhase[]
  applicable_sectors?: string[]
}

// ─── Module library ───

export interface ModuleDefinition {
  id: ModuleId
  name: string
  learning_goal: string
  default_lens: ObservationLens
  default_duration_minutes: number
  default_channels: InjectChannel[]
  framework_prompts: Record<DecisionFramework, string[]>
  scope_hints: string[]
}

// ─── Scenario instance (output of the generator) ───

export interface ClientProfile {
  sector: string
  revenue_range: string
  employee_count: number
  nis2_status: 'essential' | 'important' | 'not_applicable'
  critical_systems: string[]
  key_stakeholders: string[]
}

export interface RichInject {
  id: string
  source_phase_id: string
  channel: InjectChannel
  sender: string
  timestamp: string
  emotional_tone: EmotionalTone
  content: string
  is_handout?: boolean
}

export type DecisionScope = 'client' | 'shared' | 'retainer' | 'invalid'

export interface DecisionBox {
  role: 'voorzitter' | 'ciso' | 'hoofd_it' | 'legal' | 'comms' | 'directie'
  questions: string[]
  scope: 'client' | 'shared'
  framework_phase?: string
  options?: Array<{
    label: string
    description?: string
    allowedRoles?: string[]
    recommended?: boolean
    consequence?: string
  }>
}

export interface Handout {
  type: 'four_domain_impact' | 'root_cause_analysis' | 'ransom_package' | 'rca_summary' | 'custom'
  title: string
  content: string
}

export interface ModuleInstance {
  id: string
  module_id: ModuleId
  order: number
  t_offset: string
  duration_minutes: number
  severity: 'medium' | 'high' | 'critical'
  visible_phases: string[]
  observation_lens: ObservationLens
  decision_framework: DecisionFramework
  situation: string
  injects: RichInject[]
  decisions: DecisionBox[]
  facilitator_notes: string[]
  handout?: Handout
  learning_objectives?: Array<{
    id: string
    description: string
    module: string
    measuredBy: 'decision' | 'special' | 'manual'
    triggerActionIds?: string[]
    triggerSpecialType?: string
  }>
}

export interface ScenarioInstance {
  meta: {
    codename: string
    client_profile: ClientProfile
    scenario_type: ScenarioType
    decision_framework: DecisionFramework
    generated_at: string
    language: 'nl' | 'en'
  }
  attack_chain: AttackChainPhase[]
  modules: ModuleInstance[]
  debrief_questions: string[]
  ir_observations: string[]
}

// ─── Template module slot (used in ScenarioTemplate.modules) ───

export interface TemplateModuleSlot {
  module_id: ModuleId
  duration_minutes?: number
  custom_lens?: ObservationLens
  custom_channels?: InjectChannel[]
  decision_framework?: DecisionFramework
  facilitator_notes_extra?: string[]
}

// ─── Skeleton passed to the AI generator ───

export interface ScenarioSkeleton {
  scenario_type: ScenarioType
  decision_framework: DecisionFramework
  client_profile: ClientProfile
  attack_chain: AttackChainPhase[]
  modules: Array<{
    module_id: ModuleId
    order: number
    t_offset: string
    duration_minutes: number
    observation_lens: ObservationLens
    decision_framework: DecisionFramework
    visible_phases: string[]
    default_channels: InjectChannel[]
  }>
  language: 'nl' | 'en'
  codename: string
}

// ─── Validation ───

export interface ValidationError {
  module_id?: string
  inject_id?: string
  validator: string
  message: string
  severity: 'error' | 'warning'
}
