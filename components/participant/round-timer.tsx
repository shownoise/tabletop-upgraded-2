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

export function RoundTimer({ roundStartedAt, timerMinutes, status, lang }: RoundTimerProps) {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null)

  useEffect(() => {
    if (!roundStartedAt || status !== "active") { setSecondsLeft(null); return }
    const totalMs = timerMinutes * 60 * 1000
    const tick = () => {
      const left = Math.max(0, totalMs - (Date.now() - roundStartedAt))
      setSecondsLeft(Math.floor(left / 1000))
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [roundStartedAt, timerMinutes, status])

  if (secondsLeft === null) return null

  const mins = Math.floor(secondsLeft / 60)
  const secs = secondsLeft % 60
  const totalSecs = timerMinutes * 60
  const fraction = totalSecs > 0 ? secondsLeft / totalSecs : 0
  const isLow = secondsLeft < 120
  const isUrgent = secondsLeft < 30

  const r = 36
  const circ = 2 * Math.PI * r
  const strokeColor = isUrgent
    ? "oklch(0.62 0.22 25)"
    : isLow
    ? "oklch(0.85 0.18 75)"
    : "oklch(0.78 0.16 75)"

  return (
    <div className={`flex flex-col items-center gap-1 ${isUrgent ? "animate-pulse" : ""}`}>
      <div className="relative">
        <svg width="88" height="88" className="-rotate-90">
          <circle cx="44" cy="44" r={r} fill="none" stroke="oklch(0.28 0.006 260)" strokeWidth="4" />
          <circle
            cx="44" cy="44" r={r} fill="none" strokeWidth="4"
            stroke={strokeColor}
            strokeDasharray={`${circ * fraction} ${circ}`}
            strokeLinecap="round"
            style={{ transition: "stroke-dasharray 1s linear, stroke 0.5s" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`font-mono text-lg font-bold tabular-nums leading-none ${isUrgent ? "text-destructive" : "text-foreground"}`}>
            {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
          </span>
        </div>
      </div>
      <span className={`font-mono text-[9px] uppercase tracking-widest ${isUrgent ? "text-destructive" : "text-muted-foreground"}`}>
        {isUrgent ? tr(lang, "timeCritical") : tr(lang, "roundTimer")}
      </span>
    </div>
  )
}

// Compact inline version for HUD header
export function RoundTimerCompact({ roundStartedAt, timerMinutes, status, lang }: RoundTimerProps) {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null)

  useEffect(() => {
    if (!roundStartedAt || status !== "active") { setSecondsLeft(null); return }
    const totalMs = timerMinutes * 60 * 1000
    const tick = () => setSecondsLeft(Math.max(0, Math.floor((totalMs - (Date.now() - roundStartedAt)) / 1000)))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [roundStartedAt, timerMinutes, status])

  if (secondsLeft === null) return null
  const mins = Math.floor(secondsLeft / 60)
  const secs = secondsLeft % 60
  const isUrgent = secondsLeft < 30
  const isLow = secondsLeft < 120

  return (
    <div className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 ${
      isUrgent ? "border-destructive/60 bg-destructive/10 animate-pulse" :
      isLow ? "border-primary/40 bg-primary/10" :
      "border-border bg-card"
    }`}>
      <span className={`font-mono text-[9px] uppercase tracking-wider ${isUrgent ? "text-destructive" : "text-muted-foreground"}`}>
        {tr(lang, "roundTimer")}
      </span>
      <span className={`font-mono text-sm tabular-nums font-bold ${isUrgent ? "text-destructive" : isLow ? "text-primary" : "text-foreground"}`}>
        {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
      </span>
    </div>
  )
}
