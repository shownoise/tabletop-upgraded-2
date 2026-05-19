"use client"

import { useEffect, useState } from "react"
import type { Lang } from "@/lib/i18n"
import { tr } from "@/lib/i18n"

interface RoundTimerProps {
  roundStartedAt: number | undefined
  timerMinutes: number
  status: "lobby" | "active" | "ended"
  lang: Lang
}

function useCountdown(roundStartedAt: number | undefined, timerMinutes: number, status: string) {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null)
  useEffect(() => {
    if (!roundStartedAt || status !== "active") { setSecondsLeft(null); return }
    const totalMs = timerMinutes * 60 * 1000
    const tick = () => setSecondsLeft(Math.max(0, Math.floor((totalMs - (Date.now() - roundStartedAt)) / 1000)))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [roundStartedAt, timerMinutes, status])
  return secondsLeft
}

function timerColor(secondsLeft: number): string {
  if (secondsLeft < 30)  return "var(--tt-red)"
  if (secondsLeft < 120) return "var(--tt-warn)"
  return "var(--tt-green)"
}

export function RoundTimer({ roundStartedAt, timerMinutes, status, lang }: RoundTimerProps) {
  const secondsLeft = useCountdown(roundStartedAt, timerMinutes, status)
  if (secondsLeft === null) return null

  const mins  = Math.floor(secondsLeft / 60)
  const secs  = secondsLeft % 60
  const frac  = timerMinutes > 0 ? secondsLeft / (timerMinutes * 60) : 0
  const color = timerColor(secondsLeft)
  const isUrgent = secondsLeft < 30
  const r     = 36
  const circ  = 2 * Math.PI * r

  return (
    <div className={`flex flex-col items-center gap-2 ${isUrgent ? "animate-pulse" : ""}`}>
      <div className="relative">
        <svg width="88" height="88" className="-rotate-90">
          <circle cx="44" cy="44" r={r} fill="none" strokeWidth="4" style={{ stroke: "var(--tt-border)" }} />
          <circle
            cx="44" cy="44" r={r} fill="none" strokeWidth="4"
            strokeDasharray={`${circ * frac} ${circ}`}
            strokeLinecap="square"
            style={{ stroke: color, transition: "stroke-dasharray 1s linear, stroke 0.5s" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono text-lg font-bold tabular-nums leading-none" style={{ color }}>
            {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <span
          className="size-1.5 dot-pulse"
          style={{ backgroundColor: color }}
        />
        <span className="font-mono text-[9px] uppercase tracking-widest" style={{ color }}>
          {isUrgent ? tr(lang, "timeCritical") : tr(lang, "roundTimer")}
        </span>
      </div>
    </div>
  )
}

// Compact inline version used in the sticky timer bar
export function RoundTimerCompact({ roundStartedAt, timerMinutes, status, lang }: RoundTimerProps) {
  const secondsLeft = useCountdown(roundStartedAt, timerMinutes, status)
  if (secondsLeft === null) return null

  const mins  = Math.floor(secondsLeft / 60)
  const secs  = secondsLeft % 60
  const color = timerColor(secondsLeft)
  const isUrgent = secondsLeft < 30

  return (
    <div
      className="flex items-center gap-2 border px-2.5 py-1"
      style={{
        borderColor: `${color}40`,
        backgroundColor: `${color}0d`,
      }}
    >
      {/* Severity dot */}
      <span
        className="size-1.5 shrink-0"
        style={{
          backgroundColor: color,
          animation: isUrgent ? "dot-pulse 0.8s ease-in-out infinite" : "dot-pulse 2s ease-in-out infinite",
        }}
      />
      <span className="font-mono text-[9px] uppercase tracking-widest text-[#7a9090]">
        {tr(lang, "roundTimer")}
      </span>
      <span
        className="font-mono text-sm tabular-nums font-bold"
        style={{ color }}
      >
        {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
      </span>
    </div>
  )
}
