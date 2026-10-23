"use client"

import { useState } from "react"
import { Flag, Users } from "lucide-react"
import Link from "next/link"
import {
  DecisionReviewCard,
  DimensionImpactList,
  type DecisionReviewItem,
} from "@/components/shared/decision-review-card"
import { NO_DECISION_FALLBACK_VECTOR } from "@/lib/scoring/constants"
import { api } from "@/lib/api-client"
import type { ParticipantClosing, SessionState } from "@/lib/types"

// Stap 7 — de afronding. Team- en persoonlijke terugblik op precies hetzelfde
// resultaat als de facilitator ziet: dezelfde `DecisionReviewCard`, dezelfde
// zes dimensies met richting, uitleg en daarna het getal, dezelfde trade-off.
//
// Dit scherm had zijn eigen balkjes met afgekorte aslabels (CONT/FOR/BC/…) en
// geen enkele uitleg — dat was de klacht uit de live test (issue #105 §7). En
// het feedbackformulier verving de terugblik in plaats van er een onderdeel van
// te zijn; hieronder is het een blok op dit scherm.

function Reflection({ participantId, roundIndex }: { participantId: string | null; roundIndex: number }) {
  const [worked, setWorked] = useState("")
  const [didnt, setDidnt] = useState("")
  const [gap, setGap] = useState("")
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)

  async function send() {
    if (!participantId || busy) return
    setBusy(true)
    try {
      await api.submitFeedback({ participantId, roundIndex, worked, didnt, gap })
    } catch { /* niet blokkerend: de terugblik mag nooit op een netwerkfout stranden */ }
    setSent(true)
    setBusy(false)
  }

  if (sent) {
    return (
      <section className="rounded-lg border border-emerald-500/40 bg-emerald-500/5 px-4 py-3">
        <p className="text-sm text-foreground">
          Je terugblik is doorgegeven aan de facilitator. Dank — die neemt hem mee in de
          nabespreking.
        </p>
      </section>
    )
  }

  const empty = !worked.trim() && !didnt.trim() && !gap.trim()

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border bg-card px-4 py-4">
      <div className="flex flex-col gap-1">
        <span className="font-mono text-[10px] uppercase tracking-widest text-primary">
          Jouw terugblik
        </span>
        <p className="text-xs text-muted-foreground">
          Drie regels zijn genoeg. Dit gaat naar de facilitator, niet naar je collega&apos;s.
        </p>
      </div>

      {[
        { label: "Wat ging er goed?", value: worked, set: setWorked, hint: "Welk besluit of overleg liep soepel?" },
        { label: "Wat liep er niet?", value: didnt, set: setDidnt, hint: "Waar liep je vast of tegen elkaar in?" },
        { label: "Wat ontbrak er het hardst?", value: gap, set: setGap, hint: "Welke informatie, afspraak of bevoegdheid miste je?" },
      ].map(field => (
        <label key={field.label} className="flex flex-col gap-1">
          <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
            {field.label}
          </span>
          <textarea
            value={field.value}
            onChange={e => field.set(e.target.value)}
            rows={2}
            placeholder={field.hint}
            className="resize-none rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
          />
        </label>
      ))}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={send}
          disabled={busy || empty}
          className="rounded-md bg-primary px-5 py-2.5 font-mono text-xs uppercase tracking-wider text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? "Versturen…" : "Terugblik versturen"}
        </button>
        <button
          type="button"
          onClick={() => setSent(true)}
          className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground underline hover:no-underline"
        >
          Overslaan
        </button>
      </div>
    </section>
  )
}

interface Props {
  session: SessionState
  closing?: ParticipantClosing
  participantId?: string | null
}

export function SessionClosing({ session, closing, participantId }: Props) {
  const rounds = closing?.rounds ?? []
  const scored = closing?.totalPoints !== undefined && closing.maxPoints !== undefined
  const anyChoice = rounds.some(r => r.choices.length > 0)

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <header className="flex flex-col gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full border border-primary/40 bg-primary/10">
            <Flag className="size-5 text-primary" aria-hidden />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-semibold tracking-tight text-foreground">Oefening afgerond</h2>
            <p className="truncate text-xs text-muted-foreground">{session.scenario.scenario_title}</p>
          </div>
          {scored && (
            <div className="ml-auto shrink-0 text-right">
              <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Totaal</div>
              <div className="font-mono text-2xl font-bold tabular-nums text-primary">
                {closing!.totalPoints}
                <span className="text-sm text-muted-foreground">/{closing!.maxPoints}</span>
              </div>
            </div>
          )}
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Per ronde staat hieronder welke keuze is ingediend en wat die keuze deed op de zes
          dimensies. Geen enkele dimensie is &quot;het goede antwoord&quot; — de afweging ertussen is
          waar de oefening over gaat.
        </p>
        {closing?.teamName && (
          <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-primary">
            <Users className="size-3.5" aria-hidden /> Team {closing.teamName}
          </p>
        )}
      </header>

      {!closing && (
        <p className="rounded-lg border border-border bg-card px-4 py-4 text-sm text-muted-foreground">
          Deze terugblik is persoonlijk. Open de oefening op het toestel waarmee je hebt meegedaan.
        </p>
      )}

      {closing && rounds.length === 0 && (
        <p className="rounded-lg border border-border bg-card px-4 py-4 text-sm text-muted-foreground">
          Er zijn geen gespeelde rondes vastgelegd voor deze sessie.
        </p>
      )}

      {closing && rounds.length > 0 && !anyChoice && (
        <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
          Er is deze oefening geen keuze ingediend, dus er is niets om terug te kijken.
        </p>
      )}

      {rounds.map(round => (
        <section key={round.roundNumber} className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-3 border-b border-border pb-1.5">
            <div className="min-w-0">
              <span className="font-mono text-[10px] uppercase tracking-wider text-primary">
                Ronde {round.roundNumber}
              </span>
              <h3 className="truncate text-sm font-semibold text-foreground">{round.title}</h3>
            </div>
            {round.points !== undefined && (
              <span className="shrink-0 rounded-full border border-border px-2 py-0.5 font-mono text-[10px] tabular-nums text-muted-foreground">
                {round.points} / 100
              </span>
            )}
          </div>

          {round.choices.length === 0 ? (
            // Zelfde uitkomst als in het facilitator-rapport: geen inzending is
            // "geen besluit binnen de tijd" met de gevolgen van niets doen
            // (lib/scoring/decision-review.ts gebruikt dezelfde fallbackvector).
            <DecisionReviewCard
              item={{
                question: round.decisionPrompt ?? round.title,
                chosenLabel: null,
                vector: NO_DECISION_FALLBACK_VECTOR,
              }}
            />
          ) : (
            round.choices.map((choice, i) => {
              const item: DecisionReviewItem = {
                // De terugblik van de deelnemer draagt de rondetitel, niet de
                // beslisvraag zelf: `ParticipantClosingRound` bewaart die niet.
                question: round.decisionPrompt ?? round.title,
                chosenLabel: `${choice.optionLabel} — ${choice.roleLabel}`,
                vector: choice.outcomeVector,
                facilitatorCommentary: choice.debriefNote,
              }
              return <DecisionReviewCard key={i} item={item} />
            })
          )}

          {round.perDimension && (
            <details className="rounded-lg border border-border bg-card px-4 py-3">
              <summary className="cursor-pointer select-none font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Uitkomst van de hele ronde
              </summary>
              <div className="pt-2">
                <DimensionImpactList vector={round.perDimension} />
              </div>
            </details>
          )}
        </section>
      ))}

      {closing?.teamStandings && (
        <section className="flex flex-col gap-2 rounded-lg border border-border bg-card px-4 py-3">
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Teams naast elkaar
          </span>
          <ul className="flex flex-col divide-y divide-border">
            {closing.teamStandings.map(team => (
              <li key={team.name} className="flex items-center justify-between gap-3 py-1.5">
                <span className={`text-sm ${team.isMine ? "font-semibold text-primary" : "text-foreground"}`}>
                  {team.name}{team.isMine ? " (jullie team)" : ""}
                </span>
                <span className="font-mono text-xs tabular-nums text-muted-foreground">{team.points}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!scored && anyChoice && (
        <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-xs leading-relaxed">
          Deze oefening is niet op de zes dimensies gescoord — er is geen totaalscore vastgesteld.
        </p>
      )}

      <Reflection participantId={participantId ?? null} roundIndex={Math.max(0, session.currentRound)} />

      {closing?.scoringVersion && (
        <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
          Scoring v{closing.scoringVersion}
        </p>
      )}

      <Link
        href="/join"
        className="self-start rounded-md border border-border bg-card px-4 py-2 font-mono text-xs uppercase tracking-wider text-foreground hover:bg-accent"
      >
        Afsluiten
      </Link>
    </div>
  )
}
