"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowLeft, ShieldAlert } from "lucide-react"
import { useSessionStream } from "@/lib/use-session-stream"

const PHASE_LABELS: Record<string, string> = {
  inject: "INJECT",
  discussion: "DISCUSSION",
  decision: "DECISION",
  review: "REVIEW",
}

const ESCALATION_LABELS = ["NORMAL", "ELEVATED", "HIGH", "CRITICAL"]
const ESCALATION_COLORS = ["text-primary", "text-amber-400", "text-orange-500", "text-destructive"]

function RoundCountdown({ roundStartedAt, timerMinutes }: { roundStartedAt?: number; timerMinutes: number }) {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null)
  useEffect(() => {
    if (!roundStartedAt) return
    const tick = () => setSecondsLeft(Math.max(0, Math.floor((timerMinutes * 60 * 1000 - (Date.now() - roundStartedAt)) / 1000)))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [roundStartedAt, timerMinutes])
  if (secondsLeft === null) return null
  const m = Math.floor(secondsLeft / 60)
  const s = secondsLeft % 60
  const isUrgent = secondsLeft < 60
  const isLow = secondsLeft < 180
  return (
    <span className={`font-mono font-bold tabular-nums ${isUrgent ? "text-destructive animate-pulse" : isLow ? "text-orange-400" : "text-foreground"}`}>
      {String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}
    </span>
  )
}

export function PresentView() {
  const { state, connected } = useSessionStream()
  const session = state.session

  const currentRound = useMemo(() => {
    if (!session || session.currentRound < 0) return null
    return session.scenario.rounds[session.currentRound] ?? null
  }, [session])

  // Get the most recent pushed inject for the current round (or any round)
  const latestInject = useMemo(() => {
    if (!session) return null
    const forCurrentRound = session.pushedInjects
      .filter(p => p.roundIndex === session.currentRound)
      .sort((a, b) => b.pushedAt - a.pushedAt)
    if (forCurrentRound.length > 0) return forCurrentRound[0].inject
    const all = [...session.pushedInjects].sort((a, b) => b.pushedAt - a.pushedAt)
    return all[0]?.inject ?? null
  }, [session])

  const escalationIndex = Math.min(session?.currentRound ?? 0, 3)
  const phase = session?.roundPhase ?? "inject"

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Minimal top bar */}
      <header className="flex items-center justify-between px-8 py-4 border-b border-border/50">
        <div className="flex items-center gap-3">
          <ShieldAlert className="size-5 text-primary" />
          <span className="font-mono text-sm tracking-wider text-muted-foreground">
            {session?.scenario.scenario_title ?? "CYBER_TABLETOP"}
          </span>
        </div>
        <div className="flex items-center gap-4">
          {/* Connection indicator */}
          <span className={`size-2 rounded-full ${connected ? "bg-primary" : "bg-destructive"}`} />
          <Link href="/admin/dashboard" className="flex items-center gap-1.5 font-mono text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-3.5" /> Dashboard
          </Link>
        </div>
      </header>

      {!session ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="font-mono text-xl uppercase tracking-wider text-muted-foreground animate-pulse">
            Waiting for session…
          </p>
        </div>
      ) : session.status === "lobby" ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-8 px-8">
          <span className="font-mono text-sm uppercase tracking-wider text-muted-foreground animate-pulse">Waiting to start</span>
          <h1 className="text-5xl font-bold tracking-tight text-center max-w-4xl">
            {session.scenario.scenario_title}
          </h1>
          <p className="text-xl text-muted-foreground text-center max-w-2xl leading-relaxed">
            {session.scenario.scenario_summary}
          </p>
          <div className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2">
            <span className="font-mono text-2xl font-bold tracking-[0.3em] text-primary">{session.joinCode}</span>
          </div>
        </div>
      ) : session.status === "ended" ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-6 px-8">
          <span className="font-mono text-sm uppercase tracking-wider text-primary">Exercise Complete</span>
          <h1 className="text-5xl font-bold tracking-tight">SESSION ENDED</h1>
          <Link href="/admin/report" className="font-mono text-sm uppercase tracking-wider text-primary hover:underline">
            View Report →
          </Link>
        </div>
      ) : (
        <div className="flex-1 flex flex-col gap-0">
          {/* Round + phase meta bar */}
          <div className="flex items-center justify-between px-8 py-4 border-b border-border/50">
            <div className="flex items-center gap-4">
              <div className="flex flex-col">
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Round</span>
                <span className="font-mono text-3xl font-bold text-foreground tabular-nums">
                  {session.currentRound + 1}<span className="text-muted-foreground text-xl">/{session.scenario.rounds.length}</span>
                </span>
              </div>
              <div className="flex flex-col">
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Phase</span>
                <span className="font-mono text-xl font-bold text-primary">{PHASE_LABELS[phase] ?? phase.toUpperCase()}</span>
              </div>
            </div>
            <div className="flex items-center gap-6">
              {/* Escalation level */}
              <div className="flex flex-col items-end">
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Escalation</span>
                <span className={`font-mono text-xl font-bold ${ESCALATION_COLORS[escalationIndex]}`}>
                  {ESCALATION_LABELS[escalationIndex]}
                </span>
              </div>
              {/* Timer */}
              {currentRound && (
                <div className="flex flex-col items-end">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Timer</span>
                  <span className="text-3xl">
                    <RoundCountdown roundStartedAt={session.roundStartedAt} timerMinutes={currentRound.timerMinutes ?? 10} />
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Round title */}
          {currentRound && (
            <div className="px-8 py-6 border-b border-border/30">
              <div className="flex items-baseline gap-4">
                <span className="font-mono text-sm uppercase tracking-wider text-muted-foreground">
                  R{session.currentRound + 1}
                </span>
                <h2 className="text-4xl font-bold tracking-tight">{currentRound.title}</h2>
              </div>
            </div>
          )}

          {/* Main content area */}
          <div className="flex-1 px-8 py-8 grid grid-cols-1 gap-8 lg:grid-cols-2">
            {/* Situation update */}
            {currentRound && (
              <div className="flex flex-col gap-4">
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Situation Update</span>
                <p className="text-2xl leading-relaxed text-foreground">{currentRound.situation_update}</p>
              </div>
            )}

            {/* Latest inject */}
            {latestInject && (
              <div className={`rounded-xl border p-6 flex flex-col gap-4 ${
                latestInject.urgency === "critical"
                  ? "border-destructive/50 bg-destructive/10"
                  : latestInject.urgency === "high"
                  ? "border-orange-500/30 bg-orange-500/5"
                  : "border-primary/30 bg-primary/5"
              }`}>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Latest Inject</span>
                  <span className={`rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${
                    latestInject.urgency === "critical"
                      ? "border-destructive/50 text-destructive"
                      : latestInject.urgency === "high"
                      ? "border-orange-500/50 text-orange-500"
                      : "border-primary/40 text-primary"
                  }`}>
                    {latestInject.urgency}
                  </span>
                </div>
                <h3 className="text-2xl font-semibold">{latestInject.title}</h3>
                <p className="text-lg text-muted-foreground leading-relaxed">{latestInject.content}</p>
                {latestInject.senderName && (
                  <p className="font-mono text-sm text-muted-foreground">From: {latestInject.senderName}</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
