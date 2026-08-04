"use client"

import { useEffect, useState } from "react"
import { TrendingUp } from "lucide-react"
import type { SessionState } from "@/lib/types"
import type { ScenarioGraph, OutcomeVector } from "@/lib/graph/types"
import { cumulativeScore, scoreByDimension, submissionsFromDecisions } from "@/lib/graph/outcome-selector"

// The 6 canonical outcome dimensions — trade-off axes. Each is a tension, not
// a "good/bad" scale; the value reflects how the team's decisions have loaded
// each pole. Neither pole is "the right answer" per SCORING.md.
const DIM_LABEL_NL: Record<keyof OutcomeVector, string> = {
  CONT: 'Containment',
  FOR:  'Forensiek',
  BC:   'Bedrijfscontinuïteit',
  JUR:  'Juridisch & meldplicht',
  VER:  'Verantwoording & communicatie',
  KOS:  'Kosten & schade-impact',
}

const DIM_HINT_NL: Record<keyof OutcomeVector, string> = {
  CONT: 'Hoe snel de dreiging is ingedamd — hoger = beter ingedamd.',
  FOR:  'Bewijsvastlegging en attributie — hoger = betere forensische positie.',
  BC:   'Impact op primaire processen — hoger = minder verstoring.',
  JUR:  'Wettelijke meldplichten en aansprakelijkheid — hoger = beter afgedekt.',
  VER:  'Transparantie richting stakeholders — hoger = duidelijker verantwoord.',
  KOS:  'Directe en indirecte kosten — hoger = lagere schade-impact.',
}

const DIMS: readonly (keyof OutcomeVector)[] = ['CONT', 'FOR', 'BC', 'JUR', 'VER', 'KOS'] as const

export function DimensionScoresSection() {
  const [session, setSession] = useState<SessionState | null>(null)
  useEffect(() => {
    fetch("/api/session/state").then(r => r.json()).then((d: { session?: SessionState }) => {
      if (d?.session) setSession(d.session)
    }).catch(() => {})
  }, [])

  if (!session?.graph || !session.submittedDecisions?.length) return null
  const graph = session.graph as ScenarioGraph
  const subs = submissionsFromDecisions(session.submittedDecisions)
  const total = cumulativeScore(graph, subs)
  const byDim = scoreByDimension(graph, subs)

  const scores = DIMS.map(d => ({ dim: d, label: DIM_LABEL_NL[d], hint: DIM_HINT_NL[d], value: byDim[d] }))
  const maxAbs = Math.max(1, ...scores.map(s => Math.abs(s.value)))

  return (
    <section className="flex flex-col gap-5">
      <div>
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="size-4 text-primary" />
          <h2 className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Score per dimensie</h2>
          <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-primary">
            totaal {total >= 0 ? `+${total}` : total}
          </span>
        </div>
        <div className="flex flex-col gap-2">
          {scores.map(s => (
            <div key={s.dim} className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between font-mono text-xs">
                <span className="text-foreground">{s.label}</span>
                <span className={s.value >= 0 ? "text-emerald-600" : "text-rose-600"}>
                  {s.value >= 0 ? `+${s.value}` : s.value}
                </span>
              </div>
              <div className="h-2 rounded bg-muted overflow-hidden">
                <div
                  className={s.value >= 0 ? "h-full bg-emerald-500" : "h-full bg-rose-500"}
                  style={{ width: `${(Math.abs(s.value) / maxAbs) * 100}%` }}
                />
              </div>
              <p className="text-[11px] text-muted-foreground">{s.hint}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
