import type { RoundPhase } from "@/lib/types"

export interface RoundPhaseTiming {
  id: RoundPhase
  label: string
  weight: number
  minSeconds: number
}

export const ROUND_PHASE_TIMINGS: RoundPhaseTiming[] = [
  { id: "inject",     label: "Briefing",   weight: 0.15, minSeconds: 60  },
  { id: "discussion", label: "Discussie",  weight: 0.55, minSeconds: 180 },
  { id: "decision",   label: "Beslissing", weight: 0.20, minSeconds: 90  },
  { id: "review",     label: "Review",     weight: 0.10, minSeconds: 45  },
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
