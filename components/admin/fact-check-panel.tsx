"use client"

import { useMemo } from "react"
import type { FactCheckTag, Inject, SessionState } from "@/lib/types"
import { CLASSIFICATION_LABELS, FACT_CHECK_TAG_LABELS } from "@/lib/config/texts"
import { classificationForTag, type InjectClassification } from "@/lib/classification"

interface Props {
  session: SessionState
}

const TAG_META: Record<FactCheckTag, { label: string; color: string; bg: string }> = {
  fact:       { label: FACT_CHECK_TAG_LABELS.fact.label,       color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500" },
  assumption: { label: FACT_CHECK_TAG_LABELS.assumption.label, color: "text-yellow-600 dark:text-yellow-400",   bg: "bg-yellow-500"  },
}

const CLASSIFICATION_META: Record<InjectClassification, { label: string; color: string }> = {
  feit:    { label: CLASSIFICATION_LABELS.feit.label,    color: "text-emerald-600 dark:text-emerald-400" },
  aanname: { label: CLASSIFICATION_LABELS.aanname.label, color: "text-yellow-600 dark:text-yellow-400"   },
}

interface RoundGroup {
  round: number
  injects: Inject[]
  correct: number
  judged: number
}

export function FactCheckPanel({ session }: Props) {
  const groups = useMemo(() => {
    const checks = session.factChecks ?? []
    const out: RoundGroup[] = []
    session.scenario.rounds.forEach((r, ri) => {
      const injects = r.injects.filter(inj => inj.classification !== undefined)
      if (injects.length === 0) return
      let correct = 0, judged = 0
      for (const inj of injects) {
        for (const c of checks.filter(f => f.injectId === inj.id)) {
          judged++
          if (classificationForTag(c.tag) === inj.classification) correct++
        }
      }
      out.push({ round: ri + 1, injects, correct, judged })
    })
    return out
  }, [session.scenario, session.factChecks])

  if (groups.length === 0) return null

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <header className="border-b border-border px-4 py-3">
        <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Fact-check panel</span>
      </header>
      <div className="max-h-96 overflow-y-auto divide-y divide-border">
        {groups.map(group => (
          <section key={group.round}>
            <div className="flex items-baseline justify-between gap-2 bg-muted/40 px-4 py-1.5">
              <span className="font-mono text-[10px] uppercase tracking-wider text-primary">Ronde {group.round}</span>
              <span className="font-mono text-[10px] text-muted-foreground">
                {group.judged > 0
                  ? `${group.correct}/${group.judged} juist beoordeeld`
                  : "nog niemand beoordeeld"}
              </span>
            </div>
            {group.injects.map(inject => {
              const checks = (session.factChecks ?? []).filter(f => f.injectId === inject.id)
              const counts: Record<FactCheckTag, number> = { fact: 0, assumption: 0 }
              for (const c of checks) counts[c.tag] += 1
              const total = checks.length
              const changes = checks.reduce((acc, c) => acc + (c.changedCount ?? 0), 0)
              const truth = inject.classification ? CLASSIFICATION_META[inject.classification] : undefined
              return (
                <div key={inject.id} className="px-4 py-3 flex flex-col gap-2 border-t border-border/50">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs font-semibold truncate min-w-0">{inject.title}</span>
                    {truth && (
                      <span className={`font-mono text-[10px] uppercase tracking-widest border border-current px-1.5 py-0.5 shrink-0 ${truth.color}`}>
                        Was: {truth.label}
                      </span>
                    )}
                  </div>

                  {/* Distribution bar */}
                  <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-border">
                    {(["fact", "assumption"] as FactCheckTag[]).map(tag => {
                      const pct = total > 0 ? (counts[tag] / total) * 100 : 0
                      if (pct === 0) return null
                      return (
                        <div key={tag} className={TAG_META[tag].bg} style={{ width: `${pct}%` }} />
                      )
                    })}
                  </div>

                  {/* Per-participant chips */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    {session.participants.length === 0 && (
                      <span className="font-mono text-[10px] text-muted-foreground">Geen deelnemers</span>
                    )}
                    {session.participants.map(p => {
                      const tag = checks.find(c => c.participantId === p.id)?.tag
                      const meta = tag ? TAG_META[tag] : null
                      return (
                        <span
                          key={p.id}
                          className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[10px] ${
                            meta ? `${meta.color} border-current` : "border-border text-muted-foreground"
                          }`}
                        >
                          <span className={`inline-block size-1.5 rounded-full ${meta ? meta.bg : "bg-muted-foreground/30"}`} />
                          {p.name}
                          <span className="opacity-70">— {meta ? meta.label : "niet beoordeeld"}</span>
                        </span>
                      )
                    })}
                  </div>

                  {changes > 0 && (
                    <span className="font-mono text-[10px] text-muted-foreground">
                      Totaal {changes} wisseling{changes === 1 ? "" : "en"}
                    </span>
                  )}
                </div>
              )
            })}
          </section>
        ))}
      </div>
    </div>
  )
}
