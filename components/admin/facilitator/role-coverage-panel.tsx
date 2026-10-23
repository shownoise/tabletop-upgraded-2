"use client"

// Wie dekt welke rol. Eén bron: `roleCoverage()` uit lib/session-roles.
//
// Waarom dit op twee stappen staat: in de lobby bepaalt het of je kunt starten,
// tijdens de ronde verklaart het waarom een keuze niet binnenkomt. Een onbezette
// rol blokkeert de ronde niet, maar levert wel een "geen besluit"-kaart in de
// review — dat moet de facilitator vooraf kunnen zien.

import { roleCoverage, type RoleCoverage } from "@/lib/session-roles"
import type { SessionState } from "@/lib/types"

const STATUS_CLASS: Record<RoleCoverage["status"], string> = {
  bezet: "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400",
  overgenomen: "border-amber-500/40 bg-amber-500/5 text-amber-700 dark:text-amber-400",
  onbezet: "border-red-500/30 bg-red-500/5 text-red-700 dark:text-red-400",
}

export function RoleCoveragePanel({
  session,
  compact = false,
}: {
  session: SessionState
  compact?: boolean
}) {
  const coverage = roleCoverage(session)
  if (coverage.length === 0) return null
  const counts = {
    bezet: coverage.filter(c => c.status === "bezet").length,
    overgenomen: coverage.filter(c => c.status === "overgenomen").length,
    onbezet: coverage.filter(c => c.status === "onbezet").length,
  }

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          Rolbezetting
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">
          {counts.bezet} bezet · {counts.overgenomen} overgenomen · {counts.onbezet} onbezet
        </span>
      </div>

      {counts.onbezet > 0 && (
        <p className="mt-2 text-xs leading-relaxed text-amber-700 dark:text-amber-400">
          {counts.onbezet} {counts.onbezet === 1 ? "rol is" : "rollen zijn"} door niemand gedekt.
          Die {counts.onbezet === 1 ? "keuze" : "keuzes"} houdt de ronde niet tegen, maar komt in de
          review terug als &quot;geen besluit binnen de tijd&quot;.
        </p>
      )}

      {!compact && (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {coverage.map(c => (
            <li
              key={c.role}
              className={`rounded-md border px-2 py-1 font-mono text-[10px] ${STATUS_CLASS[c.status]}`}
              title={c.participantName ? `${c.label} — ${c.participantName} (${c.status})` : `${c.label} — ${c.status}`}
            >
              {c.label}
              {c.participantName ? <span className="opacity-70"> · {c.participantName}</span> : null}
              {c.status === "overgenomen" ? <span className="opacity-70"> · overgenomen</span> : null}
              {c.status === "onbezet" ? <span className="opacity-70"> · onbezet</span> : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
