"use client"

import Link from "next/link"
import { Component, useCallback, useEffect, useMemo, useState } from "react"
import type { ReactNode } from "react"
import { ArrowLeft, ShieldAlert } from "lucide-react"
import { useSessionStream } from "@/lib/use-session-stream"
import type { Inject, LiveEvent, Role, SubmittedDecision } from "@/lib/types"
import { analyzeGraph } from "@/lib/graph/analyze"
import { api } from "@/lib/api-client"
import { roleCoverageInUse } from "@/lib/session-roles"
import { InjectFeed } from "./inject-feed"
import { TeamPicker } from "./team-picker"
import { AchievementsToaster } from "./achievements"
import { UrgentInjectModal } from "./urgent-inject-modal"
import { RoundTimerCompact, useDeadlineLabel } from "./round-timer"
import { SessionHUD } from "./session-hud"
import { SessionClosing } from "./session-closing"
import { DecisionPanel } from "./decision-panel"
import { RegulatoryNotificationButton } from "./regulatory-notification-button"
import { SpecialModal } from "./special-modal"
import { Empty } from "@/components/ui/empty"
import { useLang } from "@/lib/use-lang"
import { tr } from "@/lib/i18n"
import { playNotificationSound } from "@/lib/sounds"
import { activeRoleView } from "./steps/active-role"
import {
  clampStep,
  highestOpenStep,
  landingStep,
  phaseKey,
  type FlowInput,
  type StepId,
} from "./steps/flow"
import { mandateView } from "./steps/mandate"
import { Onboarding } from "./steps/onboarding"
import { StepShell, type StepPrimary } from "./steps/step-shell"
import { StepWelcome } from "./steps/step-welcome"
import { StepDiscussion, StepRound } from "./steps/step-round"
import { StepChoice } from "./steps/step-choice"
import { StepReview } from "./steps/step-review"

// De deelnemersconsole. Eén scherm per stap, zeven stappen, en de stap volgt de
// fase die de facilitator zet.
//
// Dit bestand was 1442 regels met alle panelen van alle fasen tegelijk in beeld
// (issue #105 §2). Het is nu alleen nog de router: het leidt de rol en de stap
// af en kiest welk stapscherm aan de beurt is. De inhoud van de stappen staat
// in `./steps/`.

const NAME_KEY = "ctt:name"
const ID_KEY = "ctt:participantId"
// Welke van de eigen rollen actief is. Nadrukkelijk een *voorkeur*: de rollen
// zelf komen uit de serverstate via `activeRoleView()`. Zie steps/active-role.ts
// voor waarom (issue #105 §1).
const ROLE_PREFERENCE_KEY = "ctt:activeRole"

class DecisionBoundary extends Component<{ children: ReactNode }, { crashed: boolean }> {
  state = { crashed: false }
  static getDerivedStateFromError() { return { crashed: true } }
  render() {
    if (this.state.crashed) return (
      <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-4 text-center font-mono text-xs text-destructive">
        De keuzekaart kon niet laden — ververs de pagina.
      </p>
    )
    return this.props.children
  }
}

export function PlayView() {
  const [lang] = useLang()
  const { state, connected, expired, onEvent } = useSessionStream()

  // Terug naar /join als de sessie verdwijnt of de deelname verloopt.
  useEffect(() => {
    if (!expired) return
    try { localStorage.removeItem(ID_KEY) } catch { /* noop */ }
    window.location.replace("/join")
  }, [expired])

  const [name, setName] = useState<string | null>(null)
  const [participantId, setParticipantId] = useState<string | null>(null)
  const [rolePreference, setRolePreference] = useState<Role | null>(null)
  useEffect(() => {
    try {
      setName(window.localStorage.getItem(NAME_KEY))
      setParticipantId(window.localStorage.getItem(ID_KEY))
      setRolePreference(window.sessionStorage.getItem(ROLE_PREFERENCE_KEY) as Role | null)
    } catch { /* noop */ }
  }, [])

  const session = state.session

  // ── Onboarding ───────────────────────────────────────────────────────
  // Eén keer per sessie, ook voor wie later binnenkomt.
  const [showOnboarding, setShowOnboarding] = useState(false)
  const onboardingKey = session?.id ? `ctt:onboarding:${session.id}` : null
  useEffect(() => {
    if (!onboardingKey) return
    try { setShowOnboarding(!localStorage.getItem(onboardingKey)) } catch { setShowOnboarding(true) }
  }, [onboardingKey])
  const dismissOnboarding = useCallback(() => {
    setShowOnboarding(false)
    if (onboardingKey) { try { localStorage.setItem(onboardingKey, "1") } catch { /* noop */ } }
  }, [onboardingKey])

  // ── Rol en mandaat, uit de serverstate ───────────────────────────────
  const roles = useMemo(
    () => activeRoleView(session, participantId, rolePreference),
    [session, participantId, rolePreference],
  )
  const mandate = useMemo(
    () => (session ? mandateView(session, participantId) : null),
    [session, participantId],
  )

  // ── Stap ─────────────────────────────────────────────────────────────
  // Event-modus kent het teamdevice: niemand claimt een rol en dat ene tablet
  // speelt namens álle rollen. Zo'n device heeft wél recht om door te spelen en
  // mag dus niet op stap 1 blijven hangen. Zelfde regel als `roleCoverageInUse`
  // op de server: zodra iemand wél een rol claimt geldt de echte dekking.
  const hasStanding = roles.hasRole
    || (session?.mode === "event" && !!participantId && !roleCoverageInUse(session))

  const flow: FlowInput = {
    status: session?.status ?? "lobby",
    roundPhase: session?.roundPhase,
    currentRound: session?.currentRound ?? -1,
    hasRole: hasStanding,
  }
  const highest = highestOpenStep(flow)
  const landing = landingStep(flow)
  const key = phaseKey(flow)

  // Terugbladeren mag; zodra de facilitator de fase verzet springt het scherm
  // naar de nieuwe landingsstap in plaats van op een oude stap te blijven staan.
  const [desired, setDesired] = useState<StepId | null>(null)
  useEffect(() => { setDesired(null) }, [key])
  const step = clampStep(desired ?? landing, highest)

  // ── Live meldingen ───────────────────────────────────────────────────
  const [urgent, setUrgent] = useState<Inject | null>(null)
  const [banner, setBanner] = useState<{ id: number; text: string; type?: string } | null>(null)
  const [specialDismissed, setSpecialDismissed] = useState<Set<string>>(new Set())
  const [timerPaused, setTimerPaused] = useState(false)
  const [soundMutedState, setSoundMutedState] = useState(() => {
    if (typeof window === "undefined") return false
    try { return localStorage.getItem("ctt:sound_muted") === "true" } catch { return false }
  })
  // De eventlistener wordt één keer opgezet, dus de mute-stand komt uit
  // localStorage in plaats van uit een closure die bij de eerste render hoort.
  const isMuted = () => {
    try { return localStorage.getItem("ctt:sound_muted") === "true" } catch { return false }
  }

  const activeSpecial = useMemo(() => {
    if (!participantId || !session) return null
    return (session.specialEvents ?? []).find(
      sp => sp.assignedParticipantId === participantId && !specialDismissed.has(sp.id),
    ) ?? null
  }, [session, participantId, specialDismissed])

  useEffect(() => {
    return onEvent((e: LiveEvent) => {
      const ping = (kind: "inject" | "urgent" | "round") => {
        if (!isMuted()) playNotificationSound(kind)
      }
      if (e.name === "special_triggered") {
        ping("inject")
        setBanner({ id: Date.now(), text: "Er is een speciaal event getriggerd", type: "special" })
      } else if (e.name === "push_inject" || e.name === "surprise_inject") {
        const inj = (e.payload as { inject?: Inject }).inject
        if (inj && (inj.urgency === "critical" || e.name === "surprise_inject")) {
          ping("urgent")
          setUrgent(inj)
        } else if (inj) {
          ping("inject")
          setBanner({ id: Date.now(), text: `Nieuw bericht: ${inj.title}`, type: "inject" })
        }
      } else if (e.name === "next_round") {
        const idx = (e.payload as { roundIndex?: number }).roundIndex
        ping("round")
        if (typeof idx === "number") {
          setBanner({ id: Date.now(), text: `Ronde ${idx + 1} is geopend`, type: "round" })
        }
      } else if (e.name === "start_session") {
        ping("round")
        setBanner({ id: Date.now(), text: "Oefening gestart", type: "start" })
      } else if (e.name === "session_ended") {
        setBanner({ id: Date.now(), text: "Oefening afgerond", type: "end" })
      }
    })
  }, [onEvent])

  useEffect(() => {
    if (!banner) return
    const t = setTimeout(() => setBanner(null), 5000)
    return () => clearTimeout(t)
  }, [banner])

  const [slowLoad, setSlowLoad] = useState(false)
  useEffect(() => {
    if (session) return
    const t = setTimeout(() => setSlowLoad(true), 4000)
    return () => clearTimeout(t)
  }, [session])

  const [readyBusy, setReadyBusy] = useState(false)
  async function markReady() {
    if (!participantId || readyBusy) return
    setReadyBusy(true)
    try { await api.markReady(participantId) } catch { /* de lobby leest de serverstate */ }
    setReadyBusy(false)
  }

  const currentRound = session && session.currentRound >= 0
    ? session.scenario.rounds[session.currentRound] ?? null
    : null
  const deadline = useDeadlineLabel(
    session?.roundStartedAt,
    currentRound?.timerMinutes ?? 10,
    session?.status ?? "lobby",
  )

  if (!session) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
        <Empty>
          <ShieldAlert className="size-10 text-muted-foreground" />
          <h2 className="mt-4 text-xl font-semibold tracking-tight">
            {connected ? tr(lang, "waitingToStart") : "Verbinding maken…"}
          </h2>
          <p className="mt-1 max-w-sm text-muted-foreground">
            {slowLoad
              ? "Duurt langer dan verwacht. Controleer je verbinding."
              : connected
                ? "Wacht tot de facilitator de oefening start."
                : "Verbinding met server…"}
          </p>
          {slowLoad && (
            <button
              onClick={() => window.location.reload()}
              className="mt-4 inline-flex items-center gap-2 rounded-md border border-border bg-card px-4 py-2 font-mono text-xs uppercase tracking-wider text-foreground hover:bg-accent"
            >
              Pagina vernieuwen
            </button>
          )}
          <Link href="/join" className="mt-3 inline-flex items-center gap-2 rounded-md border border-border bg-card px-4 py-2 font-mono text-xs uppercase tracking-wider text-foreground hover:bg-accent">
            <ArrowLeft className="size-3.5" /> Terug
          </Link>
        </Empty>
      </div>
    )
  }

  const status = session.status
  // scenario.rounds groeit per ronde en is dus nooit het totaal.
  const totalRounds = session.totalRounds
    ?? (session.graph ? analyzeGraph(session.graph).roundCount : session.scenario.rounds.length)
  const me = participantId ? session.participants.find(p => p.id === participantId) : undefined
  const needsTeam = session.mode === "event" && me && !me.groupId

  // Eén primaire actie per stap. Bij het wachten op de facilitator is er geen.
  let primary: StepPrimary | undefined
  let note: string | undefined

  if (step === "welkom" && status === "lobby") {
    if (!hasStanding) {
      note = "Kies hierboven een rol. Daarna kun je je klaarmelden."
    } else if (me?.readyAt) {
      note = "Je bent klaargemeld. De facilitator start de oefening."
    } else {
      primary = { label: "Ik ben klaar", onClick: markReady, busy: readyBusy }
    }
  } else if (step === highest) {
    note = status === "ended"
      ? "Dit is het einde van de oefening."
      : "De facilitator zet de volgende stap open."
  }

  const content = (() => {
    switch (step) {
      case "welkom":
        return (
          <StepWelcome
            session={session}
            participantId={participantId}
            view={roles}
            mandatedRoles={mandate?.mandate.mandatedRoles ?? []}
            canPickRole={session.mode !== "event"}
            onPreferRole={role => {
              setRolePreference(role)
              try { window.sessionStorage.setItem(ROLE_PREFERENCE_KEY, role) } catch { /* noop */ }
            }}
          />
        )

      case "ronde":
        return (
          <StepRound
            round={currentRound}
            roundNumber={session.currentRound + 1}
            totalRounds={session.mode === "event" ? 0 : totalRounds}
            mandate={mandate}
            deadline={deadline}
          />
        )

      case "injects":
        return (
          <>
            <InjectFeed
              pushed={session.pushedInjects}
              lang={lang}
              participantRole={roles.active}
              extraRoles={roles.all}
              participants={session.participants}
              session={session}
              participantId={participantId ?? undefined}
            />
            {participantId && <RegulatoryNotificationButton session={session} participantId={participantId} />}
          </>
        )

      case "overleg":
        return (
          <>
            <StepDiscussion round={currentRound} mandate={mandate} deadline={deadline} />
            {participantId && <RegulatoryNotificationButton session={session} participantId={participantId} />}
          </>
        )

      case "keuze":
        return (
          <DecisionBoundary>
            {session.graph ? (
              <StepChoice
                session={session}
                participantId={participantId}
                participantName={name ?? ""}
                view={mandate}
                deadline={deadline}
              />
            ) : currentRound?.roleActions && participantId ? (
              // Sessies zonder scenariograph hebben geen `activeDecision`; daar
              // zijn de rolacties van de ronde het beslismoment.
              <DecisionPanel
                key={`decision-${session.currentRound}-${roles.active ?? "none"}`}
                roundIndex={session.currentRound}
                roundActions={currentRound.roleActions}
                participantId={participantId}
                participantName={name ?? ""}
                participantRole={roles.active}
                isEventMode={session.mode === "event"}
                existingDecision={(session.submittedDecisions ?? []).find(
                  d => d.participantId === participantId && d.roundIndex === session.currentRound,
                ) as SubmittedDecision | undefined}
                lang={lang}
              />
            ) : (
              <p className="rounded-lg border border-dashed border-border bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
                Voor deze ronde staat geen keuze open.
              </p>
            )}
          </DecisionBoundary>
        )

      case "review":
        return <StepReview session={session} participantId={participantId} view={mandate} />

      case "afronding":
        return (
          <SessionClosing
            session={session}
            closing={session.participantClosing}
            participantId={participantId}
          />
        )
    }
  })()

  return (
    <div className="min-h-screen bg-background">
      {needsTeam && participantId && (
        <TeamPicker session={session} participantId={participantId} onJoined={() => { /* de stream levert groupId */ }} />
      )}
      {participantId && <AchievementsToaster session={session} participantId={participantId} />}
      {showOnboarding && status !== "ended" && <Onboarding onDone={dismissOnboarding} />}
      {session.mode !== "event" && activeSpecial && participantId && (
        <SpecialModal
          special={activeSpecial}
          participantId={participantId}
          onClose={() => setSpecialDismissed(prev => new Set(prev).add(activeSpecial.id))}
        />
      )}

      <SessionHUD session={session} connected={connected} name={name} participantRole={roles.active} lang={lang} />

      {currentRound && status !== "ended" && (
        <div className="sticky top-[var(--ctt-hud-h,57px)] z-30 border-b border-border bg-background/95 backdrop-blur">
          <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-2">
            <RoundTimerCompact
              roundStartedAt={session.roundStartedAt}
              timerMinutes={currentRound.timerMinutes ?? 10}
              status={status}
              lang={lang}
              paused={session.roundPhase === "discussion" ? timerPaused : undefined}
              onTogglePause={session.roundPhase === "discussion" ? () => setTimerPaused(p => !p) : undefined}
            />
            {banner && (
              <div className="flex items-center gap-2 rounded-md border border-primary/30 bg-primary/10 px-3 py-1.5 font-mono text-xs text-primary">
                <span className="size-1.5 animate-pulse rounded-full bg-current" />
                {banner.text}
              </div>
            )}
            <button
              onClick={() => {
                const next = !soundMutedState
                setSoundMutedState(next)
                try { localStorage.setItem("ctt:sound_muted", next ? "true" : "false") } catch { /* noop */ }
              }}
              title={soundMutedState ? "Geluid inschakelen" : "Geluid uitschakelen"}
              aria-label={soundMutedState ? "Geluid inschakelen" : "Geluid uitschakelen"}
              aria-pressed={soundMutedState}
              className="ml-auto shrink-0 border border-border px-2 py-1 font-mono text-[9px] uppercase tracking-widest text-muted-foreground hover:text-foreground"
            >
              {soundMutedState ? "🔇" : "🔔"}
            </button>
          </div>
        </div>
      )}

      <main className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-8">
        <StepShell step={step} highest={highest} onGo={setDesired} primary={primary} note={note}>
          {content}
        </StepShell>
      </main>

      <UrgentInjectModal inject={urgent} onClose={() => setUrgent(null)} lang={lang} />
    </div>
  )
}
