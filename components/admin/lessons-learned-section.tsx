"use client"

import { useEffect, useState } from "react"
import { GraduationCap } from "lucide-react"
import type { SessionState } from "@/lib/types"
import type { AssessmentEvent } from "@/lib/engine/types"

export function LessonsLearnedSection() {
  const [events, setEvents] = useState<AssessmentEvent[]>([])

  useEffect(() => {
    fetch("/api/session/state")
      .then(r => r.json())
      .then((data: { session?: SessionState }) => {
        if (data?.session?.assessmentEvents) setEvents(data.session.assessmentEvents)
      })
      .catch(() => {})
  }, [])

  const withLessons = events.filter(e => e.lesson && e.lesson.trim().length > 0)
  if (withLessons.length === 0) return null

  // Group by dimension
  const byDim = new Map<string, AssessmentEvent[]>()
  for (const ev of withLessons) {
    const list = byDim.get(ev.dimensionId) ?? []
    list.push(ev)
    byDim.set(ev.dimensionId, list)
  }

  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <GraduationCap className="size-4 text-primary" />
        <h2 className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Lessons learned</h2>
      </div>
      <div className="rounded-xl border border-primary/20 bg-primary/5 px-5 py-4 flex flex-col gap-4">
        {Array.from(byDim.entries()).map(([dim, list]) => (
          <div key={dim} className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-wider text-primary">
                {dim.replace(/_/g, " ")}
              </span>
              <span className="font-mono text-[10px] text-muted-foreground">
                {list.length} moment(s)
              </span>
            </div>
            <ul className="flex flex-col gap-1.5">
              {list.map((ev, i) => {
                const impact = ev.scoreImpact ?? 0
                const impactColor = impact >= 0
                  ? "border-emerald-500/30 bg-emerald-500/5"
                  : "border-destructive/30 bg-destructive/5"
                return (
                  <li key={i} className={`rounded border ${impactColor} px-3 py-2 flex flex-col gap-1`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[10px] text-muted-foreground">{ev.note}</span>
                      <span className="font-mono text-[10px]">
                        {impact > 0 ? "+" : ""}{impact}
                      </span>
                    </div>
                    <p className="text-xs leading-relaxed">{ev.lesson}</p>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
}
