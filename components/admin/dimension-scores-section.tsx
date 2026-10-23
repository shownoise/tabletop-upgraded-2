"use client"

import { useEffect, useState } from "react"
import { TrendingUp } from "lucide-react"
import type { SessionState } from "@/lib/types"
import type { ScenarioGraph } from "@/lib/graph/types"
import { cumulativeScore, scoreByDimension, scoreCoverage, submissionsFromDecisions } from "@/lib/graph/outcome-selector"
import { DimensionImpactList } from "@/components/shared/decision-review-card"

// Geen eigen labels of balkjes meer: richting, uitleg en getal per dimensie
// komen uit lib/scoring/dimensions.ts via DimensionImpactList, zodat deelnemer,
// facilitator en rapport dezelfde zes regels lezen.
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
  const coverage = scoreCoverage(graph, subs)
  if (coverage.scored === 0) {
    return <section className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-5 py-4 text-sm">
      <h2 className="font-semibold">Punten per dimensie niet vastgesteld</h2>
      <p className="mt-1 text-muted-foreground">Geen van de {coverage.submitted} ingediende keuzes is gekoppeld aan een scorevector. Bespreek de effecten van elke keuze handmatig.</p>
    </section>
  }
  const total = cumulativeScore(graph, subs)
  const byDim = scoreByDimension(graph, subs)

  return (
    <section className="flex flex-col gap-5">
      {coverage.scored < coverage.submitted && <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
        De punten hieronder zijn onvolledig: {coverage.scored} van {coverage.submitted} keuzes zijn meegeteld.
      </p>}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="size-4 text-primary" />
          <h2 className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Uitkomst per dimensie</h2>
          <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-primary">
            totaal {total >= 0 ? `+${total}` : total}
          </span>
        </div>
        <p className="mb-3 text-xs text-muted-foreground">
          Opgeteld over alle ingediende keuzes. Een dimensie op nul betekent: deze keuzes hadden geen effect op die as.
        </p>
        <DimensionImpactList vector={byDim} />
      </div>
    </section>
  )
}
