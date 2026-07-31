"use client"

import type { SessionState } from "@/lib/types"

// Deel B §7.6 — groepsdruk-inject. Toont anoniem "X van Y groepen hebben
// ingezonden voor dit beslispunt". Geen scores; sociale druk zonder gaming-
// oppervlak.

export function GroupProgress({ session }: { session: SessionState }) {
  const groups = session.groups ?? []
  if (groups.length < 2) return null   // enkel-team → geen sociale-druk-signaal nodig
  if (session.roundPhase !== "discussion" && session.roundPhase !== "decision") return null

  const currentRound = session.currentRound
  const submissions = session.submittedDecisions ?? []
  const submittedGroupIds = new Set(
    submissions
      .filter(d => d.roundIndex === currentRound && d.groupId)
      .map(d => d.groupId as string),
  )

  const total = groups.length
  const submitted = groups.filter(g => submittedGroupIds.has(g.id)).length
  const pct = total === 0 ? 0 : Math.round((submitted / total) * 100)

  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          Voortgang — ronde {currentRound + 1}
        </span>
        <span className="font-mono text-lg font-bold text-primary tabular-nums">
          {submitted}<span className="text-muted-foreground text-sm"> / {total}</span>
        </span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full bg-primary transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-2 font-mono text-[11px] text-muted-foreground">
        {submitted === 0
          ? `${total} groepen hebben nog geen keuze ingezonden`
          : submitted === total
          ? `alle groepen hebben ingezonden — lock volgt automatisch`
          : `${submitted} van ${total} groep${submitted === 1 ? "" : "en"} klaar`}
      </p>
    </div>
  )
}
