"use client"

import { Activity } from "lucide-react"
import type { SessionState, TimelineEvent } from "@/lib/types"
import { formatTime } from "@/lib/format"

export function TimelinePanel({
  session,
  title = "Timeline",
}: {
  session: SessionState
  title?: string
}) {
  const events = [...session.timeline].slice().reverse()
  return (
    <div className="rounded-lg border border-border bg-card">
      <header className="flex items-center justify-between border-b border-border px-5 py-3 md:px-6">
        <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">{title}</span>
        <span className="font-mono text-xs text-foreground">{events.length}</span>
      </header>
      {events.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-5 py-10 text-center md:px-6">
          <Activity className="size-5 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No events yet</p>
        </div>
      ) : (
        <ol className="flex max-h-[420px] flex-col divide-y divide-border overflow-y-auto">
          {events.map((ev) => (
            <li key={ev.id} className="px-5 py-3 md:px-6 animate-fade-in">
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-mono text-xs uppercase tracking-wider text-primary">
                  {labelFor(ev)}
                </span>
                <span className="font-mono text-[10px] text-muted-foreground">
                  {formatTime(ev.timestamp)}
                </span>
              </div>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{descFor(ev)}</p>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

function labelFor(ev: TimelineEvent): string {
  switch (ev.type) {
    case "session_created":
      return "Session created"
    case "session_started":
      return "Session started"
    case "session_ended":
      return "Session ended"
    case "round_changed":
      return `Round ${(ev.data.roundIndex as number) + 1}`
    case "participant_joined":
      return "Participant joined"
    case "inject_pushed":
      return "Inject pushed"
    case "surprise_inject":
      return "Surprise inject"
    case "special_triggered":
      return "Special event"
    case "special_completed":
      return "Special completed"
  }
}

function descFor(ev: TimelineEvent): string {
  switch (ev.type) {
    case "session_created":
      return (ev.data.title as string) ?? "Scenario generated"
    case "session_started":
      return "Round 1 is live"
    case "session_ended":
      return "Exercise complete"
    case "round_changed":
      return `Moved to round ${(ev.data.roundIndex as number) + 1}`
    case "participant_joined":
      return `${ev.data.name as string} joined the exercise`
    case "inject_pushed":
    case "surprise_inject": {
      const inj = ev.data.inject as { title?: string } | undefined
      return inj?.title ?? "Inject delivered"
    }
    case "special_triggered":
      return `${ev.data.specialType ?? "Special"} triggered`
    case "special_completed":
      return `${ev.data.specialType ?? "Special"} completed`
  }
}
