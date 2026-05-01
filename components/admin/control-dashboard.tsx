"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import {
  ArrowLeft, ChevronLeft, ChevronRight, Copy, Play, Power,
  ShieldAlert, Square, Users, Clock, Wifi, WifiOff, CheckCircle
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useSessionStream } from "@/lib/use-session-stream"
import { api } from "@/lib/api-client"
import { InjectControls } from "./inject-controls"
import { useLang } from "@/lib/use-lang"
import { tr } from "@/lib/i18n"
import { LangToggle } from "@/components/lang-toggle"

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

  const session = state.session
  const totalRounds = session?.scenario.rounds.length ?? 0
  const currentIndex = session?.currentRound ?? -1
  const currentRound = session && currentIndex >= 0 ? session.scenario.rounds[currentIndex] : null

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
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Users className="size-3" />
              <span>{session.participants.length} {tr(lang, "participants").toLowerCase()}</span>
            </div>
          </div>

          {/* Session timer */}
          <div className="flex flex-col gap-1.5">
            <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">{tr(lang, "sessionTimer")}</span>
            {isActive || isEnded ? <SessionClock startedAt={session.createdAt} /> : <span className="font-mono text-2xl font-bold text-muted-foreground">—</span>}
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
                <Button size="sm" onClick={() => run("start", () => api.startSession())} disabled={working !== null} className="gap-2 font-mono uppercase tracking-wider">
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

        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive-foreground">{error}</div>
        )}

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
                    <div className="size-6 rounded-full border border-border bg-background font-mono text-[9px] uppercase text-muted-foreground flex items-center justify-center">
                      {p.name.slice(0, 2)}
                    </div>
                    <span className="text-sm flex-1">{p.name}</span>
                    <span className="size-1.5 rounded-full bg-primary" />
                  </li>
                ))}
              </ul>
            </div>

            {/* Scenario summary */}
            <div className="rounded-xl border border-border bg-card px-4 py-4">
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{tr(lang, "scenarioSummary")}</span>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground line-clamp-4">{session.scenario.scenario_summary}</p>
            </div>

            {/* Timeline */}
            <div className="rounded-xl border border-border bg-card px-4 py-4 flex flex-col gap-2">
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{tr(lang, "eventLog")}</span>
              <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
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
            </div>

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
