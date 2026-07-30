"use client"

import { useEffect, useState } from "react"
import type { AssessmentReport } from "@/lib/scoring"

// Post-LOCK reveal panel (Deel B §5.2). Toont in vaste volgorde:
//   1. Weging van deze ronde (nu pas onthuld)
//   2. Uitkomstvector per ronde
//   3. Rolresolutie
//
// Verschijnt automatisch tijdens `roundPhase === 'lock'` of `'review'`.

const DIM_LABELS: Record<string, string> = {
  CONT: "Containment",
  FOR:  "Forensische integriteit",
  BC:   "Bedrijfscontinuïteit",
  JUR:  "Juridisch",
  VER:  "Vertrouwen",
  KOS:  "Kosten",
}

const DIMS = ["CONT", "FOR", "BC", "JUR", "VER", "KOS"] as const

export function RevealPanel({ visible = true, currentRound }: { visible?: boolean; currentRound: number }) {
  const [report, setReport] = useState<AssessmentReport | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!visible) return
    let cancelled = false
    async function fetchReport() {
      try {
        const res = await fetch("/api/session/score?format=report")
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          if (!cancelled) setError(data.error ?? `HTTP ${res.status}`)
          return
        }
        const data = (await res.json()) as AssessmentReport
        if (!cancelled) { setReport(data); setError(null) }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err))
      }
    }
    fetchReport()
    // Ronde-overgangen triggeren refetch via de currentRound-dep.
    return () => { cancelled = true }
  }, [visible, currentRound])

  if (!visible) return null

  return (
    <div className="rounded-xl border-2 border-primary/40 bg-primary/5 p-4">
      <div className="flex items-center gap-3 mb-3">
        <span className="font-mono text-[10px] uppercase tracking-wider text-primary font-bold">Reveal §5.2</span>
        <span className="font-mono text-[10px] text-muted-foreground">Ronde {currentRound}</span>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}
      {!error && !report && <p className="text-xs text-muted-foreground">Reveal wordt berekend…</p>}

      {report && (
        <div className="space-y-4">
          {/* 1. Weging van deze ronde (nu pas onthuld) */}
          {(() => {
            const round = report.outcomes.find(o => o.round === currentRound)
            if (!round) return null
            return (
              <div>
                <div className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground mb-1.5">
                  1. Uitkomst deze ronde
                </div>
                <div className="grid grid-cols-6 gap-1 text-center">
                  {DIMS.map(d => (
                    <div key={d} className="rounded border border-border p-1.5 bg-background">
                      <div className="font-mono text-[9px] text-muted-foreground">{d}</div>
                      <div className={`text-sm font-bold ${
                        round.perDimension[d] > 0 ? "text-primary" :
                        round.perDimension[d] < 0 ? "text-destructive" : ""
                      }`}>
                        {round.perDimension[d] > 0 ? "+" : ""}{round.perDimension[d].toFixed(1)}
                      </div>
                      <div className="text-[9px] text-muted-foreground truncate">{DIM_LABELS[d]}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Genormaliseerd: <span className="font-mono font-bold">{round.normalized.toFixed(2)}</span></span>
                  <span className="text-muted-foreground">Punten: <span className="font-mono font-bold text-primary">{round.points}</span></span>
                </div>
              </div>
            )
          })()}

          {/* 2. Alle rondes tot nu — trend */}
          <div>
            <div className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground mb-1.5">
              2. Trend over rondes
            </div>
            <div className="flex gap-1 items-end">
              {report.outcomes.map(o => (
                <div key={o.round} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full h-16 flex items-end">
                    <div
                      className={`w-full rounded-t ${
                        o.round === currentRound ? "bg-primary" : "bg-muted-foreground/40"
                      }`}
                      style={{ height: `${Math.max(4, o.points * 0.64)}px` }}
                      title={`Ronde ${o.round}: ${o.points} pt`}
                    />
                  </div>
                  <span className="font-mono text-[9px] text-muted-foreground">R{o.round}</span>
                  <span className="font-mono text-[10px] font-bold">{o.points}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 3. Rolresolutie — wie was verantwoordelijk waar */}
          <div>
            <div className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground mb-1.5">
              3. Rolresolutie
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px]">
              {Object.entries(report.effectiveOwners).map(([domain, owner]) => (
                <div key={domain} className="flex justify-between">
                  <span className="text-muted-foreground">{domain}</span>
                  <span className={`font-mono ${owner === "NPC" ? "text-amber-600" : ""}`}>{owner}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-2 border-t border-border text-[11px] text-muted-foreground font-mono">
            Scoring v{report.meta.scoringVersion} · rolCoverage {(report.meta.rolCoverage * 100).toFixed(0)}%
          </div>
        </div>
      )}
    </div>
  )
}
