"use client"
import { useEffect, useState } from "react"

interface Props {
  phaseName: string
  phaseIndex: number
  totalPhases: number
  startedAt: number
  effectiveDurationSeconds: number
  paused?: boolean
}

export function PhaseTimer({ phaseName, phaseIndex, totalPhases, startedAt, effectiveDurationSeconds, paused }: Props) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (paused) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [paused])

  const elapsedMs = Math.max(0, now - startedAt)
  const totalMs = effectiveDurationSeconds * 1000
  const remainingMs = Math.max(0, totalMs - elapsedMs)
  const pct = totalMs > 0 ? Math.min(100, (elapsedMs / totalMs) * 100) : 0
  const min = Math.floor(remainingMs / 60000)
  const sec = Math.floor((remainingMs % 60000) / 1000).toString().padStart(2, "0")

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-widest">
        <span className="text-tt-accent">{phaseName}</span>
        <span className="text-tt-dim">Fase {phaseIndex + 1}/{totalPhases}</span>
        <span className={remainingMs < 30_000 && !paused ? "text-red-500" : "text-tt-bright"}>
          {paused ? "paused" : `${min}:${sec}`}
        </span>
      </div>
      <div className="h-1 w-full overflow-hidden rounded-full bg-tt-border/40">
        <div
          className="h-full bg-tt-accent transition-[width] duration-1000 ease-linear"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

interface SegmentedProps {
  totalPhases: number
  phaseIndex: number
  names?: string[]
}

export function PhaseSegments({ totalPhases, phaseIndex, names }: SegmentedProps) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: totalPhases }, (_, i) => (
        <div
          key={i}
          className={`h-0.5 flex-1 rounded-full ${
            i < phaseIndex ? "bg-tt-accent" :
            i === phaseIndex ? "bg-tt-accent/60" :
            "bg-tt-border/40"
          }`}
          title={names?.[i]}
        />
      ))}
    </div>
  )
}
