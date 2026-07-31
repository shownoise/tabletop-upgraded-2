"use client"

import { useMemo } from "react"
import type { SessionState } from "@/lib/types"

// Deel B §7.2 — persoonlijke confidence-tally voor deelnemers na LOCK/review.
// Toont hun eigen zekerheids-invoer per ronde, gecombineerd met de eigen
// keuze. Geen aggregate KALIBRATIE (die is teamniveau), wel een spiegel:
// "waar was je overtuigd, waar minder".

export function ConfidenceTally({
  session,
  participantId,
}: {
  session: SessionState
  participantId: string
}) {
  const rows = useMemo(() => {
    const decisions = (session.submittedDecisions ?? [])
      .filter(d => d.participantId === participantId)
      .sort((a, b) => a.roundIndex - b.roundIndex)
    return decisions.map(d => ({
      round: d.roundIndex + 1,
      confidence: d.confidence,
      actionLabel: d.actionLabel,
      submittedAt: d.submittedAt,
    }))
  }, [session, participantId])

  if (rows.length === 0) return null

  const withConfidence = rows.filter(r => typeof r.confidence === "number")
  const avgConfidence = withConfidence.length > 0
    ? withConfidence.reduce((s, r) => s + (r.confidence ?? 0), 0) / withConfidence.length
    : null

  return (
    <div className="rounded-xl border border-tt-border bg-tt-bright/5 p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="font-mono text-[10px] uppercase tracking-widest text-tt-dim">
          Jouw zekerheid
        </span>
        {avgConfidence !== null && (
          <span className="font-mono text-xs text-tt-dim">
            gemiddeld: <span className="font-bold text-tt-bright">{avgConfidence.toFixed(1)}</span> / 5
          </span>
        )}
      </div>
      <div className="space-y-2">
        {rows.map(r => (
          <div key={r.round} className="flex items-center gap-3 rounded border border-tt-border/40 bg-tt-bg/50 px-3 py-2">
            <span className="font-mono text-xs text-tt-dim w-8">R{r.round}</span>
            <span className="flex-1 font-mono text-xs text-tt-bright truncate">
              {r.actionLabel}
            </span>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map(v => (
                <span
                  key={v}
                  className={`size-3 rounded-sm ${
                    typeof r.confidence === "number" && v <= r.confidence
                      ? "bg-tt-accent"
                      : "bg-tt-border/40"
                  }`}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 font-mono text-[10px] text-tt-dim">
        Kalibratie op teamniveau verschijnt in het rapport na de sessie.
      </p>
    </div>
  )
}
