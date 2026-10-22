"use client"

import { useMemo } from "react"
import type { ParticipantFeedback, Role, SessionState } from "@/lib/types"
import { ROLE_META } from "@/lib/types"

interface Props {
  session: SessionState
}

const FIELDS: Array<{ key: keyof Pick<ParticipantFeedback, "worked" | "didnt" | "gap">; label: string; tone: string }> = [
  { key: "worked", label: "Wat werkte", tone: "text-emerald-600 dark:text-emerald-400" },
  { key: "didnt", label: "Wat werkte niet", tone: "text-muted-foreground" },
  { key: "gap", label: "Grootste gat", tone: "text-destructive" },
]

export function ParticipantFeedbackPanel({ session }: Props) {
  const groups = useMemo(() => {
    const roleById = new Map<string, Role | undefined>(session.participants.map(p => [p.id, p.role]))
    return (session.roundProgress ?? [])
      .filter(r => r.participantFeedback.length > 0)
      .slice()
      .sort((a, b) => a.roundIndex - b.roundIndex)
      .map(r => ({
        roundIndex: r.roundIndex,
        entries: r.participantFeedback
          .slice()
          .sort((a, b) => a.submittedAt - b.submittedAt)
          .map(f => ({ ...f, role: roleById.get(f.participantId) })),
      }))
  }, [session.roundProgress, session.participants])

  if (groups.length === 0) return null

  const answered = new Set(groups.flatMap(g => g.entries.map(e => e.participantId))).size

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <header className="flex items-baseline justify-between gap-2 border-b border-border px-4 py-3">
        <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Terugblik deelnemers</span>
        <span className="font-mono text-[10px] text-muted-foreground">
          {answered} van {session.participants.length} ingevuld
        </span>
      </header>
      <div className="max-h-96 overflow-y-auto divide-y divide-border">
        {groups.map(group => (
          <section key={group.roundIndex}>
            <div className="flex items-baseline justify-between gap-2 bg-muted/40 px-4 py-1.5">
              <span className="font-mono text-[10px] uppercase tracking-wider text-primary">
                Ronde {group.roundIndex + 1}
              </span>
              <span className="font-mono text-[10px] text-muted-foreground">
                {group.entries.length} {group.entries.length === 1 ? "reactie" : "reacties"}
              </span>
            </div>
            {group.entries.map(entry => (
              <div key={entry.participantId} className="flex flex-col gap-2 border-t border-border/50 px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold">{entry.participantName}</span>
                  {entry.role && (
                    <span className="rounded-full border border-primary/30 bg-primary/10 px-1.5 py-px font-mono text-[8px] uppercase tracking-wider text-primary">
                      {ROLE_META[entry.role].label}
                    </span>
                  )}
                  <span className="ml-auto font-mono text-[9px] text-muted-foreground">
                    {new Date(entry.submittedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                {FIELDS.filter(f => entry[f.key].length > 0).map(f => (
                  <div key={f.key} className="flex flex-col gap-0.5">
                    <span className={`font-mono text-[9px] uppercase tracking-widest ${f.tone}`}>{f.label}</span>
                    <p className="whitespace-pre-wrap text-xs leading-relaxed">{entry[f.key]}</p>
                  </div>
                ))}
              </div>
            ))}
          </section>
        ))}
      </div>
    </div>
  )
}
