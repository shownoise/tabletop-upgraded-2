"use client"

import { Shield } from "lucide-react"
import { FactCheckReview } from "../fact-check-review"
import { regulatoryAdviceSentence } from "../regulatory-notification-button"
import { DecisionReviewCard, type DecisionReviewItem } from "@/components/shared/decision-review-card"
import { NO_DECISION_FALLBACK_VECTOR } from "@/lib/scoring/constants"
import type { OutcomeDimension } from "@/lib/scoring/constants"
import { ROLE_META, type ActiveDecisionPending, type ChoiceQuality, type Role, type SessionState } from "@/lib/types"
import type { MandateView } from "./mandate"

// Stap 6 — de scorebespreking van deze ronde, in dezelfde kaart als de
// facilitator en het rapport (`components/shared/decision-review-card.tsx`).
// Issue #105 eiste dat die drie exact dezelfde beslisvraag, keuze, dimensies en
// trade-off tonen.

const QUALITY_LABEL: Record<ChoiceQuality, string> = {
  best: "Beste keuze",
  good: "Goede keuze",
  poor: "Kon beter",
  wrong: "Verkeerde keuze",
}

// Zie step-choice: de deelnemersprojectie stuurt per optie nog geen
// `outcomeVector` mee (lib/session-store.ts, projectActiveDecision). Zodra dat
// gebeurt vult deze kaart zich met de echte zes dimensies; tot die tijd zeggen
// we eerlijk dat de weging bij de afronding komt in plaats van zes nullen te
// tonen alsof de keuze geen effect had.
type OptionWithVector = ActiveDecisionPending & {
  outcomeVector?: Partial<Record<OutcomeDimension, number>>
}

function roleLabel(role?: Role): string | undefined {
  return role ? ROLE_META[role]?.label ?? role : undefined
}

export function StepReview({
  session,
  participantId,
  view,
}: {
  session: SessionState
  participantId: string | null
  view: MandateView | null
}) {
  const roundIndex = session.currentRound
  const prompt = session.activeDecision?.prompt
  const options = (session.activeDecision?.options ?? []) as OptionWithVector[]
  const mine = (session.submittedDecisions ?? []).filter(
    d => d.roundIndex === roundIndex && d.participantId === participantId,
  )

  // Feit/aanname is een optioneel mechanisme van het scenario: `FactCheckReview`
  // rendert zichzelf als niets wanneer geen enkele inject een classificatie
  // draagt. Het hoort bij de review en niet in de hoofdflow, dus staat het hier
  // onderaan de stap in plaats van als eigen paneel tijdens de ronde.
  const factCheck = participantId ? (
    <FactCheckReview session={session} participantId={participantId} roundIndex={roundIndex} />
  ) : null

  // Meldplicht is een uitkomst van de ronde, niet van één keuze: wel of niet
  // op tijd gemeld hoort in de bespreking te staan.
  const regulatory = session.regulatoryRegime
    ? regulatoryAdviceSentence(session.regulatoryObligations ?? [], session.regulatoryRegime.id)
    : null
  const tail = (
    <>
      {regulatory && (
        <p className="rounded-lg border border-border bg-muted/30 px-4 py-2.5 text-xs text-foreground">
          {regulatory}
        </p>
      )}
      {factCheck}
    </>
  )

  if (!prompt) {
    return (
      <>
        <p className="rounded-lg border border-dashed border-border bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
          Voor deze ronde is geen beslisvraag vastgelegd, dus er is niets terug te kijken.
        </p>
        {tail}
      </>
    )
  }

  // Niets ingediend terwijl de keuze wél van jou was: dat is een uitkomst, geen
  // leegte. Zelfde vector en zelfde tekst als het facilitator-rapport
  // (lib/scoring/decision-review.ts).
  if (mine.length === 0) {
    const owner = view?.mandate.mandatedRoles[0] ?? view?.mandate.unoccupiedMandates[0]
    const item: DecisionReviewItem = {
      question: prompt,
      chosenLabel: null,
      role: owner,
      unoccupied: !!owner && !session.participants.some(p => p.role === owner),
      vector: NO_DECISION_FALLBACK_VECTOR,
    }
    return (
      <>
        <DecisionReviewCard item={item} />
        {tail}
      </>
    )
  }

  return (
    <>
      {mine.map(d => {
        const opt = options.find(o => o.optionId === d.actionId)
        const quality = opt?.qualityRank ? QUALITY_LABEL[opt.qualityRank] : undefined
        const commentary = [opt?.facilitatorCommentary, opt?.lessonLearned]
          .filter(Boolean)
          .join("\n\n") || undefined

        if (opt?.outcomeVector) {
          const item: DecisionReviewItem = {
            question: prompt,
            chosenLabel: d.actionLabel,
            role: d.role,
            byName: d.participantName,
            viaInheritance: !!view?.mine?.inherited.includes(d.role),
            reasoning: d.reasoning || undefined,
            vector: opt.outcomeVector,
            facilitatorCommentary: commentary,
          }
          return <DecisionReviewCard key={`${d.actionId}-${d.role}`} item={item} />
        }

        return (
          <article
            key={`${d.actionId}-${d.role}`}
            className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4"
          >
            <header className="flex flex-col gap-1">
              <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Beslisvraag
              </p>
              <h3 className="text-sm font-medium leading-snug text-foreground">{prompt}</h3>
            </header>

            <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
              <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Gekozen
              </p>
              <p className="text-sm text-foreground">{d.actionLabel}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {roleLabel(d.role)}
                {d.participantName ? ` · ${d.participantName}` : ""}
                {view?.mine?.inherited.includes(d.role) ? " · rol overgenomen" : ""}
              </p>
            </div>

            {d.reasoning && (
              <div>
                <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Jullie onderbouwing
                </p>
                <p className="text-xs leading-relaxed text-foreground/90">{d.reasoning}</p>
              </div>
            )}

            {(quality || commentary) && (
              <div className="flex flex-col gap-1.5 rounded-md border border-primary/25 bg-primary/5 px-3 py-2">
                <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-primary">
                  <Shield className="size-3.5" aria-hidden /> Wat wij ervan vinden
                  {quality ? ` — ${quality}` : ""}
                </span>
                {commentary && (
                  <p className="whitespace-pre-line text-xs leading-relaxed text-foreground">{commentary}</p>
                )}
              </div>
            )}

            <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              De zes dimensies van deze keuze komen bij de afronding — daar staat per as de richting,
              de uitleg en het getal.
            </p>
          </article>
        )
      })}
      {tail}
    </>
  )
}
