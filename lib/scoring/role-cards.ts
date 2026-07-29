import type { RoleResolution } from './role-resolution'
import type { InjectSpec, RoleId, ScenarioSpec } from './types'

// Deel B §7.5 — genereer rolkaarten per ronde per rol.
//
//   "Print per ronde per rol een kaart of envelop met het mandaat van die rol
//    en de informatie die alleen zij heeft — precies de visibleTo-injects uit
//    Deel A §4.2b."
//
// Puur: input scenario + resolutie → per (ronde, rol) een payload.

export interface RoleCard {
  round: number
  role: RoleId
  // Beslispunten waar deze rol eigenaar van is (voor mandaat-context).
  ownedDecisions: Array<{
    decisionPointId: string
    domain: string
    consulted: RoleId[]
    prompt?: string
  }>
  // Injects die *alleen* deze rol ziet (visibleTo-exclusiviteit).
  privateInjects: InjectSpec[]
  // Injects die als misroute bij deze rol binnenkomen (correctRoute wijst weg).
  misroutedInjects: Array<InjectSpec & { correctRouteEffective: RoleId | 'NPC' }>
}

export function buildRoleCards(
  scenario: ScenarioSpec,
  resolution: RoleResolution,
): RoleCard[] {
  const roles = new Set<RoleId>(Object.values(resolution.effectiveOwners).filter((r): r is RoleId => r !== 'NPC'))
  const cards: RoleCard[] = []
  for (const round of scenario.rounds) {
    for (const role of roles) {
      const ownedDecisions = scenario.decisionPoints
        .filter(dp => dp.round === round.number && (dp.designedOwner === role || resolution.effectiveOwners[dp.domain] === role))
        .map(dp => ({
          decisionPointId: dp.id,
          domain: dp.domain,
          consulted: dp.consulted ?? [],
        }))

      const privateInjects = scenario.injects.filter(i =>
        i.round === round.number
        && i.visibleTo?.length === 1
        && i.visibleTo[0] === role,
      )

      const misroutedInjects = scenario.injects
        .filter(i => i.round === round.number && i.correctRoute && i.visibleTo?.includes(role) && i.correctRoute !== role)
        .map(i => ({
          ...i,
          correctRouteEffective: (i.correctRoute && resolution.effectiveOwners[getDomainForRole(scenario, i.correctRoute)] as RoleId | 'NPC') ?? 'NPC' as const,
        }))

      // Toon alleen kaarten die inhoud hebben.
      if (ownedDecisions.length + privateInjects.length + misroutedInjects.length === 0) continue
      cards.push({ round: round.number, role, ownedDecisions, privateInjects, misroutedInjects })
    }
  }
  return cards
}

function getDomainForRole(scenario: ScenarioSpec, role: RoleId): import('./constants').Domain {
  // Zoek eerste domein waar de rol als designedOwner voorkomt in een beslispunt.
  // Anders val terug op EXTERNE_PARTIJEN (spec default sluitstuk-domein).
  const dp = scenario.decisionPoints.find(d => d.designedOwner === role)
  return (dp?.domain ?? 'EXTERNE_PARTIJEN') as import('./constants').Domain
}
