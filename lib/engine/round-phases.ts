import type { RoundPhase } from "@/lib/types"

export interface RoundPhaseTiming {
  id: RoundPhase
  label: string
  weight: number
  minSeconds: number
}

// Fase-tijden: korte minima zodat facilitator sneller kan itereren.
// De facilitator kan altijd handmatig "Volgende fase" klikken om te versnellen.
// Voor een normale sessie van 15min per ronde: 45s briefing + 8m discussie + 4m beslissing + 20s lock + 2m review.
export const ROUND_PHASE_TIMINGS: RoundPhaseTiming[] = [
  { id: "inject",     label: "Briefing",   weight: 0.10, minSeconds: 30  },
  { id: "discussion", label: "Discussie",  weight: 0.55, minSeconds: 120 },
  { id: "decision",   label: "Beslissing", weight: 0.22, minSeconds: 60  },
  { id: "lock",       label: "Vastgezet",  weight: 0.03, minSeconds: 15  },
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
