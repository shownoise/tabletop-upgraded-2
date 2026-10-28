"use client"

// De omlijsting om elke stap: wie ben ik, waar sta ik, en wat is de volgende
// zet. Alles wat niet over de stap zelf gaat — join-code, status, de primaire
// knop, de stapnavigatie — staat hier één keer in plaats van vier keer.

import Link from "next/link"
import {
  ArrowLeft, ChevronLeft, ChevronRight, Copy, CheckCircle, FileText, HelpCircle,
  Monitor, Play, Settings, Square, Wifi, WifiOff, Wrench,
} from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { LangToggle } from "@/components/lang-toggle"
import { ThemeToggle } from "@/components/theme-toggle"
import { GuidedTour } from "@/components/shared/guided-tour"
import { TOURS } from "@/lib/guided-tour-steps"
import { describeNextAction } from "@/lib/session-next-action"
import { api } from "@/lib/api-client"
import { tr, ESCALATION_KEYS, type Lang } from "@/lib/i18n"
import type { RoundPhase, SessionState } from "@/lib/types"
import { MAIN_STEPS, STEP_HEADING, STEP_LABEL, STEP_PATH, type FacilitatorStep } from "./steps"

export const PHASE_ORDER: RoundPhase[] = ["inject", "discussion", "decision", "review"]

export interface FacilitatorActions {
  working: string | null
  run: (label: string, fn: () => Promise<unknown>) => Promise<void>
  startSession: () => void
  endExercise: () => void
  destroySession: () => void
}

const ESCALATION_CLASSES = [
  "border-border text-muted-foreground",
  "border-amber-500/40 text-amber-600",
  "border-orange-500/40 text-orange-600",
  "border-destructive/40 text-destructive",
]

export function FacilitatorShell({
  session,
  connected,
  step,
  lang,
  setLang,
  actions,
  error,
  children,
}: {
  session: SessionState
  connected: boolean
  step: FacilitatorStep
  lang: Lang
  setLang: (l: Lang) => void
  actions: FacilitatorActions
  error: string | null
  children: React.ReactNode
}) {
  const [copied, setCopied] = useState(false)
  const [tourOpen, setTourOpen] = useState(false)
  const status = session.status
  const isActive = status === "active"
  const isLobby = status === "lobby"
  const isEnded = status === "ended"
  const currentIndex = session.currentRound
  const totalRounds = session.graph
    ? session.graph.nodes.filter(n => n.type === "round").length
    : session.scenario.rounds.length
  const escalationIndex = Math.min(Math.max(currentIndex, 0), 3)
  const currentPhase: RoundPhase = session.roundPhase ?? "inject"

  async function copyJoinCode() {
    try {
      await navigator.clipboard.writeText(session.joinCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-5 py-3 md:px-8">
          <div className="flex items-center gap-3">
            <Link href="/admin/clients" title="Terug naar klanten" className="flex size-8 items-center justify-center rounded-md border border-border bg-card text-muted-foreground hover:text-foreground">
              <ArrowLeft className="size-4" />
            </Link>
            <div className="flex flex-col">
              <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">{tr(lang, "facilitatorConsole")}</span>
              <span className="max-w-[200px] truncate font-mono text-sm text-foreground md:max-w-none">{session.scenario.scenario_title}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Modus is vastgesteld bij het aanmaken van de sessie — read-only. */}
            <div
              title="Modus is vastgesteld bij aanmaken van de sessie"
              className="hidden items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-primary md:flex"
            >
              {session.mode === "event" ? tr(lang, "mode_event") : tr(lang, "mode_training")}
            </div>
            {isActive && (
              <div className={`hidden items-center rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider md:flex ${ESCALATION_CLASSES[escalationIndex]}`}>
                {tr(lang, ESCALATION_KEYS[escalationIndex])}
              </div>
            )}
            <div className={`flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-xs uppercase tracking-wider ${
              isActive ? "border-primary/40 bg-primary/10"
              : isEnded ? "border-destructive/40 bg-destructive/10"
              : "border-border bg-card"
            }`}>
              <span className={`size-1.5 rounded-full ${isActive ? "bg-primary pulse-ring" : isEnded ? "bg-destructive" : "bg-muted-foreground"}`} />
              {isLobby ? tr(lang, "lobby") : isActive ? tr(lang, "live") : tr(lang, "ended")}
            </div>
            <div className={`flex items-center gap-1.5 rounded-full border px-2 py-1 ${connected ? "border-border bg-card" : "border-destructive/40 bg-destructive/10"}`}>
              {connected ? <Wifi className="size-3 text-primary" /> : <WifiOff className="size-3 text-destructive" />}
            </div>
            <LangToggle lang={lang} setLang={setLang} />
            <ThemeToggle />
            {/* Rondleiding over het dashboard: dimt en vervaagt alles behalve
                één stap, met een pijl en een toelichting. Dezelfde component
                als bij de deelnemer. */}
            <button
              type="button"
              onClick={() => setTourOpen(true)}
              title="Hoe werkt dit dashboard?"
              className="flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"
            >
              <HelpCircle className="size-3.5" />
              Uitleg
            </button>
            <Link
              href="/admin/present"
              className="flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"
              title="Groot scherm — voor de zaal"
            >
              <Monitor className="size-3.5" />
              Groot scherm
            </Link>
            {/* Vanaf hier was Beheer niet te bereiken: deze header heeft zijn
                eigen navigatie, en de terugpijl gaat naar de klanten. Je zat
                dus tijdens een sessie vast zonder weg naar instellingen,
                gebruikers of opslag. */}
            <Link
              href="/admin/settings"
              className="flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"
              title="Instellingen, gebruikers en opslag"
            >
              <Settings className="size-3.5" />
              Beheer
            </Link>
          </div>
        </div>

        {/* Stapnavigatie — de hoofdflow, plus rapport en gereedschap apart. */}
        <nav aria-label="Stappen" className="mx-auto flex max-w-7xl flex-wrap items-center gap-1.5 px-5 pb-3 md:px-8">
          {MAIN_STEPS.map((s, i) => {
            const active = s === step
            return (
              <Link
                key={s}
                href={STEP_PATH[s]}
                data-tour={`facilitator-stap-${s}`}
                aria-current={active ? "step" : undefined}
                className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider transition-colors ${
                  active
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-card text-muted-foreground hover:text-foreground"
                }`}
              >
                <span className="opacity-60">{i + 1}</span>
                {STEP_LABEL[s]}
              </Link>
            )
          })}
          <span aria-hidden className="mx-1 hidden h-5 w-px bg-border md:block" />
          <Link
            href="/admin/report"
            className="flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/10 px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-primary transition-colors hover:bg-primary/20"
          >
            <FileText className="size-3.5" /> Rapport
          </Link>
          {/* Zelfde rapport in een nieuw tabblad — bleef nodig voor wie het
              rapport naast het dashboard open wil houden tijdens het nagesprek. */}
          <a
            href="/admin/report/current"
            target="_blank"
            rel="noreferrer"
            title="Rapport in nieuw tabblad"
            className="flex items-center rounded-md border border-border bg-card px-2 py-1.5 font-mono text-[11px] uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"
          >
            ↗
          </a>
          <Link
            href={STEP_PATH.gereedschap}
            data-tour="facilitator-stap-gereedschap"
            aria-current={step === "gereedschap" ? "step" : undefined}
            className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider transition-colors ${
              step === "gereedschap"
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-card text-muted-foreground hover:text-foreground"
            }`}
          >
            <Wrench className="size-3.5" /> {STEP_LABEL.gereedschap}
          </Link>
        </nav>
      </header>

      {/* Commandobalk — join-code, stand, en de enige primaire knop. */}
      <div className="border-b border-border bg-card/60">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-3 px-5 py-3 md:px-8">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">{tr(lang, "joinCodeLabel")}</span>
            <span className="font-mono text-xl font-bold tracking-[0.2em] text-primary">{session.joinCode}</span>
            <button
              onClick={copyJoinCode}
              title="Join-code kopiëren"
              className="rounded-md border border-border bg-background p-1.5 text-muted-foreground transition-colors hover:text-foreground"
            >
              {copied ? <CheckCircle className="size-3.5 text-primary" /> : <Copy className="size-3.5" />}
            </button>
          </div>
          <span className="font-mono text-xs text-muted-foreground">
            {isLobby
              ? tr(lang, "waitingToStartAdmin")
              : isActive
                ? tr(lang, "roundProgress", { n: String(currentIndex + 1), total: String(totalRounds) })
                : tr(lang, "exerciseComplete")}
          </span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {isLobby && (
              <Button
                size="sm"
                onClick={actions.startSession}
                disabled={actions.working !== null}
                className="gap-2 font-mono uppercase tracking-wider"
              >
                <Play className="size-3.5" />{tr(lang, "startSession")}
              </Button>
            )}
            {isActive && <NextActionButton session={session} actions={actions} currentPhase={currentPhase} />}
            {!isEnded && (
              <Button
                size="sm"
                variant="outline"
                onClick={actions.endExercise}
                disabled={actions.working !== null}
                className="gap-2 font-mono uppercase tracking-wider"
                title="Beëindig de oefening nu — deelnemers krijgen hun eindscherm, de sessie blijft bewaard"
              >
                <Square className="size-3.5" />Beëindig oefening
              </Button>
            )}
          </div>
        </div>
      </div>

      <main data-facilitator-step={step} className="mx-auto flex max-w-7xl flex-col gap-6 px-5 py-6 md:px-8 md:py-8">
        {/* Eén kop per stap, uit STEP_HEADING. Uniek per stap, zodat live te
            controleren is op welke stap je staat zonder de navigatie te lezen. */}
        <h1 className="font-mono text-sm uppercase tracking-wider text-muted-foreground">
          {STEP_HEADING[step]}
        </h1>
        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive-foreground">{error}</div>
        )}
        {children}
      </main>

      <GuidedTour tour={TOURS.facilitator} open={tourOpen} onClose={() => setTourOpen(false)} />
    </div>
  )
}

// De volgende zet in de flow. Eén knop, want twee knoppen naast elkaar leverde
// live de vraag op welke van de twee de ronde afsloot.
function NextActionButton({
  session,
  actions,
  currentPhase,
}: {
  session: SessionState
  actions: FacilitatorActions
  currentPhase: RoundPhase
}) {
  const next = describeNextAction(session)
  const isEnd = next.action === "end_session"
  const isBlocked = next.action === "blocked"

  // Een uitgeschakelde primaire knop was een dood einde. Live gereproduceerd:
  // in de beslissingsfase stond er "Nog wachten op 4 beslissingen", grijs, met
  // de reden alleen in een tooltip, en de uitweg was een ándere knop die zich
  // niet als uitweg aankondigde. Bij een solo- of onderbezet team is dat
  // permanent de toestand, want die inzendingen komen nooit.
  //
  // Dus: zolang er inzendingen missen is de primaire actie "Beslissing
  // afsluiten". Die zet onbeantwoorde rollen op een impliciete "geen besluit"
  // met de reden erbij, waarna de knop gewoon "Volgende fase: Review" wordt.
  // Twee klikken, maar elke klik is betekenisvol en terug kan via Vorige fase.
  if (isBlocked) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        {next.blockedReason && (
          <span className="max-w-xs text-right text-[11px] leading-snug text-amber-700 dark:text-amber-400">
            {next.blockedReason}
          </span>
        )}
        <Button
          size="sm"
          onClick={() => actions.run("finalize", () => api.forceLock())}
          disabled={actions.working !== null}
          className="gap-1.5 border-amber-500/40 font-mono uppercase tracking-wider"
          title="Onbeantwoorde rollen krijgen 'geen besluit' met de reden erbij; daarna kun je naar de review"
        >
          Beslissing afsluiten
          <ChevronRight className="size-3.5" />
        </Button>
      </div>
    )
  }

  return (
    <Button
      size="sm"
      onClick={() => {
        if (next.action === "advance_phase") {
          const idx = Math.min(PHASE_ORDER.indexOf(currentPhase) + 1, PHASE_ORDER.length - 1)
          return actions.run("phase", () => api.setPhase(PHASE_ORDER[idx]))
        }
        if (next.action === "next_round" || next.action === "end_session") {
          return actions.run("next", () => api.nextRound())
        }
      }}
      disabled={actions.working !== null}
      className="gap-1.5 font-mono uppercase tracking-wider"
      title={next.labelNL}
    >
      {isEnd ? <Square className="size-3.5" /> : null}
      {next.labelNL}
      {!isEnd ? <ChevronRight className="size-3.5" /> : null}
    </Button>
  )
}

// Terug-knop voor de fase, alleen buiten Partner Event. Staat op de
// rondestap omdat hij bij de fase hoort, niet bij de sessie.
export function PhaseRetreatButton({
  session,
  actions,
}: {
  session: SessionState
  actions: FacilitatorActions
}) {
  const currentPhase: RoundPhase = session.roundPhase ?? "inject"
  const idx = PHASE_ORDER.indexOf(currentPhase)
  return (
    <Button
      size="sm"
      variant="outline"
      onClick={() => { if (idx > 0) actions.run("phase", () => api.setPhase(PHASE_ORDER[idx - 1])) }}
      disabled={actions.working !== null || idx <= 0}
      className="gap-1.5 font-mono text-[10px] uppercase tracking-wider"
    >
      <ChevronLeft className="size-3" /> Vorige fase
    </Button>
  )
}
