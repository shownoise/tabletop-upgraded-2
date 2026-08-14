"use client"

import { useMemo } from "react"
import type { FactCheckTag, Inject, SessionState } from "@/lib/types"

interface Props {
  session: SessionState
}

const TAG_META: Record<FactCheckTag, { label: string; color: string; bg: string }> = {
  fact:       { label: "Feit",    color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500" },
  assumption: { label: "Aanname", color: "text-yellow-600 dark:text-yellow-400",   bg: "bg-yellow-500"  },
}

// Ground-truth labels — 3-waardig omdat 'misleidend' (bewuste onwaarheid) een
// aparte categorie is naast feit en aanname. Deelnemers kunnen dit label niet
// zetten; alleen de auteur kent de ground truth.
const GROUND_TRUTH_LABEL: Record<string, { label: string; color: string }> = {
  fact:        { label: "Feit",           color: "text-emerald-600 dark:text-emerald-400" },
  assumption:  { label: "Aanname",        color: "text-yellow-600 dark:text-yellow-400"   },
  misleading:  { label: "Misleidend",     color: "text-red-600 dark:text-red-400"         },
  unverified:  { label: "Ongeverifieerd", color: "text-orange-600 dark:text-orange-400"   },
}

export function FactCheckPanel({ session }: Props) {
  const targets = useMemo(() => {
    const out: Array<{ round: number; inject: Inject }> = []
    session.scenario.rounds.forEach((r, ri) => {
      for (const inj of r.injects) {
        if (inj.reliability !== undefined) out.push({ round: ri + 1, inject: inj })
      }
    })
    return out
  }, [session.scenario])

  if (targets.length === 0) return null

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <header className="border-b border-border px-4 py-3">
        <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Fact-check panel</span>
      </header>
      <div className="max-h-96 overflow-y-auto divide-y divide-border">
        {targets.map(({ round, inject }) => {
          const checks = (session.factChecks ?? []).filter(f => f.injectId === inject.id)
          const counts: Record<FactCheckTag, number> = { fact: 0, assumption: 0 }
          for (const c of checks) counts[c.tag] += 1
          const total = checks.length
          const changes = checks.reduce((acc, c) => acc + (c.changedCount ?? 0), 0)
          const groundTruth = inject.reliability
            ? GROUND_TRUTH_LABEL[inject.reliability]
            : undefined
          return (
            <div key={inject.id} className="px-4 py-3 flex flex-col gap-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="font-mono text-[10px] text-primary">R{round}</span>
                  <span className="text-xs font-semibold truncate">{inject.title}</span>
                </div>
                {groundTruth && (
                  <span className={`font-mono text-[10px] uppercase tracking-widest border border-current px-1.5 py-0.5 shrink-0 ${groundTruth.color}`}>
                    GT: {groundTruth.label}
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
                      <span className="opacity-70">— {tag ?? "—"}</span>
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
      </div>
    </div>
  )
}
