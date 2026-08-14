"use client"

import { useEffect, useState } from "react"
import { ShieldAlert, Wifi, WifiOff, Users } from "lucide-react"
import type { Role, SessionState } from "@/lib/types"
import { ROLE_META } from "@/lib/types"
import type { Lang } from "@/lib/i18n"
import { tr } from "@/lib/i18n"
import { LangToggle } from "@/components/lang-toggle"
import { ThemeToggle } from "@/components/theme-toggle"
import { ESCALATION_LABELS } from "@/lib/config/texts"

const ESCALATION_BADGE = [
  "border-tt-dim/40 bg-tt-dim/10 text-tt-dim",
  "border-tt-warn/40 bg-tt-warn/10 text-tt-warn",
  "border-tt-warn/40 bg-tt-warn/10 text-tt-warn",
  "border-tt-red/40 bg-tt-red/10 text-tt-red",
] as const

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

function RoundDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }, (_, i) => {
        const isActive = i === current
        const isDone = i < current
        return (
          <div
            key={i}
            className={`size-2 transition-all duration-500 ${
              isDone   ? "bg-tt-dim" :
              isActive ? "bg-tt-accent dot-pulse" :
                         "bg-tt-border"
            }`}
          />
        )
      })}
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
    <header className="sticky top-0 z-40 border-b border-tt-border bg-tt-bg">
      {/* Top bar */}
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2.5 md:px-8">
        <div className="flex items-center gap-3">
          <ShieldAlert className="size-3.5 text-tt-accent shrink-0" />
          <div className="flex flex-col">
            <span className="font-mono text-[9px] uppercase tracking-widest text-tt-dim">
              {name ?? "—"}
            </span>
            <span className="font-mono text-[10px] text-tt-bright truncate max-w-[140px] md:max-w-none">
              {session.scenario.scenario_title}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Role badge */}
          {participantRole && (
            <div className="hidden items-center border border-tt-accent/30 bg-tt-accent/5 px-2.5 py-1 md:flex">
              <span className="font-mono text-[9px] uppercase tracking-widest text-tt-accent">
                {ROLE_META[participantRole].label}
              </span>
            </div>
          )}

          {/* Escalation badge */}
          {isActive && (
            <div className={`hidden items-center border px-2.5 py-1 md:flex ${ESCALATION_BADGE[escalationIndex]}`}>
              <span className="font-mono text-[9px] uppercase tracking-widest">
                {tr(lang, "escalationLevel")}: {tr(lang, `escalation_${ESCALATION_LABELS[escalationIndex]}` as Parameters<typeof tr>[1])}
              </span>
            </div>
          )}

          {/* Session timer */}
          {session.startedAt && (
            <div className="hidden items-center gap-1.5 border border-tt-border bg-tt-surface px-2.5 py-1 md:flex">
              <span className="font-mono text-[9px] uppercase tracking-widest text-tt-dim">
                {tr(lang, "sessionTimer")}
              </span>
              <SessionTimer startedAt={session.startedAt} />
            </div>
          )}

          {/* Participants count */}
          <div className="flex items-center gap-1.5 border border-tt-border bg-tt-surface px-2.5 py-1">
            <Users className="size-3 text-tt-dim" />
            <span className="font-mono text-xs text-tt-bright">{session.participants.length}</span>
          </div>

          {/* Connection */}
          <div className="flex items-center gap-1.5 border border-tt-border bg-tt-surface px-2 py-1">
            {connected
              ? <Wifi className="size-3 text-tt-green" />
              : <WifiOff className="size-3 text-tt-red" />
            }
          </div>

          <LangToggle lang={lang} setLang={setLang} />
          <ThemeToggle />
        </div>
      </div>

      {/* Round dot progress */}
      {isActive && totalRounds > 0 && (
        <div className="mx-auto max-w-6xl px-4 pb-2 md:px-8">
          <div className="flex items-center gap-3">
            <span className="font-mono text-[9px] uppercase tracking-widest text-tt-dim shrink-0">
              {tr(lang, "round")} {currentIdx + 1}/{totalRounds}
            </span>
            <div className="flex-1">
              <RoundDots current={currentIdx} total={totalRounds} />
            </div>
            <span className="font-mono text-[9px] text-tt-dim shrink-0 truncate max-w-[120px]">
              {session.scenario.rounds[currentIdx]?.title ?? ""}
            </span>
          </div>
        </div>
      )}
    </header>
  )
}
