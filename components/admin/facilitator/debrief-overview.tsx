"use client"

// De gedeelde weergave van één ronde en van de hele oefening.
//
// Dit is het stuk dat facilitator en deelnemer gemeenschappelijk hebben: beide
// zien dezelfde `DecisionReviewCard`s, dezelfde zes dimensies en dezelfde
// trade-offzin. De deelnemerskant kan `RoundReviewSection` en `DebriefOverview`
// hier rechtstreeks importeren — ze kennen alleen `RoundReviewData`, geen
// sessiestate en geen facilitator-rechten.

import { ROLE_META } from "@/lib/types"
import { DecisionReviewCard } from "@/components/shared/decision-review-card"
import { AnswerModelPanel } from "./answer-model-panel"
import { POINTS_PER_ROUND, type RoundReviewData, type ScoreTotal } from "./review-items"

export function RoundReviewSection({
  round,
  showTalkingPoints = true,
  // Het antwoordmodel is facilitator-only en staat daarom achter een opt-in:
  // deze component is bewust ook door de deelnemerskant te gebruiken, en een
  // standaard-aan zou het bedoelde antwoord daar weggeven.
  showAnswerModel = false,
}: {
  round: RoundReviewData
  showTalkingPoints?: boolean
  showAnswerModel?: boolean
}) {
  return (
    <section className="flex flex-col gap-4">
      <header className="flex flex-col gap-1.5 border-b border-border pb-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base font-semibold text-foreground">
            Ronde {round.roundNumber} — {round.roundTitle}
          </h2>
          <RoundPoints round={round} />
        </div>
        <p className="text-sm leading-snug text-muted-foreground">
          <span className="font-mono text-[10px] uppercase tracking-wider">Beslisvraag · </span>
          {round.question}
        </p>
      </header>

      {round.items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          Er is in deze ronde niets ingezonden en er stond geen keuze open.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {round.items.map((item, i) => (
            <div key={`${round.roundIndex}-${i}`} className="flex flex-col gap-1">
              {/* De kaart zelf noemt de rol alleen bij een genomen besluit. Live
                  leverde dat vier identieke "geen besluit"-kaarten op zonder dat
                  te zien was van wie. Daarom hier de rol erboven. */}
              {item.chosenLabel === null && item.role && (
                <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  {ROLE_META[item.role]?.label ?? item.role}
                </p>
              )}
              <DecisionReviewCard item={item} />
            </div>
          ))}
        </div>
      )}

      {showAnswerModel && <AnswerModelPanel decisions={round.answerModel} />}

      {showTalkingPoints && round.talkingPoints.length > 0 && (
        <div className="rounded-lg border border-border bg-muted/20 px-4 py-3">
          <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Gespreksvragen voor de zaal
          </p>
          <ul className="mt-1.5 flex flex-col gap-1.5">
            {round.talkingPoints.map((q, i) => (
              <li key={i} className="flex gap-2 text-sm leading-relaxed text-foreground">
                <span aria-hidden className="text-primary">?</span>
                {q}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

// Punten per ronde. Zonder inzending is dit geen nul maar "nog niet gemeten" —
// dat onderscheid was live niet te zien en leverde een score op waar niemand
// iets had gedaan.
function RoundPoints({ round }: { round: RoundReviewData }) {
  if (!round.hasSubmissions || round.points === null) {
    return (
      <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-amber-700 dark:text-amber-400">
        nog niet gemeten
      </span>
    )
  }
  // Altijd met noemer: 100 punten per ronde is de schaal van de engine
  // (POINTS_PER_ROUND). Een los getal was precies de klacht uit de live test.
  return (
    <span className="font-mono text-xs text-muted-foreground">
      Ronde-uitkomst: <span className="text-foreground">{round.points}</span> van {POINTS_PER_ROUND} punten
    </span>
  )
}

export function DebriefOverview({
  rounds,
  total,
  showAnswerModel = false,
}: {
  rounds: RoundReviewData[]
  total: ScoreTotal | null
  showAnswerModel?: boolean
}) {
  if (rounds.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
        Er zijn nog geen rondes gespeeld, dus er is nog niets te bespreken.
      </p>
    )
  }
  return (
    <div className="flex flex-col gap-10">
      <ScoreTotalLine total={total} rounds={rounds} />
      {/* Het beeld over de rondes heen. Stap 3 toont één ronde in detail en
          stap 4 alle rondes — met één gespeelde ronde was dat hetzelfde
          scherm, precies op het moment dat je ze voor het eerst naast elkaar
          ziet. Deze strook is wat stap 3 niet kan geven: het verloop. */}
      <RondeVerloop rounds={rounds} />
      {rounds.map(round => (
        <RoundReviewSection key={round.roundIndex} round={round} showAnswerModel={showAnswerModel} />
      ))}
    </div>
  )
}

// Per ronde één regel: nummer, punten, en of er iets is ingezonden. Bij één
// gespeelde ronde zegt hij dat eerlijk in plaats van een verloop te suggereren
// dat er niet is.
export function RondeVerloop({ rounds }: { rounds: RoundReviewData[] }) {
  const gemeten = rounds.filter(r => r.hasSubmissions)
  if (rounds.length === 1) {
    return (
      <p className="rounded-lg border border-dashed border-border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
        Er is één ronde gespeeld, dus dit overzicht is dezelfde bespreking die je bij
        stap 3 hebt gezien. Vanaf de tweede ronde staat hier het verloop: welke ronde
        wat opleverde en waar het team won of terrein verloor.
      </p>
    )
  }

  const hoogste = Math.max(...gemeten.map(r => r.points ?? 0), POINTS_PER_ROUND)

  return (
    <section className="flex flex-col gap-2 rounded-lg border border-border bg-card px-4 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          Verloop over {rounds.length} rondes
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">
          {gemeten.length} met een inzending
        </span>
      </div>
      <ul className="flex flex-col gap-1.5">
        {rounds.map(round => {
          const punten = round.points
          const breedte = punten === null ? 0 : Math.max(2, Math.round((punten / hoogste) * 100))
          return (
            <li key={round.roundIndex} className="flex items-center gap-3">
              <span className="w-6 shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
                R{round.roundNumber}
              </span>
              <span className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
                <span
                  className={`block h-full rounded-full ${punten === null ? "bg-amber-500/40" : "bg-primary"}`}
                  style={{ width: `${punten === null ? 100 : breedte}%` }}
                />
              </span>
              <span className="w-28 shrink-0 text-right font-mono text-[11px] tabular-nums text-muted-foreground">
                {punten === null ? "niets ingezonden" : `${punten} van ${POINTS_PER_ROUND}`}
              </span>
            </li>
          )
        })}
      </ul>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Een ronde zonder inzending is geen nul maar een lege balk: er is daar niets
        gemeten. Vraag het team bij welke ronde het kantelde en waarom.
      </p>
    </section>
  )
}

// Een totaal zonder noemer is onbruikbaar in een nagesprek: "21 punten" zegt
// niets zonder "van hoeveel". De noemer komt uit `scoreDenominator`; levert die
// niets op, dan zegt deze regel wat er wél gemeten is in plaats van een getal.
export function ScoreTotalLine({ total, rounds }: { total: ScoreTotal | null; rounds: RoundReviewData[] }) {
  const measured = rounds.filter(r => r.hasSubmissions).length
  if (!total) {
    return (
      <p className="rounded-lg border border-border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
        {measured} van {rounds.length} gespeelde rondes zijn gemeten. Er staat hier geen
        puntentotaal: zonder inzending is er niets te scoren en zou elk percentage
        misleidend zijn. De uitkomst per ronde en de zes dimensies per keuze staan hieronder.
      </p>
    )
  }
  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
      <p className="font-mono text-[10px] uppercase tracking-wider text-primary">Puntentotaal</p>
      <p className="text-sm text-foreground">
        <span className="font-semibold">{total.earned} van {total.possible} punten</span>
        {total.percentage !== null ? ` (${total.percentage}%)` : ""}
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Noemer: {total.rounds} scoorbare {total.rounds === 1 ? "ronde" : "rondes"} ×{" "}
        {POINTS_PER_ROUND} punten. Daarvan {total.measured}{" "}
        {total.measured === 1 ? "ronde" : "rondes"} met een werkelijke inzending; een
        scoorbare ronde zonder inzending telt mee als nul.
      </p>
    </div>
  )
}
