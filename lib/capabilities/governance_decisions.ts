import type { CapabilityPlugin } from "./types"

export const governanceDecisionsCapability: CapabilityPlugin = {
  id: 'governance_decisions',
  name: 'Governance & Decisions',
  description: 'Tests decision mandate clarity, escalation paths, and structured decision-making frameworks.',
  injectChannelPreferences: ['whatsapp', 'email', 'phone', 'teams'],
  roundActionTypes: ['structured_framework', 'dilemma_card', 'facilitator_halt', 'decision_log', 'open_discussion'],
  participantDocTemplates: ['role_card', 'decision_log', 'escalation_matrix'],
  facilitatorHints: [
    'Watch: is it clear who owns this decision?',
    'Watch: is escalation happening too early or too late?',
    'Watch: does the team apply the decision framework consistently?',
    'Watch: are all voices heard, or is one role dominating?',
  ],
  assessmentDimensions: [
    'decision_speed',
    'decision_quality',
    'escalation_timing',
    'mandate_clarity',
    'framework_adherence',
  ],
}
