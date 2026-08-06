import type { GraphNode, InjectNodeData, ScenarioGraph } from "./types"

// Phase 1 — setup-inject link.
//
// A "setup inject" is an inject the author marks with setsUpDecisionNodeId
// pointing at a DecisionNode. Framework rule: every decision should have at
// least one setup inject in the same round or the immediately preceding round.
//
// This module computes:
//   1. Which round a given node belongs to (by inject-edge or by sequence-edge
//      reachability from Start), producing a monotone round index.
//   2. All setup injects for a given decision node, filtered to same/prev round.
//   3. The set of decision nodes that have no setup inject anywhere — used by
//      the validator and by the decision-card overview warning.

export interface RoundIndexMap {
  // nodeId → 1-based round number (index in the ordered chain of RoundNodes).
  // Nodes attached to a round via inject-edge inherit the round's index.
  // Nodes downstream of a round via sequence-edge inherit the source round's
  // index too (a Decision "belongs" to the round that leads into it).
  byNode: Map<string, number>
  // roundNodeId → 1-based round number (order of first reachability from start).
  roundNumberById: Map<string, number>
}

// Compute round indices by walking sequence-edges from Start. Rounds are
// numbered in the order they are first reached. Every other node inherits
// the round of whichever RoundNode most-recently precedes it in the walk.
export function buildRoundIndexMap(graph: ScenarioGraph): RoundIndexMap {
  const byNode = new Map<string, number>()
  const roundNumberById = new Map<string, number>()

  const nodesById = new Map<string, GraphNode>(graph.nodes.map(n => [n.id, n]))
  const outgoing = new Map<string, string[]>()
  for (const e of graph.edges) {
    const list = outgoing.get(e.source) ?? []
    list.push(e.target)
    outgoing.set(e.source, list)
  }

  const start = graph.nodes.find(n => n.type === "start")
  if (!start) {
    // Fall back to graph order — best-effort.
    let rn = 0
    for (const n of graph.nodes) {
      if (n.type === "round") {
        rn += 1
        roundNumberById.set(n.id, rn)
        byNode.set(n.id, rn)
      }
    }
    return { byNode, roundNumberById }
  }

  // DFS assigning "current round" as we walk. First time we see a RoundNode
  // is where its number gets frozen. Injects attached via inject-edge to a
  // round get the round's number directly.
  let counter = 0
  function visit(id: string, currentRound: number, seen: Set<string>) {
    if (seen.has(id)) return
    seen.add(id)
    const node = nodesById.get(id)
    if (!node) return
    let round = currentRound
    if (node.type === "round" && !roundNumberById.has(node.id)) {
      counter += 1
      roundNumberById.set(node.id, counter)
      round = counter
    } else if (node.type === "round") {
      round = roundNumberById.get(node.id)!
    }
    if (round > 0 && !byNode.has(node.id)) byNode.set(node.id, round)

    for (const nextId of outgoing.get(id) ?? []) {
      visit(nextId, round, seen)
    }
  }
  visit(start.id, 0, new Set())

  // Second pass — pick up inject-edge children that were unreachable from
  // start via the normal walk (e.g. dangling injects attached only by
  // inject-edge). Give them their round's number if the round has one.
  for (const e of graph.edges) {
    if (e.type !== "inject") continue
    const roundNumber = roundNumberById.get(e.source)
    if (roundNumber && !byNode.has(e.target)) {
      byNode.set(e.target, roundNumber)
    }
  }

  return { byNode, roundNumberById }
}

export interface SetupInjectEntry {
  injectId: string
  title: string
  roundNumber: number   // 1-based round of the inject
}

// Return all injects that carry setsUpDecisionNodeId === decisionId AND live in
// the same or the immediately preceding round as the decision node. Same-round
// setups are listed first, then previous-round.
export function collectSetupInjectsForDecision(
  graph: ScenarioGraph,
  decisionId: string,
  roundMap?: RoundIndexMap,
): SetupInjectEntry[] {
  const map = roundMap ?? buildRoundIndexMap(graph)
  const decisionRound = map.byNode.get(decisionId)
  if (!decisionRound) return []
  const entries: SetupInjectEntry[] = []
  for (const n of graph.nodes) {
    if (n.type !== "inject") continue
    const d = n.data as InjectNodeData
    if (d.setsUpDecisionNodeId !== decisionId) continue
    const injectRound = map.byNode.get(n.id)
    if (!injectRound) continue
    if (injectRound === decisionRound || injectRound === decisionRound - 1) {
      entries.push({ injectId: n.id, title: d.title ?? "(zonder titel)", roundNumber: injectRound })
    }
  }
  return entries.sort((a, b) => b.roundNumber - a.roundNumber)
}

// Return all decision nodes reachable in the graph that have zero setup injects
// (same or previous round). Used by the validator + by an at-a-glance count in
// tests. The result is stable-sorted by node id for deterministic snapshots.
export function collectDecisionsWithoutSetup(graph: ScenarioGraph): string[] {
  const map = buildRoundIndexMap(graph)
  const out: string[] = []
  for (const n of graph.nodes) {
    if (n.type !== "decision") continue
    const setups = collectSetupInjectsForDecision(graph, n.id, map)
    if (setups.length === 0) out.push(n.id)
  }
  return out.sort()
}

// List all decision nodes in the same or previous round of an inject — used by
// the inject-inspector dropdown to populate "Zet welke beslissing op?".
export function candidateDecisionsForInject(
  graph: ScenarioGraph,
  injectId: string,
  roundMap?: RoundIndexMap,
): Array<{ decisionId: string; label: string; roundNumber: number }> {
  const map = roundMap ?? buildRoundIndexMap(graph)
  const injectRound = map.byNode.get(injectId)
  if (!injectRound) return []
  const out: Array<{ decisionId: string; label: string; roundNumber: number }> = []
  for (const n of graph.nodes) {
    if (n.type !== "decision") continue
    const dRound = map.byNode.get(n.id)
    if (!dRound) continue
    if (dRound === injectRound || dRound === injectRound + 1) {
      const prompt = (n.data as { prompt?: string }).prompt ?? "(zonder vraag)"
      out.push({ decisionId: n.id, label: prompt, roundNumber: dRound })
    }
  }
  return out.sort((a, b) => a.roundNumber - b.roundNumber)
}
