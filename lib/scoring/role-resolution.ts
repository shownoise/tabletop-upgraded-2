import { DEFAULT_DOMAIN_OWNERSHIP, DOMAINS, type Domain } from './constants'
import type { RoleId, Roster, ScenarioSpec } from './types'

export interface RoleResolution {
  effectiveOwners: Record<Domain, RoleId | 'NPC'>
  rolCoverage: number   // bezette *eerste-keus* domeinen / totaal
  distinctOwners: number
  resolvedAt: number
  // Interne hulp: welke rol wordt als CRISIS_LEAD gemapt (nuttig voor rapportage).
  crisisLeadAlias?: RoleId
}

// Deel B §1.2 — resolutie bij sessie-start. Eén keer, daarna immutable.
export function resolveRoles(
  roster: Roster,
  scenario: ScenarioSpec,
  now: number = Date.now(),
): RoleResolution {
  const present = new Set(roster.presentRoles)
  const npc = new Set(roster.npcRoles ?? [])
  // NPC-rollen tellen niet als "bezet" voor scoring, maar tellen wel voor doorroutering.
  const bezet = (r: RoleId) => present.has(r) && !npc.has(r)

  const ownership = mergeOwnership(scenario.domainOwnership)
  const effective: Record<Domain, RoleId | 'NPC'> = {} as Record<Domain, RoleId | 'NPC'>
  let firstChoiceFilled = 0

  for (const d of DOMAINS) {
    const chain = ownership[d]
    let assigned: RoleId | 'NPC' = 'NPC'
    let position = -1
    for (let i = 0; i < chain.length; i++) {
      const r = chain[i]
      if (bezet(r)) { assigned = r; position = i; break }
    }
    effective[d] = assigned
    if (position === 0) firstChoiceFilled++
  }

  const rolCoverage = firstChoiceFilled / DOMAINS.length
  const distinctOwners = new Set(
    Object.values(effective).filter((r): r is RoleId => r !== 'NPC'),
  ).size

  return { effectiveOwners: effective, rolCoverage, distinctOwners, resolvedAt: now }
}

function mergeOwnership(overrides?: Partial<Record<Domain, RoleId[]>>): Record<Domain, RoleId[]> {
  const out = {} as Record<Domain, RoleId[]>
  for (const d of DOMAINS) {
    out[d] = overrides?.[d] ?? [...DEFAULT_DOMAIN_OWNERSHIP[d]]
  }
  return out
}

// Deel B §1.3 — voor een gegeven rol: als bezet → die rol; anders effectiveOwner van
// het domein waar de rol in de fallbackketen als eerste voorkomt.
export function effectiveRoleFor(
  role: RoleId,
  resolution: RoleResolution,
  scenario: ScenarioSpec,
): RoleId | 'NPC' {
  // Als deze rol als effectieve eigenaar op minstens één domein staat, dan is 'ie bezet.
  if (Object.values(resolution.effectiveOwners).includes(role)) return role
  // Anders zoek het eerste domein waar deze rol in de fallbackketen staat en gebruik die effectieve eigenaar.
  const ownership = mergeOwnership(scenario.domainOwnership)
  for (const d of DOMAINS) {
    if (ownership[d].includes(role)) return resolution.effectiveOwners[d]
  }
  return 'NPC'
}

