import type { CapabilityPlugin } from "./types"

export const governanceDecisionsCapability: CapabilityPlugin = {
  id: 'governance_decisions',
  name: 'Governance & Decisions',
  description: 'Tests decision mandate clarity, escalation paths, and structured decision-making.',
  injectChannelPreferences: ['whatsapp', 'email', 'phone', 'teams'],
  participantDocTemplates: ['role_card', 'decision_log', 'escalation_matrix'],
  facilitatorHints: [
    'Let op: is duidelijk wie de eigenaar is van dit besluit?',
    'Let op: gebeurt escalatie te vroeg of te laat?',
    'Let op: past het team het gekozen framework consistent toe?',
    'Let op: worden alle stemmen gehoord, of domineert één rol?',
  ],
}
