"use client"

// De gedeelde weergave van één ronde en van de hele oefening.
//
// Dit is het stuk dat facilitator en deelnemer gemeenschappelijk hebben: beide
// zien dezelfde `DecisionReviewCard`s, dezelfde zes dimensies en dezelfde
// trade-offzin. De deelnemerskant kan `RoundReviewSection` en `DebriefOverview`
// hier rechtstreeks importeren — ze kennen alleen `RoundReviewData`, geen
// sessiestate en geen facilitator-rechten.

import { DecisionReviewCard } from "@/components/shared/decision-review-card"
import type { RoundReviewData, ScoreTotal } from "./review-items"

export function RoundReviewSection({
  round,
  showTalkingPoints = true,
}: {
  round: RoundReviewData
  showTalkingPoints?: boolean
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
            <DecisionReviewCard key={`${round.roundIndex}-${i}`} item={item} />
          ))}
        </div>
      )}

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
  return (
    <span className="font-mono text-xs text-muted-foreground">
      Ronde-uitkomst: <span className="text-foreground">{round.points}</span> punten
    </span>
  )
}

export function DebriefOverview({
  rounds,
  total,
}: {
  rounds: RoundReviewData[]
  total: ScoreTotal | null
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
      {rounds.map(round => (
        <RoundReviewSection key={round.roundIndex} round={round} />
      ))}
    </div>
  )
}

// Een totaal zonder noemer is onbruikbaar in een nagesprek: "21 punten" zegt
// niets zonder "van hoeveel". Zolang de engine die noemer niet levert, zeggen
// we dat liever dan dat we er een verzinnen.
function ScoreTotalLine({ total, rounds }: { total: ScoreTotal | null; rounds: RoundReviewData[] }) {
  const measured = rounds.filter(r => r.hasSubmissions).length
  if (!total) {
    return (
      <p className="rounded-lg border border-border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
        {measured} van {rounds.length} rondes zijn gemeten. Er staat hier bewust geen
        puntentotaal: zonder vastgestelde noemer is een totaal niet uit te leggen.
        De uitkomst per ronde en de zes dimensies per keuze staan hieronder.
      </p>
    )
  }
  return (
    <p className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-foreground">
      <span className="font-mono text-[10px] uppercase tracking-wider text-primary">Puntentotaal · </span>
      {total.earned} van {total.possible} punten over {total.rounds} gemeten rondes.
    </p>
  )
}
