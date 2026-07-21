"use client"

import { Users, CheckCircle2, Circle } from "lucide-react"
import type { SessionState } from "@/lib/types"
import { ROLE_META } from "@/lib/types"
import { formatTime } from "@/lib/format"

export function ParticipantsList({ session }: { session: SessionState }) {
  const list = [...session.participants].sort((a, b) => b.joinedAt - a.joinedAt)
  return (
    <div className="rounded-lg border border-border bg-card">
      <header className="flex items-center justify-between border-b border-border px-5 py-3 md:px-6">
        <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Participants</span>
        <span className="font-mono text-xs text-foreground">{session.participants.length}</span>
      </header>
      {list.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-5 py-10 text-center md:px-6">
          <Users className="size-5 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No participants yet</p>
          <p className="font-mono text-xs text-muted-foreground">
            Share code{" "}
            <span className="text-primary">{session.joinCode}</span>
          </p>
        </div>
      ) : (
        <ul className="flex max-h-72 flex-col divide-y divide-border overflow-y-auto">
          {list.map((p) => {
            const roleLabel = p.role ? ROLE_META[p.role]?.label ?? p.role : null
            return (
              <li
                key={p.id}
                className="flex items-center justify-between gap-3 px-5 py-3 md:px-6 animate-fade-in"
              >
                <div className="flex items-center gap-3">
                  <div className="flex size-8 items-center justify-center rounded-full border border-border bg-background font-mono text-xs uppercase text-muted-foreground">
                    {p.name.slice(0, 2)}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm">{p.name}</span>
                    <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                      joined {formatTime(p.joinedAt)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {roleLabel ? (
                    <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-primary">
                      {roleLabel}
                    </span>
                  ) : (
                    <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">no role</span>
                  )}
                  {p.readyAt ? (
                    <CheckCircle2 className="size-3.5 text-primary" aria-label="Ready" />
                  ) : (
                    <Circle className="size-3.5 text-muted-foreground" aria-label="Not ready" />
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
