"use client"

// Wie dekt welke rol. Eén bron: `roleCoverage()` uit lib/session-roles.
//
// Waarom dit op twee stappen staat: in de lobby bepaalt het of je kunt starten,
// tijdens de ronde verklaart het waarom een keuze niet binnenkomt. Een onbezette
// rol blokkeert de ronde niet, maar levert wel een "geen besluit"-kaart in de
// review — dat moet de facilitator vooraf kunnen zien.
//
// `collapsible` is de variant voor de actieve ronde: daar is de rolbezetting
// achtergrondinformatie en mocht ze niet als zevende blok van gelijk gewicht
// meedoen (#105 §7). De telling staat in de samenvattingsregel, de volledige
// lijst zit erachter. Is er een onbezette rol, dan staat de uitklap open.

import { roleCoverage, type RoleCoverage } from "@/lib/session-roles"
import type { SessionState } from "@/lib/types"

const STATUS_CLASS: Record<RoleCoverage["status"], string> = {
  bezet: "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400",
  overgenomen: "border-amber-500/40 bg-amber-500/5 text-amber-700 dark:text-amber-400",
  onbezet: "border-red-500/30 bg-red-500/5 text-red-700 dark:text-red-400",
}

export function RoleCoveragePanel({
  session,
  collapsible = false,
}: {
  session: SessionState
  collapsible?: boolean
}) {
  const coverage = roleCoverage(session)
  if (coverage.length === 0) return null
  const counts = {
    bezet: coverage.filter(c => c.status === "bezet").length,
    overgenomen: coverage.filter(c => c.status === "overgenomen").length,
    onbezet: coverage.filter(c => c.status === "onbezet").length,
  }
  const tally = `${counts.bezet} bezet · ${counts.overgenomen} overgenomen · ${counts.onbezet} onbezet`

  const body = (
    <>
      {/* Eén string in plaats van tekst om de expressies heen: in een doorloop
          las deze regel als "Die keuzeshoudt de ronde niet tegen", en met losse
          tekstknopen om een ternary heen is dat lastig te zien. Zo kan het niet
          meer gebeuren. */}
      {counts.onbezet > 0 && (
        <p className="text-xs leading-relaxed text-amber-700 dark:text-amber-400">
          {counts.onbezet === 1
            ? "1 rol is door niemand gedekt. Die keuze houdt de ronde niet tegen, maar komt in de review terug als “geen besluit binnen de tijd”."
            : `${counts.onbezet} rollen zijn door niemand gedekt. Die keuzes houden de ronde niet tegen, maar komen in de review terug als “geen besluit binnen de tijd”.`}
        </p>
      )}
      <ul className="flex flex-wrap gap-1.5">
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
    </>
  )

  if (collapsible) {
    return (
      <details className="group rounded-xl border border-border bg-card" open={counts.onbezet > 0}>
        <summary className="flex cursor-pointer list-none flex-wrap items-baseline justify-between gap-2 px-4 py-3">
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Rolbezetting
          </span>
          <span className="flex items-baseline gap-2">
            <span className="font-mono text-[10px] text-muted-foreground">{tally}</span>
            <span className="text-[8px] text-muted-foreground opacity-60 group-open:hidden">▶</span>
            <span className="hidden text-[8px] text-muted-foreground opacity-60 group-open:inline">▼</span>
          </span>
        </summary>
        <div className="flex flex-col gap-2 px-4 pb-4">{body}</div>
      </details>
    )
  }

  return (
    <section className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          Rolbezetting
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">{tally}</span>
      </div>
      {body}
    </section>
  )
}
