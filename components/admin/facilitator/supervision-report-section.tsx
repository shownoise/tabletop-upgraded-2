"use client"

// Het toezichthouder-rapport, ingeklapt achter één regel die de stand samenvat.
//
// Waarom (a) — ingeklapt — en niet (b) — verplaatst naar de eindbespreking:
// `step-eindbespreking.tsx` ligt buiten deze klus, dus (b) zou neerkomen op een
// component dat nergens gemonteerd staat en daarmee tijdelijk onbereikbaar
// toezicht. Ingeklapt houdt het rapport bereikbaar waar de facilitator het nu
// gewend is, kost op de gereedschapsstap één regel, en de keuze is omkeerbaar:
// dit component is zelfstandig (geen verplichte props), dus de hoofdsessie kan
// het met één regel in de eindbespreking hangen zodra dat bestand vrij is.
//
// Het rapport wordt hier geladen en niet in `SupervisionReportView`, zodat de
// regel in de kop dezelfde telling toont als het open rapport — met één fetch,
// precies zoals eerst.

import { useCallback, useEffect, useState } from "react"
import { api } from "@/lib/api-client"
import type { SupervisionReport } from "@/lib/engine/supervision"
import { SupervisionReportView, summarizeSupervisionReport } from "@/components/admin/supervision-report"

export function SupervisionReportSection({
  organizationName,
  facilitatorName,
}: {
  organizationName?: string
  facilitatorName?: string
}) {
  const [report, setReport] = useState<SupervisionReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.getSupervisionReport()
      setReport(res.report)
    } catch {
      setReport(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const summary = report ? summarizeSupervisionReport(report) : null
  const headline = summary
    ? `${summary.areasWithEvidence} van ${summary.totalAreas} testgebieden met bewijs`
    : loading
      ? "stand wordt opgehaald…"
      : "nog geen rapport beschikbaar"

  return (
    <section className="rounded-xl border border-border bg-card">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-5 py-3 text-left transition-colors hover:bg-muted/30"
      >
        <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
          Toezichthouder-rapport — {headline}
        </span>
        <span className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {open ? "Inklappen" : "Uitklappen"}
        </span>
      </button>
      {open && (
        <div className="border-t border-border">
          {report ? (
            <SupervisionReportView
              report={report}
              onReload={() => { void load() }}
              reloading={loading}
              organizationName={organizationName}
              facilitatorName={facilitatorName}
            />
          ) : (
            <div className="flex items-center gap-3 p-5 text-sm text-muted-foreground">
              {loading ? "Rapport laden…" : "Geen rapport beschikbaar."}
              {!loading && (
                <button
                  type="button"
                  onClick={() => { void load() }}
                  className="font-mono text-[10px] uppercase tracking-wider text-primary underline"
                >
                  Herlaad
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  )
}
