import type { RoundOutcome, ScenarioSpec } from './types'
import { OUTCOME_DIMENSIONS } from './constants'

// Deel B §5.1 — punten(r) = round(100 · (RONDE_UITKOMST(r) + 1) / 2). Al berekend
// in computeRoundOutcome. Deze module levert het leaderboard + tie-break.

export interface LeaderboardEntry {
  groupId: string
  totalPoints: number
  perRoundPoints: number[]
}

export function buildLeaderboard(
  outcomesByGroup: Record<string, RoundOutcome[]>,
  scenario: ScenarioSpec,
): LeaderboardEntry[] {
  const entries: LeaderboardEntry[] = []
  for (const [groupId, outcomes] of Object.entries(outcomesByGroup)) {
    const perRoundPoints = outcomes.map(o => o.points)
    entries.push({
      groupId,
      totalPoints: perRoundPoints.reduce((s, x) => s + x, 0),
      perRoundPoints,
    })
  }
  entries.sort((a, b) => compareLeaderboard(a, b, outcomesByGroup, scenario))
  return entries
}

// Tie-break: eerst hoogste totaal, dan zwaarst gewogen dimensie in laatste ronde, dan besluitmoment.
function compareLeaderboard(
  a: LeaderboardEntry,
  b: LeaderboardEntry,
  outcomesByGroup: Record<string, RoundOutcome[]>,
  scenario: ScenarioSpec,
): number {
  if (a.totalPoints !== b.totalPoints) return b.totalPoints - a.totalPoints
  const lastRoundNumber = Math.max(...scenario.rounds.map(r => r.number))
  const lastSpec = scenario.rounds.find(r => r.number === lastRoundNumber)
  if (!lastSpec) return 0
  const heaviest = pickHeaviestDim(lastSpec.outcomeWeights)
  const aLast = outcomesByGroup[a.groupId].find(o => o.round === lastRoundNumber)
  const bLast = outcomesByGroup[b.groupId].find(o => o.round === lastRoundNumber)
  const av = aLast?.perDimension[heaviest] ?? 0
  const bv = bLast?.perDimension[heaviest] ?? 0
  if (av !== bv) return bv - av
  return 0
}

function pickHeaviestDim(weights: Record<string, number>): typeof OUTCOME_DIMENSIONS[number] {
  let best = OUTCOME_DIMENSIONS[0] as typeof OUTCOME_DIMENSIONS[number]
  let bestW = weights[best] ?? 0
  for (const d of OUTCOME_DIMENSIONS) {
    const w = weights[d] ?? 0
    if (w > bestW) { bestW = w; best = d }
  }
  return best
}

// Deel B §7.3 — divergentie: entropie over de keuzeverdeling per beslispunt.
// Nuttig voor scenario-health en de host-panel "waar zit het gesprek".
export function divergenceOverGroups(
  perDecisionOptionCounts: Record<string, Record<string, number>>,
): Record<string, number> {
  const out: Record<string, number> = {}
  for (const [dpId, counts] of Object.entries(perDecisionOptionCounts)) {
    const total = Object.values(counts).reduce((s, x) => s + x, 0)
    if (total === 0) { out[dpId] = 0; continue }
    let H = 0
    for (const c of Object.values(counts)) {
      if (c === 0) continue
      const p = c / total
      H -= p * Math.log2(p)
    }
    out[dpId] = H
  }
  return out
}
