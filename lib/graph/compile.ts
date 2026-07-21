import type { Inject, Round, Scenario } from "@/lib/types"
import type { GraphNode, InjectNodeData, RoundNodeData, ScenarioGraph } from "./types"

export function compileLinearGraph(graph: ScenarioGraph): Scenario {
  const starts = graph.nodes.filter(n => n.type === "start")
  if (starts.length !== 1) {
    throw new Error("Graph must have exactly one start node")
  }

  const hasBranchNodes = graph.nodes.some(n => n.type === "decision" || n.type === "special" || n.type === "outcome")
  if (hasBranchNodes) {
    console.warn("compileLinearGraph: graph contains decision/special/outcome nodes — ignored in Phase 1.")
  }

  const nodeById = new Map<string, GraphNode>(graph.nodes.map(n => [n.id, n]))
  const sequenceOut = new Map<string, string[]>()
  const injectOut = new Map<string, string[]>()
  for (const edge of graph.edges) {
    if (edge.type === "sequence") {
      const list = sequenceOut.get(edge.source) ?? []
      list.push(edge.target)
      sequenceOut.set(edge.source, list)
    } else if (edge.type === "inject") {
      const list = injectOut.get(edge.source) ?? []
      list.push(edge.target)
      injectOut.set(edge.source, list)
    }
  }

  const orderedRounds: GraphNode[] = []
  const seen = new Set<string>()
  let cursor: string | undefined = starts[0].id
  while (cursor && !seen.has(cursor)) {
    seen.add(cursor)
    const node = nodeById.get(cursor)
    if (!node) break
    if (node.type === "round") orderedRounds.push(node)
    const next = sequenceOut.get(cursor)
    cursor = next?.[0]
  }

  const rounds: Round[] = orderedRounds.map((roundNode, idx) => {
    const rd = roundNode.data as RoundNodeData
    const injectTargets = injectOut.get(roundNode.id) ?? []
    const injects: Inject[] = injectTargets.flatMap((tid, i) => {
      const child = nodeById.get(tid)
      if (!child || child.type !== "inject") return []
      const d = child.data as InjectNodeData
      const { kind: _kind, ...injectFields } = d
      const inject: Inject = { id: `${roundNode.id}-inj-${i}`, ...injectFields }
      return [inject]
    })
    return {
      round_number: idx + 1,
      title: rd.title,
      situation_update: rd.situation_update,
      injects,
      timerMinutes: rd.timerMinutes,
      roleActions: rd.roleActions,
      learningObjectives: rd.learningObjectives,
      facilitatorNotes: rd.facilitatorNotes,
    }
  })

  const rawName = graph.name.trim()
  const upper = rawName.toUpperCase()
  const scenario_title = upper.startsWith("OPERATIE ") ? upper : `OPERATIE ${upper}`
  const scenario_summary = rounds[0]?.situation_update ?? ""

  return { scenario_title, scenario_summary, rounds }
}
