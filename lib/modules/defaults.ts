import type { ScenarioType } from "../types"
import type { TemplateModuleSlot } from "../types/scenario-instance"

export const DEFAULT_MODULE_SETS: Record<ScenarioType, TemplateModuleSlot[]> = {
  ransomware_double_extortion: [
    { module_id: 'detection_sensemaking' },
    { module_id: 'business_continuity' },
    { module_id: 'crisis_communication' },
    { module_id: 'ransom_negotiation' },
  ],
  insider_threat: [
    { module_id: 'detection_sensemaking' },
    { module_id: 'insider_investigation' },
    { module_id: 'legal_regulatory' },
    { module_id: 'crisis_communication' },
  ],
  bec_cfo_fraud: [
    { module_id: 'detection_sensemaking' },
    { module_id: 'legal_regulatory' },
    { module_id: 'crisis_communication' },
  ],
  supply_chain_compromise: [
    { module_id: 'detection_sensemaking' },
    { module_id: 'supply_chain_response' },
    { module_id: 'business_continuity' },
    { module_id: 'crisis_communication' },
  ],
}

// Default module-projections: which chain phases are visible per module per scenario type.
// AI generator uses these as starting point; can be overridden per template.
export const DEFAULT_VISIBLE_PHASES: Record<ScenarioType, Record<string, string[]>> = {
  ransomware_double_extortion: {
    detection_sensemaking: ['T-0-encryption', 'T+0-ransom-demand'],
    business_continuity: ['T-0-encryption', 'T-3d-data-exfiltration'],
    crisis_communication: ['T-0-encryption', 'T+0-ransom-demand', 'T+2-proof-of-life'],
    ransom_negotiation: ['T+0-ransom-demand', 'T+2-proof-of-life'],
  },
  insider_threat: {
    detection_sensemaking: ['T-0-detection', 'T-7d-dlp-alert-fires'],
    insider_investigation: [
      'T-180d-trigger-event', 'T-90d-behavior-change', 'T-60d-data-hoarding-starts',
      'T-30d-resignation-discussed', 'T-14d-acceleration', 'T-7d-dlp-alert-fires',
      'T-3d-laatste-werkweek', 'T-0-detection',
    ],
    legal_regulatory: ['T-0-detection', 'T+1d-investigation-starts'],
    crisis_communication: ['T+1d-investigation-starts'],
  },
  bec_cfo_fraud: {
    detection_sensemaking: ['T+7d-real-supplier-calls', 'T-0-payment-executed'],
    legal_regulatory: ['T-0-payment-executed', 'T+7d-real-supplier-calls'],
    crisis_communication: ['T+7d-real-supplier-calls'],
  },
  supply_chain_compromise: {
    detection_sensemaking: ['T-0-breach-notice', 'T-60d-foothold-at-client'],
    supply_chain_response: [
      'T-180d-supplier-compromised', 'T-90d-trojanized-update',
      'T-60d-foothold-at-client', 'T-0-breach-notice',
    ],
    business_continuity: ['T+3d-own-impact-confirmed'],
    crisis_communication: ['T+1d-news-breaks', 'T+3d-own-impact-confirmed'],
  },
}
