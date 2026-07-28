"use client"

import { Shield, ThumbsUp, ThumbsDown, AlertTriangle } from "lucide-react"
import type { SessionState, SubmittedDecision, RoleAction, ChoiceQuality } from "@/lib/types"

// Review-fase panel: laat participants zien wat wij (IR-retainer) van hun keuze
// vinden. Gebruikt facilitatorCommentary + qualityRank die alleen tijdens de
// review-fase door toParticipantState wordt onthuld.
interface Props {
  session: SessionState
  participantId: string
  roundIndex: number
}

const QUALITY_META: Record<ChoiceQuality, { label: string; Icon: typeof ThumbsUp; color: string; bg: string }> = {
  best:  { label: "Beste keuze",     Icon: ThumbsUp,       color: "#10b981", bg: "bg-emerald-500/10" },
  good:  { label: "Goede keuze",     Icon: ThumbsUp,       color: "#38bdf8", bg: "bg-sky-500/10" },
  poor:  { label: "Kon beter",       Icon: AlertTriangle,  color: "#f59e0b", bg: "bg-amber-500/10" },
  wrong: { label: "Verkeerde keuze", Icon: ThumbsDown,     color: "#ef4444", bg: "bg-red-500/10" },
}

export function ReviewCommentary({ session, participantId, roundIndex }: Props) {
  if (session.roundPhase !== 'review') return null
  const round = session.scenario.rounds[roundIndex]
  if (!round?.roleActions?.length) return null

  const mine: SubmittedDecision[] = (session.submittedDecisions ?? [])
    .filter(d => d.participantId === participantId && d.roundIndex === roundIndex)
  if (mine.length === 0) return null

  return (
    <div className="rounded-xl border border-tt-accent/30 bg-tt-accent/5 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-tt-border">
        <Shield className="size-3.5 text-tt-accent" />
        <span className="font-mono text-[10px] uppercase tracking-widest text-tt-accent">
          IR-retainer perspectief
        </span>
      </div>
      <div className="flex flex-col divide-y divide-border">
        {mine.map(dec => {
          const action = round.roleActions?.find(a => a.id === dec.actionId) as RoleAction | undefined
          const rank: ChoiceQuality | undefined = action?.qualityRank
          const meta = rank ? QUALITY_META[rank] : null
          return (
            <div key={dec.actionId} className={`p-4 flex flex-col gap-2 ${meta?.bg ?? ""}`}>
              <div className="flex items-center gap-2">
                {meta && <meta.Icon className="size-4" style={{ color: meta.color }} />}
                <span className="font-mono text-[10px] uppercase tracking-widest" style={{ color: meta?.color ?? "var(--tt-dim)" }}>
                  {meta?.label ?? "Ingediend"}
                </span>
                <span className="text-xs text-tt-dim">·</span>
                <span className="font-mono text-[10px] text-tt-dim">{dec.actionLabel}</span>
              </div>
              {action?.facilitatorCommentary && (
                <p className="text-sm leading-relaxed text-foreground">
                  {action.facilitatorCommentary}
                </p>
              )}
              {action?.lessonLearned && (
                <div className="border-l-2 border-tt-accent/40 pl-3 py-1">
                  <span className="font-mono text-[9px] uppercase tracking-widest text-tt-dim block mb-0.5">Lessons learned</span>
                  <span className="text-xs text-tt-dim italic">{action.lessonLearned}</span>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
