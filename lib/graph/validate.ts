import type { DecisionNodeData, GraphNode, InjectNodeData, RoundNodeData, ScenarioGraph } from "./types"
import { computeCoverage } from "@/lib/engine/supervision"

export interface GraphIssue {
  severity: "error" | "warning"
  nodeId?: string
  edgeId?: string
  message: string
}

export function validateGraph(graph: ScenarioGraph): GraphIssue[] {
  const issues: GraphIssue[] = []
  const nodesById = new Map<string, GraphNode>(graph.nodes.map(n => [n.id, n]))

  const starts = graph.nodes.filter(n => n.type === "start")
  if (starts.length === 0) {
    issues.push({ severity: "error", message: "Graph must have exactly one start node (found 0)." })
  } else if (starts.length > 1) {
    for (const s of starts) {
      issues.push({ severity: "error", nodeId: s.id, message: "Graph must have exactly one start node." })
    }
  }

  for (const edge of graph.edges) {
    if (!nodesById.has(edge.source)) {
      issues.push({ severity: "error", edgeId: edge.id, message: `Edge source "${edge.source}" does not exist.` })
    }
    if (!nodesById.has(edge.target)) {
      issues.push({ severity: "error", edgeId: edge.id, message: `Edge target "${edge.target}" does not exist.` })
    }
  }

  const outgoing = new Map<string, number>()
  for (const edge of graph.edges) {
    outgoing.set(edge.source, (outgoing.get(edge.source) ?? 0) + 1)
  }
  for (const node of graph.nodes) {
    if (node.type === "outcome" || node.type === "inject") continue
    if ((outgoing.get(node.id) ?? 0) === 0) {
      issues.push({
        severity: "error",
        nodeId: node.id,
        message: `${node.type} node has no outgoing edge.`,
      })
    }
  }

  if (starts.length === 1) {
    const reachable = new Set<string>()
    const stack: string[] = [starts[0].id]
    while (stack.length) {
      const id = stack.pop()!
      if (reachable.has(id)) continue
      reachable.add(id)
      for (const edge of graph.edges) {
        if (edge.source === id && !reachable.has(edge.target)) stack.push(edge.target)
      }
    }
    for (const node of graph.nodes) {
      if (!reachable.has(node.id)) {
        const hint = node.type === "outcome"
          ? "Connect it with a sequence or branch edge from a Round, Decision, or Special so participants can reach it."
          : node.type === "inject"
            ? "Connect it to a Round via an 'inject' edge (drag from the round's bottom handle)."
            : "Connect an incoming edge from another node so this can be reached from Start."
        issues.push({
          severity: "error",
          nodeId: node.id,
          message: `${labelFor(node.type)} node is unreachable from start. ${hint}`,
        })
      }
    }
  }

  const roundNodes = graph.nodes.filter(n => n.type === "round")
  if (roundNodes.length > 12) {
    issues.push({ severity: "warning", message: `Graph has ${roundNodes.length} rounds — this feels unwieldy.` })
  }
  for (const round of roundNodes) {
    const hasInjectChild = graph.edges.some(e => e.source === round.id && e.type === "inject")
    if (!hasInjectChild) {
      issues.push({
        severity: "warning",
        nodeId: round.id,
        message: "Round has no injects. Participants will only see the situation update, no messages. Drag Inject nodes onto the canvas and connect them from this round.",
      })
    }
  }

  for (const node of graph.nodes) {
    if (node.type !== "decision") continue
    const dd = node.data as DecisionNodeData
    const outgoing = graph.edges.filter(e => e.source === node.id)
    if (outgoing.length < 2) {
      issues.push({ severity: "error", nodeId: node.id, message: "Decision node must have at least 2 outgoing edges." })
    }
    for (const opt of dd.options) {
      const matched = graph.edges.find(e => e.source === node.id && e.sourceHandle === opt.id)
      if (!matched) {
        issues.push({ severity: "error", nodeId: node.id, message: `Decision option "${opt.label}" has no outgoing edge.` })
      }
    }
    for (const edge of outgoing) {
      if (!edge.sourceHandle) continue
      if (!dd.options.some(o => o.id === edge.sourceHandle)) {
        issues.push({ severity: "error", nodeId: node.id, edgeId: edge.id, message: "Edge references a removed decision option." })
      }
    }
  }

  if (hasCycle(graph)) {
    issues.push({ severity: "error", message: "Graph contains a cycle — only DAGs are supported." })
  }

  // Content checks — surfaced pre-publish
  for (const round of roundNodes) {
    const rd = round.data as RoundNodeData
    if (!rd.title?.trim()) {
      issues.push({ severity: "error", nodeId: round.id, message: "Round has no title." })
    }
    if (!rd.situation_update?.trim()) {
      issues.push({ severity: "warning", nodeId: round.id, message: "Round has no situation update — participants will see a blank briefing." })
    }
  }

  const injectNodes = graph.nodes.filter(n => n.type === "inject")
  for (const inj of injectNodes) {
    const d = inj.data as InjectNodeData
    if (!d.title?.trim()) {
      issues.push({ severity: "warning", nodeId: inj.id, message: "Inject has no title." })
    }
    if (!d.content?.trim()) {
      issues.push({ severity: "warning", nodeId: inj.id, message: "Inject has no content." })
    }
  }

  if (roundNodes.length === 0) {
    issues.push({ severity: "error", message: "Scenario has no rounds." })
  }

  // Coverage warnings
  const coverage = computeCoverage(graph)
  const uncovered = coverage.filter(c => c.coverageLevel === 'none')
  if (uncovered.length > 0) {
    issues.push({
      severity: "warning",
      message: `Coverage: ${uncovered.length} testgebieden onbedekt (${uncovered.map(c => c.meta.numberLabel).join(", ")}).`,
    })
  }

  const meldplicht = graph.meldplicht
  if (meldplicht?.enabled) {
    const notificationTagged = graph.nodes.some(n => {
      const d = n.data as { supervisionAreas?: string[]; roleActions?: { supervisionAreas?: string[] }[] }
      if ((d.supervisionAreas ?? []).includes('notification_duty')) return true
      return (d.roleActions ?? []).some(a => (a.supervisionAreas ?? []).includes('notification_duty'))
    })
    if (!notificationTagged) {
      issues.push({ severity: "warning", message: "Meldplicht staat aan maar geen enkele node/actie is getagd met 'notification_duty'." })
    }
    if (meldplicht.chasersEnabled) {
      const hasChaser = graph.nodes.some(n => n.type === "chaser")
      if (!hasChaser) {
        issues.push({ severity: "warning", message: "Chasers staan aan maar er is geen chaser-node in de graph." })
      }
    }
  }

  const outcomeNodes = graph.nodes.filter(n => n.type === "outcome")
  for (const o of outcomeNodes) {
    const incoming = graph.edges.filter(e => e.target === o.id)
    if (incoming.length === 0) {
      issues.push({ severity: "warning", nodeId: o.id, message: "Outcome heeft geen inkomende decision-paden — onbereikbaar bij spel." })
    }
  }

  for (const n of graph.nodes) {
    if (n.type !== 'special') continue
    const sd = n.data as { type?: string }
    if (sd.type === 'ir_retainer_activation') {
      if (!graph.irRetainerProfile) {
        issues.push({ severity: "warning", nodeId: n.id, message: "IR-retainer activation node zonder retainer profile op de graph." })
      }
    }
  }

  return issues
}

function labelFor(type: string): string {
  return type.charAt(0).toUpperCase() + type.slice(1)
}

function hasCycle(graph: ScenarioGraph): boolean {
  const adjacency = new Map<string, string[]>()
  for (const edge of graph.edges) {
    const list = adjacency.get(edge.source) ?? []
    list.push(edge.target)
    adjacency.set(edge.source, list)
  }
  const WHITE = 0, GRAY = 1, BLACK = 2
  const color = new Map<string, number>()
  for (const node of graph.nodes) color.set(node.id, WHITE)

  function visit(id: string): boolean {
    color.set(id, GRAY)
    for (const next of adjacency.get(id) ?? []) {
      const c = color.get(next) ?? WHITE
      if (c === GRAY) return true
      if (c === WHITE && visit(next)) return true
    }
    color.set(id, BLACK)
    return false
  }

  for (const node of graph.nodes) {
    if ((color.get(node.id) ?? WHITE) === WHITE) {
      if (visit(node.id)) return true
    }
  }
  return false
}
