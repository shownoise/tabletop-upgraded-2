"use client"

import { useEffect, useState } from "react"
import { ShieldAlert, Wifi, WifiOff, Users } from "lucide-react"
import type { Role, SessionState } from "@/lib/types"
import { ROLE_META } from "@/lib/types"
import type { Lang } from "@/lib/i18n"
import { tr } from "@/lib/i18n"
import { LangToggle } from "@/components/lang-toggle"
import { ThemeToggle } from "@/components/theme-toggle"

const ESCALATION_LABELS = ["normal", "elevated", "high", "critical"] as const
const ESCALATION_CLASSES = [
  "border-border bg-card text-muted-foreground",
  "border-amber-500/40 bg-amber-500/10 text-amber-600",
  "border-orange-500/40 bg-orange-500/10 text-orange-600",
  "border-destructive/40 bg-destructive/10 text-destructive",
]

interface Props {
  session: SessionState
  connected: boolean
  name: string | null
  participantRole?: Role
  lang: Lang
  setLang: (l: Lang) => void
}

function SessionTimer({ startedAt }: { startedAt: number }) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    const tick = () => setElapsed(Math.floor((Date.now() - startedAt) / 1000))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [startedAt])

  const h = Math.floor(elapsed / 3600)
  const m = Math.floor((elapsed % 3600) / 60)
  const s = elapsed % 60
  const fmt = h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
  return <span className="font-mono text-sm tabular-nums text-foreground">{fmt}</span>
}

function RoundProgressBar({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${
            i < current
              ? "bg-primary"
              : i === current
              ? "bg-primary/60 pulse-ring"
              : "bg-border"
          }`}
        />
      ))}
    </div>
  )
}

export function SessionHUD({ session, connected, name, participantRole, lang, setLang }: Props) {
  const status = session.status
  const totalRounds = session.scenario.rounds.length
  const currentIdx = session.currentRound
  const isActive = status === "active"
  const escalationIndex = Math.min(Math.max(currentIdx, 0), 3)

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-md">
      {/* Top bar */}
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2.5 md:px-8">
        <div className="flex items-center gap-3">
          <div className="flex size-7 items-center justify-center rounded border border-primary/40 bg-primary/10">
            <ShieldAlert className="size-3.5 text-primary" />
          </div>
          <div className="flex flex-col">
            <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
              {name ?? "—"}
            </span>
            <span className="font-mono text-[10px] text-muted-foreground truncate max-w-[140px] md:max-w-none">
              {session.scenario.scenario_title}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Role badge */}
          {participantRole && (
            <div className="hidden items-center rounded-md border border-primary/30 bg-primary/10 px-2.5 py-1 md:flex">
              <span className="font-mono text-[9px] uppercase tracking-wider text-primary">
                {ROLE_META[participantRole].label}
              </span>
            </div>
          )}

          {/* Escalation badge */}
          {isActive && (
            <div className={`hidden items-center rounded-md border px-2.5 py-1 md:flex ${ESCALATION_CLASSES[escalationIndex]}`}>
              <span className="font-mono text-[9px] uppercase tracking-wider">
                {tr(lang, "escalationLevel")}: {tr(lang, `escalation_${ESCALATION_LABELS[escalationIndex]}` as Parameters<typeof tr>[1])}
              </span>
            </div>
          )}

          {/* Session timer */}
          {session.startedAt && (
            <div className="hidden items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 md:flex">
              <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                {tr(lang, "sessionTimer")}
              </span>
              <SessionTimer startedAt={session.startedAt} />
            </div>
          )}

          {/* Participants count */}
          <div className="flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1">
            <Users className="size-3 text-muted-foreground" />
            <span className="font-mono text-xs text-foreground">{session.participants.length}</span>
          </div>

          {/* Connection */}
          <div className="flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1">
            {connected
              ? <Wifi className="size-3 text-primary" />
              : <WifiOff className="size-3 text-destructive" />
            }
          </div>

          <LangToggle lang={lang} setLang={setLang} />
          <ThemeToggle />
        </div>
      </div>

      {/* Round progress bar */}
      {isActive && totalRounds > 0 && (
        <div className="mx-auto max-w-6xl px-4 pb-2 md:px-8">
          <div className="flex items-center gap-3">
            <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground shrink-0">
              {tr(lang, "round")} {currentIdx + 1}/{totalRounds}
            </span>
            <div className="flex-1">
              <RoundProgressBar current={currentIdx + 1} total={totalRounds} />
            </div>
            <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground shrink-0">
              {session.scenario.rounds[currentIdx]?.title ?? ""}
            </span>
          </div>
        </div>
      )}
    </header>
  )
}
