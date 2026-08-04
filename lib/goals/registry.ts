import type { GoalPlugin } from "./types"
import type { GoalId } from "@/lib/engine/types"
import { decisionMakingGoal } from "./decision_making"

function comingSoon(id: GoalId, name: string, description: string): GoalPlugin {
  return {
    id,
    name,
    description,
    status: 'coming_soon',
    capabilities: [],
    defaultScenarioTypes: [],
    facilitatorGuide: '',
    participantBriefing: '',
  }
}

export const GOAL_REGISTRY: Record<GoalId, GoalPlugin> = {
  decision_making: decisionMakingGoal,
  crisis_management: comingSoon(
    'crisis_management',
    'Crisis Management',
    'Full crisis team coordination across IT, Legal, Communications, and Executive. Multi-track pressure with simultaneous stakeholder demands.',
  ),
  ransomware_simulation: comingSoon(
    'ransomware_simulation',
    'Ransomware Simulation',
    'Deep-dive ransomware exercise including negotiation, backup recovery decisions, and regulatory notification under a live timer.',
  ),
  business_continuity: comingSoon(
    'business_continuity',
    'Business Continuity',
    'Operational resilience: workarounds, priority recovery, and acceptable downtime decisions for mission-critical processes.',
  ),
  regulatory_compliance: comingSoon(
    'regulatory_compliance',
    'Regulatory Compliance',
    'Notification obligations, regulator interaction, and compliance deadline management under NIS2 and GDPR.',
  ),
  supply_chain_crisis: comingSoon(
    'supply_chain_crisis',
    'Supply Chain Crisis',
    'Vendor compromise scenarios with downstream customer impact, processor liability, and supply chain response coordination.',
  ),
  partner_mix: comingSoon(
    'partner_mix',
    'Partner Mix Event',
    'Competitive multi-team format with leaderboard, speed bonuses, and dilemma cards. Designed for partner events and conferences.',
  ),
}

export function getGoal(id: GoalId): GoalPlugin {
  return GOAL_REGISTRY[id]
}

export function getActiveGoals(): GoalPlugin[] {
  return Object.values(GOAL_REGISTRY).filter(g => g.status === 'active')
}

export function getAllGoals(): GoalPlugin[] {
  return Object.values(GOAL_REGISTRY)
}
