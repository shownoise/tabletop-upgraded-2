import { NO_DECISION_FALLBACK_VECTOR, OUTCOME_DIMENSIONS, type OutcomeDimension } from './constants'
import type { ExerciseEvent, RoundOutcome, ScenarioSpec } from './types'

// Deel A §5 — gewogen som van gekozen optie-vectoren, genormaliseerd op −1..+1.
//
// Formule:
//   uitkomst(r) = Σ_dim ( w_dim(r) · gemiddelde_gekozen_vector_dim ) / Σ_dim ( w_dim(r) · 2 )
//
// Meerdere beslispunten in één ronde → gemiddelde van hun vectoren per dimensie.
// Beslispunten zonder inzending → fallback-vector (Deel B §7.1).
export function computeRoundOutcome(
  scenario: ScenarioSpec,
  events: ExerciseEvent[],
  round: number,
): RoundOutcome {
  const roundSpec = scenario.rounds.find(r => r.number === round)
  if (!roundSpec) {
    return { round, normalized: 0, perDimension: emptyVector(), points: 50 }
  }
  const decisionsThisRound = scenario.decisionPoints.filter(d => d.round === round)
  // Latest submission per (decisionPointId).
  const submissionsById = new Map<string, string>()  // decisionPointId → optionId
  for (const ev of events) {
    if (ev.kind === 'decision_submitted' && ev.round === round) {
      submissionsById.set(ev.decisionPointId, ev.optionId)
    } else if (ev.kind === 'decision_revised' && ev.round === round) {
      submissionsById.set(ev.decisionPointId, ev.optionId)
    }
  }

  // Sommeer per-dim over alle beslispunten.
  const sums = emptyVector()
  let n = 0
  for (const dp of decisionsThisRound) {
    const optId = submissionsById.get(dp.id)
    const vec = optId
      ? dp.options.find(o => o.id === optId)?.outcomeVector
      : implicitVectorFor(dp) ?? NO_DECISION_FALLBACK_VECTOR
    if (!vec) continue
    for (const dim of OUTCOME_DIMENSIONS) sums[dim] += vec[dim]
    n++
  }

  const perDim = emptyVector()
  if (n > 0) for (const dim of OUTCOME_DIMENSIONS) perDim[dim] = sums[dim] / n

  const weights = roundSpec.outcomeWeights
  let num = 0
  let den = 0
  for (const dim of OUTCOME_DIMENSIONS) {
    num += (weights[dim] ?? 0) * perDim[dim]
    den += (weights[dim] ?? 0) * 2
  }
  const normalized = den === 0 ? 0 : num / den
  const points = Math.round(100 * (normalized + 1) / 2)

  return { round, normalized, perDimension: perDim, points }
}

function emptyVector(): Record<OutcomeDimension, number> {
  return { CONT: 0, FOR: 0, BC: 0, JUR: 0, VER: 0, KOS: 0 }
}

function implicitVectorFor(dp: import('./types').DecisionPointSpec): Record<OutcomeDimension, number> | undefined {
  const implicit = dp.options.find(o => o.implicit)
  return implicit?.outcomeVector
}

// Cumulatieve uitkomst na een ronde — voor knock-on regels (§6) en spider per rol.
export function cumulativeOutcome(
  scenario: ScenarioSpec,
  events: ExerciseEvent[],
  throughRound: number,
): Record<OutcomeDimension, number> {
  const acc = emptyVector()
  for (const r of scenario.rounds) {
    if (r.number > throughRound) continue
    const o = computeRoundOutcome(scenario, events, r.number)
    for (const dim of OUTCOME_DIMENSIONS) acc[dim] += o.perDimension[dim]
  }
  return acc
}
