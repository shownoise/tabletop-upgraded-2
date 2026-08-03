"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowLeft, ShieldAlert } from "lucide-react"
import { useSessionStream } from "@/lib/use-session-stream"
import type { AssessmentReport } from "@/lib/scoring"

const PHASE_LABELS: Record<string, string> = {
  inject: "BRIEFING",
  discussion: "OVERLEG",
  decision: "KEUZE",
  lock: "VASTGEZET",
  review: "REVEAL",
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

  // All pushed injects for the current round + any surprise injects (roundIndex < 0),
  // newest first. Big-screen shows the FULL feed so every role can see everything;
  // the score reveal takes over at lock/review phase.
  const roundInjects = useMemo(() => {
    if (!session) return []
    return [...session.pushedInjects]
      .filter(p => p.roundIndex === session.currentRound || p.roundIndex < 0)
      .sort((a, b) => b.pushedAt - a.pushedAt)
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
          <Link href="/admin/story" className="flex items-center gap-1.5 font-mono text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-3.5" /> Control
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

          {/* Groepsdruk-indicator tijdens KEUZE — anoniem "X van Y groepen klaar" */}
          {session.mode === "event" && (phase === "discussion" || phase === "decision") && (session.groups ?? []).length > 1 && (
            <GroupProgressBanner session={session} />
          )}

          {/* Main content area — normaal: situatie + volledige inject-feed; tijdens lock/review: reveal */}
          {(phase === "lock" || phase === "review") ? (
            <BigScreenReveal currentRoundNumber={session.currentRound + 1} />
          ) : (
            <div className="flex-1 px-8 py-6 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
              {/* Situation update — left column */}
              {currentRound && (
                <div className="flex flex-col gap-4">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Situation update</span>
                  <p className="text-2xl leading-relaxed text-foreground whitespace-pre-wrap">
                    {currentRound.situation_update}
                  </p>
                </div>
              )}

              {/* All pushed injects for this round — right column, newest on top,
                  every role's feed visible so the big screen is a single source of truth. */}
              <div className="flex flex-col gap-3 min-h-0">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    Injects this round
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-primary">
                    {roundInjects.length} total
                  </span>
                </div>
                {roundInjects.length === 0 ? (
                  <p className="font-mono text-sm uppercase tracking-wider text-muted-foreground animate-pulse">
                    Waiting for injects…
                  </p>
                ) : (
                  <ul className="flex flex-col gap-3 overflow-y-auto pr-1" style={{ maxHeight: "calc(100vh - 340px)" }}>
                    {roundInjects.map((p, idx) => (
                      <BigScreenInjectCard key={`${p.inject.id}-${p.pushedAt}`} inject={p.inject} highlight={idx === 0} />
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Big-screen inject card — compact enough to fit multiple on a projector.
function BigScreenInjectCard({
  inject,
  highlight,
}: {
  inject: import("@/lib/types").Inject
  highlight: boolean
}) {
  const border =
    inject.urgency === "critical" ? "border-destructive/60 bg-destructive/10"
    : inject.urgency === "high" ? "border-orange-500/40 bg-orange-500/5"
    : inject.urgency === "medium" ? "border-primary/40 bg-primary/5"
    : "border-border bg-card"
  const badgeClass =
    inject.urgency === "critical" ? "border-destructive/50 text-destructive"
    : inject.urgency === "high" ? "border-orange-500/50 text-orange-500"
    : "border-primary/40 text-primary"
  return (
    <li className={`rounded-xl border p-4 flex flex-col gap-2 ${border} ${highlight ? "ring-2 ring-primary/30" : ""}`}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            {inject.channel ?? inject.type}
          </span>
          <span className={`rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${badgeClass}`}>
            {inject.urgency}
          </span>
          {inject.targetRoles?.length ? (
            <span className="font-mono text-[10px] text-muted-foreground truncate">
              → {inject.targetRoles.join(", ")}
            </span>
          ) : inject.targetTeam && inject.targetTeam !== "all" ? (
            <span className="font-mono text-[10px] text-muted-foreground">→ {inject.targetTeam}</span>
          ) : null}
        </div>
        {inject.timestamp && (
          <span className="font-mono text-[10px] text-muted-foreground shrink-0">{inject.timestamp}</span>
        )}
      </div>
      <h3 className="text-xl font-semibold leading-tight">{inject.title}</h3>
      <p className="text-base text-muted-foreground leading-relaxed whitespace-pre-wrap">
        {inject.content}
      </p>
      {(inject.senderName || inject.source) && (
        <span className="font-mono text-[11px] text-muted-foreground">
          — {inject.senderName ?? inject.source}{inject.senderHandle ? ` (${inject.senderHandle})` : ""}
        </span>
      )}
    </li>
  )
}

// Deel B §7.6 — anonieme voortgang op groot scherm.
function GroupProgressBanner({ session }: { session: import("@/lib/types").SessionState }) {
  const groups = session.groups ?? []
  const currentRound = session.currentRound
  const submissions = session.submittedDecisions ?? []
  const submittedGroupIds = new Set(
    submissions.filter(d => d.roundIndex === currentRound && d.groupId).map(d => d.groupId as string),
  )
  const total = groups.length
  const submitted = groups.filter(g => submittedGroupIds.has(g.id)).length
  return (
    <div className="mx-8 mt-4 rounded-xl border border-primary/30 bg-primary/5 px-8 py-4 flex items-center justify-between">
      <span className="font-mono text-sm uppercase tracking-wider text-muted-foreground">
        Voortgang
      </span>
      <div className="flex items-baseline gap-3">
        <span className="text-5xl font-bold tabular-nums text-primary">{submitted}</span>
        <span className="text-2xl text-muted-foreground">/ {total} groepen klaar</span>
      </div>
    </div>
  )
}

// Deel B §5.2 — reveal-scherm voor het grote scherm. Vaste volgorde:
//   1. Weging deze ronde (nu pas onthuld)
//   2. Vector per dimensie
//   3. Punten deze ronde + trend
//   4. Rolresolutie
const DIMS = ["CONT", "FOR", "BC", "JUR", "VER", "KOS"] as const
const DIM_LABELS: Record<string, string> = {
  CONT: "Containment",
  FOR:  "Forensische integriteit",
  BC:   "Bedrijfscontinuïteit",
  JUR:  "Juridisch",
  VER:  "Vertrouwen",
  KOS:  "Kosten",
}

interface GroupLeaderboardEntry {
  gid: string
  name: string
  points: number
  currentRoundVector?: Record<string, number>
  currentRoundPoints?: number
}

function BigScreenReveal({ currentRoundNumber }: { currentRoundNumber: number }) {
  const [report, setReport] = useState<AssessmentReport | null>(null)
  const [leaderboard, setLeaderboard] = useState<GroupLeaderboardEntry[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function fetchAll() {
      try {
        const [rReport, rGroups] = await Promise.all([
          fetch("/api/session/score?format=report"),
          fetch("/api/session/score?mode=EVENT&byGroup=true"),
        ])
        if (!rReport.ok) {
          const data = await rReport.json().catch(() => ({}))
          if (!cancelled) setError(data.error ?? `HTTP ${rReport.status}`)
          return
        }
        const data = (await rReport.json()) as AssessmentReport
        let lb: GroupLeaderboardEntry[] = []
        if (rGroups.ok) {
          const gd = (await rGroups.json()) as {
            perGroup: Record<string, { totalPoints: number; outcomes: Array<{ round: number; points: number; perDimension: Record<string, number> }> }>
            groupNames: Record<string, string>
          }
          lb = Object.entries(gd.perGroup)
            .map(([gid, out]) => {
              const currentRoundOutcome = out.outcomes.find(o => o.round === currentRoundNumber)
              return {
                gid,
                name: gd.groupNames[gid] ?? gid,
                points: out.totalPoints,
                currentRoundVector: currentRoundOutcome?.perDimension,
                currentRoundPoints: currentRoundOutcome?.points,
              }
            })
            .sort((a, b) => b.points - a.points)
        }
        if (!cancelled) { setReport(data); setLeaderboard(lb); setError(null) }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err))
      }
    }
    fetchAll()
    const id = setInterval(fetchAll, 3000)
    return () => { cancelled = true; clearInterval(id) }
  }, [currentRoundNumber])

  if (error) return (
    <div className="flex-1 flex items-center justify-center px-8 py-8">
      <p className="font-mono text-lg text-destructive">Reveal niet beschikbaar: {error}</p>
    </div>
  )
  if (!report) return (
    <div className="flex-1 flex items-center justify-center px-8 py-8">
      <p className="font-mono text-lg text-muted-foreground animate-pulse">Reveal wordt berekend…</p>
    </div>
  )

  const roundOutcome = report.outcomes.find(o => o.round === currentRoundNumber)

  return (
    <div className="flex-1 px-8 py-8 flex flex-col gap-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-primary">Reveal §5.2</div>
          <div className="text-4xl font-bold">Ronde {currentRoundNumber}</div>
        </div>
        {roundOutcome && (
          <div className="text-right">
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Punten deze ronde</div>
            <div className="text-6xl font-bold text-primary tabular-nums">{roundOutcome.points}</div>
          </div>
        )}
      </div>

      {/* 6-dim vector */}
      {roundOutcome && (
        <div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-3">Uitkomstvector — nu onthuld</div>
          <div className="grid grid-cols-6 gap-4">
            {DIMS.map(d => (
              <div key={d} className="rounded-lg border border-border p-4 text-center">
                <div className="font-mono text-[10px] text-muted-foreground uppercase">{d}</div>
                <div className={`text-4xl font-bold mt-1 tabular-nums ${
                  roundOutcome.perDimension[d] > 0 ? "text-primary" :
                  roundOutcome.perDimension[d] < 0 ? "text-destructive" : "text-muted-foreground"
                }`}>
                  {roundOutcome.perDimension[d] > 0 ? "+" : ""}{roundOutcome.perDimension[d].toFixed(1)}
                </div>
                <div className="text-[11px] text-muted-foreground mt-2 truncate">{DIM_LABELS[d]}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Trend over rondes */}
      <div>
        <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-3">Trend</div>
        <div className="flex gap-3 items-end h-32">
          {report.outcomes.map(o => (
            <div key={o.round} className="flex-1 flex flex-col items-center gap-2">
              <div className="w-full h-full flex items-end">
                <div
                  className={`w-full rounded-t transition-all ${
                    o.round === currentRoundNumber ? "bg-primary" : "bg-muted-foreground/40"
                  }`}
                  style={{ height: `${Math.max(4, o.points)}%` }}
                />
              </div>
              <span className="font-mono text-xs text-muted-foreground">R{o.round}</span>
              <span className="font-mono text-lg font-bold tabular-nums">{o.points}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Leaderboard — alleen als er meerdere groepen zijn (EVENT-mode) */}
      {leaderboard.length > 1 && (
        <div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-3">Leaderboard — deze ronde</div>
          <div className="space-y-2">
            {leaderboard.map((e, i) => (
              <div
                key={e.gid}
                className={`rounded-lg border px-6 py-3 transition-all ${
                  i === 0 ? "border-primary bg-primary/10" : "border-border bg-card"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-4">
                    <span className={`text-2xl font-bold tabular-nums ${i === 0 ? "text-primary" : "text-muted-foreground"}`}>
                      #{i + 1}
                    </span>
                    <span className="text-xl font-semibold">{e.name}</span>
                    {typeof e.currentRoundPoints === "number" && (
                      <span className="font-mono text-xs text-muted-foreground">
                        deze ronde: <span className="font-bold">{e.currentRoundPoints}</span>
                      </span>
                    )}
                  </div>
                  <span className="text-3xl font-bold tabular-nums text-primary">{e.points}</span>
                </div>
                {/* Mini per-group vector deze ronde */}
                {e.currentRoundVector && (
                  <div className="grid grid-cols-6 gap-1.5 mt-2">
                    {DIMS.map(d => {
                      const v = e.currentRoundVector![d] ?? 0
                      return (
                        <div key={d} className="rounded border border-border/40 py-1 text-center bg-background/50">
                          <div className="font-mono text-[9px] text-muted-foreground uppercase">{d}</div>
                          <div className={`font-mono text-sm font-bold tabular-nums ${
                            v > 0 ? "text-primary" : v < 0 ? "text-destructive" : "text-muted-foreground"
                          }`}>
                            {v > 0 ? "+" : ""}{v.toFixed(1)}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
