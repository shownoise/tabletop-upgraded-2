"use client"

import Link from "next/link"
import { useEffect, useMemo, useRef, useState } from "react"
import { ArrowLeft, ChevronDown, Info, ShieldAlert } from "lucide-react"
import { useSessionStream } from "@/lib/use-session-stream"
import type { Inject, LiveEvent } from "@/lib/types"
import { InjectFeed } from "./inject-feed"
import { UrgentInjectModal } from "./urgent-inject-modal"
import { RoundTimerCompact } from "./round-timer"
import { SessionHUD } from "./session-hud"
import { FeedbackScreen } from "./feedback-screen"
import { Empty } from "@/components/ui/empty"
import { useLang } from "@/lib/use-lang"
import { tr } from "@/lib/i18n"

const NAME_KEY = "ctt:name"
const FEEDBACK_KEY = "ctt:feedback_rounds"

// ─── Intro overlay ───
function IntroOverlay({ lang, onReady }: { lang: ReturnType<typeof useLang>[0]; onReady: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background px-4">
      <div className="grid-bg pointer-events-none absolute inset-0 opacity-20" aria-hidden />
      <div className="relative z-10 w-full max-w-lg flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex size-8 items-center justify-center rounded border border-primary/40 bg-primary/10">
              <ShieldAlert className="size-4 text-primary" />
            </div>
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">CYBER_TABLETOP</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{tr(lang, "welcomeTitle")}</h1>
          <p className="text-muted-foreground text-sm">{tr(lang, "welcomeSub")}</p>
        </div>

        <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5">
          <span className="font-mono text-[10px] uppercase tracking-wider text-primary">{tr(lang, "howItWorks")}</span>
          {[
            tr(lang, "intro1"),
            tr(lang, "intro2"),
            tr(lang, "intro3"),
            tr(lang, "intro4"),
            tr(lang, "intro5"),
          ].map((s, i) => (
            <div key={i} className="flex gap-3">
              <span className="font-mono text-xs text-primary mt-0.5 shrink-0">{i + 1}.</span>
              <p className="text-sm text-muted-foreground leading-relaxed">{s}</p>
            </div>
          ))}
          <div className="mt-2 rounded-md border border-primary/20 bg-primary/5 px-4 py-2.5">
            <p className="font-mono text-xs text-primary">{tr(lang, "timerNote")}</p>
          </div>
        </div>

        <button
          onClick={onReady}
          className="flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-4 font-mono text-sm uppercase tracking-wider text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          {tr(lang, "readyBtn")}
        </button>
      </div>
    </div>
  )
}

// ─── Round situation card ───
function RoundSituationCard({ session, lang }: { session: NonNullable<ReturnType<typeof useSessionStream>["state"]["session"]>; lang: ReturnType<typeof useLang>[0] }) {
  const currentRound = session.currentRound >= 0 ? session.scenario.rounds[session.currentRound] : null
  const [expanded, setExpanded] = useState(true)

  if (!currentRound) return null

  return (
    <div className="rounded-xl border border-primary/30 bg-primary/5 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-3 hover:bg-primary/10 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Info className="size-3.5 text-primary" />
          <span className="font-mono text-[10px] uppercase tracking-wider text-primary">
            {tr(lang, "round")} {session.currentRound + 1} · {currentRound.title}
          </span>
        </div>
        <ChevronDown className={`size-4 text-primary transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>
      {expanded && (
        <div className="px-5 pb-5 flex flex-col gap-4 border-t border-primary/20">
          <p className="text-sm leading-relaxed text-foreground pt-3">{currentRound.situation_update}</p>
          <div className="rounded-lg border border-border bg-background/50 px-4 py-3">
            <p className="font-mono text-[10px] uppercase tracking-wider text-primary mb-2">{tr(lang, "roundIntro")}</p>
            <ul className="flex flex-col gap-1.5">
              {[
                tr(lang, "roundInstruction1"),
                tr(lang, "roundInstruction2"),
                tr(lang, "roundInstruction3"),
              ].map((s, i) => (
                <li key={i} className="flex gap-2 text-xs text-muted-foreground">
                  <span className="text-primary shrink-0">→</span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main view ───
export function PlayView() {
  const [lang, setLang] = useLang()
  const { state, connected, onEvent } = useSessionStream()
  const [name, setName] = useState<string | null>(null)
  const [showIntro, setShowIntro] = useState(true)
  const [urgent, setUrgent] = useState<Inject | null>(null)
  const [banner, setBanner] = useState<{ id: number; text: string; type?: string } | null>(null)
  const [feedbackFor, setFeedbackFor] = useState<{ round: number; isFinal: boolean } | null>(null)
  const [doneFeedbackRounds, setDoneFeedbackRounds] = useState<Set<number>>(new Set())
  const prevRoundRef = useRef<number>(-1)

  useEffect(() => {
    try { setName(window.sessionStorage.getItem(NAME_KEY)) } catch {}
    try {
      const stored = localStorage.getItem(FEEDBACK_KEY)
      if (stored) setDoneFeedbackRounds(new Set(JSON.parse(stored)))
    } catch {}
  }, [])

  const session = state.session

  // Detect round transitions → trigger feedback
  useEffect(() => {
    if (!session) return
    const idx = session.currentRound
    if (idx !== prevRoundRef.current && prevRoundRef.current >= 0 && !doneFeedbackRounds.has(prevRoundRef.current)) {
      setFeedbackFor({ round: prevRoundRef.current + 1, isFinal: false })
    }
    if (session.status === "ended" && !doneFeedbackRounds.has(-1)) {
      setFeedbackFor({ round: session.scenario.rounds.length, isFinal: true })
    }
    prevRoundRef.current = idx
  }, [session?.currentRound, session?.status])

  useEffect(() => {
    return onEvent((e: LiveEvent) => {
      if (e.name === "push_inject" || e.name === "surprise_inject") {
        const inj = (e.payload as { inject?: Inject }).inject
        if (inj && (inj.urgency === "critical" || e.name === "surprise_inject")) setUrgent(inj)
        else if (inj) setBanner({ id: Date.now(), text: `New inject: ${inj.title}`, type: "inject" })
      } else if (e.name === "next_round") {
        const idx = (e.payload as { roundIndex?: number }).roundIndex
        if (typeof idx === "number") setBanner({ id: Date.now(), text: tr(lang, "round") + ` ${idx + 1} — ${session?.scenario.rounds[idx]?.title ?? ""}`, type: "round" })
      } else if (e.name === "start_session") {
        setBanner({ id: Date.now(), text: "Exercise started", type: "start" })
      } else if (e.name === "session_ended") {
        setBanner({ id: Date.now(), text: "Exercise ended", type: "end" })
      }
    })
  }, [onEvent, lang, session])

  useEffect(() => {
    if (!banner) return
    const t = setTimeout(() => setBanner(null), 5000)
    return () => clearTimeout(t)
  }, [banner])

  const currentRound = useMemo(() => {
    if (!session || session.currentRound < 0) return null
    return session.scenario.rounds[session.currentRound] ?? null
  }, [session])

  function handleFeedbackDone(fb: { worked: string; didnt: string; gap: string }) {
    if (!feedbackFor) return
    const key = feedbackFor.isFinal ? -1 : feedbackFor.round
    const next = new Set(doneFeedbackRounds).add(key)
    setDoneFeedbackRounds(next)
    try { localStorage.setItem(FEEDBACK_KEY, JSON.stringify([...next])) } catch {}
    setFeedbackFor(null)
  }

  if (!session) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
        <Empty>
          <ShieldAlert className="size-10 text-muted-foreground" />
          <h2 className="mt-4 text-xl font-semibold tracking-tight">{tr(lang, "waitingToStart")}</h2>
          <p className="mt-1 max-w-sm text-muted-foreground">
            {connected ? tr(lang, "waitingToStart") : "Connecting…"}
          </p>
          <Link href="/join" className="mt-6 inline-flex items-center gap-2 rounded-md border border-border bg-card px-4 py-2 font-mono text-xs uppercase tracking-wider text-foreground hover:bg-accent">
            <ArrowLeft className="size-3.5" /> Back
          </Link>
        </Empty>
      </div>
    )
  }

  const status = session.status

  return (
    <div className="min-h-screen bg-background">
      {/* Intro overlay */}
      {showIntro && session.status === "lobby" && (
        <IntroOverlay lang={lang} onReady={() => setShowIntro(false)} />
      )}

      {/* Feedback screen */}
      {feedbackFor && (
        <FeedbackScreen
          roundNumber={feedbackFor.round}
          totalRounds={session.scenario.rounds.length}
          isFinal={feedbackFor.isFinal}
          lang={lang}
          onContinue={handleFeedbackDone}
        />
      )}

      {/* HUD header */}
      <SessionHUD session={session} connected={connected} name={name} lang={lang} setLang={setLang} />

      {/* Round timer + inline banner zone */}
      {currentRound && (
        <div className="sticky top-[52px] z-30 bg-background/95 backdrop-blur border-b border-border">
          <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-2 md:px-8">
            <RoundTimerCompact
              roundStartedAt={session.roundStartedAt}
              timerMinutes={currentRound.timerMinutes ?? 10}
              status={status}
              lang={lang}
            />
            {banner && (
              <div className={`flex items-center gap-2 rounded-md px-3 py-1.5 border font-mono text-xs animate-fade-in ${
                banner.type === "round" ? "border-primary/30 bg-primary/10 text-primary" : "border-destructive/30 bg-destructive/10 text-destructive"
              }`}>
                <span className="size-1.5 rounded-full bg-current animate-pulse" />
                {banner.text}
              </div>
            )}
            <div className="ml-auto font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              {status === "lobby" ? tr(lang, "waitingToStart") :
               status === "ended" ? tr(lang, "exerciseEnded") :
               tr(lang, "roundOf", { n: String(session.currentRound + 1), total: String(session.scenario.rounds.length) })}
            </div>
          </div>
        </div>
      )}

      <main className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Feed — main column */}
          <div className="flex flex-col gap-5 lg:col-span-2">
            {/* Round situation */}
            {currentRound ? (
              <RoundSituationCard session={session} lang={lang} />
            ) : status === "lobby" ? (
              <div className="flex flex-col items-center gap-4 rounded-xl border border-border bg-card/50 py-12 text-center">
                <div className="flex gap-1.5">
                  {[0,1,2].map(i => <span key={i} className="size-2 rounded-full bg-primary/40 animate-pulse" style={{ animationDelay: `${i*0.3}s` }} />)}
                </div>
                <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">{tr(lang, "waitingToStart")}</p>
              </div>
            ) : (
              <div className="rounded-xl border border-border bg-card/50 py-8 text-center">
                <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">{tr(lang, "exerciseEnded")}</p>
              </div>
            )}

            {/* Inject feed */}
            <InjectFeed pushed={session.pushedInjects} lang={lang} />
          </div>

          {/* Sidebar */}
          <aside className="flex flex-col gap-4">
            {/* Players */}
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="border-b border-border px-4 py-2.5">
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{tr(lang, "players")}</span>
              </div>
              <ul className="flex flex-col divide-y divide-border max-h-48 overflow-y-auto">
                {session.participants.map((p) => (
                  <li key={p.id} className="flex items-center justify-between px-4 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className="size-6 rounded-full border border-border bg-background font-mono text-[9px] uppercase text-muted-foreground flex items-center justify-center">
                        {p.name.slice(0, 2)}
                      </div>
                      <span className="text-sm">{p.name}</span>
                    </div>
                    <span className="size-1.5 rounded-full bg-primary" />
                  </li>
                ))}
              </ul>
            </div>

            {/* Session info */}
            <div className="rounded-xl border border-border bg-card px-4 py-4 flex flex-col gap-3">
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{tr(lang, "eventLog")}</span>
              <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
                {[...session.timeline].reverse().slice(0, 20).map((ev) => (
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
          </aside>
        </div>
      </main>

      <UrgentInjectModal inject={urgent} onClose={() => setUrgent(null)} lang={lang} />
    </div>
  )
}
