import type { RoundPhase } from "@/lib/types"

export interface RoundPhaseTiming {
  id: RoundPhase
  label: string  // Dutch
  weight: number
  minSeconds: number
}

// Canonical 4-phase timing. Facilitator can always click "Volgende fase" to
// short-circuit any minSeconds. Auto-advance only applies once minSeconds elapsed.
// Weights sum to 1.0 — used to distribute the round budget after the minima.
export const ROUND_PHASE_TIMINGS: RoundPhaseTiming[] = [
  { id: "inject",     label: "Inject",     weight: 0.10, minSeconds: 30  },
  { id: "discussion", label: "Discussie",  weight: 0.60, minSeconds: 120 },
  { id: "decision",   label: "Beslissing", weight: 0.20, minSeconds: 60  },
  { id: "review",     label: "Review",     weight: 0.10, minSeconds: 30  },
]

export function computeRoundPhaseDurations(roundBudgetSeconds: number): Record<RoundPhase, number> {
  const timings = ROUND_PHASE_TIMINGS
  const minSum = timings.reduce((a, t) => a + t.minSeconds, 0)
  const budget = Math.max(roundBudgetSeconds, minSum)
  const extra = budget - minSum

  const out = {} as Record<RoundPhase, number>
  for (const t of timings) {
    out[t.id] = t.minSeconds + extra * t.weight
  }
  return out
}

// The canonical phase order. Single source of truth for both auto-advance and
// facilitator-driven manual advance. Never mutated.
export const PHASE_ORDER: readonly RoundPhase[] = ['inject', 'discussion', 'decision', 'review'] as const

export function nextPhase(current: RoundPhase): RoundPhase | 'next_round' {
  const idx = PHASE_ORDER.indexOf(current)
  if (idx < 0 || idx === PHASE_ORDER.length - 1) return 'next_round'
  return PHASE_ORDER[idx + 1]
}
