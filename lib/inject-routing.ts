import type { Inject, InjectRoutePlan, Role, Scenario, SessionState, RoleDistributionSnapshot } from "@/lib/types"
import type { TeamId } from "@/lib/team-roster"
import { effectiveRolesForParticipant } from "@/lib/engine/distribute-roles"

export interface RoutingInput {
  inject: Inject
  presentRoles: Role[]
  teamRoles: Record<TeamId, Role[]>
  distribution?: RoleDistributionSnapshot
  overrides?: Record<string, Role[]>
}

// Route an inject to the effective set of roles that should see it. If the
// authored `targetRoles` list is present, resolve each role through the
// distribution: if a role is absent-primary but assigned as inherited, the
// participant carrying it gets the inject. Falls back to team-targeting, then
// to a deterministic single-participant hash.
export function resolveInjectRecipients(input: RoutingInput): Role[] {
  const { inject, presentRoles, teamRoles, distribution, overrides } = input
  if (presentRoles.length === 0) return []
  const present = new Set(presentRoles)

  if (inject.targetRoles?.length) {
    const direct = inject.targetRoles.filter(r => present.has(r))
    if (direct.length > 0) return direct

    if (distribution) {
      // Find every participant who inherits any of the missing target roles,
      // then return their primary roles (which participants actually play).
      const inherited = new Set<Role>()
      for (const target of inject.targetRoles) {
        for (const entry of distribution.entries) {
          const roles = effectiveRolesForParticipant(entry, overrides?.[entry.participantId])
          if (roles.includes(target)) inherited.add(entry.primaryRole)
        }
      }
      if (inherited.size > 0) return [...inherited]
    }
  }

  const team = inject.targetTeam
  if (team && team !== "all") {
    const inTeam = (teamRoles[team] ?? []).filter(r => present.has(r))
    if (inTeam.length > 0) return inTeam
  }

  const idx = stableHash(inject.id) % presentRoles.length
  return [presentRoles[idx]]
}

function stableHash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

export function plotInjectRoutes(input: {
  scenario: Scenario
  presentRoles: Role[]
  teamRoles: Record<TeamId, Role[]>
  previousVersion?: number
  distribution?: RoleDistributionSnapshot
  overrides?: Record<string, Role[]>
}): InjectRoutePlan {
  const routes: Record<string, Role[]> = {}
  const load: Partial<Record<Role, number>> = {}
  for (const r of input.presentRoles) load[r] = 0

  for (const round of input.scenario.rounds) {
    for (const inject of round.injects) {
      const resolved = resolveInjectRecipients({
        inject,
        presentRoles: input.presentRoles,
        teamRoles: input.teamRoles,
        distribution: input.distribution,
        overrides: input.overrides,
      })

      // WHY: stableHash % N tends to pile injects onto the same participant when the scenario
      // has few injects. Rebalance the single-recipient fallback path to the least-loaded role.
      const isHashFallback =
        !inject.targetRoles?.length &&
        (!inject.targetTeam || inject.targetTeam === "all")

      let final = resolved
      if (isHashFallback && resolved.length === 1 && input.presentRoles.length > 0) {
        const leastLoaded = [...input.presentRoles].sort((a, b) => (load[a] ?? 0) - (load[b] ?? 0))[0]
        if (leastLoaded) final = [leastLoaded]
      }

      routes[inject.id] = final
      for (const r of final) load[r] = (load[r] ?? 0) + 1
    }
  }

  return {
    version: (input.previousVersion ?? 0) + 1,
    plottedAt: Date.now(),
    presentRolesAtPlot: input.presentRoles,
    routes,
  }
}

export function getInjectRecipients(
  inject: Inject,
  session: SessionState,
  teamRoles: Record<TeamId, Role[]>,
): Role[] {
  const planned = session.injectRoutePlan?.routes[inject.id]
  if (planned && planned.length > 0) return planned
  const presentRoles = session.participants.map(p => p.role).filter((r): r is Role => !!r)
  return resolveInjectRecipients({
    inject,
    presentRoles,
    teamRoles,
    distribution: session.roleDistribution,
    overrides: session.roleAssignmentOverrides,
  })
}
