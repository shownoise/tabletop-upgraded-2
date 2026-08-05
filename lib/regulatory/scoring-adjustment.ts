import type { RegulatoryObligationState, RegulatoryRegime, SessionState } from "@/lib/types"
import type { AssessmentReport } from "@/lib/scoring"
import type { OutcomeDimension } from "@/lib/scoring/constants"
import { OUTCOME_DIMENSIONS } from "@/lib/scoring/constants"

// classifyTiming — pure duplicate of session-store's classifyRegulatoryTiming
// so the scoring layer doesn't need to import from session-store.
function classifyTiming(o: RegulatoryObligationState, regime: RegulatoryRegime): 'on_time' | 'late' | 'omitted' {
  if (o.status === 'expired') return 'omitted'
  if (o.status !== 'filed') return 'omitted'
  const ms = regime.milestones.find(m => m.id === o.milestoneId)
  if (!ms) return 'late'
  const filedHour = o.filedAtHour ?? Number.POSITIVE_INFINITY
  const deadlineHour = o.openedAtHour + ms.deadlineHours
  return filedHour <= deadlineHour ? 'on_time' : 'late'
}

// Fold the regime's scoring vector into the outcome-round the filing/expiry
// belongs to. Mutates a copy — returns a new report shape.
//
// - filed on-time  → apply regime.scoring.onTime to the round of filing
// - filed late     → apply regime.scoring.late    to the round of filing
// - expired unfiled→ apply regime.scoring.omitted to the round of expiry
//
// The vector is added to `perDimension`; we do NOT re-normalise `normalized`
// or `points` — participant-facing view reads perDimension directly, and the
// review reveal is where the effect surfaces. If a round has no filing event
// but a still-open obligation past its deadline, we treat it as expired for
// scoring purposes.
export function applyRegulatoryAdjustment(
  session: SessionState,
  report: AssessmentReport,
): AssessmentReport {
  const regime = session.regulatoryRegime
  const obligations = session.regulatoryObligations ?? []
  if (!regime || obligations.length === 0) return report

  const outcomes = report.outcomes.map(o => ({
    ...o,
    perDimension: { ...o.perDimension },
  }))

  for (const o of obligations) {
    const timing = classifyTiming(o, regime)
    let targetRound: number | undefined
    let vector: Partial<Record<OutcomeDimension, number>>
    if (timing === 'on_time' || timing === 'late') {
      targetRound = o.filedAtRound
      vector = timing === 'on_time' ? regime.scoring.onTime : regime.scoring.late
    } else {
      targetRound = o.expiredAtRound ?? o.openedAtRound
      vector = regime.scoring.omitted
    }
    if (!targetRound) continue

    let outcome = outcomes.find(r => r.round === targetRound)
    if (!outcome) {
      // Ensure a slot exists — the round-outcome may not have been computed
      // (e.g. session ended abruptly). Create a zero row so the adjustment
      // still shows up in review + debrief.
      outcome = {
        round: targetRound,
        normalized: 0,
        perDimension: emptyVector(),
        points: 50,
        hasSubmissions: false,
      }
      outcomes.push(outcome)
      outcomes.sort((a, b) => a.round - b.round)
    }
    for (const dim of OUTCOME_DIMENSIONS) {
      const delta = vector[dim]
      if (typeof delta === 'number') {
        outcome.perDimension[dim] = (outcome.perDimension[dim] ?? 0) + delta
      }
    }
  }

  return { ...report, outcomes }
}

function emptyVector(): Record<OutcomeDimension, number> {
  return { CONT: 0, FOR: 0, BC: 0, JUR: 0, VER: 0, KOS: 0 }
}
