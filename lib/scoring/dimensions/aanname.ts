import type { DimensionScore, ExerciseEvent } from '../types'

// Deel A §7.3 — AANNAME = 5 · (0.45·H + 0.25·(1−F) + 0.30·V)
//   H = juist als aanname getagd / werkelijk aantal aannames
//   F = aannames getagd als feit / werkelijk aantal aannames
//   V = aannames met falsificatietrigger / totaal aannames
//
// Mechaniek: bij inzending vult de eigenaar premissen. Elk premise heeft:
//   - text
//   - kind: 'fact' | 'assumption'
//   - source? (verplicht voor fact)
//   - falsificationTrigger? (optioneel voor assumption)
//
// De "werkelijke" aannames (ground truth H, F noemer) leiden we af uit hoe
// de scenario-designer premissen labelt. Zonder ground-truth-label is de
// dimensie observation en niet measurement. Op dit moment is er geen
// scenario-annotatie voor "welke uitspraken zijn ground-truth aannames" —
// we vertrouwen op de deelnemer-tagging en tellen H, F, V puur op hun input.
export function scoreAanname(events: ExerciseEvent[]): DimensionScore {
  const submissions = events.filter(e => e.kind === 'decision_submitted') as Extract<ExerciseEvent, { kind: 'decision_submitted' }>[]
  const allTags = submissions.flatMap(s => (s.premises ?? s.assumptions ?? []))
  if (allTags.length === 0) {
    return { value: null, dataQuality: 'null', reason: 'no premises tagged on any submission' }
  }

  const actualAssumptions = allTags.filter(t => t.kind === 'assumption').length
  const asFact = allTags.filter(t => t.kind === 'fact').length
  const total = allTags.length
  const withFalsification = allTags.filter(t => t.kind === 'assumption' && t.falsificationTrigger && t.falsificationTrigger.trim().length > 0).length

  // H interpreteer als "fractie premissen correct als assumption gemarkeerd van totaal premissen"
  // (zonder een externe ground-truth) — zie caveat boven.
  const H = total === 0 ? 0 : actualAssumptions / total
  const F = total === 0 ? 0 : asFact / total
  const V = actualAssumptions === 0 ? 0 : withFalsification / actualAssumptions

  const raw = 0.45 * H + 0.25 * (1 - F) + 0.30 * V
  return {
    value: clamp05(5 * raw),
    dataQuality: 'measured',
    detail: { H: round4(H), F: round4(F), V: round4(V), n: total },
  }
}

function clamp05(x: number): number { return Math.min(5, Math.max(0, x)) }
function round4(x: number): number { return Math.round(x * 10000) / 10000 }
