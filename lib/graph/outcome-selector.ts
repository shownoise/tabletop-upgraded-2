import type { SubmittedDecision } from "@/lib/types"
import type { DecisionNodeData, OutcomeNodeData, OutcomeVector, ScenarioGraph } from "./types"

interface SubmissionRef {
  actionId?: string
  optionId?: string
}

// The 6 outcome dimensions — CONT/FOR/BC/JUR/VER/KOS.
const DIMS: readonly (keyof OutcomeVector)[] = ['CONT', 'FOR', 'BC', 'JUR', 'VER', 'KOS'] as const

// Sum outcome-vectors from every decision option that was selected. Options
// without an explicit outcomeVector contribute zero.
function collectOutcomeVectors(graph: ScenarioGraph, submissions: SubmissionRef[]): OutcomeVector[] {
  const optionIds = new Set(submissions.map(s => s.optionId).filter(Boolean) as string[])
  const actionIds = new Set(submissions.map(s => s.actionId).filter(Boolean) as string[])
  const vectors: OutcomeVector[] = []
  for (const n of graph.nodes) {
    if (n.type !== 'decision') continue
    const d = n.data as DecisionNodeData
    for (const opt of d.options) {
      const matched = optionIds.has(opt.id) || (opt.roleActionId ? actionIds.has(opt.roleActionId) : false)
      if (!matched) continue
      if (opt.outcomeVector) vectors.push(opt.outcomeVector)
    }
  }
  return vectors
}

// Cumulative score — flat sum of every outcome dimension across every selected
// option. Used for score-range outcome selection.
export function cumulativeScore(graph: ScenarioGraph, submissions: SubmissionRef[]): number {
  const vectors = collectOutcomeVectors(graph, submissions)
  let total = 0
  for (const v of vectors) for (const d of DIMS) total += v[d] ?? 0
  return total
}

// Per-dimension breakdown across the 6 outcome axes. Reveals trade-offs — a
// fast-decisive choice may score +CONT but −JUR, and this is what surfaces it.
export function scoreByDimension(graph: ScenarioGraph, submissions: SubmissionRef[]): OutcomeVector {
  const vectors = collectOutcomeVectors(graph, submissions)
  const totals: OutcomeVector = { CONT: 0, FOR: 0, BC: 0, JUR: 0, VER: 0, KOS: 0 }
  for (const v of vectors) for (const d of DIMS) totals[d] += v[d] ?? 0
  return totals
}

// Pick an outcome node whose scoreRange contains the cumulative score. Tie-break
// on narrowest range, then highest min.
export function selectOutcomeByScore(graph: ScenarioGraph, total: number): OutcomeNodeData | undefined {
  const outcomes = graph.nodes
    .filter(n => n.type === 'outcome')
    .map(n => n.data as OutcomeNodeData)
    .filter(o => o.scoreRange !== undefined)
  if (outcomes.length === 0) return undefined

  const matching = outcomes.filter(o => {
    const min = o.scoreRange?.min ?? -Infinity
    const max = o.scoreRange?.max ?? Infinity
    return total >= min && total <= max
  })
  if (matching.length === 0) return undefined
  if (matching.length === 1) return matching[0]

  return matching.sort((a, b) => {
    const wa = (a.scoreRange?.max ?? Infinity) - (a.scoreRange?.min ?? -Infinity)
    const wb = (b.scoreRange?.max ?? Infinity) - (b.scoreRange?.min ?? -Infinity)
    if (wa !== wb) return wa - wb
    return (b.scoreRange?.min ?? -Infinity) - (a.scoreRange?.min ?? -Infinity)
  })[0]
}

export function submissionsFromDecisions(decisions: SubmittedDecision[]): SubmissionRef[] {
  return decisions.map(d => ({ actionId: d.actionId }))
}

// Rank a set of options by summed outcome-vector: highest sum wins. Used in the
// reveal panel to identify the "IR-retainer preferred" pick from the options.
export function bestChoiceIndex(items: Array<{ outcomeVector?: OutcomeVector }>): number {
  if (items.length === 0) return -1
  const totals = items.map(i => {
    const v = i.outcomeVector
    if (!v) return 0
    return DIMS.reduce((s, d) => s + (v[d] ?? 0), 0)
  })
  let bestIdx = 0
  for (let i = 1; i < totals.length; i++) if (totals[i] > totals[bestIdx]) bestIdx = i
  return bestIdx
}
