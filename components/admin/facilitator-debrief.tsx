"use client"

import { useState } from "react"
import { CheckCircle, Users, ChevronRight, MessageSquare } from "lucide-react"
import type { ParticipantFeedback } from "@/lib/types"
import type { Lang } from "@/lib/i18n"

interface FacilitatorDebriefProps {
  roundIndex: number
  roundTitle: string
  participantFeedback: ParticipantFeedback[]
  facilitatorNotes: {
    debriefPoints: string[]
    redFlags: string[]
    keyQuestions: string[]
  }
  pushedInjectNotes: Array<{ title: string; showNotes?: string; context?: string; expectedActions?: string[] }>
  lang: Lang
  onProceed: (facilitatorNotes: string) => void
}

export function FacilitatorDebrief({
  roundIndex, roundTitle, participantFeedback,
  facilitatorNotes, pushedInjectNotes, lang, onProceed
}: FacilitatorDebriefProps) {
  const [notes, setNotes] = useState("")
  const [tab, setTab] = useState<"feedback" | "shownotes">("feedback")

  const workedItems = participantFeedback.filter(f => f.worked.trim())
  const didntItems = participantFeedback.filter(f => f.didnt.trim())
  const gapItems = participantFeedback.filter(f => f.gap.trim())

  return (
    <div className="fixed inset-0 z-50 flex bg-background/95 backdrop-blur-sm overflow-auto">
      <div className="m-auto w-full max-w-3xl px-4 py-8">
        <div className="rounded-2xl border border-primary/30 bg-card overflow-hidden shadow-2xl">
          {/* Header */}
          <div className="flex items-center gap-4 border-b border-border px-6 py-5 bg-primary/5">
            <div className="flex size-10 items-center justify-center rounded-xl border border-primary/40 bg-primary/10">
              <Users className="size-5 text-primary" />
            </div>
            <div>
              <div className="font-mono text-xs uppercase tracking-wider text-primary">Facilitator debrief</div>
              <div className="font-mono text-base font-bold text-foreground">Round {roundIndex + 1}: {roundTitle}</div>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <span className="font-mono text-xs text-muted-foreground">{participantFeedback.length} responses</span>
              <div className="size-2 rounded-full bg-primary animate-pulse" />
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-border">
            {(["feedback", "shownotes"] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 px-6 py-3 font-mono text-xs uppercase tracking-wider transition-colors ${tab === t ? "border-b-2 border-primary text-primary bg-primary/5" : "text-muted-foreground hover:text-foreground"}`}
              >
                {t === "feedback" ? `Participant responses (${participantFeedback.length})` : "Inject show notes"}
              </button>
            ))}
          </div>

          <div className="px-6 py-5 flex flex-col gap-5 max-h-[60vh] overflow-y-auto">
            {tab === "feedback" ? (
              <>
                {/* Aggregated responses */}
                {[
                  { label: "✓ What worked", items: workedItems.map(f => ({ name: f.participantName, text: f.worked })), color: "text-green-400 border-green-500/30 bg-green-500/5" },
                  { label: "✗ What didn't", items: didntItems.map(f => ({ name: f.participantName, text: f.didnt })), color: "text-destructive border-destructive/30 bg-destructive/5" },
                  { label: "⚑ Biggest gap", items: gapItems.map(f => ({ name: f.participantName, text: f.gap })), color: "text-orange-400 border-orange-500/30 bg-orange-500/5" },
                ].map(({ label, items, color }) => (
                  items.length > 0 && (
                    <div key={label} className="flex flex-col gap-2">
                      <span className={`font-mono text-[10px] uppercase tracking-wider ${color.split(" ")[0]}`}>{label}</span>
                      <div className={`rounded-xl border px-4 py-3 flex flex-col gap-2 ${color.split(" ").slice(1).join(" ")}`}>
                        {items.map((item, i) => (
                          <div key={i} className="flex gap-3 text-sm">
                            <span className="font-mono text-[9px] text-muted-foreground shrink-0 mt-0.5 pt-0.5">{item.name}</span>
                            <span className="text-foreground leading-relaxed">{item.text}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                ))}

                {participantFeedback.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground font-mono text-xs uppercase tracking-wider">No feedback submitted yet</div>
                )}

                {/* Debrief guide */}
                <div className="rounded-xl border border-border bg-background px-4 py-4 flex flex-col gap-3">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-primary">Debrief questions (facilitator guide)</span>
                  {facilitatorNotes.debriefPoints.filter(Boolean).map((q, i) => (
                    <div key={i} className="flex gap-2 text-sm">
                      <span className="font-mono text-primary shrink-0">{i + 1}.</span>
                      <span className="text-muted-foreground">{q}</span>
                    </div>
                  ))}
                  {facilitatorNotes.redFlags.filter(Boolean).length > 0 && (
                    <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 mt-2">
                      <span className="font-mono text-[9px] uppercase tracking-wider text-destructive">Red flags to address</span>
                      {facilitatorNotes.redFlags.filter(Boolean).map((f, i) => (
                        <div key={i} className="text-xs text-muted-foreground mt-1">⚑ {f}</div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                {/* Inject show notes */}
                {pushedInjectNotes.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground font-mono text-xs uppercase tracking-wider">No injects pushed this round</div>
                ) : pushedInjectNotes.map((inj, i) => (
                  <div key={i} className="rounded-xl border border-border bg-background px-4 py-4 flex flex-col gap-3">
                    <span className="font-mono text-sm font-semibold text-foreground">{inj.title}</span>
                    {inj.context && (
                      <div>
                        <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Context</span>
                        <p className="text-sm text-muted-foreground mt-1">{inj.context}</p>
                      </div>
                    )}
                    {inj.showNotes && (
                      <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
                        <span className="font-mono text-[9px] uppercase tracking-wider text-primary">Show notes</span>
                        <p className="text-sm text-foreground mt-1">{inj.showNotes}</p>
                      </div>
                    )}
                    {inj.expectedActions && inj.expectedActions.length > 0 && (
                      <div>
                        <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Expected actions</span>
                        <ul className="mt-1 flex flex-col gap-1">
                          {inj.expectedActions.map((a, j) => <li key={j} className="text-sm text-muted-foreground flex gap-2"><span className="text-primary">→</span>{a}</li>)}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </>
            )}
          </div>

          {/* Facilitator notes input + proceed */}
          <div className="border-t border-border px-6 py-5 flex flex-col gap-3 bg-background/20">
            <div className="flex items-center gap-2">
              <MessageSquare className="size-3.5 text-muted-foreground" />
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Facilitator notes (optional)</span>
            </div>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              className="rounded-xl border border-border bg-background px-4 py-3 text-sm font-mono text-foreground focus:outline-none focus:border-primary/40 resize-none w-full"
              placeholder="Key observations, decisions to revisit, tone adjustments for next round…"
            />
            <button
              onClick={() => onProceed(notes)}
              className="flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 font-mono text-sm uppercase tracking-wider text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Proceed to next round <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
