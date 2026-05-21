import type { CapabilityPlugin } from "./types"
import type { CapabilityId } from "@/lib/engine/types"
import { governanceDecisionsCapability } from "./governance_decisions"
import { gamificationCapability } from "./gamification"

function placeholder(id: CapabilityId, name: string, description: string): CapabilityPlugin {
  return {
    id,
    name,
    description,
    injectChannelPreferences: [],
    roundActionTypes: ['open_discussion'],
    participantDocTemplates: [],
    facilitatorHints: [],
    assessmentDimensions: [],
  }
}

export const CAPABILITY_REGISTRY: Record<CapabilityId, CapabilityPlugin> = {
  governance_decisions: governanceDecisionsCapability,
  gamification: gamificationCapability,
  crisis_communication: placeholder(
    'crisis_communication',
    'Crisis Communication',
    'Spokesperson decisions, press handling, and stakeholder messaging under public pressure.',
  ),
  business_continuity: placeholder(
    'business_continuity',
    'Business Continuity',
    'Workarounds, priority recovery, and acceptable downtime decisions.',
  ),
  legal_compliance: placeholder(
    'legal_compliance',
    'Legal & Compliance',
    'Regulatory notification timelines, liability, and evidence preservation.',
  ),
  ransom_negotiation: placeholder(
    'ransom_negotiation',
    'Ransom Negotiation',
    'Pay-or-not decisions, negotiation tactics, and insurer coordination.',
  ),
  reputation_management: placeholder(
    'reputation_management',
    'Reputation Management',
    'Media response, LinkedIn, and public perception management.',
  ),
  supply_chain_response: placeholder(
    'supply_chain_response',
    'Supply Chain Response',
    'Vendor coordination, downstream customer impact, and processor liability.',
  ),
}

export function getCapability(id: CapabilityId): CapabilityPlugin {
  return CAPABILITY_REGISTRY[id]
}
