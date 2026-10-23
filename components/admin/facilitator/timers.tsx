"use client"

// De twee klokken van de facilitator. Stonden in het oude dashboard tussen 700
// regels andere markup; ze horen bij meerdere stappen, dus staan ze nu apart.

import { useEffect, useState } from "react"

export function SessionClock({ startedAt }: { startedAt: number }) {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    const tick = () => setElapsed(Math.floor((Date.now() - startedAt) / 1000))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [startedAt])
  const m = Math.floor(elapsed / 60)
  const s = elapsed % 60
  return (
    <span className="font-mono text-3xl font-bold tabular-nums text-foreground">
      {String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}
    </span>
  )
}

export function RoundTimer({
  roundStartedAt,
  timerMinutes,
}: {
  roundStartedAt?: number
  timerMinutes: number
}) {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null)
  useEffect(() => {
    if (!roundStartedAt) return
    const tick = () =>
      setSecondsLeft(Math.max(0, Math.floor((timerMinutes * 60 * 1000 - (Date.now() - roundStartedAt)) / 1000)))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [roundStartedAt, timerMinutes])
  if (secondsLeft === null) {
    return <span className="font-mono text-3xl font-bold text-muted-foreground">—</span>
  }
  const m = Math.floor(secondsLeft / 60)
  const s = secondsLeft % 60
  const isLow = secondsLeft < 120
  const isUrgent = secondsLeft < 30
  return (
    <span
      className={`font-mono text-3xl font-bold tabular-nums ${isUrgent ? "animate-pulse text-destructive" : isLow ? "text-primary" : "text-foreground"}`}
    >
      {String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}
    </span>
  )
}

// Eén label-met-waarde blok, zodat de drie meters op de rondestap dezelfde maat
// hebben en de facilitator ze op afstand kan lezen.
export function MetricBlock({
  label,
  children,
  hint,
}: {
  label: string
  children: React.ReactNode
  hint?: string
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
      {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
    </div>
  )
}
