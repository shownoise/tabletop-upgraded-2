"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useRef, useState } from "react"
import {
  ArrowLeft, ChevronLeft, ChevronRight, Copy, Play, Power,
  ShieldAlert, Square, Users, Clock, Wifi, WifiOff, CheckCircle,
  FileText, Monitor, ChevronRight as PhaseArrow, Flag
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useSessionStream } from "@/lib/use-session-stream"
import { api } from "@/lib/api-client"
import { InjectControls } from "./inject-controls"
import { DecisionsView } from "./decisions-view"
import { SpecialsPanel } from "./specials-panel"
import { GraphPathPanel } from "./graph-path-panel"
import { InjectRoutePlan } from "./inject-route-plan"
import { FactCheckPanel } from "./fact-check-panel"
import { NotificationTracker } from "./notification-tracker"
import { SupervisionReportView } from "./supervision-report"
import { buildTeamRoles } from "@/lib/team-roster"
import { useLang } from "@/lib/use-lang"
import { tr } from "@/lib/i18n"
import { LangToggle } from "@/components/lang-toggle"
import { ThemeToggle } from "@/components/theme-toggle"
import type { FacilitatorRoundScore, RoundPhase } from "@/lib/types"
import { ROLE_META } from "@/lib/types"
import { buildExerciseConfig } from "@/lib/engine/exercise-config"
import { buildFacilitatorContext, BOB_PHASES, OODA_PHASES } from "@/lib/engine/facilitator-support"
import type { AssessmentDimensionId, GoalId } from "@/lib/engine/types"

const PHASE_ORDER: RoundPhase[] = ["inject", "discussion", "decision", "review"]

// ─── Discussion phase stepper ─────────────────────────────────

function DiscussionPhaseStepper({
  session,
  currentIndex,
}: {
  session: NonNullable<ReturnType<typeof useSessionStream>["state"]["session"]>
  currentIndex: number
}) {
  const phases = session.config.decisionFramework === 'ooda' ? OODA_PHASES : BOB_PHASES
  const activePhase = session.activeDiscussionPhase
  const phaseIndex = activePhase?.phaseIndex ?? -1
  const currentPhase = phaseIndex >= 0 ? phases[phaseIndex] : null
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null)
  const [working, setWorking] = useState(false)
  const [timerExpiredAlert, setTimerExpiredAlert] = useState(false)
  const prevSecondsRef = useRef<number | null>(null)

  useEffect(() => {
    if (!activePhase || !currentPhase) { setSecondsLeft(null); setTimerExpiredAlert(false); return }
    const effective = session.currentDiscussionPhaseEffectiveSeconds ?? currentPhase.durationSeconds
    const end = activePhase.phaseStartedAt + effective * 1000
    const tick = () => {
      if (session.phaseAutoAdvancePaused) return
      const s = Math.max(0, Math.round((end - Date.now()) / 1000))
      setSecondsLeft(s)
      if (s === 0 && prevSecondsRef.current !== 0) setTimerExpiredAlert(true)
      prevSecondsRef.current = s
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [activePhase?.phaseStartedAt, activePhase?.phaseIndex, currentPhase, session.currentDiscussionPhaseEffectiveSeconds, session.phaseAutoAdvancePaused])

  // Reset alert when phase advances
  useEffect(() => { setTimerExpiredAlert(false); prevSecondsRef.current = null }, [phaseIndex])

  async function callPhase(phaseIdx: number, action: 'set' | 'extend' = 'set') {
    setWorking(true)
    try { await api.setDiscussionPhase({ roundNumber: currentIndex, phaseIndex: phaseIdx, action }) }
    catch { /* ignore */ }
    finally { setWorking(false) }
  }

  const frameworkLabel = session.config.decisionFramework === 'ooda' ? 'OODA' : 'BOB'

  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-primary/15">
        <div className="flex items-center gap-3">
          <span className="font-mono text-[10px] uppercase tracking-widest text-primary">Discussion — {frameworkLabel}</span>
          <div className="flex gap-1.5">
            {phases.map((_, i) => (
              <button
                key={i}
                disabled={working}
                onClick={() => callPhase(i)}
                className={`size-2 rounded-full transition-all ${
                  i === phaseIndex ? 'bg-primary' : i < phaseIndex ? 'bg-primary/40' : 'bg-border'
                }`}
                title={phases[i].name}
              />
            ))}
          </div>
        </div>
        {secondsLeft !== null && (
          <span className={`font-mono text-sm font-bold tabular-nums ${secondsLeft < 30 ? 'text-destructive animate-pulse' : secondsLeft < 60 ? 'text-amber-600' : 'text-foreground'}`}>
            {String(Math.floor(secondsLeft / 60)).padStart(2, '0')}:{String(secondsLeft % 60).padStart(2, '0')}
          </span>
        )}
      </div>

      <div className="px-5 py-4 flex flex-col gap-4">
        {phaseIndex === -1 ? (
          <div className="flex flex-col gap-3">
            <p className="font-mono text-xs text-muted-foreground">Start the {frameworkLabel} framework when ready.</p>
            <button
              disabled={working}
              onClick={() => callPhase(0)}
              className="self-start rounded-lg border border-primary/40 bg-primary/10 px-4 py-2 font-mono text-[10px] uppercase tracking-wider text-primary hover:bg-primary/20 transition-colors disabled:opacity-50"
            >
              Start {frameworkLabel}
            </button>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-1.5">
              <span className="font-mono text-[9px] uppercase tracking-widest text-primary">{currentPhase?.name}</span>
              <p className="font-mono text-sm text-foreground leading-relaxed">{currentPhase?.participantPrompt}</p>
            </div>
            {currentPhase?.facilitatorHint && (
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2">
                <span className="font-mono text-[9px] uppercase tracking-widest text-amber-600 block mb-1">Facilitator only</span>
                <p className="font-mono text-xs text-amber-700 dark:text-amber-400 leading-relaxed">{currentPhase.facilitatorHint}</p>
              </div>
            )}
            {/* Timer expired alert — shown on any phase when time runs out */}
            {timerExpiredAlert && (
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 flex items-center justify-between gap-4 animate-pulse">
                <div className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-destructive shrink-0" />
                  <div className="flex flex-col gap-0.5">
                    <span className="font-mono text-[9px] uppercase tracking-widest text-destructive font-bold">
                      Tijd verstreken — {currentPhase?.name}
                    </span>
                    <p className="font-mono text-[10px] text-muted-foreground">
                      {phaseIndex < phases.length - 1
                        ? "Ga door naar de volgende fase of geef meer tijd."
                        : "Schakel naar het beslismoment of geef meer tijd."}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setTimerExpiredAlert(false)}
                  className="shrink-0 font-mono text-[9px] text-muted-foreground hover:text-foreground"
                >
                  ✕
                </button>
              </div>
            )}
            {/* Last phase — suggest moving to decision */}
            {phaseIndex === phases.length - 1 && !timerExpiredAlert && (
              <div className="rounded-lg border border-primary/40 bg-primary/10 px-4 py-3 flex items-center justify-between gap-4">
                <div className="flex flex-col gap-0.5">
                  <span className="font-mono text-[9px] uppercase tracking-widest text-primary font-bold">
                    {frameworkLabel} afgerond
                  </span>
                  <p className="font-mono text-xs text-muted-foreground">
                    Schakel naar het beslismoment zodat deelnemers hun keuze kunnen indienen.
                  </p>
                </div>
                <button
                  disabled={working}
                  onClick={async () => {
                    setWorking(true)
                    try { await api.setPhase("decision") } catch { /* ignore */ }
                    finally { setWorking(false) }
                  }}
                  className="shrink-0 rounded-lg border border-primary bg-primary px-4 py-2 font-mono text-[10px] uppercase tracking-wider text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  → Beslismoment
                </button>
              </div>
            )}
            <div className="flex gap-2 flex-wrap">
              {phaseIndex < phases.length - 1 && (
                <button
                  disabled={working}
                  onClick={() => callPhase(phaseIndex + 1)}
                  className="rounded-lg border border-border bg-background px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors disabled:opacity-50"
                >
                  Next phase →
                </button>
              )}
              <button
                disabled={working}
                onClick={() => callPhase(phaseIndex, 'extend')}
                className="rounded-lg border border-border bg-background px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors disabled:opacity-50"
              >
                +2 min
              </button>
              <button
                disabled={working}
                onClick={async () => {
                  setWorking(true)
                  try { await api.setPhaseAutoAdvancePaused(!session.phaseAutoAdvancePaused) } catch { /* ignore */ }
                  finally { setWorking(false) }
                }}
                className={`rounded-lg border px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider transition-colors disabled:opacity-50 ${
                  session.phaseAutoAdvancePaused
                    ? "border-amber-500/60 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                    : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
                }`}
              >
                {session.phaseAutoAdvancePaused ? "Resume auto-advance" : "Pause auto-advance"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
const ESCALATION_LABELS = ["Normal", "Elevated", "High", "Critical"]
const ESCALATION_CLASSES = [
  "border-border text-muted-foreground",
  "border-amber-500/40 text-amber-600",
  "border-orange-500/40 text-orange-600",
  "border-destructive/40 text-destructive",
]

function RoundScoreWidget({ roundIndex, scores }: { roundIndex: number; scores: FacilitatorRoundScore[] }) {
  const [saving, setSaving] = useState(false)
  const [scoreError, setScoreError] = useState<string | null>(null)
  const current = scores.find(s => s.roundIndex === roundIndex)

  async function save(score: -1 | 0 | 1) {
    setSaving(true)
    setScoreError(null)
    try {
      await api.scoreRound(roundIndex, score)
    } catch (err) {
      setScoreError(err instanceof Error ? err.message : "Opslaan mislukt")
    } finally {
      setSaving(false)
    }
  }

  const OPTS: Array<{ score: -1 | 0 | 1; label: string; cls: string; active: string }> = [
    { score: -1, label: "Slecht", cls: "border-destructive/40 text-destructive hover:bg-destructive/10", active: "bg-destructive/15 border-destructive text-destructive" },
    { score: 0,  label: "Neutraal", cls: "border-border text-muted-foreground hover:bg-muted", active: "bg-muted border-border text-foreground" },
    { score: 1,  label: "Goed", cls: "border-primary/40 text-primary hover:bg-primary/10", active: "bg-primary/15 border-primary text-primary" },
  ]

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-5 py-3">
        <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground shrink-0">Score ronde {roundIndex + 1}</span>
        <div className="flex gap-2">
          {OPTS.map(opt => (
            <button
              key={opt.score}
              disabled={saving}
              onClick={() => save(opt.score)}
              className={`rounded-lg border px-3 py-1 font-mono text-[10px] uppercase tracking-wider transition-all disabled:opacity-50 ${
                current?.score === opt.score ? opt.active : opt.cls
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {current && (
          <span className="font-mono text-[9px] text-muted-foreground ml-auto">
            Totaal: {scores.reduce((s, r) => s + r.score, 0) >= 0 ? "+" : ""}{scores.reduce((s, r) => s + r.score, 0)}
          </span>
        )}
      </div>
      {scoreError && (
        <p className="font-mono text-[10px] text-destructive px-1">
          Fout: {scoreError} — controleer of de sessie nog actief is.
        </p>
      )}
    </div>
  )
}

function SessionClock({ startedAt }: { startedAt: number }) {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    const tick = () => setElapsed(Math.floor((Date.now() - startedAt) / 1000))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [startedAt])
  const m = Math.floor(elapsed / 60)
  const s = elapsed % 60
  return <span className="font-mono text-2xl font-bold tabular-nums text-foreground">{String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}</span>
}

function RoundTimer({ roundStartedAt, timerMinutes }: { roundStartedAt?: number; timerMinutes: number }) {
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
  const isLow = secondsLeft < 120
  const isUrgent = secondsLeft < 30
  return (
    <div className={`flex flex-col gap-0.5 ${isUrgent ? "animate-pulse" : ""}`}>
      <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Round timer</span>
      <span className={`font-mono text-2xl font-bold tabular-nums ${isUrgent ? "text-destructive" : isLow ? "text-primary" : "text-foreground"}`}>
        {String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}
      </span>
    </div>
  )
}

export function ControlDashboard() {
  const [lang, setLang] = useLang()
  const router = useRouter()
  const { state, connected } = useSessionStream()
  const [working, setWorking] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [decisionsOpen, setDecisionsOpen] = useState(false)
  const [contextOpen, setContextOpen] = useState(false)
  const [debrief, setDebrief] = useState<import("@/lib/engine/types").SessionAssessment | null>(null)
  const [debriefLoading, setDebriefLoading] = useState(false)

  const session = state.session
  const totalRounds = session?.scenario.rounds.length ?? 0

  // Derive logged assessment controls from persisted events — survives refresh
  const loggedControls = useMemo<Set<string>>(() => {
    const s = new Set<string>()
    for (const ev of session?.assessmentEvents ?? []) {
      s.add(`${ev.dimensionId}-${ev.value}-${ev.roundNumber}`)
    }
    return s
  }, [session?.assessmentEvents])
  const currentIndex = session?.currentRound ?? -1
  const currentRound = session && currentIndex >= 0 ? session.scenario.rounds[currentIndex] : null
  const currentPhase: RoundPhase = session?.roundPhase ?? "inject"
  const escalationIndex = Math.min(Math.max(currentIndex, 0), 3)

  async function advancePhase() {
    const idx = PHASE_ORDER.indexOf(currentPhase)
    if (idx < PHASE_ORDER.length - 1) {
      await run("phase", () => api.setPhase(PHASE_ORDER[idx + 1]))
    }
  }

  async function retreatPhase() {
    const idx = PHASE_ORDER.indexOf(currentPhase)
    if (idx > 0) {
      await run("phase", () => api.setPhase(PHASE_ORDER[idx - 1]))
    }
  }

  async function run(label: string, fn: () => Promise<unknown>) {
    setWorking(label)
    setError(null)
    try { await fn() }
    catch (err) { setError(err instanceof Error ? err.message : "Action failed") }
    finally { setWorking(null) }
  }

  async function copyJoinCode() {
    if (!session) return
    try {
      await navigator.clipboard.writeText(session.joinCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }

  async function endAndReset() {
    await run("reset", () => api.resetSession())
    router.push("/admin")
  }

  if (!session) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
        <ShieldAlert className="size-10 text-muted-foreground" />
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{tr(lang, "noActiveSession")}</h1>
          <p className="max-w-md text-muted-foreground">
            {connected ? tr(lang, "configureExercise") : "Connecting to live event stream…"}
          </p>
        </div>
        <Button asChild><Link href="/admin">{tr(lang, "configureExercise")}</Link></Button>
      </div>
    )
  }

  const status = session.status
  const isActive = status === "active"
  const isLobby = status === "lobby"
  const isEnded = status === "ended"

  return (
    <div className="min-h-screen bg-background">
      {/* Sticky header */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-5 py-3 md:px-8">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex size-8 items-center justify-center rounded-md border border-border bg-card text-muted-foreground hover:text-foreground">
              <ArrowLeft className="size-4" />
            </Link>
            <div className="flex flex-col">
              <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">{tr(lang, "facilitatorConsole")}</span>
              <span className="font-mono text-sm text-foreground truncate max-w-[200px] md:max-w-none">{session.scenario.scenario_title}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Mode badge */}
            <div className="hidden items-center rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-primary md:flex">
              {session.mode === "event" ? tr(lang, "mode_event") : tr(lang, "mode_training")}
            </div>
            {/* Escalation badge */}
            {isActive && (
              <div className={`hidden items-center rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider md:flex ${ESCALATION_CLASSES[escalationIndex]}`}>
                {ESCALATION_LABELS[escalationIndex]}
              </div>
            )}
            <div className={`flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-xs uppercase tracking-wider ${
              isActive ? "border-primary/40 bg-primary/10" :
              isEnded ? "border-destructive/40 bg-destructive/10" :
              "border-border bg-card"
            }`}>
              <span className={`size-1.5 rounded-full ${isActive ? "bg-primary pulse-ring" : isEnded ? "bg-destructive" : "bg-muted-foreground"}`} />
              {isLobby ? tr(lang, "lobby") : isActive ? tr(lang, "live") : tr(lang, "ended")}
            </div>
            <div className={`flex items-center gap-1.5 rounded-full border px-2 py-1 ${connected ? "border-border bg-card" : "border-destructive/40 bg-destructive/10"}`}>
              {connected ? <Wifi className="size-3 text-primary" /> : <WifiOff className="size-3 text-destructive" />}
            </div>
            <LangToggle lang={lang} setLang={setLang} />
            <ThemeToggle />
            {/* Extra nav buttons */}
            <Link href="/admin/story" className="flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors" title="Story mode (simplified)">
              Story
            </Link>
            <Link href="/admin/present" className="flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors" title="Presentation mode">
              <Monitor className="size-3.5" />
            </Link>
            {isEnded && (
              <Link href="/admin/report" className="flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/10 px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-primary hover:bg-primary/20 transition-colors">
                <FileText className="size-3.5" /> Report
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-6 md:px-8 md:py-8 flex flex-col gap-6">

        {/* Command bar */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 rounded-xl border border-border bg-card p-5">
          {/* Join code */}
          <div className="flex flex-col gap-1.5">
            <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">{tr(lang, "joinCodeLabel")}</span>
            <div className="flex items-center gap-2">
              <span className="font-mono text-3xl font-bold tracking-[0.2em] text-primary">{session.joinCode}</span>
              <button onClick={copyJoinCode} className="rounded-md border border-border bg-background p-1.5 text-muted-foreground hover:text-foreground transition-colors">
                {copied ? <CheckCircle className="size-3.5 text-primary" /> : <Copy className="size-3.5" />}
              </button>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Users className="size-3" />
              <span>{session.participants.length} {tr(lang, "participants").toLowerCase()}</span>
              {isLobby && session.participants.length > 0 && (() => {
                const readyCount = session.participants.filter(p => !!p.readyAt).length
                return (
                  <span className={`font-mono text-[9px] uppercase tracking-wider ${readyCount === session.participants.length ? "text-primary" : "text-muted-foreground"}`}>
                    · {readyCount}/{session.participants.length} ready
                  </span>
                )
              })()}
            </div>
          </div>

          {/* Session timer */}
          <div className="flex flex-col gap-1.5">
            <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">{tr(lang, "sessionTimer")}</span>
            {isActive || isEnded ? <SessionClock startedAt={session.startedAt ?? session.createdAt} /> : <span className="font-mono text-2xl font-bold text-muted-foreground">—</span>}
            <span className="text-xs text-muted-foreground">{isLobby ? tr(lang, "waitingToStartAdmin") : isActive ? tr(lang, "roundProgress", { n: String(currentIndex + 1), total: String(totalRounds) }) : tr(lang, "exerciseComplete")}</span>
          </div>

          {/* Round timer */}
          <div className="flex flex-col gap-1.5">
            <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">{tr(lang, "roundTimer")}</span>
            {isActive && currentRound ? (
              <RoundTimer roundStartedAt={session.roundStartedAt} timerMinutes={currentRound.timerMinutes ?? 10} />
            ) : <span className="font-mono text-2xl font-bold text-muted-foreground">—</span>}
            {isActive && currentRound?.timerMinutes && (
              <span className="text-xs text-muted-foreground">{currentRound.timerMinutes} min round</span>
            )}
          </div>

          {/* Round controls */}
          <div className="flex flex-col gap-2">
            <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">{tr(lang, "roundControl")}</span>
            <div className="flex flex-wrap gap-2">
              {isLobby && (
                <Button
                  size="sm"
                  onClick={() => run("start", async () => {
                    try {
                      await api.startSession()
                    } catch (err) {
                      const msg = err instanceof Error ? err.message : String(err)
                      // 409 → not all participants ready — ask facilitator to confirm.
                      if (msg.includes("Ready") && window.confirm(`${msg}\n\nToch starten?`)) {
                        await api.startSession({ force: true })
                      } else {
                        throw err
                      }
                    }
                  })}
                  disabled={working !== null}
                  className="gap-2 font-mono uppercase tracking-wider"
                >
                  <Play className="size-3.5" />{tr(lang, "startSession")}
                </Button>
              )}
              {isActive && (
                <>
                  <Button size="sm" variant="outline" onClick={() => run("prev", () => api.prevRound())} disabled={working !== null || currentIndex <= 0} className="gap-1.5 font-mono uppercase tracking-wider">
                    <ChevronLeft className="size-3.5" />{tr(lang, "prevRound")}
                  </Button>
                  <Button size="sm" onClick={() => run("next", () => api.nextRound())} disabled={working !== null} className="gap-1.5 font-mono uppercase tracking-wider">
                    {currentIndex >= totalRounds - 1 ? (
                      <><Square className="size-3.5" />{tr(lang, "endSession")}</>
                    ) : (
                      <>{tr(lang, "nextRound")}<ChevronRight className="size-3.5" /></>
                    )}
                  </Button>
                </>
              )}
              {isEnded && (
                <Button size="sm" variant="outline" onClick={endAndReset} className="gap-2 font-mono uppercase tracking-wider">
                  <Power className="size-3.5" />{tr(lang, "resetSession")}
                </Button>
              )}
            </div>
            {/* Round progress dots */}
            {totalRounds > 0 && (
              <div className="flex gap-1 mt-1">
                {Array.from({ length: totalRounds }, (_, i) => (
                  <div key={i} className={`h-1 flex-1 rounded-full transition-all ${
                    i < currentIndex + (isActive ? 1 : 0) ? "bg-primary" :
                    i === currentIndex && isActive ? "bg-primary/50" : "bg-border"
                  }`} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Phase controls — shown when session is active */}
        {isActive && (
          <div className="rounded-xl border border-border bg-card p-5 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">{tr(lang, "currentPhase")}</span>
              <div className="flex items-center gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={retreatPhase}
                  disabled={working !== null || currentPhase === "inject"}
                  className="gap-1.5 font-mono uppercase tracking-wider text-[10px]"
                >
                  <ChevronLeft className="size-3" /> Vorige fase
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={advancePhase}
                  disabled={working !== null || currentPhase === "review"}
                  className="gap-1.5 font-mono uppercase tracking-wider text-[10px]"
                >
                  Volgende fase <PhaseArrow className="size-3" />
                </Button>
              </div>
            </div>
            {/* Phase progress indicator */}
            <div className="flex items-center gap-2">
              {PHASE_ORDER.map((p, i) => {
                const phaseIdx = PHASE_ORDER.indexOf(currentPhase)
                const isPast = i < phaseIdx
                const isCurrent = i === phaseIdx
                const isFuture = i > phaseIdx
                return (
                  <div key={p} className="flex flex-1 flex-col items-center gap-1">
                    <div className={`h-1 w-full rounded-full transition-all ${
                      isPast ? "bg-primary" : isCurrent ? "bg-primary/60" : "bg-border"
                    }`} />
                    <span className={`font-mono text-[8px] uppercase tracking-wider ${
                      isCurrent ? "text-primary font-bold" : isFuture ? "text-muted-foreground/50" : "text-muted-foreground"
                    }`}>
                      {tr(lang, `phase_${p}` as Parameters<typeof tr>[1])}
                    </span>
                  </div>
                )
              })}
            </div>
            {/* Decisions toggle — show in review or decision phase */}
            {(currentPhase === "decision" || currentPhase === "review") && currentRound && (
              <button
                onClick={() => setDecisionsOpen(v => !v)}
                className="flex items-center justify-between rounded-lg border border-border bg-background px-4 py-2.5 hover:bg-card transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Flag className="size-3.5 text-primary" />
                  <span className="font-mono text-xs text-foreground">{tr(lang, "decisionsView")}</span>
                  {(session.submittedDecisions ?? []).filter(d => d.roundIndex === currentIndex).length > 0 && (
                    <span className="rounded-full border border-primary/30 bg-primary/10 px-1.5 py-px font-mono text-[9px] text-primary">
                      {(session.submittedDecisions ?? []).filter(d => d.roundIndex === currentIndex).length}
                    </span>
                  )}
                  {(session.governanceFlags ?? []).filter(f => f.roundIndex === currentIndex).length > 0 && (
                    <span className="rounded-full border border-destructive/40 bg-destructive/10 px-1.5 py-px font-mono text-[9px] text-destructive">
                      {(session.governanceFlags ?? []).filter(f => f.roundIndex === currentIndex).length} flags
                    </span>
                  )}
                </div>
                <ChevronRight className={`size-4 text-muted-foreground transition-transform ${decisionsOpen ? "rotate-90" : ""}`} />
              </button>
            )}
            {decisionsOpen && currentRound && (
              <div className="rounded-xl border border-border bg-card p-4">
                <DecisionsView
                  decisions={(session.submittedDecisions ?? []).filter(d => d.roundIndex === currentIndex)}
                  flags={(session.governanceFlags ?? []).filter(f => f.roundIndex === currentIndex)}
                  participants={session.participants}
                  roundActions={currentRound.roleActions ?? []}
                  lang={lang}
                />
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive-foreground">{error}</div>
        )}

        {/* Facilitator notes — shown when current round has AI-generated guidance */}
        {isActive && currentRound?.facilitatorNotes && (() => {
          const notes = currentRound.facilitatorNotes!
          return (
            <div
              className="border border-tt-border bg-tt-surface p-5 flex flex-col gap-4"
              style={{ borderLeft: "3px solid var(--tt-accent)" }}
            >
              <div className="flex items-center gap-2">
                <Flag className="size-3.5 text-tt-accent" />
                <span className="font-mono text-[9px] uppercase tracking-widest text-tt-accent">Facilitator sturing — ronde {currentIndex + 1}</span>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="flex flex-col gap-1.5">
                  <span className="font-mono text-[9px] uppercase tracking-widest text-tt-accent">Discussiedoel</span>
                  <p className="font-mono text-xs text-tt-bright leading-relaxed">{notes.discussionGoal}</p>
                </div>
                {notes.keyQuestions?.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    <span className="font-mono text-[9px] uppercase tracking-widest text-tt-accent">Stuurvragen</span>
                    <ul className="flex flex-col gap-1">
                      {notes.keyQuestions.map((q, i) => (
                        <li key={i} className="font-mono text-xs text-tt-dim flex gap-1.5">
                          <span className="text-tt-accent shrink-0">?</span>{q}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {notes.redFlags?.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    <span className="font-mono text-[9px] uppercase tracking-widest text-tt-red">Let op</span>
                    <ul className="flex flex-col gap-1">
                      {notes.redFlags.map((f, i) => (
                        <li key={i} className="font-mono text-xs text-tt-dim flex gap-1.5">
                          <span className="text-tt-red shrink-0">⚠</span>{f}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              {notes.hints?.length > 0 && (
                <div className="flex flex-col gap-1.5 border-t border-[#2a3030] pt-3">
                  <span className="font-mono text-[9px] uppercase tracking-widest text-tt-dim">Tips voor facilitator</span>
                  <ul className="flex flex-wrap gap-2">
                    {notes.hints.map((h, i) => (
                      <li key={i} className="border border-tt-border bg-tt-bright/5 px-2.5 py-1 font-mono text-[10px] text-tt-dim">{h}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )
        })()}

        {/* BOB/OODA phase stepper — visible during discussion phase when framework has phases */}
        {isActive && session.roundPhase === "discussion" &&
          (session.config.decisionFramework === 'bob' || session.config.decisionFramework === 'ooda' || !session.config.decisionFramework) && (
          <DiscussionPhaseStepper session={session} currentIndex={currentIndex} />
        )}

        {/* Per-round facilitator score */}
        {isActive && (
          <RoundScoreWidget
            roundIndex={currentIndex}
            scores={session.facilitatorRoundScores ?? []}
          />
        )}

        {/* Goal context panel — shown when goalId is set and session is active */}
        {isActive && session.config.goalId && (() => {
          const resolvedConfig = buildExerciseConfig(session.config.goalId as GoalId, session.config)
          const ctx = buildFacilitatorContext(resolvedConfig, currentIndex)
          const goal = resolvedConfig.goal

          async function logControl(dimensionId: AssessmentDimensionId, value: number, label: string) {
            try { await api.logAssessmentEvent({ dimensionId, roundNumber: currentIndex, value, note: label }) }
            catch { /* silent */ }
          }

          return (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <button
                type="button"
                onClick={() => setContextOpen(v => !v)}
                className="w-full flex items-center justify-between px-5 py-3 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <ShieldAlert className="size-3.5 text-primary" />
                  <span className="font-mono text-[10px] uppercase tracking-wider text-primary">{goal.name}</span>
                  <span className="font-mono text-[9px] text-muted-foreground hidden sm:block">
                    — {goal.assessmentDimensions.length} dimensions · {resolvedConfig.capabilities.length} capabilities
                  </span>
                </div>
                <ChevronRight className={`size-4 text-muted-foreground transition-transform ${contextOpen ? "rotate-90" : ""}`} />
              </button>

              {contextOpen && (
                <div className="border-t border-border px-5 py-4 flex flex-col gap-5">

                  {/* Observation prompts */}
                  {ctx.observationPrompts.length > 0 && (
                    <div className="flex flex-col gap-2">
                      <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Watch this round</span>
                      <ul className="flex flex-col gap-1.5">
                        {ctx.observationPrompts.map((p, i) => (
                          <li key={i} className="flex items-start gap-2 font-mono text-xs text-foreground">
                            <span className="text-primary shrink-0 mt-0.5">›</span>{p}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Compliance triggers */}
                  {ctx.complianceTriggers.length > 0 && (
                    <div className="flex flex-col gap-2">
                      <span className="font-mono text-[9px] uppercase tracking-widest text-amber-600">Compliance clock</span>
                      <ul className="flex flex-col gap-1.5">
                        {ctx.complianceTriggers.map((t, i) => (
                          <li key={i} className="flex items-start gap-2 font-mono text-xs text-amber-700 dark:text-amber-400">
                            <span className="shrink-0 mt-0.5">⚠</span>{t}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Mandate checks */}
                  {ctx.mandateChecks.length > 0 && (
                    <div className="flex flex-col gap-2">
                      <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Mandate checks</span>
                      <ul className="flex flex-col gap-1.5">
                        {ctx.mandateChecks.map((m, i) => (
                          <li key={i} className="flex items-start gap-2 font-mono text-xs text-muted-foreground">
                            <span className="shrink-0 mt-0.5">?</span>{m}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Assessment controls */}
                  {ctx.assessmentControls.length > 0 && (
                    <div className="flex flex-col gap-2">
                      <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Log assessment</span>
                      <div className="flex flex-wrap gap-2">
                        {ctx.assessmentControls.map((ctrl, i) => {
                          const key = `${ctrl.dimensionId}-${ctrl.value}-${currentIndex}`
                          const logged = loggedControls.has(key)
                          return (
                            <button
                              key={i}
                              type="button"
                              onClick={() => logControl(ctrl.dimensionId, ctrl.value, ctrl.label)}
                              className={`rounded-lg border px-3 py-1.5 font-mono text-[10px] transition-all ${
                                logged
                                  ? "border-primary bg-primary/10 text-primary"
                                  : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
                              }`}
                            >
                              {logged ? "✓ " : ""}{ctrl.label}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })()}

        {/* Debrief panel — shown when session ended and goalId set */}
        {isEnded && session.config.goalId && (
          <div className="rounded-xl border border-border bg-card p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="size-3.5 text-primary" />
                <span className="font-mono text-[10px] uppercase tracking-wider text-primary">Assessment debrief</span>
              </div>
              {!debrief && (
                <button
                  type="button"
                  disabled={debriefLoading}
                  onClick={async () => {
                    setDebriefLoading(true)
                    try {
                      const result = await api.getDebrief()
                      setDebrief(result.assessment)
                    } catch (err) {
                      setError(err instanceof Error ? err.message : "Debrief failed")
                    } finally {
                      setDebriefLoading(false)
                    }
                  }}
                  className="font-mono text-[10px] uppercase tracking-wider rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50"
                >
                  {debriefLoading ? "Generating…" : "Generate debrief"}
                </button>
              )}
            </div>

            {debrief && (
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-4 rounded-lg border border-border bg-background px-4 py-3">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Overall score</span>
                    <span className="font-mono text-2xl font-bold text-foreground">{debrief.overallScore}<span className="text-muted-foreground text-sm font-normal">/100</span></span>
                  </div>
                  <div className="flex-1 grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-4">
                    {Object.entries(debrief.dimensionScores).map(([dim, score]) => (
                      <div key={dim} className="flex flex-col gap-0.5">
                        <span className="font-mono text-[8px] uppercase tracking-widest text-muted-foreground truncate">{dim.replace(/_/g, ' ')}</span>
                        <span className={`font-mono text-sm font-medium ${(score ?? 0) >= 70 ? "text-primary" : (score ?? 0) >= 50 ? "text-amber-600" : "text-destructive"}`}>{score}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {debrief.advice.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Recommendations</span>
                    <div className="flex flex-col gap-3">
                      {debrief.advice.map((adv, i) => (
                        <div key={i} className={`rounded-lg border px-4 py-3 flex flex-col gap-1 ${
                          adv.priority === 'high' ? "border-destructive/30 bg-destructive/5" :
                          adv.priority === 'medium' ? "border-amber-500/30 bg-amber-500/5" :
                          "border-border bg-card"
                        }`}>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[8px] uppercase tracking-widest text-muted-foreground">{adv.dimensionId.replace(/_/g, ' ')}</span>
                            <span className={`font-mono text-[8px] uppercase tracking-widest ${
                              adv.priority === 'high' ? "text-destructive" : adv.priority === 'medium' ? "text-amber-600" : "text-muted-foreground"
                            }`}>{adv.priority}</span>
                          </div>
                          <p className="text-xs text-foreground leading-relaxed">{adv.observation}</p>
                          <p className="text-xs text-muted-foreground leading-relaxed">→ {adv.recommendation}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {debrief.advice.length === 0 && (
                  <p className="font-mono text-xs text-primary">All scored dimensions are at 70 or above — strong performance.</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Toezichthouder-rapport — beschikbaar zodra sessie loopt */}
        <ToezichthouderReportPanel />

        {/* Notification tracker — meldplicht drafts live */}
        <NotificationTracker session={session} />

        {/* Main layout: inject controls + sidebar */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Inject controls */}
          <section className="lg:col-span-2">
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="flex items-center justify-between border-b border-border px-5 py-3">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">{tr(lang, "injectControls")}</span>
                  {currentRound && (
                    <Badge variant="outline" className="border-primary/40 bg-primary/10 font-mono text-[10px] uppercase tracking-wider text-primary">
                      R{currentIndex + 1} — {currentRound.title}
                    </Badge>
                  )}
                </div>
                {isActive && <Badge variant="outline" className="border-primary/30 bg-primary/10 font-mono text-[10px] text-primary uppercase tracking-wider">{tr(lang, "live")}</Badge>}
              </div>
              <div className="p-5">
                <InjectControls session={session} disabled={working !== null} lang={lang} />
              </div>
            </div>
          </section>

          {/* Sidebar: participants + timeline */}
          <aside className="flex flex-col gap-4">
            {/* Participants */}
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="border-b border-border px-4 py-2.5 flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{tr(lang, "participants")}</span>
                <span className="font-mono text-xs text-foreground">{session.participants.length}</span>
              </div>
              <ul className="divide-y divide-border max-h-48 overflow-y-auto">
                {session.participants.length === 0 ? (
                  <li className="px-4 py-6 text-center font-mono text-xs text-muted-foreground uppercase tracking-wider">
                    Waiting for participants…
                  </li>
                ) : session.participants.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 px-4 py-2.5">
                    <div className="size-6 rounded-full border border-border bg-background font-mono text-[9px] uppercase text-muted-foreground flex items-center justify-center shrink-0">
                      {p.name.slice(0, 2)}
                    </div>
                    <span className="text-sm flex-1 min-w-0 truncate">{p.name}</span>
                    {p.role && (
                      <span className="rounded-full border border-primary/30 bg-primary/10 px-1.5 py-px font-mono text-[8px] uppercase tracking-wider text-primary shrink-0">
                        {ROLE_META[p.role].label}
                      </span>
                    )}
                    <span className="size-1.5 rounded-full bg-primary shrink-0" />
                  </li>
                ))}
              </ul>
            </div>

            {/* Graph path panel — only for graph-driven sessions */}
            {session.graph && <GraphPathPanel session={session} />}

            {/* Locked-at-start inject → recipient routing */}
            {(session.injectRoutePlan || session.status === "active") && (
              <InjectRoutePlan
                session={session}
                teamRoles={buildTeamRoles()}
                onReplot={async () => { await api.replotInjects() }}
              />
            )}

            {/* Fact-check panel — live tag distribution + ground truth (facilitator-only) */}
            <FactCheckPanel session={session} />

            {/* Specials panel — shown when mode is not off */}
            {session.config.specialsMode && session.config.specialsMode !== "off" && (
              <SpecialsPanel session={session} />
            )}

            {/* Scenario summary */}
            <div className="rounded-xl border border-border bg-card px-4 py-4">
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{tr(lang, "scenarioSummary")}</span>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground line-clamp-4">{session.scenario.scenario_summary}</p>
            </div>

            {/* Timeline */}
            <details className="group rounded-xl border border-border bg-card">
              <summary className="cursor-pointer px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground select-none list-none flex items-center justify-between">
                {tr(lang, "eventLog")}
                <span className="text-[8px] opacity-50 group-open:hidden">▶ expand</span>
                <span className="text-[8px] opacity-50 hidden group-open:inline">▼ collapse</span>
              </summary>
              <div className="px-4 pb-4 flex flex-col gap-2 max-h-64 overflow-y-auto">
                {[...session.timeline].reverse().slice(0, 25).map((ev) => (
                  <div key={ev.id} className="flex items-start gap-2 text-xs">
                    <span className="font-mono text-[9px] text-muted-foreground shrink-0 mt-0.5">
                      {new Date(ev.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <span className="text-muted-foreground leading-relaxed">
                      {ev.type.replace(/_/g, " ")}
                      {(ev.data as { name?: string }).name ? ` — ${(ev.data as { name?: string }).name}` : ""}
                    </span>
                  </div>
                ))}
              </div>
            </details>

            {/* Danger zone */}
            <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Session</span>
              <button onClick={endAndReset} className="font-mono text-[10px] uppercase tracking-wider text-destructive hover:underline">
                {tr(lang, "destroySession")}
              </button>
            </div>
          </aside>
        </div>
      </main>
    </div>
  )
}

function ToezichthouderReportPanel() {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-wider text-primary">Toezichthouder-rapport</span>
        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          className="rounded border border-primary/40 px-2 py-0.5 text-[10px] font-mono uppercase text-primary hover:bg-primary/10"
        >
          {open ? "Verberg" : "Toon rapport"}
        </button>
      </div>
      {open && <SupervisionReportView />}
    </div>
  )
}
