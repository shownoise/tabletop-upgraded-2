import { ROLE_META } from "@/lib/types"
import type { Inject, Role, RoleAction } from "@/lib/types"
import type { InjectNodeData, RoundNodeData, ScenarioGraph } from "./types"

export interface RoundPreview {
  title: string
  situation_update: string
  timerMinutes?: number
  injects: Array<{ inject: Inject; visible: boolean; reason: string }>
  roleActions: RoleAction[]
}

function injectMatchesRole(inject: InjectNodeData, role: Role): { visible: boolean; reason: string } {
  if (inject.targetRoles && inject.targetRoles.length > 0) {
    const ok = inject.targetRoles.includes(role)
    return { visible: ok, reason: ok ? `Targeted at ${role}` : `Only visible to ${inject.targetRoles.join(", ")}` }
  }
  const team = inject.targetTeam ?? "all"
  if (team === "all") return { visible: true, reason: "Broadcast to all" }
  const roleTeam = ROLE_META[role].team
  const ok = team === roleTeam
  return {
    visible: ok,
    reason: ok ? `Team ${team} matches role team` : `Team ${team} only — role is in ${roleTeam}`,
  }
}

export function previewRoundForRole(graph: ScenarioGraph, roundNodeId: string, role: Role): RoundPreview | null {
  const nodeById = new Map(graph.nodes.map(n => [n.id, n]))
  const round = nodeById.get(roundNodeId)
  if (!round || round.type !== "round") return null

  const rd = round.data as RoundNodeData
  const injectEdges = graph.edges.filter(e => e.source === roundNodeId && e.type === "inject")

  const injects = injectEdges.map((edge, i) => {
    const child = nodeById.get(edge.target)
    if (!child || child.type !== "inject") return null
    const d = child.data as InjectNodeData
    const { kind: _kind, ...fields } = d
    const inject: Inject = { id: `${roundNodeId}-inj-${i}`, ...fields }
    const { visible, reason } = injectMatchesRole(d, role)
    return { inject, visible, reason }
  }).filter((x): x is { inject: Inject; visible: boolean; reason: string } => x !== null)

  const roleActions = (rd.roleActions ?? []).filter(a => a.allowedRoles.length === 0 || a.allowedRoles.includes(role))

  return {
    title: rd.title,
    situation_update: rd.situation_update,
    timerMinutes: rd.timerMinutes,
    injects,
    roleActions,
  }
}

export function listRoundNodes(graph: ScenarioGraph): Array<{ id: string; title: string }> {
  return graph.nodes
    .filter(n => n.type === "round")
    .map(n => ({ id: n.id, title: (n.data as RoundNodeData).title || "(untitled)" }))
}
