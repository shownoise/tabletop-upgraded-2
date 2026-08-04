import type { Participant, Role, RoleDistributionEntry, RoleDistributionSnapshot } from "@/lib/types"
import { ROLE_META } from "@/lib/types"
import type { ScenarioGraph, RoundNodeData, DecisionNodeData, InjectNodeData } from "@/lib/graph/types"
import type { Scenario } from "@/lib/types"

// Deterministic, workload-balanced role distribution. Given the roles authored in
// the scenario and the participants who have actually joined, produce a mapping
// where every present participant plays their primary role plus zero or more
// inherited (absent) roles. Load is measured in *authored content units* — a
// decision option or a role-targeted inject each counts as 1.
//
// Determinism guarantees:
//  - No randomness, no Date.now(), no non-stable iteration order.
//  - Same input → same output, byte-identical.
//  - Reordering the input participants[] does not change the output (uses a
//    stable sort on participant id).
//
// Load-balancing:
//  - Absent roles are assigned one at a time, picking the participant with the
//    lowest current workload, then breaking ties by domain-match (same or
//    adjacent RoleMeta.domain), then by sorted role id.
//
// Invariants:
//  - Every present participant retains their primary role. The CEO seat is
//    never handed off to someone else (`isTopDecisionMaker`).
//  - Every authored role is either assigned to some present participant or
//    appears in `unassignedRoles`.

export interface AuthoredWorkload {
  role: Role
  weight: number
}

// Sum decision-options + role-targeted injects per authored role.
export function computeAuthoredWorkload(source: ScenarioGraph | Scenario): AuthoredWorkload[] {
  const byRole = new Map<Role, number>()
  function add(role: Role, delta = 1) {
    byRole.set(role, (byRole.get(role) ?? 0) + delta)
  }

  if ('nodes' in source) {
    // Graph shape
    for (const n of source.nodes) {
      if (n.type === 'round') {
        const rd = n.data as RoundNodeData
        for (const a of rd.roleActions ?? []) for (const r of a.allowedRoles) add(r)
      } else if (n.type === 'decision') {
        const dd = n.data as DecisionNodeData
        for (const o of dd.options) if (o.allowedRole) add(o.allowedRole)
      } else if (n.type === 'inject') {
        const id = n.data as InjectNodeData
        for (const r of id.targetRoles ?? []) add(r)
      }
    }
  } else {
    // Legacy Scenario shape
    for (const round of source.rounds) {
      for (const a of round.roleActions ?? []) for (const r of a.allowedRoles) add(r)
      for (const inj of round.injects) for (const r of inj.targetRoles ?? []) add(r)
    }
  }

  return [...byRole.entries()].map(([role, weight]) => ({ role, weight }))
}

// Distance-of-relatedness between two role domains. Used only as a tie-breaker
// after workload — the goal is to keep related work on the same person before
// splitting it purely by count.
function domainAffinity(a: Role, b: Role): number {
  const da = ROLE_META[a].domain
  const db = ROLE_META[b].domain
  if (da === db) return 0
  // "Adjacent" — same team.
  if (ROLE_META[a].team === ROLE_META[b].team) return 1
  return 2
}

// Stable sort helper — never relies on Array.prototype.sort's stability across
// engines that might not guarantee it (older Node versions did not).
function stableSort<T>(arr: readonly T[], cmp: (a: T, b: T) => number): T[] {
  return arr.map((v, i) => ({ v, i })).sort((x, y) => cmp(x.v, y.v) || x.i - y.i).map(x => x.v)
}

export interface DistributeRolesInput {
  authoredRoles: readonly Role[]
  workloads: readonly AuthoredWorkload[]     // per authored role
  presentParticipants: readonly Participant[]
}

export function distributeRoles(input: DistributeRolesInput): RoleDistributionSnapshot {
  const authored = new Set<Role>(input.authoredRoles)
  const weightOf = new Map<Role, number>(input.workloads.map(w => [w.role, w.weight]))
  const wt = (r: Role) => weightOf.get(r) ?? 1

  // Present participants with a role — filter and stable-sort by participantId
  // so distribution is reproducible.
  const present = stableSort(
    input.presentParticipants.filter(p => !!p.role),
    (a, b) => a.id.localeCompare(b.id),
  )

  const primaryTaken = new Set<Role>()
  const entriesById = new Map<string, RoleDistributionEntry>()
  for (const p of present) {
    if (!p.role) continue
    if (primaryTaken.has(p.role)) continue  // duplicate primary — first wins (stable order)
    primaryTaken.add(p.role)
    entriesById.set(p.id, {
      participantId: p.id,
      participantName: p.name,
      primaryRole: p.role,
      inheritedRoles: [],
      workload: authored.has(p.role) ? wt(p.role) : 0,
    })
  }

  const entries = [...entriesById.values()]
  if (entries.length === 0) {
    return { computedAt: 0, entries: [], unassignedRoles: [...input.authoredRoles], coverage: 0 }
  }

  // Absent authored roles that need to be redistributed.
  // Sort deterministically: heaviest workload first (so big roles get placed
  // first — best-fit shape), then by sorted role id as tiebreaker.
  const absent: Role[] = [...authored].filter(r => !primaryTaken.has(r))
  const absentSorted = stableSort(
    absent,
    (a, b) => (wt(b) - wt(a)) || a.localeCompare(b),
  )

  for (const role of absentSorted) {
    if (role === 'ceo') continue  // top decision-maker's content never re-owned; scoring drops it
    // Pick the participant with the lowest workload, tie-broken by best domain match
    // to the role, then by sorted participant id.
    const ranked = stableSort(entries, (a, b) => {
      if (a.workload !== b.workload) return a.workload - b.workload
      const affA = Math.min(domainAffinity(a.primaryRole, role),
        ...a.inheritedRoles.map(r => domainAffinity(r, role)))
      const affB = Math.min(domainAffinity(b.primaryRole, role),
        ...b.inheritedRoles.map(r => domainAffinity(r, role)))
      if (affA !== affB) return affA - affB
      return a.participantId.localeCompare(b.participantId)
    })
    const target = ranked[0]
    target.inheritedRoles = [...target.inheritedRoles, role]
    target.workload += wt(role)
  }

  const unassignedRoles = absentSorted.filter(r => r === 'ceo' && !primaryTaken.has(r))
  const covered = new Set<Role>()
  for (const e of entries) {
    covered.add(e.primaryRole)
    for (const r of e.inheritedRoles) covered.add(r)
  }
  const authoredCount = [...authored].length
  const coverage = authoredCount === 0 ? 1 : [...authored].filter(r => covered.has(r)).length / authoredCount

  return { computedAt: 0, entries, unassignedRoles, coverage }
}

// Given a RoleDistributionEntry plus optional facilitator overrides, return the
// full set of roles this participant plays right now. Overrides replace inherited
// roles wholesale (primary is always preserved).
export function effectiveRolesForParticipant(entry: RoleDistributionEntry, override?: Role[]): Role[] {
  if (override) return [entry.primaryRole, ...override.filter(r => r !== entry.primaryRole)]
  return [entry.primaryRole, ...entry.inheritedRoles]
}
