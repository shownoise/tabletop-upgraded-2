"use client"

import { useEffect, useState } from "react"
import { GraduationCap } from "lucide-react"
import type { SessionState } from "@/lib/types"
import { ROLE_META } from "@/lib/types"

interface Lesson {
  round: number
  optionLabel: string
  lesson: string
  role: string
  participant: string
}

// Reads lessons-learned from participants' selected role-actions + decision
// options. Only lessons authored in scenario data appear here.
export function LessonsLearnedSection() {
  const [session, setSession] = useState<SessionState | null>(null)
  useEffect(() => {
    fetch("/api/session/state").then(r => r.json()).then((d: { session?: SessionState }) => {
      if (d?.session) setSession(d.session)
    }).catch(() => {})
  }, [])
  if (!session) return null

  const lessons: Lesson[] = []
  const subs = session.submittedDecisions ?? []
  for (const s of subs) {
    const round = session.scenario.rounds[s.roundIndex]
    const action = round?.roleActions?.find(a => a.id === s.actionId)
    if (action?.lessonLearned) {
      lessons.push({
        round: s.roundIndex + 1,
        optionLabel: action.label,
        lesson: action.lessonLearned,
        role: ROLE_META[s.role]?.label ?? s.role,
        participant: s.participantName,
      })
    }
  }
  if (lessons.length === 0) return null

  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <GraduationCap className="size-4 text-primary" />
        <h2 className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Lessons learned</h2>
      </div>
      <div className="rounded-xl border border-primary/20 bg-primary/5 px-5 py-4 flex flex-col gap-3">
        {lessons.map((l, i) => (
          <div key={i} className="rounded border border-border bg-background px-3 py-2 flex flex-col gap-1">
            <div className="flex items-center justify-between gap-2 font-mono text-[10px] text-muted-foreground">
              <span>Ronde {l.round} — {l.role} ({l.participant})</span>
              <span className="italic">{l.optionLabel}</span>
            </div>
            <p className="text-xs leading-relaxed">{l.lesson}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
