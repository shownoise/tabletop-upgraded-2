import type { Inject, Role } from "@/lib/types"
import { ROLE_FALLBACK } from "@/lib/types"
import type { TeamId } from "@/lib/team-roster"

export interface RoutingInput {
  inject: Inject
  presentRoles: Role[]
  teamRoles: Record<TeamId, Role[]>
}

export function resolveInjectRecipients(input: RoutingInput): Role[] {
  const { inject, presentRoles, teamRoles } = input
  if (presentRoles.length === 0) return []
  const present = new Set(presentRoles)

  if (inject.targetRoles?.length) {
    const direct = inject.targetRoles.filter(r => present.has(r))
    if (direct.length > 0) return direct

    const viaFallback = new Set<Role>()
    for (const r of inject.targetRoles) {
      for (const cand of ROLE_FALLBACK[r] ?? []) {
        if (present.has(cand)) { viaFallback.add(cand); break }
      }
    }
    if (viaFallback.size > 0) return [...viaFallback]
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
