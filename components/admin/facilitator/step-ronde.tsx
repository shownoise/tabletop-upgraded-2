"use client"

// Stap 2 — actieve ronde. Dit is het scherm dat tijdens een live sessie open
// staat, dus de volgorde is: welke ronde en fase, hoeveel tijd, wat is de
// beslisvraag, wie heeft al ingezonden. Lange tekstblokken (injectteksten,
// facilitatorsturing) staan ingeklapt of op de gereedschapsstap.

import Link from "next/link"
import { useMemo } from "react"
import { ArrowRight, ChevronLeft, Flag, Wrench } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GroupProgress } from "@/components/admin/group-progress"
import { LiveOverviewPanel } from "@/components/admin/live-overview-panel"
import { api } from "@/lib/api-client"
import { FACILITATOR_GUIDE } from "@/lib/config/texts"
import { tr, type Lang } from "@/lib/i18n"
import type { RoundPhase, SessionState } from "@/lib/types"
import { PhaseRetreatButton, PHASE_ORDER, type FacilitatorActions } from "./facilitator-shell"
import { RoleCoveragePanel } from "./role-coverage-panel"
import { roundSubmissionProgress } from "./round-submission-progress"
import { buildRoundReviews } from "./review-items"
import { MetricBlock, RoundTimer, SessionClock } from "./timers"
import { STEP_PATH } from "./steps"

export function StepRonde({
  session,
  lang,
  actions,
}: {
  session: SessionState
  lang: Lang
  actions: FacilitatorActions
}) {
  const currentIndex = session.currentRound
  const currentRound = currentIndex >= 0 ? session.scenario.rounds[currentIndex] : null
  const phase: RoundPhase = session.roundPhase ?? "inject"
  const isActive = session.status === "active"
  const isCoreEvent = session.mode === "event" && !!session.graph
  const totalRounds = session.graph
    ? session.graph.nodes.filter(n => n.type === "round").length
    : session.scenario.rounds.length

  // De beslisvraag komt uit dezelfde afleiding als de review, zodat facilitator
  // en deelnemer letterlijk dezelfde vraag voor zich hebben.
  const review = useMemo(
    () => (currentIndex >= 0 ? buildRoundReviews(session, { onlyRoundIndex: currentIndex })[0] : undefined),
    [session, currentIndex],
  )

  // Teller én noemer uit dezelfde afleiding als het live-overzicht. "0 ingediend"
  // zonder noemer zei niet of je op één of op acht inzendingen wachtte (#105 §7).
  const progress = roundSubmissionProgress(session)
  const flagsThisRound = (session.governanceFlags ?? []).filter(f => f.roundIndex === currentIndex).length

  if (!isActive) {
    return (
      <section className="rounded-xl border border-dashed border-border px-5 py-8 text-center">
        <p className="text-sm text-muted-foreground">
          Er loopt geen ronde. {session.status === "lobby"
            ? "De sessie staat nog in de lobby."
            : "De oefening is beëindigd."}
        </p>
        <Link
          href={session.status === "lobby" ? STEP_PATH.sessie : STEP_PATH.eindbespreking}
          className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-primary hover:bg-primary/20"
        >
          {session.status === "lobby" ? "Naar sessie en lobby" : "Naar eindbespreking"}
          <ArrowRight className="size-3" />
        </Link>
      </section>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* 1. Stand: ronde, fase, tijd. Alles in één rij, groot leesbaar. */}
      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
              Ronde {currentIndex + 1} van {totalRounds}
            </span>
            <h2 className="text-xl font-semibold tracking-tight text-foreground">
              {currentRound?.title ?? `Ronde ${currentIndex + 1}`}
            </h2>
          </div>
          <div className="flex flex-wrap items-end gap-6">
            <MetricBlock label={tr(lang, "sessionTimer")}>
              <SessionClock startedAt={session.startedAt ?? session.createdAt} />
            </MetricBlock>
            <MetricBlock
              label={tr(lang, "roundTimer")}
              hint={currentRound?.timerMinutes ? `${currentRound.timerMinutes} min per ronde` : undefined}
            >
              <RoundTimer
                roundStartedAt={session.roundStartedAt}
                timerMinutes={currentRound?.timerMinutes ?? 10}
              />
            </MetricBlock>
            <MetricBlock
              label="Ingezonden deze ronde"
              hint={progress.missingRoles.length > 0
                ? `nog wachten op ${progress.missingRoles.length} ${progress.missingRoles.length === 1 ? "rol" : "rollen"}`
                : undefined}
            >
              <span className="font-mono text-3xl font-bold tabular-nums text-foreground">
                {progress.submitted}
                {progress.expected != null && (
                  <span className="text-base font-normal text-muted-foreground"> van {progress.expected}</span>
                )}
              </span>
            </MetricBlock>
          </div>
        </div>

        {/* Fasebalk */}
        <div className="mt-5 flex items-end gap-3">
          <div className="flex flex-1 items-center gap-2">
            {PHASE_ORDER.map((p, i) => {
              const phaseIdx = PHASE_ORDER.indexOf(phase)
              return (
                <div key={p} className="flex flex-1 flex-col items-center gap-1">
                  <div
                    className={`h-1 w-full rounded-full transition-all ${
                      i < phaseIdx ? "bg-primary" : i === phaseIdx ? "bg-primary/60" : "bg-border"
                    }`}
                  />
                  <span
                    className={`font-mono text-[9px] uppercase tracking-wider ${
                      i === phaseIdx
                        ? "font-bold text-primary"
                        : i > phaseIdx
                          ? "text-muted-foreground/50"
                          : "text-muted-foreground"
                    }`}
                  >
                    {tr(lang, `phase_${p}` as Parameters<typeof tr>[1])}
                  </span>
                </div>
              )
            })}
          </div>
          {!isCoreEvent && (
            <div className="flex items-center gap-2">
              {/* Terug naar de vorige ronde. Niet in Partner Event: daar loopt de
                  graph vooruit en is terugspoelen geen geldige overgang. */}
              <Button
                size="sm"
                variant="outline"
                onClick={() => actions.run("prev", () => api.prevRound())}
                disabled={actions.working !== null || currentIndex <= 0}
                className="gap-1.5 font-mono text-[10px] uppercase tracking-wider"
              >
                <ChevronLeft className="size-3" /> {tr(lang, "prevRound")}
              </Button>
              <PhaseRetreatButton session={session} actions={actions} />
            </div>
          )}
        </div>

        {/* Rondevoortgang */}
        {totalRounds > 0 && (
          <div className="mt-4 flex gap-1">
            {Array.from({ length: totalRounds }, (_, i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full transition-all ${
                  i < currentIndex ? "bg-primary" : i === currentIndex ? "bg-primary/50" : "bg-border"
                }`}
              />
            ))}
          </div>
        )}
      </section>

      {/* 2. De beslisvraag van deze ronde — boven elk ander tekstblok. */}
      <section className="rounded-xl border-l-[3px] border-primary border-y border-r border-y-border border-r-border bg-card px-5 py-4">
        <p className="font-mono text-[10px] uppercase tracking-wider text-primary">
          Beslisvraag van deze ronde
        </p>
        <p className="mt-1.5 text-base leading-snug text-foreground">
          {review?.question ?? currentRound?.title ?? "Deze ronde heeft geen geschreven beslisvraag."}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Link
            href={STEP_PATH.review}
            className="inline-flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-primary hover:bg-primary/20"
          >
            Naar review <ArrowRight className="size-3" />
          </Link>
          {flagsThisRound > 0 && (
            <span className="rounded-full border border-destructive/40 bg-destructive/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-destructive">
              {flagsThisRound} {flagsThisRound === 1 ? "signaal" : "signalen"}
            </span>
          )}
          <Link
            href={STEP_PATH.gereedschap}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
          >
            <Wrench className="size-3" /> Injects en specials
          </Link>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <LiveOverviewPanel session={session} />
          <RoleCoveragePanel session={session} collapsible />

          {/* BOB-hint: statisch, alleen tijdens discussie. */}
          {!isCoreEvent && phase === "discussion" && (
            <div className="rounded-xl border border-primary/20 bg-primary/5 px-5 py-3">
              <span className="font-mono text-[10px] uppercase tracking-widest text-primary">Discussie</span>
              <p className="mt-1 font-mono text-xs leading-relaxed text-muted-foreground">
                {FACILITATOR_GUIDE.bobHint}
              </p>
            </div>
          )}
        </div>

        <aside className="flex flex-col gap-4">
          {session.graph && session.mode === "event" && <GroupProgress session={session} />}

          {/* Facilitatorsturing — ingeklapt. Dit is het langste tekstblok van de
              stap en mocht de beslisvraag niet meer wegdrukken. */}
          {!isCoreEvent && currentRound?.facilitatorNotes && (
            <details className="group rounded-xl border border-primary/30 bg-primary/5">
              <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-primary">
                <span className="flex items-center gap-2">
                  <Flag className="size-3" /> Facilitatorsturing — ronde {currentIndex + 1}
                </span>
                <span className="text-[8px] opacity-60 group-open:hidden">▶</span>
                <span className="hidden text-[8px] opacity-60 group-open:inline">▼</span>
              </summary>
              <div className="flex flex-col gap-3 px-4 pb-4">
                <div className="flex flex-col gap-1">
                  <span className="font-mono text-[9px] uppercase tracking-widest text-primary">Discussiedoel</span>
                  <p className="text-xs leading-relaxed text-foreground">
                    {currentRound.facilitatorNotes.discussionGoal}
                  </p>
                </div>
                {currentRound.facilitatorNotes.keyQuestions?.length > 0 && (
                  <div className="flex flex-col gap-1">
                    <span className="font-mono text-[9px] uppercase tracking-widest text-primary">Stuurvragen</span>
                    <ul className="flex flex-col gap-1">
                      {currentRound.facilitatorNotes.keyQuestions.map((q, i) => (
                        <li key={i} className="flex gap-1.5 text-xs leading-relaxed text-muted-foreground">
                          <span className="shrink-0 text-primary">?</span>
                          {q}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {currentRound.facilitatorNotes.redFlags?.length > 0 && (
                  <div className="flex flex-col gap-1">
                    <span className="font-mono text-[9px] uppercase tracking-widest text-destructive">Let op</span>
                    <ul className="flex flex-col gap-1">
                      {currentRound.facilitatorNotes.redFlags.map((f, i) => (
                        <li key={i} className="flex gap-1.5 text-xs leading-relaxed text-muted-foreground">
                          <span className="shrink-0 text-destructive">!</span>
                          {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {currentRound.facilitatorNotes.hints?.length > 0 && (
                  <div className="flex flex-col gap-1 border-t border-primary/20 pt-2">
                    <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Tips</span>
                    <ul className="flex flex-wrap gap-1.5">
                      {currentRound.facilitatorNotes.hints.map((h, i) => (
                        <li key={i} className="rounded border border-border bg-background px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
                          {h}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </details>
          )}
        </aside>
      </div>
    </div>
  )
}
