"use client"

import { Bell } from "lucide-react"
import type { NotificationType, SessionState } from "@/lib/types"

interface Props {
  session: SessionState
}

const LABELS: Record<NotificationType, string> = {
  ncsc_24h: "24u NCSC vroegtijdige waarschuwing",
  ncsc_72h: "72u NCSC melding",
  ncsc_final: "Eindverslag NCSC",
  ap_72h: "AP-melding (AVG)",
}

export function NotificationTracker({ session }: Props) {
  const meldplicht = session.graph?.meldplicht
  if (meldplicht && !meldplicht.enabled) return null
  const drafts = session.notifications ?? []
  const types: NotificationType[] = ['ncsc_24h', 'ncsc_72h', 'ncsc_final', 'ap_72h']

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <Bell className="size-3.5 text-tt-accent" />
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Meldplicht — live drafts</span>
      </div>
      <ul className="divide-y divide-border">
        {types.map(t => {
          const d = drafts.find(n => n.type === t)
          const submitted = d?.submittedAt
          const completeness = d?.score?.completeness ?? 0
          return (
            <li key={t} className="flex items-start justify-between gap-3 px-3 py-2 text-xs">
              <div className="flex flex-col min-w-0 flex-1">
                <span className="font-mono text-[10px] text-muted-foreground">{LABELS[t]}</span>
                <span className="truncate text-[11px]">{d ? (submitted ? "Verzonden" : "Concept in bewerking") : "Nog niet gestart"}</span>
              </div>
              <div className="flex flex-col items-end gap-0.5">
                {d && (
                  <span className="font-mono text-[9px] text-muted-foreground">volledig: {Math.round(completeness * 100)}%</span>
                )}
                {submitted && (
                  <span className={`font-mono text-[9px] ${d?.score?.onTime ? "text-emerald-500" : "text-red-500"}`}>
                    {d?.score?.onTime ? "op tijd" : "te laat"}
                  </span>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
