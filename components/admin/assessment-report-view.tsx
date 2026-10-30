"use client"

import { Printer, ArrowLeft } from "lucide-react"
import Link from "next/link"
import type { AssessmentReport, DecisionReviewRound, ScoringOutput } from "@/lib/scoring"
import { DIMENSION_META, NOTHING_TO_SCORE_NL, OUTCOME_DIMENSIONS, denominatorFromReport, type OutcomeDimension } from "@/lib/scoring"
import { DecisionReviewCard, DimensionImpactList } from "@/components/shared/decision-review-card"

// Geen eigen labelmapping: de namen van de zes dimensies komen uit
// lib/scoring/dimensions.ts, zodat deelnemer, facilitator en rapport exact
// dezelfde termen gebruiken (eis uit issue #105).
const dimLabel = (d: OutcomeDimension): string => DIMENSION_META[d].label

// De mini-spiders per ronde hebben geen ruimte voor "Verantwoording &
// communicatie". Afgekort uit hetzelfde label in plaats van een tweede
// handmatige lijst met afkortingen.

export interface AssessmentReportViewProps {
  sessionMeta: {
    scenarioTitle: string
    sessionTitle: string
    startedAt: number
    endedAt?: number
    status: "lobby" | "active" | "ended"
    totalRounds: number
  }
  participants: Array<{
    id: string
    name: string
    primaryLabel: string
    inheritedLabels: string[]
    decisionsSubmitted: number
    avgConfidence: number | null
  }>
  report: AssessmentReport
  scoring: ScoringOutput
  // Dezelfde scorebespreking die de deelnemer en het facilitator-rapport zien.
  // Server-side opgebouwd met decisionReviewItems(session).
  reviewRounds: DecisionReviewRound[]
  regulatory: {
    regime: { authorityLabel: string; obligation: string } | null
    obligations: Array<{
      milestoneLabel: string
      status: "open" | "filed" | "expired"
      openedAtRound: number
      filedAtRound?: number
      onTime: boolean
    }>
  }
  retainer: { activatedAtRound: number } | null
}

export function AssessmentReportView(props: AssessmentReportViewProps) {
  const { sessionMeta, participants, report, scoring, reviewRounds, regulatory, retainer } = props

  const teamVector = report.spider.team
  const totalPoints = report.totalPoints
  // De noemer komt uit het rapport, niet uit `outcomes.length`. Dat laatste
  // telde ook rondes mee die nooit gespeeld zijn of geen beslismoment hadden —
  // daar kwam de "0 van 600" uit de live test vandaan (issue #105).
  const denom = denominatorFromReport(report)
  const scorableCount = denom.rounds.length

  // Executive summary — pick strongest and weakest dimension by absolute value.
  const dimEntries = OUTCOME_DIMENSIONS.map(d => ({ dim: d, value: teamVector[d] }))
  const sortedByValue = [...dimEntries].sort((a, b) => b.value - a.value)
  const strongest = sortedByValue[0]
  const weakest = sortedByValue[sortedByValue.length - 1]

  // Hoeveel beslispunten zijn écht ingediend, en hoeveel zijn als "geen besluit
  // binnen de tijd" gescoord. Een entry zonder `submission` is dat laatste.
  //
  // Dit onderscheid ontbrak, en daardoor loog de samenvatting zonder onwaar te
  // zijn: een oefening waarin niemand iets koos leverde "Het team scoorde 29
  // van 100 punten", "Alle dimensies liggen dicht bij nul" en "Alle
  // beslispunten zijn gescoord" — terwijl alle zes dimensies op −1 stonden
  // omdat er niets was besloten. Dat leest als een gerustwoord.
  const execSentences = (denom.nothingToScore
    ? [
        NOTHING_TO_SCORE_NL,
        scorableCount > 0
          ? `Er ${scorableCount === 1 ? "lag één beslismoment" : `lagen ${scorableCount} beslismomenten`} klaar waarop nog niemand heeft gekozen.`
          : `In de gespeelde rondes lag nog geen beslismoment.`,
      ]
    : [
        `Het team scoorde ${totalPoints} van ${denom.maxPoints} punten (${denom.percentage}%) over ${scorableCount === 1 ? "één gespeelde ronde" : `${scorableCount} gespeelde rondes`} met een beslismoment.`,
        denom.measuredRounds.length < scorableCount
          ? `In ${scorableCount - denom.measuredRounds.length} van die rondes is niets ingediend; die tellen als nul punten mee.`
          : "",
        strongest.value !== 0
          ? `De sterkste dimensie was ${dimLabel(strongest.dim)} (${strongest.value >= 0 ? "+" : ""}${strongest.value.toFixed(1)}).`
          : weakest.value < 0
            // "Dicht bij nul" was hier onjuist: als er niets positief is maar
            // wel iets negatief, staat de hele oefening in de min.
            ? `Geen enkele dimensie is vooruitgegaan.`
            : `Alle dimensies liggen dicht bij nul — geen duidelijke uitschieter naar boven.`,
        weakest.value !== strongest.value
          ? `De zwakste dimensie was ${dimLabel(weakest.dim)} (${weakest.value >= 0 ? "+" : ""}${weakest.value.toFixed(1)}).`
          : "",
        scoring.droppedOptionalDecisions.length > 0
          ? `${scoring.droppedOptionalDecisions.length} optionele beslispunt(en) zijn vervallen door te weinig rolscheiding.`
          : `Alle beslispunten zijn gescoord.`,
      ]
  ).filter(Boolean)


  return (
    <div className="min-h-screen bg-background print:bg-white">
      {/* Print stylesheet */}
      <style>{`
        @page { size: A4; margin: 1.5cm; }
        @media print {
          body { color: black; background: white; }
          .no-print { display: none !important; }
          .page-break { page-break-before: always; }
          .avoid-break { page-break-inside: avoid; }
          .report-wrapper { max-width: none; padding: 0; }
        }
      `}</style>

      {/* Toolbar — hidden in print */}
      <div className="no-print sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
          <Link
            href="/admin/dashboard"
            className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            Dashboard
          </Link>
          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-2 rounded-md border border-primary/40 bg-primary/10 px-3 py-1.5 font-mono text-xs uppercase tracking-wider text-primary hover:bg-primary/20"
          >
            <Printer className="size-3.5" />
            Download PDF
          </button>
        </div>
      </div>

      <main className="report-wrapper mx-auto max-w-5xl px-6 py-8 md:py-12 flex flex-col gap-10">
        {/* 1. Header */}
        <header className="flex flex-col gap-2 avoid-break">
          <span className="font-mono text-[10px] uppercase tracking-widest text-primary">
            Assessment-rapport
          </span>
          <h1 className="text-3xl font-bold tracking-tight">{sessionMeta.scenarioTitle}</h1>
          <p className="text-sm text-muted-foreground">{sessionMeta.sessionTitle}</p>
          <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-xs md:grid-cols-4">
            <div>
              <dt className="font-mono uppercase tracking-wider text-muted-foreground">Start</dt>
              <dd>{new Date(sessionMeta.startedAt).toLocaleString("nl-NL")}</dd>
            </div>
            <div>
              <dt className="font-mono uppercase tracking-wider text-muted-foreground">Einde</dt>
              <dd>
                {sessionMeta.endedAt
                  ? new Date(sessionMeta.endedAt).toLocaleString("nl-NL")
                  : sessionMeta.status === "active" ? "Sessie loopt nog" : "—"}
              </dd>
            </div>
            <div>
              <dt className="font-mono uppercase tracking-wider text-muted-foreground">Deelnemers</dt>
              <dd>{participants.length}</dd>
            </div>
            <div>
              <dt className="font-mono uppercase tracking-wider text-muted-foreground">Rondes</dt>
              <dd>{sessionMeta.totalRounds}</dd>
            </div>
          </dl>
          {participants.length > 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              <span className="font-mono uppercase tracking-wider">Rolverdeling:</span>{" "}
              {participants.map(p => `${p.name} (${p.primaryLabel})`).join(" · ")}
            </p>
          )}
        </header>

        {/* 2. Executive summary */}
        <section className="avoid-break">
          <h2 className="font-mono text-xs uppercase tracking-widest text-primary mb-2">Samenvatting</h2>
          <div className="rounded-xl border border-border bg-card p-5 flex flex-col gap-2">
            {execSentences.map((s, i) => (
              <p key={i} className="text-sm leading-relaxed">{s}</p>
            ))}
          </div>
        </section>

        {/* 3. Cumulatieve uitkomst over de zes dimensies.
            Hier stond een radar-grafiek met afgekorte asnamen. Die is weg: issue
            #105 §6 vraagt richting, uitleg en pas daarna het getal, en noemt een
            spiderweb expliciet onbruikbaar in een plenair gesprek. De lijst
            eronder droeg de informatie al, de grafiek alleen de vorm. */}
        <section className="avoid-break">
          <h2 className="font-mono text-xs uppercase tracking-widest text-primary mb-2">
            Cumulatieve uitkomst — 6 dimensies
          </h2>
          <div className="rounded-xl border border-border bg-card p-6">
            <DimensionImpactList vector={teamVector} />
          </div>
        </section>

        {/* 4. Per-round mini spider charts */}
        <section className="avoid-break">
          <h2 className="font-mono text-xs uppercase tracking-widest text-primary mb-2">Per ronde</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {report.spider.perDimensionAcrossRounds.map(({ round, vector }) => {
              const outcome = report.outcomes.find(o => o.round === round)
              const submitted = outcome?.hasSubmissions
              // Een ronde buiten de noemer kon geen punten opleveren; dan is
              // "0 pt" misleidend in plaats van informatief.
              const counts = denom.rounds.includes(round)
              return (
                <div key={round} className="rounded-xl border border-border bg-card p-4 flex flex-col gap-2 avoid-break">
                  <div className="flex items-baseline justify-between">
                    <span className="font-mono text-[10px] uppercase tracking-widest text-primary">
                      Ronde {round}
                    </span>
                    <span className={`font-mono text-xs tabular-nums ${submitted ? "text-foreground" : "text-muted-foreground/60"}`}>
                      {/* Zonder inzending telt de ronde als nul in totalPoints;
                          de 50 "neutrale" punten uit computeRoundOutcome zouden
                          hier een score suggereren die niet is verdiend. */}
                      {counts ? `${submitted ? outcome?.points ?? 0 : 0} van 100 pt` : "telt niet mee"}
                    </span>
                  </div>
                  {/* Ook hier geen mini-radar meer: zes afgekorte assen in 200
                      pixels waren niet te lezen, laat staan voor te lezen. */}
                  <DimensionImpactList vector={vector} />
                  {!submitted && (
                    <p className="text-[10px] italic text-muted-foreground">
                      {counts
                        ? "Niemand heeft gekozen — de gevolgen hieronder zijn die van niets doen."
                        : "Deze ronde had geen beslismoment en telt niet mee in de score."}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </section>

        {/* 5. Scorebespreking per beslisvraag — zelfde kaart als deelnemer en
            facilitator zien, dus dezelfde dimensienamen en dezelfde reden bij
            "geen besluit". */}
        {reviewRounds.length > 0 && (
          <section>
            <h2 className="font-mono text-xs uppercase tracking-widest text-primary mb-2">
              Scorebespreking per beslisvraag
            </h2>
            <div className="flex flex-col gap-6">
              {reviewRounds.map(reviewRound => (
                <div key={reviewRound.round} className="flex flex-col gap-3">
                  <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    Ronde {reviewRound.round}
                    {reviewRound.title ? ` — ${reviewRound.title}` : ""}
                  </p>
                  {reviewRound.entries.map(entry =>
                    entry.scored ? (
                      <div key={entry.key} className="avoid-break">
                        <DecisionReviewCard item={entry.item} />
                      </div>
                    ) : (
                      <div key={entry.key} className="avoid-break rounded-lg border border-amber-500/40 bg-amber-500/5 px-4 py-3">
                        <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Gekozen</p>
                        <p className="text-sm text-foreground">{entry.item.chosenLabel}</p>
                        <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                          Punten niet vastgesteld — deze optie heeft geen scorevector. Bespreek de gevolgen op de zes
                          dimensies met het team.
                        </p>
                      </div>
                    ),
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 6. Timing narrative */}
        <section className="avoid-break">
          <h2 className="font-mono text-xs uppercase tracking-widest text-primary mb-2">
            Timing — meldplicht &amp; IR-retainer
          </h2>
          <div className="rounded-xl border border-border bg-card p-5 flex flex-col gap-3">
            {/* Regulatory */}
            <div className="flex flex-col gap-1">
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Meldplicht — {regulatory.regime?.authorityLabel ?? "geen regime"}
              </span>
              {regulatory.obligations.length === 0 ? (
                <p className="text-sm text-muted-foreground">Geen meldplicht-verplichtingen opgetreden.</p>
              ) : (
                <ul className="flex flex-col gap-1">
                  {regulatory.obligations.map((o, i) => {
                    const verdict = o.status === "filed"
                      ? (o.onTime
                          ? `Ingediend in R${o.filedAtRound} — op tijd`
                          : `Ingediend in R${o.filedAtRound} — te laat`)
                      : o.status === "expired" ? "Vervallen — niet ingediend (verzuim)"
                      : `Geopend in R${o.openedAtRound} — nog niet ingediend`
                    return (
                      <li key={i} className="text-sm">
                        <span className="font-medium">{o.milestoneLabel}:</span>{" "}
                        <span className={
                          o.status === "filed" && o.onTime ? "text-emerald-700 dark:text-emerald-400"
                          : o.status === "open" ? "text-amber-700 dark:text-amber-400"
                          : "text-rose-700 dark:text-rose-400"
                        }>
                          {verdict}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
            {/* Retainer */}
            <div className="flex flex-col gap-1 border-t border-border pt-3">
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">IR-retainer</span>
              {retainer ? (
                <p className="text-sm">
                  <span className="text-emerald-700 dark:text-emerald-400 font-medium">
                    Geactiveerd in ronde {retainer.activatedAtRound}
                  </span>
                  {" — vroege activatie beperkt escalatie en versnelt forensiek en juridisch traject."}
                </p>
              ) : (
                <p className="text-sm">
                  <span className="text-rose-700 dark:text-rose-400 font-medium">Niet geactiveerd</span>
                  {" — advies: activeer bij bevestigde compromittering direct om forensische positie en aansprakelijkheid te borgen."}
                </p>
              )}
            </div>
          </div>
        </section>

        {/* 7. Per-participant table */}
        <section className="avoid-break">
          <h2 className="font-mono text-xs uppercase tracking-widest text-primary mb-2">Per deelnemer</h2>
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-muted-foreground text-[10px] font-mono uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-2">Naam</th>
                  <th className="text-left px-4 py-2">Rol(len)</th>
                  <th className="text-right px-4 py-2">Inzendingen</th>
                  <th className="text-right px-4 py-2">Gem. zekerheid</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {participants.map(p => (
                  <tr key={p.id}>
                    <td className="px-4 py-2 font-medium">{p.name}</td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {[p.primaryLabel, ...p.inheritedLabels].join(" + ")}
                    </td>
                    <td className="px-4 py-2 text-right font-mono tabular-nums">{p.decisionsSubmitted}</td>
                    <td className="px-4 py-2 text-right font-mono tabular-nums">
                      {p.avgConfidence !== null ? p.avgConfidence.toFixed(1) : "—"}
                    </td>
                  </tr>
                ))}
                {participants.length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-6 text-center text-xs text-muted-foreground italic">Geen deelnemers</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* 8. Dropped optional decisions */}
        {scoring.droppedOptionalDecisions.length > 0 && (
          <section className="avoid-break">
            <h2 className="font-mono text-xs uppercase tracking-widest text-primary mb-2">Vervallen optionele beslispunten</h2>
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4">
              <p className="text-xs text-muted-foreground mb-2">
                Deze beslispunten zijn niet meegewogen door te weinig rolscheiding (drempel niet gehaald).
              </p>
              <ul className="list-disc pl-5 text-sm flex flex-col gap-0.5">
                {scoring.droppedOptionalDecisions.map(id => (
                  <li key={id} className="font-mono text-xs">{id}</li>
                ))}
              </ul>
            </div>
          </section>
        )}

        {/* Footer meta */}
        <footer className="pt-4 border-t border-border text-[10px] font-mono uppercase tracking-wider text-muted-foreground flex flex-wrap items-center gap-x-6 gap-y-1">
          <span>Scoring v{report.meta.scoringVersion}</span>
          <span>Gegenereerd: {new Date(report.meta.generatedAt).toLocaleString("nl-NL")}</span>
          <span>Rol-coverage: {Math.round(report.meta.rolCoverage * 100)}%</span>
          <span>Distincte eigenaren: {report.meta.distinctOwners}</span>
        </footer>
      </main>
    </div>
  )
}
