"use client"

import { useMemo } from "react"
import { Check, X, Minus } from "lucide-react"
import type { FactCheckTag, SessionState } from "@/lib/types"
import { computeFactCheckScore } from "@/lib/engine/fact-check-score"

interface Props {
  session: SessionState
  participantId: string
  roundIndex?: number   // if undefined, show all rounds
}

const TAG_META: Record<FactCheckTag, { label: string; dot: string; color: string }> = {
  fact:       { label: "Feit",       dot: "bg-emerald-500", color: "text-emerald-600 dark:text-emerald-400" },
  assumption: { label: "Aanname",    dot: "bg-yellow-500",  color: "text-yellow-600 dark:text-yellow-400"   },
  misleading: { label: "Misleidend", dot: "bg-red-500",     color: "text-red-600 dark:text-red-400"         },
}

function normalizeReliability(rel: string | undefined): FactCheckTag | undefined {
  if (rel === "fact" || rel === "assumption" || rel === "misleading") return rel
  return undefined
}

export function FactCheckReview({ session, participantId, roundIndex }: Props) {
  const score = useMemo(() => computeFactCheckScore(session), [session])

  const targets = useMemo(() => {
    const out: Array<{ round: number; injectId: string; title: string; truth: FactCheckTag }> = []
    session.scenario.rounds.forEach((r, ri) => {
      if (typeof roundIndex === "number" && ri !== roundIndex) return
      for (const inj of r.injects) {
        const truth = normalizeReliability(inj.reliability)
        if (!truth) continue
        out.push({ round: ri + 1, injectId: inj.id, title: inj.title, truth })
      }
    })
    return out
  }, [session.scenario, roundIndex])

  if (targets.length === 0) return null

  const me = score.perParticipant[participantId] ?? { correct: 0, total: 0, score: 0 }
  const teamAvgPct = Math.round(score.teamAverage * 100)
  const myPct = me.total > 0 ? Math.round(me.score * 100) : 0

  return (
    <div className="rounded-lg border border-tt-border bg-tt-surface p-4 flex flex-col gap-3">
      <header className="flex items-center justify-between">
        <span className="font-mono text-xs uppercase tracking-widest text-tt-accent">Fact-check review</span>
        <span className="font-mono text-[10px] text-tt-dim">
          Jij: {me.correct}/{me.total} ({myPct}%) · Team gem.: {teamAvgPct}%
        </span>
      </header>
      <ul className="flex flex-col divide-y divide-tt-border/50">
        {targets.map(t => {
          const myTag = (session.factChecks ?? []).find(
            f => f.injectId === t.injectId && f.participantId === participantId
          )?.tag
          const mismatched = myTag && myTag !== t.truth
          const truthMeta = TAG_META[t.truth]
          const myMeta = myTag ? TAG_META[myTag] : null
          return (
            <li key={t.injectId} className="py-2 flex items-center gap-3 text-xs">
              <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                <span className="font-mono text-[9px] text-tt-dim">R{t.round}</span>
                <span className="truncate">{t.title}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <div className="flex flex-col items-end gap-0.5">
                  <span className="font-mono text-[9px] text-tt-dim">Jouw</span>
                  {myMeta ? (
                    <span className={`inline-flex items-center gap-1 ${myMeta.color}`}>
                      <span className={`inline-block size-1.5 rounded-full ${myMeta.dot}`} />
                      {myMeta.label}
                    </span>
                  ) : (
                    <span className="text-tt-dim">—</span>
                  )}
                </div>
                <div className="flex flex-col items-end gap-0.5">
                  <span className="font-mono text-[9px] text-tt-dim">Waarheid</span>
                  <span className={`inline-flex items-center gap-1 ${truthMeta.color}`}>
                    <span className={`inline-block size-1.5 rounded-full ${truthMeta.dot}`} />
                    {truthMeta.label}
                  </span>
                </div>
                {myTag ? (
                  mismatched ? (
                    <X className="size-4 text-red-500 shrink-0" />
                  ) : (
                    <Check className="size-4 text-emerald-500 shrink-0" />
                  )
                ) : (
                  <Minus className="size-4 text-tt-dim shrink-0" />
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
