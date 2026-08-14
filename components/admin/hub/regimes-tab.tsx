"use client"

import { REGULATORY_REGIMES } from "@/lib/regulatory/regimes"

// Regimes read-only in dit paneel. Toevoegen of aanpassen van een regime
// vereist een code-wijziging omdat de scoring-adjust-logica op de milestone-ids
// leunt. Deze tab toont wat je hebt en geeft developer-guidance.

export function RegimesTab() {
  const regimes = Object.values(REGULATORY_REGIMES)
  return (
    <section className="flex flex-col gap-4">
      <div>
        <h3 className="text-lg font-semibold tracking-tight">Regulatory regimes</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Per klant koppel je een regime dat de bevoegde autoriteit en de meldtermijn bepaalt.
        </p>
        <p className="text-xs text-amber-700 dark:text-amber-500 mt-2">
          Regimes zijn read-only omdat de scoring-adjust-logica op de milestone-ids leunt. Toevoegen = code-wijziging in{" "}
          <code className="font-mono text-xs">lib/regulatory/regimes.ts</code>. Bevoegde autoriteit + tekst kun je wel per veld
          overriden via <em>Teksten</em>.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {regimes.map(r => (
          <div key={r.id} className="rounded-lg border border-border bg-card p-5">
            <div className="flex items-baseline justify-between gap-4 mb-3 flex-wrap">
              <div>
                <h4 className="font-medium">{r.authorityLabel}</h4>
                <p className="text-xs text-muted-foreground mt-0.5">Jurisdictie: {r.jurisdiction} · id: <code className="font-mono">{r.id}</code></p>
              </div>
            </div>
            <p className="text-sm mb-3 leading-relaxed">{r.obligation}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {r.milestones.map(m => (
                <div key={m.id} className="rounded border border-border p-3 bg-muted/20">
                  <div className="flex items-baseline justify-between">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{m.id}</span>
                    <span className="font-mono text-xs">{m.deadlineHours}u deadline</span>
                  </div>
                  <div className="text-sm font-medium mt-1">{m.label}</div>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{m.purpose}</p>
                </div>
              ))}
            </div>
            <div className="mt-3 pt-3 border-t border-border/60 text-xs text-muted-foreground">
              Scoring impact: on-time <span className="font-mono">{JSON.stringify(r.scoring.onTime)}</span> · late <span className="font-mono">{JSON.stringify(r.scoring.late)}</span> · omitted <span className="font-mono">{JSON.stringify(r.scoring.omitted)}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
