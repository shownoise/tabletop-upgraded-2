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

// Tie-break: eerst hoogste totaal, dan CONT (containment) van de laatste ronde.
// Sinds de per-ronde weging is verwijderd (2026-08-14) is CONT als kompas gekozen
// omdat het de meest tactische dimensie is: bij gelijke punten wint wie beter
// heeft ingedamd.
function compareLeaderboard(
  a: LeaderboardEntry,
  b: LeaderboardEntry,
  outcomesByGroup: Record<string, RoundOutcome[]>,
  scenario: ScenarioSpec,
): number {
  if (a.totalPoints !== b.totalPoints) return b.totalPoints - a.totalPoints
  const lastRoundNumber = Math.max(...scenario.rounds.map(r => r.number))
  const aLast = outcomesByGroup[a.groupId].find(o => o.round === lastRoundNumber)
  const bLast = outcomesByGroup[b.groupId].find(o => o.round === lastRoundNumber)
  const av = aLast?.perDimension.CONT ?? 0
  const bv = bLast?.perDimension.CONT ?? 0
  if (av !== bv) return bv - av
  return 0
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
