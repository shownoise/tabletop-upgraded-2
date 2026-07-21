"use client"

import { useEffect, useState } from "react"
import type { RoundPhase, RoundPhaseState } from "@/lib/types"
import { ROUND_PHASE_TIMINGS } from "@/lib/engine/round-phases"

interface Props {
  state: RoundPhaseState
  paused?: boolean
}

export function RoundPhaseTimeline({ state, paused }: Props) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (paused) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [paused])

  const order: RoundPhase[] = ["inject", "discussion", "decision", "review"]
  const currentIdx = order.indexOf(state.currentPhase)
  const durationMs = (state.durations[state.currentPhase] ?? 0) * 1000
  const elapsedMs = Math.max(0, now - state.phaseStartedAt)
  const remainingMs = Math.max(0, durationMs - elapsedMs)
  const pct = durationMs > 0 ? Math.min(100, (elapsedMs / durationMs) * 100) : 0
  const min = Math.floor(remainingMs / 60000)
  const sec = Math.floor((remainingMs % 60000) / 1000).toString().padStart(2, "0")
  const totalMin = Math.floor(durationMs / 60000)
  const totalSec = Math.floor((durationMs % 60000) / 1000).toString().padStart(2, "0")
  const currentTiming = ROUND_PHASE_TIMINGS.find(t => t.id === state.currentPhase)

  return (
    <div className="flex flex-col gap-2 rounded-md border border-tt-border bg-tt-surface px-4 py-3">
      <div className="grid grid-cols-4 gap-2">
        {ROUND_PHASE_TIMINGS.map((t, i) => {
          const done = i < currentIdx
          const active = i === currentIdx
          return (
            <div key={t.id} className="flex flex-col items-start gap-1.5">
              <div className="flex items-center gap-2 w-full">
                <span
                  className={`inline-block size-2 rounded-full shrink-0 ${
                    done ? "bg-tt-accent" : active ? "bg-tt-accent animate-pulse ring-2 ring-tt-accent/30" : "bg-tt-border"
                  }`}
                />
                <span
                  className={`font-mono text-[10px] uppercase tracking-widest truncate ${
                    done ? "text-tt-bright" : active ? "text-tt-accent" : "text-tt-dim"
                  }`}
                >
                  {t.label}
                </span>
              </div>
              <div
                className={`h-0.5 w-full rounded-full ${
                  done ? "bg-tt-accent" : active ? "bg-tt-accent/40" : "bg-tt-border/40"
                }`}
              />
            </div>
          )
        })}
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 h-1 rounded-full bg-tt-border/40 overflow-hidden">
          <div
            className="h-full bg-tt-accent transition-[width] duration-1000 ease-linear"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="font-mono text-[10px] text-tt-dim shrink-0">
          {currentTiming?.label} — <span className={remainingMs < 30_000 ? "text-red-500" : "text-tt-bright"}>{min}:{sec}</span> / {totalMin}:{totalSec}
        </span>
      </div>
    </div>
  )
}
