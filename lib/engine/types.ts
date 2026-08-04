// Author-side taxonomy: goals a facilitator picks in the setup form. These drive
// AI prompt directives and preset content selection — they are NOT scoring axes.
export type GoalId =
  | 'decision_making'
  | 'crisis_management'
  | 'ransomware_simulation'
  | 'business_continuity'
  | 'regulatory_compliance'
  | 'supply_chain_crisis'
  | 'partner_mix'

// Author-side capability tags — combined with GoalId to build AI prompts. Also
// used to filter which supervision rules apply.
export type CapabilityId =
  | 'governance_decisions'
  | 'crisis_communication'
  | 'business_continuity'
  | 'legal_compliance'
  | 'ransom_negotiation'
  | 'reputation_management'
  | 'supply_chain_response'

export type DocTemplateId =
  | 'role_card'
  | 'decision_log'
  | 'ir_checklist'
  | 'comms_template'
  | 'legal_checklist'
  | 'escalation_matrix'

// Legacy holder — still referenced by facilitator-support builders. Values are
// facilitator-only Dutch hints displayed during the run view.
export interface FacilitatorRoundContext {
  roundNumber: number
  activeCapabilities: CapabilityId[]
  observationPrompts: string[]
  complianceTriggers: string[]
  mandateChecks: string[]
  notes: string
}
