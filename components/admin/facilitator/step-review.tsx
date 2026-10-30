"use client"

// Stap 3 — review. Een eigen scherm dat de facilitator na een ronde bewust
// opent, niet een paneel onderaan het dashboard.
//
// Per keuze één `DecisionReviewCard`: de beslisvraag, de gekozen optie of
// expliciet "geen besluit binnen de tijd", de zes dimensies volledig
// uitgeschreven met richting en uitleg vóór het getal, en daarna de trade-off.
// Exact dezelfde component die de deelnemer ziet — acceptatie-eis van #105.

import Link from "next/link"
import { useMemo, useState } from "react"
import { ArrowRight, ChevronRight } from "lucide-react"
import { DecisionsView } from "@/components/admin/decisions-view"
import { ParticipantFeedbackPanel } from "@/components/admin/participant-feedback-panel"
import { RoundReviewNarrativePanel } from "@/components/admin/round-review-narrative-panel"
import { tr, type Lang } from "@/lib/i18n"
import type {
  GovernanceFlag, Participant, RoleAction, SessionState, SubmittedDecision,
} from "@/lib/types"
import { RoundReviewSection, ScoreTotalLine } from "./debrief-overview"
import { buildRoundReviews, facilitatorScoreTotal } from "./review-items"
import { STEP_PATH } from "./steps"

export function StepReview({ session, lang }: { session: SessionState; lang: Lang }) {
  const lastPlayed = Math.min(session.currentRound, session.scenario.rounds.length - 1)
  // null = volg de ronde waar de sessie nu in zit. Zodra de facilitator zelf een
  // ronde kiest blijft die staan, ook als de sessie doorloopt.
  const [picked, setPicked] = useState<number | null>(null)
  const selected = picked !== null && picked <= lastPlayed ? picked : lastPlayed

  const rounds = useMemo(() => buildRoundReviews(session), [session])
  const total = useMemo(() => facilitatorScoreTotal(session), [session])
  const round = rounds.find(r => r.roundIndex === selected)

  if (lastPlayed < 0 || !round) {
    return (
      <section className="rounded-xl border border-dashed border-border px-5 py-8 text-center">
        <p className="text-sm text-muted-foreground">
          Er is nog geen ronde gespeeld, dus er is nog niets te reviewen.
        </p>
        <Link
          href={STEP_PATH.sessie}
          className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-primary hover:bg-primary/20"
        >
          Naar sessie en lobby <ArrowRight className="size-3" />
        </Link>
      </section>
    )
  }

  const decisions = (session.submittedDecisions ?? []).filter(d => d.roundIndex === selected)
  const flags = (session.governanceFlags ?? []).filter(f => f.roundIndex === selected)
  const roundActions = session.scenario.rounds[selected]?.roleActions ?? []

  return (
    <div className="flex flex-col gap-6">
      {/* Rondekiezer — de review van een eerdere ronde moet terug te halen zijn
          zonder de sessie terug te spoelen. */}
      {rounds.length > 1 && (
        <nav aria-label="Ronde kiezen" className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Ronde
          </span>
          {rounds.map(r => (
            <button
              key={r.roundIndex}
              type="button"
              onClick={() => setPicked(r.roundIndex)}
              aria-current={r.roundIndex === selected ? "true" : undefined}
              className={`rounded-md border px-3 py-1 font-mono text-[11px] uppercase tracking-wider transition-colors ${
                r.roundIndex === selected
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              R{r.roundNumber}
            </button>
          ))}
        </nav>
      )}

      <ScoreTotalLine total={total} rounds={rounds} />

      <RoundReviewSection round={round} showAnswerModel />

      {/* Facilitator-only verhaallijn bij deze ronde. Rendert zichzelf alleen
          tijdens de reviewfase; buiten die fase blijft dit leeg. */}
      <RoundReviewNarrativePanel session={session} roundIndex={selected} />

      {/* Per deelnemer, ingeklapt: wie diende wat in en welke signalen stonden
          erbij. De kaarten hierboven zijn het gesprek, dit is de controle. */}
      <DecisionDetails
        decisions={decisions}
        flags={flags}
        participants={session.participants}
        roundActions={roundActions}
        lang={lang}
      />

      <ParticipantFeedbackPanel session={session} />

      <div className="flex flex-wrap items-center gap-2">
        {session.status === "active" && (
          <Link
            href={STEP_PATH.ronde}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
          >
            Terug naar actieve ronde
          </Link>
        )}
        <Link
          href={STEP_PATH.eindbespreking}
          className="inline-flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-primary hover:bg-primary/20"
        >
          Naar eindbespreking <ArrowRight className="size-3" />
        </Link>
      </div>
    </div>
  )
}

function DecisionDetails({
  decisions,
  flags,
  participants,
  roundActions,
  lang,
}: {
  decisions: SubmittedDecision[]
  flags: GovernanceFlag[]
  participants: Participant[]
  roundActions: RoleAction[]
  lang: Lang
}) {
  const [open, setOpen] = useState(false)
  return (
    <section className="rounded-xl border border-border bg-card">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-muted/30"
      >
        <span className="flex items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            {tr(lang, "decisionsView")}
          </span>
          <span className="rounded-full border border-border px-1.5 py-px font-mono text-[9px] text-muted-foreground">
            {decisions.length} ingezonden
          </span>
          {flags.length > 0 && (
            <span className="rounded-full border border-destructive/40 bg-destructive/10 px-1.5 py-px font-mono text-[9px] text-destructive">
              {flags.length} signalen
            </span>
          )}
        </span>
        <ChevronRight className={`size-4 text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`} />
      </button>
      {open && (
        <div className="border-t border-border p-4">
          <DecisionsView
            decisions={decisions}
            flags={flags}
            participants={participants}
            roundActions={roundActions}
            lang={lang}
          />
        </div>
      )}
    </section>
  )
}
