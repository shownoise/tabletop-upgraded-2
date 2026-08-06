"use client"

import type { SessionState } from "@/lib/types"
import { roundReviewNarrative } from "@/lib/scoring/round-review-narrative"

// Phase 7 — facilitator-only round-review narrative panel.
// Mounted next to RevealPanel on the control-dashboard. Never rendered in the
// participant path — the panel lives under the admin route tree.
export function RoundReviewNarrativePanel({
  session,
  roundIndex,
}: {
  session: SessionState
  roundIndex: number
}) {
  // Only show during REVIEW.
  if (session.roundPhase !== "review") return null

  const isFacilitator =
    typeof window !== "undefined" && window.location.pathname.startsWith("/admin")
  if (!isFacilitator) return null

  const narrative = roundReviewNarrative(session, roundIndex)
  const interventions = narrative.facilitatorInterventions ?? []
  const nothing =
    narrative.lines.length === 0 &&
    narrative.omissions.length === 0 &&
    interventions.length === 0
  if (nothing) return null

  return (
    <div className="rounded-xl border border-primary/40 bg-primary/5 px-4 py-3 flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-[10px] uppercase tracking-widest text-primary">
          Round-review narrative (alleen facilitator)
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">
          Ronde {narrative.round}
        </span>
      </div>
      {narrative.lines.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {narrative.lines.map((line, i) => (
            <li key={i} className="text-xs leading-relaxed" dangerouslySetInnerHTML={{ __html: renderBold(line) }} />
          ))}
        </ul>
      )}
      {narrative.omissions.length > 0 && (
        <div className="mt-1 border-t border-primary/30 pt-2">
          <span className="font-mono text-[10px] uppercase tracking-widest text-tt-warn">Omissies</span>
          <ul className="mt-1 flex flex-col gap-1">
            {narrative.omissions.map((line, i) => (
              <li key={i} className="text-xs leading-relaxed" dangerouslySetInnerHTML={{ __html: renderBold(line) }} />
            ))}
          </ul>
        </div>
      )}
      {interventions.length > 0 && (
        <div className="mt-1 border-t border-primary/30 pt-2">
          <span className="font-mono text-[10px] uppercase tracking-widest text-primary/80">Facilitator-interventies</span>
          <ul className="mt-1 flex flex-col gap-1">
            {interventions.map((line, i) => (
              <li key={i} className="text-xs leading-relaxed text-muted-foreground" dangerouslySetInnerHTML={{ __html: renderBold(line) }} />
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

// Bare-bones **bold** rendering to keep the narrative readable without pulling
// in a full markdown pipeline. Escapes HTML first, then swaps ** for <strong>.
function renderBold(input: string): string {
  const escaped = input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
  return escaped.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
}
