import { ROLE_META, type Role } from "@/lib/types"

export type TeamId = "crisis_management" | "technical_it"

export function buildTeamRoles(): Record<TeamId, Role[]> {
  const acc: Record<TeamId, Role[]> = { crisis_management: [], technical_it: [] }
  for (const roleId of Object.keys(ROLE_META) as Role[]) {
    const meta = ROLE_META[roleId]
    if (meta.team === "crisis_management" || meta.team === "technical_it") {
      acc[meta.team].push(roleId)
    }
  }
  return acc
}
