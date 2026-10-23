"use client"

import { useEffect, useRef, useState } from "react"
import { ShieldAlert, Wifi, WifiOff, Users } from "lucide-react"
import type { Role, SessionState } from "@/lib/types"
import { ROLE_META } from "@/lib/types"
import { analyzeGraph } from "@/lib/graph/analyze"
import type { Lang } from "@/lib/i18n"
import { tr, ESCALATION_KEYS } from "@/lib/i18n"

const ESCALATION_BADGE = [
  "border-tt-dim/40 bg-tt-dim/10 text-tt-dim",
  "border-tt-warn/40 bg-tt-warn/10 text-tt-warn",
  "border-tt-warn/40 bg-tt-warn/10 text-tt-warn",
  "border-tt-red/40 bg-tt-red/10 text-tt-red",
] as const

// Geen taal- of themaschakelaar in deze balk. De Eye-banner
// (`components/shared/eye-header.tsx`) staat erboven en heeft ze al; beide
// headers zijn `sticky top-0 z-40`, dus live stonden er twee nl/en-knoppen
// boven elkaar (issue #105 §3).
interface Props {
  session: SessionState
  connected: boolean
  name: string | null
  participantRole?: Role
  lang: Lang
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

export function SessionHUD({ session, connected, name, participantRole, lang }: Props) {
  const status = session.status
  // scenario.rounds grows one round at a time, so it is never the total. A
  // facilitator opening /play gets the unstripped state and can count the graph.
  const totalRounds = session.totalRounds
    ?? (session.graph ? analyzeGraph(session.graph).roundCount : session.scenario.rounds.length)
  const currentIdx = session.currentRound
  const isActive = status === "active"
  const escalationIndex = Math.min(Math.max(currentIdx, 0), 3)

  // The round-timer bar in play-view sticks directly beneath this header. Its
  // offset used to be a hardcoded 52px while the header measures 57px on a
  // phone, so the bar slid underneath. Publishing the real height keeps the two
  // in step whatever gets added to the header later.
  const headerRef = useRef<HTMLElement>(null)
  useEffect(() => {
    const el = headerRef.current
    if (!el) return
    const publish = () => {
      document.documentElement.style.setProperty("--ctt-hud-h", `${Math.round(el.getBoundingClientRect().height)}px`)
    }
    publish()
    const observer = new ResizeObserver(publish)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <header ref={headerRef} className="sticky top-0 z-40 border-b border-tt-border bg-tt-bg">
      {/* Top bar */}
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2.5 md:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <ShieldAlert className="size-3.5 text-tt-accent shrink-0" />
          <div className="flex min-w-0 flex-col">
            <span className="font-mono text-[9px] uppercase tracking-widest text-tt-dim">
              {name ?? "—"}
            </span>
            <span className="font-mono text-[10px] text-tt-bright truncate">
              {session.scenario.scenario_title}
            </span>
          </div>
        </div>

        {/* shrink-0 plus min-w-0 on the left: without both, this cluster pushed
            the header past a 375px viewport and the whole page scrolled
            sideways. */}
        <div className="flex shrink-0 items-center gap-2">
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
                {tr(lang, "escalationLevel")}: {tr(lang, ESCALATION_KEYS[escalationIndex])}
              </span>
            </div>
          )}

          {/* Session timer — stops existing once the exercise is over */}
          {isActive && session.startedAt && (
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
