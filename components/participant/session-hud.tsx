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
const ESCALATION_COLORS = ["#7a9090", "#ffb340", "#ffb340", "#ff4d3d"]

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
              isDone   ? "bg-[#7a9090]" :
              isActive ? "bg-[#e8ff40] dot-pulse" :
                         "bg-[#2a3030]"
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

  const escalationColor = ESCALATION_COLORS[escalationIndex]

  return (
    <header className="sticky top-0 z-40 border-b border-[#2a3030] bg-[#0d0f0f]">
      {/* Top bar */}
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2.5 md:px-8">
        <div className="flex items-center gap-3">
          <ShieldAlert className="size-3.5 text-[#e8ff40] shrink-0" />
          <div className="flex flex-col">
            <span className="font-mono text-[9px] uppercase tracking-widest text-[#7a9090]">
              {name ?? "—"}
            </span>
            <span className="font-mono text-[10px] text-[#f0fafa] truncate max-w-[140px] md:max-w-none">
              {session.scenario.scenario_title}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Role badge */}
          {participantRole && (
            <div className="hidden items-center border border-[#e8ff40]/30 bg-[#e8ff40]/5 px-2.5 py-1 md:flex">
              <span className="font-mono text-[9px] uppercase tracking-widest text-[#e8ff40]">
                {ROLE_META[participantRole].label}
              </span>
            </div>
          )}

          {/* Escalation badge */}
          {isActive && (
            <div
              className="hidden items-center border px-2.5 py-1 md:flex"
              style={{ borderColor: `${escalationColor}40`, backgroundColor: `${escalationColor}10` }}
            >
              <span
                className="font-mono text-[9px] uppercase tracking-widest"
                style={{ color: escalationColor }}
              >
                {tr(lang, "escalationLevel")}: {tr(lang, `escalation_${ESCALATION_LABELS[escalationIndex]}` as Parameters<typeof tr>[1])}
              </span>
            </div>
          )}

          {/* Session timer */}
          {session.startedAt && (
            <div className="hidden items-center gap-1.5 border border-[#2a3030] bg-[#111618] px-2.5 py-1 md:flex">
              <span className="font-mono text-[9px] uppercase tracking-widest text-[#7a9090]">
                {tr(lang, "sessionTimer")}
              </span>
              <SessionTimer startedAt={session.startedAt} />
            </div>
          )}

          {/* Participants count */}
          <div className="flex items-center gap-1.5 border border-[#2a3030] bg-[#111618] px-2.5 py-1">
            <Users className="size-3 text-[#7a9090]" />
            <span className="font-mono text-xs text-[#f0fafa]">{session.participants.length}</span>
          </div>

          {/* Connection */}
          <div className="flex items-center gap-1.5 border border-[#2a3030] bg-[#111618] px-2 py-1">
            {connected
              ? <Wifi className="size-3 text-[#40ffb3]" />
              : <WifiOff className="size-3 text-[#ff4d3d]" />
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
            <span className="font-mono text-[9px] uppercase tracking-widest text-[#7a9090] shrink-0">
              {tr(lang, "round")} {currentIdx + 1}/{totalRounds}
            </span>
            <div className="flex-1">
              <RoundDots current={currentIdx} total={totalRounds} />
            </div>
            <span className="font-mono text-[9px] text-[#7a9090] shrink-0 truncate max-w-[120px]">
              {session.scenario.rounds[currentIdx]?.title ?? ""}
            </span>
          </div>
        </div>
      )}
    </header>
  )
}
