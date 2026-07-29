import type { DimensionScore, ExerciseEvent, ScenarioSpec } from '../types'

// Deel A §7.5 — EXTERN = 5 · Σ_j w_j · (0.6·τ_j + 0.4·q_j) / Σ_j w_j
//   τ_j = 1                              als t_j binnen venster
//        exp(−(t_j − sluit_j)/κ_j)       als te laat
//        0                               als nooit geactiveerd
//   q_j = 0/0.5/1  facilitator: was de vraag actionable? (Deel A §7.5)
export function scoreExtern(scenario: ScenarioSpec, events: ExerciseEvent[]): DimensionScore {
  const parties = scenario.externalParties ?? []
  if (parties.length === 0) {
    return { value: null, dataQuality: 'null', reason: 'no external parties configured' }
  }

  const sessionStart = firstOfKind(events, 'session_start')?.t
  if (sessionStart == null) {
    return { value: null, dataQuality: 'null', reason: 'no session_start event' }
  }

  const activations = events.filter(e => e.kind === 'external_party_activated') as Extract<ExerciseEvent, { kind: 'external_party_activated' }>[]
  const qOverrides = events.filter(e => e.kind === 'facilitator_q_j') as Extract<ExerciseEvent, { kind: 'facilitator_q_j' }>[]

  let num = 0
  let den = 0
  const details: Record<string, number> = {}
  for (const p of parties) {
    const act = activations.find(a => a.partyId === p.id)
    let tau = 0
    if (act) {
      const hoursAfterStart = (act.t - sessionStart) / 3600000
      if (p.window) {
        if (hoursAfterStart <= p.window.closeHours && hoursAfterStart >= p.window.openHours) {
          tau = 1
        } else if (hoursAfterStart > p.window.closeHours) {
          const overshoot = hoursAfterStart - p.window.closeHours
          tau = Math.exp(-overshoot / Math.max(p.toleranceHours, 0.01))
        } else {
          tau = 0 // te vroeg — zeer zeldzaam, negeer met 0
        }
      } else {
        // Geen expliciet venster → geldt als "binnen tolerantie". τ=1 als geactiveerd.
        tau = 1
      }
    }
    const qOverride = qOverrides.find(q => q.partyId === p.id)
    const q = qOverride ? qOverride.value : (act ? act.actionable : 0)
    const contrib = 0.6 * tau + 0.4 * q
    num += p.weight * contrib
    den += p.weight
    details[p.id] = round4(contrib)
  }
  if (den === 0) return { value: null, dataQuality: 'null', reason: 'zero total weight over parties' }

  return {
    value: clamp05(5 * (num / den)),
    dataQuality: 'measured',
    detail: details,
  }
}

function firstOfKind<K extends ExerciseEvent['kind']>(events: ExerciseEvent[], kind: K): Extract<ExerciseEvent, { kind: K }> | undefined {
  return events.find(e => e.kind === kind) as Extract<ExerciseEvent, { kind: K }> | undefined
}

function clamp05(x: number): number { return Math.min(5, Math.max(0, x)) }
function round4(x: number): number { return Math.round(x * 10000) / 10000 }
