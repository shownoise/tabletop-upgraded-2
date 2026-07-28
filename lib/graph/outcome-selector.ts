import type { DecisionNodeData, OutcomeNodeData, ScenarioGraph } from "./types"

// Sum of every scoreImpact from every decision-option matched to a
// submitted decision. Per-dimension breakdown is preserved via
// linkedDimension for the report; this helper only returns the total.
export function cumulativeScore(
  graph: ScenarioGraph,
  submitted: Array<{ actionId?: string; optionId?: string }>,
): number {
  const optionIds = new Set(submitted.map(s => s.optionId).filter(Boolean) as string[])
  const actionIds = new Set(submitted.map(s => s.actionId).filter(Boolean) as string[])
  let total = 0
  for (const n of graph.nodes) {
    if (n.type !== 'decision') continue
    const d = n.data as DecisionNodeData
    for (const opt of d.options) {
      const matched = optionIds.has(opt.id) || (opt.roleActionId ? actionIds.has(opt.roleActionId) : false)
      if (matched && typeof opt.scoreImpact === 'number') total += opt.scoreImpact
    }
  }
  return total
}

// Per-dimension breakdown — kept intentionally as a separate helper so the
// report can render bars per dimension without paying the cost when it isn't
// showing them.
export function scoreByDimension(
  graph: ScenarioGraph,
  submitted: Array<{ actionId?: string; optionId?: string }>,
): Record<string, number> {
  const optionIds = new Set(submitted.map(s => s.optionId).filter(Boolean) as string[])
  const actionIds = new Set(submitted.map(s => s.actionId).filter(Boolean) as string[])
  const totals: Record<string, number> = {}
  for (const n of graph.nodes) {
    if (n.type !== 'decision') continue
    const d = n.data as DecisionNodeData
    for (const opt of d.options) {
      const matched = optionIds.has(opt.id) || (opt.roleActionId ? actionIds.has(opt.roleActionId) : false)
      if (!matched || typeof opt.scoreImpact !== 'number' || !opt.linkedDimension) continue
      totals[opt.linkedDimension] = (totals[opt.linkedDimension] ?? 0) + opt.scoreImpact
    }
  }
  return totals
}

// Pick the outcome whose scoreRange contains the cumulative score. Preference
// order when multiple ranges match:
//   1. Narrowest range (tightest min/max window)
//   2. Highest min bound (favor the more optimistic outcome as a tie-breaker)
// If no outcome has a scoreRange, returns undefined — the caller falls back to
// legacy behaviour (outcome connected via outcome-edge from R_last).
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
