import type { Inject, Role, Round, SessionState, SpecialType } from "@/lib/types"
import type {
  ChaserNodeData,
  DecisionNodeData,
  InjectNodeData,
  OutcomeNodeData,
  RoundNodeData,
  ScenarioGraph,
  SpecialNodeData,
} from "./types"

export type EngineTrigger =
  | { kind: "auto" }
  | { kind: "facilitator_next" }
  | { kind: "decision_made"; handle: string }
  | { kind: "special_completed"; score: number }

export type EngineOutput =
  | { kind: "push_inject"; inject: Inject }
  | { kind: "start_round"; round: Round; nodeId: string }
  | { kind: "trigger_special"; type: SpecialType; assignedRole?: Role; nodeId: string }
  | { kind: "set_outcome"; outcome: OutcomeNodeData; nodeId: string }
  | { kind: "await_decision"; nodeId: string; prompt: string; measuredBy: DecisionNodeData["measuredBy"]; options: DecisionNodeData["options"]; triggerRole?: Role }

export interface StepResult {
  nextNodeId: string | null
  outputs: EngineOutput[]
}

function evalPredicate(op: "<" | "<=" | ">" | ">=" | "==", value: number, score: number): boolean {
  switch (op) {
    case "<": return score < value
    case "<=": return score <= value
    case ">": return score > value
    case ">=": return score >= value
    case "==": return score === value
  }
}

function injectsForRound(graph: ScenarioGraph, nodeById: Map<string, ScenarioGraph["nodes"][number]>, roundNodeId: string): Inject[] {
  const edges = graph.edges.filter(e => e.source === roundNodeId && e.type === "inject")
  return edges.flatMap((e, i) => {
    const child = nodeById.get(e.target)
    if (!child || child.type !== "inject") return []
    const d = child.data as InjectNodeData
    const { kind: _kind, ...fields } = d
    const inject: Inject = { id: `${roundNodeId}-inj-${i}`, ...fields }
    return [inject]
  })
}

export function stepFromNode(
  graph: ScenarioGraph,
  currentNodeId: string,
  trigger: EngineTrigger,
): StepResult {
  const nodeById = new Map(graph.nodes.map(n => [n.id, n]))
  const current = nodeById.get(currentNodeId)
  if (!current) return { nextNodeId: null, outputs: [] }

  let nextId: string | null = null

  if (current.type === "start") {
    if (trigger.kind !== "auto") return { nextNodeId: currentNodeId, outputs: [] }
    const out = graph.edges.find(e => e.source === currentNodeId && e.type === "sequence")
    nextId = out?.target ?? null
  } else if (current.type === "round") {
    if (trigger.kind !== "facilitator_next") return { nextNodeId: currentNodeId, outputs: [] }
    const outs = graph.edges.filter(e => e.source === currentNodeId && e.type === "sequence")
    if (outs.length > 1) {
      throw new Error("Round has multiple outgoing sequence edges — use a Decision node to branch.")
    }
    nextId = outs[0]?.target ?? null
  } else if (current.type === "decision") {
    const dd = current.data as DecisionNodeData
    // Three cases:
    //   1. advancesGraph === false: soft scoring node, sequence forward on either trigger.
    //   2. perRole: true: decision-collection point (every option's branch edge points to
    //      the same next-round target). facilitator_next follows any outgoing edge — they
    //      all converge. This was the third-report "cannot advance" bug: facilitator_next
    //      on a per-role decision node was silently refused because the code required a
    //      decision_made trigger with a matching sourceHandle, which no client sends for
    //      a collection node.
    //   3. Otherwise: hard facilitator-picks branching decision, requires decision_made
    //      with a specific handle.
    if (dd.advancesGraph === false) {
      if (trigger.kind !== "decision_made" && trigger.kind !== "facilitator_next") {
        return { nextNodeId: currentNodeId, outputs: [] }
      }
      const seq = graph.edges.find(e => e.source === currentNodeId && (e.type === "sequence" || !e.sourceHandle))
      nextId = seq?.target ?? null
    } else if (dd.perRole === true) {
      if (trigger.kind !== "decision_made" && trigger.kind !== "facilitator_next") {
        return { nextNodeId: currentNodeId, outputs: [] }
      }
      // Every branch edge from a per-role decision points to the same target — pick any.
      const anyBranch = graph.edges.find(e => e.source === currentNodeId)
      nextId = anyBranch?.target ?? null
    } else {
      if (trigger.kind !== "decision_made") return { nextNodeId: currentNodeId, outputs: [] }
      const chosen = graph.edges.find(e => e.source === currentNodeId && e.sourceHandle === trigger.handle)
      nextId = chosen?.target ?? null
    }
  } else if (current.type === "special") {
    if (trigger.kind !== "special_completed") return { nextNodeId: currentNodeId, outputs: [] }
    const data = current.data as SpecialNodeData
    const threshold = data.thresholds.find(t => evalPredicate(t.predicate.op, t.predicate.value, trigger.score))
    if (threshold) {
      const edge = graph.edges.find(e => e.source === currentNodeId && e.sourceHandle === threshold.id)
      nextId = edge?.target ?? null
    } else {
      const fallback = graph.edges.find(e => e.source === currentNodeId && e.type === "sequence")
      nextId = fallback?.target ?? null
    }
  } else {
    return { nextNodeId: null, outputs: [] }
  }

  if (!nextId) return { nextNodeId: null, outputs: [] }

  const next = nodeById.get(nextId)
  if (!next) return { nextNodeId: null, outputs: [] }

  const outputs: EngineOutput[] = []

  if (next.type === "round") {
    const rd = next.data as RoundNodeData
    const injects = injectsForRound(graph, nodeById, next.id)
    const round: Round = {
      round_number: 0,
      title: rd.title,
      situation_update: rd.situation_update,
      injects,
      timerMinutes: rd.timerMinutes,
      roleActions: rd.roleActions,
      learningObjectives: rd.learningObjectives,
      facilitatorNotes: rd.facilitatorNotes,
    }
    outputs.push({ kind: "start_round", round, nodeId: next.id })
    return { nextNodeId: next.id, outputs }
  }
  if (next.type === "decision") {
    const dd = next.data as DecisionNodeData
    outputs.push({
      kind: "await_decision",
      nodeId: next.id,
      prompt: dd.prompt,
      measuredBy: dd.measuredBy,
      options: dd.options,
      triggerRole: dd.triggerRole,
    })
    return { nextNodeId: next.id, outputs }
  }
  if (next.type === "special") {
    const sd = next.data as SpecialNodeData
    outputs.push({ kind: "trigger_special", type: sd.type, assignedRole: sd.assignedRole, nodeId: next.id })
    return { nextNodeId: next.id, outputs }
  }
  if (next.type === "outcome") {
    const od = next.data as OutcomeNodeData
    outputs.push({ kind: "set_outcome", outcome: od, nodeId: next.id })
    return { nextNodeId: null, outputs }
  }

  return { nextNodeId: next.id, outputs }
}

export function evaluateChasersOnRoundStart(
  graph: ScenarioGraph,
  session: SessionState,
  roundNumber: number,
): Inject[] {
  const results: Inject[] = []
  for (const node of graph.nodes) {
    if (node.type !== "chaser") continue
    const data = node.data as ChaserNodeData
    if (typeof data.condition.afterRoundNumber === "number" && data.condition.afterRoundNumber > roundNumber) continue
    if (!conditionTrue(data, session)) continue
    const { kind: _kind, ...injectFields } = data.inject
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[chaser] firing "${injectFields.title}" (round=${roundNumber}, condition=${data.condition.kind})`)
    }
    results.push({ id: `${node.id}-chase`, ...injectFields })
  }
  return results
}

function conditionTrue(chaser: ChaserNodeData, session: SessionState): boolean {
  const cond = chaser.condition
  if (cond.kind === "regulatory_obligation_open") {
    if (!cond.milestoneId) return false
    const list = session.regulatoryObligations ?? []
    return list.some(o => o.milestoneId === cond.milestoneId && o.status === 'open')
  }
  if (cond.kind === "decision_not_taken") {
    if (!cond.roleActionId) return false
    return !(session.submittedDecisions ?? []).some(d => d.actionId === cond.roleActionId)
  }
  if (cond.kind === "flag") {
    if (!cond.key) return false
    const value = (session.flags ?? {})[cond.key] ?? false
    return cond.value === undefined ? !!value : value === cond.value
  }
  return false
}
