"use client"

import { Landmark } from "lucide-react"
import type { RegulatoryObligationState, SessionState } from "@/lib/types"
import { ROLE_META } from "@/lib/types"

// Facilitator view — one row per obligation with round, hour, status, filer,
// filer's role. Real-time via the session-state stream. Renders nothing when
// no regime or no obligations yet exist.
export function RegulatoryObligationsPanel({ session }: { session: SessionState }) {
  const regime = session.regulatoryRegime
  const obligations = session.regulatoryObligations ?? []
  if (!regime || obligations.length === 0) return null

  return (
    <section className="rounded-xl border border-primary/40 bg-primary/5 p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Landmark className="size-3.5 text-primary" />
        <span className="font-mono text-[10px] uppercase tracking-wider text-primary">
          Meldplicht — {regime.authorityLabel}
        </span>
      </div>
      <ul className="flex flex-col divide-y divide-primary/20">
        {obligations.map(o => (
          <ObligationRow key={`${o.regimeId}-${o.milestoneId}`} obligation={o} session={session} />
        ))}
      </ul>
    </section>
  )
}

function ObligationRow({
  obligation,
  session,
}: {
  obligation: RegulatoryObligationState
  session: SessionState
}) {
  const regime = session.regulatoryRegime!
  const milestone = regime.milestones.find(m => m.id === obligation.milestoneId)
  const label = milestone?.label ?? obligation.milestoneId
  const deadlineHour = obligation.openedAtHour + (milestone?.deadlineHours ?? 0)

  const statusText = obligation.status === 'open'
    ? `Open sinds R${obligation.openedAtRound} (uur ${obligation.openedAtHour.toFixed(1)}) — deadline uur ${deadlineHour.toFixed(1)}`
    : obligation.status === 'filed'
      ? `Ingediend in R${obligation.filedAtRound ?? '?'} (uur ${obligation.filedAtHour?.toFixed(1) ?? '?'})`
      : `Vervallen — niet ingediend voor uur ${deadlineHour.toFixed(1)}`

  const statusColor = obligation.status === 'open'
    ? 'text-amber-700 dark:text-amber-400'
    : obligation.status === 'filed'
      ? (obligation.filedAtHour !== undefined && obligation.filedAtHour <= deadlineHour
          ? 'text-emerald-700 dark:text-emerald-400'
          : 'text-rose-700 dark:text-rose-400')
      : 'text-rose-700 dark:text-rose-400'

  return (
    <li className="py-2 flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="font-medium text-foreground">{label}</span>
        <span className={`font-mono text-[10px] uppercase tracking-wider ${statusColor}`}>{obligation.status}</span>
      </div>
      <p className="text-[11px] text-muted-foreground">{statusText}</p>
      {obligation.filedBy && (
        <p className="text-[11px] text-muted-foreground">
          Door: <span className="text-foreground">
            {session.participants.find(p => p.id === obligation.filedBy)?.name ?? obligation.filedBy}
          </span>
          {obligation.filedByRole && (
            <span> ({ROLE_META[obligation.filedByRole]?.label ?? obligation.filedByRole})</span>
          )}
        </p>
      )}
      {obligation.freeText && (
        <p className="text-[11px] italic text-muted-foreground">"{obligation.freeText}"</p>
      )}
      {obligation.keyPoints && (
        <p className="text-[11px] italic text-muted-foreground">"{obligation.keyPoints}"</p>
      )}
    </li>
  )
}
