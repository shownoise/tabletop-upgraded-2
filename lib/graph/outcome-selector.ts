import type { AssessmentDimensionKey, RoleAction, ScoreImpacts, SubmittedDecision } from "@/lib/types"
import { resolveScoreImpacts } from "@/lib/types"
import type { DecisionNodeData, OutcomeNodeData, ScenarioGraph, RoundNodeData } from "./types"

interface SubmissionRef {
  actionId?: string
  optionId?: string
}

// Trekt alle scoreImpacts uit één graph + één set gesubmitte referenties.
// Combineert:
//  - RoleAction submissions (per-rol per-ronde keuzes)
//  - DecisionNode option picks (graph-decision keuzes)
// Legacy single-dim scoreImpact+linkedDimension worden gepromovoot naar de map.
function collectImpacts(graph: ScenarioGraph, submissions: SubmissionRef[]): ScoreImpacts[] {
  const optionIds = new Set(submissions.map(s => s.optionId).filter(Boolean) as string[])
  const actionIds = new Set(submissions.map(s => s.actionId).filter(Boolean) as string[])
  const impacts: ScoreImpacts[] = []

  for (const n of graph.nodes) {
    if (n.type === 'decision') {
      const d = n.data as DecisionNodeData
      for (const opt of d.options) {
        const matched = optionIds.has(opt.id) || (opt.roleActionId ? actionIds.has(opt.roleActionId) : false)
        if (!matched) continue
        impacts.push(resolveScoreImpacts(opt))
      }
    }
    if (n.type === 'round') {
      const r = n.data as RoundNodeData
      for (const action of r.roleActions ?? []) {
        if (!actionIds.has(action.id)) continue
        impacts.push(resolveScoreImpacts(action))
      }
    }
  }
  return impacts
}

// Cumulatieve score — som van alle dimensies bij elkaar. Geeft je één
// gecomprimeerd getal voor de outcome-bandwidth check.
export function cumulativeScore(graph: ScenarioGraph, submissions: SubmissionRef[]): number {
  const all = collectImpacts(graph, submissions)
  let total = 0
  for (const m of all) for (const v of Object.values(m)) total += v ?? 0
  return total
}

// Per-dimensie breakdown — laat zien welke dimensies goed/slecht scoren.
// Trade-offs worden hierdoor zichtbaar: "snel handelen" kan +decision_speed
// hebben maar -compliance_awareness.
export function scoreByDimension(graph: ScenarioGraph, submissions: SubmissionRef[]): Record<AssessmentDimensionKey, number> {
  const all = collectImpacts(graph, submissions)
  const totals = {} as Record<AssessmentDimensionKey, number>
  for (const m of all) {
    for (const [dim, val] of Object.entries(m) as [AssessmentDimensionKey, number][]) {
      totals[dim] = (totals[dim] ?? 0) + val
    }
  }
  return totals
}

// Selecteer outcome op basis van cumulatieve score-bandwidth.
// Preferentie bij overlap: smalste range wint, hoogste min als tiebreaker.
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

// Convenience: bouw submissions-ref direct uit een lijst SubmittedDecision.
export function submissionsFromDecisions(decisions: SubmittedDecision[]): SubmissionRef[] {
  return decisions.map(d => ({ actionId: d.actionId }))
}

// Ranking helper — bepaal welke van een set opties (RoleActions of options)
// de "beste" is op basis van cumulatieve dimensie-punten. Voor gebruik in
// review-fase en debrief: laat zien wat de author-marker qualityRank was én
// wat de cumulatieve dimensies zeggen.
export function bestChoiceIndex(items: Array<{ scoreImpact?: number; linkedDimension?: AssessmentDimensionKey; scoreImpacts?: ScoreImpacts }>): number {
  if (items.length === 0) return -1
  const totals = items.map(i => {
    const map = resolveScoreImpacts(i as RoleAction)
    return Object.values(map).reduce((s, v) => s + (v ?? 0), 0)
  })
  let bestIdx = 0
  for (let i = 1; i < totals.length; i++) if (totals[i] > totals[bestIdx]) bestIdx = i
  return bestIdx
}
