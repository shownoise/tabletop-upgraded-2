import { NO_DECISION_FALLBACK_VECTOR, OUTCOME_DIMENSIONS, type OutcomeDimension } from './constants'
import type { ExerciseEvent, RoundOutcome, ScenarioSpec } from './types'

// Ronde-uitkomst — gemiddelde van gekozen vectoren, genormaliseerd op −1..+1.
// Alle 6 dimensies tellen even zwaar. Geen per-ronde weging.
//
// Belangrijk: onbeantwoorde beslissingen worden TIJDENS de ronde overgeslagen —
// anders zou een team na één antwoord meteen negatief scoren omdat de andere
// beslissingen als "geen besluit" (NO_DECISION_FALLBACK_VECTOR, met -1 op
// CONT/BC/JUR) mee zouden tellen. `finalizeDecision` in session-store voegt
// impliciete submissions toe bij LOCK, dus na afsluiten van de ronde tellen
// die wél mee.
export function computeRoundOutcome(
  scenario: ScenarioSpec,
  events: ExerciseEvent[],
  round: number,
): RoundOutcome {
  const roundSpec = scenario.rounds.find(r => r.number === round)
  if (!roundSpec) {
    return { round, normalized: 0, perDimension: emptyVector(), points: 50, hasSubmissions: false }
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

  // Sommeer per-dim over ALLEEN beslispunten waarvoor een submission bestaat.
  // Onbeantwoorde beslissingen tellen niet — die worden pas via
  // finalizeDecision aangevuld met impliciete submissions bij LOCK.
  const sums = emptyVector()
  let n = 0
  for (const dp of decisionsThisRound) {
    const optId = submissionsById.get(dp.id)
    if (!optId) continue  // geen submission — skip tijdens live compute
    let vec = dp.options.find(o => o.id === optId)?.outcomeVector
    if (!vec) {
      // Impliciete submission (van finalizeDecision) zonder authored implicit-option:
      // val terug op de scenario-implicit vector, anders de "geen besluit" default.
      vec = implicitVectorFor(dp) ?? NO_DECISION_FALLBACK_VECTOR
    }
    for (const dim of OUTCOME_DIMENSIONS) sums[dim] += vec[dim]
    n++
  }

  const perDim = emptyVector()
  if (n > 0) for (const dim of OUTCOME_DIMENSIONS) perDim[dim] = sums[dim] / n

  // Genormaliseerde uitkomst: gemiddelde over alle 6 dimensies gedeeld door 2
  // (want elke dimensie loopt −2..+2, dus het gemiddelde ook, genormaliseerd
  // door /2 komt uit op −1..+1).
  let normalized = 0
  if (n > 0) {
    let sum = 0
    for (const dim of OUTCOME_DIMENSIONS) sum += perDim[dim]
    normalized = sum / (OUTCOME_DIMENSIONS.length * 2)
  }
  const points = Math.round(100 * (normalized + 1) / 2)

  return { round, normalized, perDimension: perDim, points, hasSubmissions: n > 0 }
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
