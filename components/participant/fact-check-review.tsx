"use client"

import { useMemo } from "react"
import { Check, X, Minus } from "lucide-react"
import type { FactCheckTag, InjectAnnotation, InjectSpanAnnotation, SessionState } from "@/lib/types"
import { splitTextByAnnotations } from "@/components/shared/span-annotator"

// Fact-check review — compares each participant's own tags to authored ground truth.
// Scoring was removed; this component is a plain visual comparison.
function computeMyMatches(session: SessionState, participantId: string): { correct: number; total: number; matchedSpans: number; totalSpans: number } {
  const checks = session.factChecks ?? []
  const anns = session.injectAnnotations ?? []
  let correct = 0, total = 0, matchedSpans = 0, totalSpans = 0
  for (const round of session.scenario.rounds) {
    for (const inj of round.injects) {
      if (inj.reliability) {
        const my = checks.find(c => c.injectId === inj.id && c.participantId === participantId)
        if (my) { total++; if (my.tag === inj.reliability) correct++ }
      }
      for (const gt of inj.groundTruthAnnotations ?? []) {
        totalSpans++
        const mine = anns.filter(a => a.injectId === inj.id && a.participantId === participantId)
        if (mine.some(m => m.start <= gt.end && m.end >= gt.start && m.tag === gt.tag)) matchedSpans++
      }
    }
  }
  return { correct, total, matchedSpans, totalSpans }
}

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
  const myScore = useMemo(() => computeMyMatches(session, participantId), [session, participantId])

  const targets = useMemo(() => {
    const out: Array<{
      round: number
      injectId: string
      title: string
      truth: FactCheckTag
      content: string
      groundTruth: InjectSpanAnnotation[]
    }> = []
    session.scenario.rounds.forEach((r, ri) => {
      if (typeof roundIndex === "number" && ri !== roundIndex) return
      for (const inj of r.injects) {
        const truth = normalizeReliability(inj.reliability)
        if (!truth) continue
        out.push({
          round: ri + 1,
          injectId: inj.id,
          title: inj.title,
          truth,
          content: inj.content,
          groundTruth: inj.groundTruthAnnotations ?? [],
        })
      }
    })
    return out
  }, [session.scenario, roundIndex])

  if (targets.length === 0) return null

  const myPct = myScore.total > 0 ? Math.round((myScore.correct / myScore.total) * 100) : 0

  return (
    <div className="rounded-lg border border-tt-border bg-tt-surface p-4 flex flex-col gap-3">
      <header className="flex items-center justify-between">
        <span className="font-mono text-xs uppercase tracking-widest text-tt-accent">Fact-check review</span>
        <span className="font-mono text-[10px] text-tt-dim">
          Jij: {myScore.correct}/{myScore.total} markeringen{myScore.totalSpans > 0 ? ` · ${myScore.matchedSpans}/${myScore.totalSpans} spans correct` : ""} ({myPct}%)
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
      {targets.some(t => t.groundTruth.length > 0) && (
        <div className="mt-3 flex flex-col gap-3 border-t border-tt-border/50 pt-3">
          <span className="font-mono text-[10px] uppercase tracking-widest text-tt-dim">Span-diff: jouw markeringen vs waarheid</span>
          {targets.filter(t => t.groundTruth.length > 0).map(t => {
            const myAnns = (session.injectAnnotations ?? []).filter(a => a.injectId === t.injectId && a.participantId === participantId)
            return (
              <SpanDiff
                key={t.injectId}
                title={t.title}
                round={t.round}
                content={t.content}
                mine={myAnns}
                truth={t.groundTruth}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

const UNDERLINE_MINE: Record<FactCheckTag, string> = {
  fact: "decoration-emerald-500/70",
  assumption: "decoration-yellow-500/70",
  misleading: "decoration-red-500/70",
}

function SpanDiff({
  title, round, content, mine, truth,
}: {
  title: string
  round: number
  content: string
  mine: InjectAnnotation[]
  truth: InjectSpanAnnotation[]
}) {
  const myAsGeneric = mine.map(a => ({ id: a.id, start: a.start, end: a.end, tag: a.tag as FactCheckTag }))
  const truthAsGeneric = truth.map(a => ({ id: a.id, start: a.start, end: a.end, tag: a.tag as FactCheckTag }))
  const mineSegs = splitTextByAnnotations<FactCheckTag>(content, myAsGeneric)
  const truthSegs = splitTextByAnnotations<FactCheckTag>(content, truthAsGeneric)
  return (
    <div className="rounded border border-tt-border/60 p-2">
      <div className="mb-1 flex items-center justify-between text-[10px] font-mono text-tt-dim">
        <span>R{round} · {title}</span>
      </div>
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <div className="mb-1 text-[10px] uppercase tracking-widest text-tt-dim">Jouw markeringen</div>
          <div className="whitespace-pre-wrap leading-relaxed">
            {mineSegs.map((s, i) => {
              const slice = content.slice(s.start, s.end)
              if (!s.tag) return <span key={i}>{slice}</span>
              return <span key={i} className={`underline decoration-2 ${UNDERLINE_MINE[s.tag]}`}>{slice}</span>
            })}
          </div>
        </div>
        <div>
          <div className="mb-1 text-[10px] uppercase tracking-widest text-tt-dim">Waarheid</div>
          <div className="whitespace-pre-wrap leading-relaxed">
            {truthSegs.map((s, i) => {
              const slice = content.slice(s.start, s.end)
              if (!s.tag) return <span key={i}>{slice}</span>
              return <span key={i} className={`underline decoration-2 ${UNDERLINE_MINE[s.tag]}`}>{slice}</span>
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
