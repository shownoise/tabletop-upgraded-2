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
    'Volledige coördinatie van het crisisteam over IT, Legal, Communicatie en directie. Druk op meerdere sporen tegelijk, met stakeholders die gelijktijdig iets van je willen.',
  ),
  ransomware_simulation: comingSoon(
    'ransomware_simulation',
    'Ransomware Simulation',
    'Diepgaande ransomware-oefening: onderhandeling, besluiten over herstel uit back-ups, en de meldplicht onder een lopende klok.',
  ),
  business_continuity: comingSoon(
    'business_continuity',
    'Business Continuity',
    'Operationele weerbaarheid: noodoplossingen, welke processen als eerste terug moeten, en welke uitvaltijd nog acceptabel is voor bedrijfskritische processen.',
  ),
  regulatory_compliance: comingSoon(
    'regulatory_compliance',
    'Regulatory Compliance',
    'Meldplichten, contact met de toezichthouder, en het beheersen van compliance-deadlines onder NIS2 en AVG.',
  ),
  supply_chain_crisis: comingSoon(
    'supply_chain_crisis',
    'Supply Chain Crisis',
    'Een gecompromitteerde leverancier, met impact bij je eigen klanten, aansprakelijkheid als verwerker, en coördinatie door de hele keten.',
  ),
  partner_mix: comingSoon(
    'partner_mix',
    'Partner Mix Event',
    'Competitief formaat voor meerdere teams, met scorebord, snelheidsbonussen en dilemmakaarten. Bedoeld voor partner-events en congressen.',
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
