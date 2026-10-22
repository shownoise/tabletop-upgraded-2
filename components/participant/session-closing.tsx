"use client"

import { Flag } from "lucide-react"
import Link from "next/link"
import type { OutcomeDimensionKey, OutcomeVector } from "@/lib/graph/types"
import type { ParticipantClosing, SessionState } from "@/lib/types"

const DIMS: readonly OutcomeDimensionKey[] = ["CONT", "FOR", "BC", "JUR", "VER", "KOS"] as const

const DIM_LABEL: Record<OutcomeDimensionKey, string> = {
  CONT: "Containment",
  FOR: "Forensiek",
  BC: "Bedrijfscontinuïteit",
  JUR: "Juridisch & meldplicht",
  VER: "Verantwoording & communicatie",
  KOS: "Kosten & schade-impact",
}

const DIM_HINT: Record<OutcomeDimensionKey, string> = {
  CONT: "Hoe snel de dreiging is ingedamd — hoger is beter ingedamd.",
  FOR: "Bewijsvastlegging en attributie — hoger is een betere forensische positie.",
  BC: "Impact op de primaire processen — hoger is minder verstoring.",
  JUR: "Wettelijke meldplichten en aansprakelijkheid — hoger is beter afgedekt.",
  VER: "Transparantie richting stakeholders — hoger is duidelijker verantwoord.",
  KOS: "Directe en indirecte kosten — hoger is lagere schade-impact.",
}

// Elke as loopt van −2 tot +2; de breedte van de balk is de absolute waarde
// daarvan ten opzichte van die grens.
const AXIS_MAX = 2

function signed(value: number): string {
  const rounded = Math.round(value * 10) / 10
  return rounded > 0 ? `+${rounded}` : `${rounded}`
}

function VectorBars({ vector }: { vector: OutcomeVector }) {
  return (
    <div className="flex flex-col gap-1.5">
      {DIMS.map(dim => {
        const value = vector[dim]
        const pct = Math.min(100, (Math.abs(value) / AXIS_MAX) * 100)
        return (
          <div key={dim} className="flex items-center gap-3">
            <span title={DIM_HINT[dim]} className="w-[9rem] shrink-0 font-mono text-[10px] uppercase leading-tight tracking-wider text-muted-foreground sm:w-[11rem]">
              {DIM_LABEL[dim]}
            </span>
            <div className="relative h-1.5 flex-1 rounded-full bg-muted">
              <div className="absolute left-1/2 top-0 h-full w-px bg-border" />
              <div
                className={`absolute top-0 h-full rounded-full ${value >= 0 ? "bg-emerald-500" : "bg-rose-500"}`}
                style={
                  value >= 0
                    ? { left: "50%", width: `${pct / 2}%` }
                    : { right: "50%", width: `${pct / 2}%` }
                }
              />
            </div>
            <span className={`w-10 shrink-0 text-right font-mono text-[10px] tabular-nums ${value > 0 ? "text-emerald-600 dark:text-emerald-400" : value < 0 ? "text-rose-600 dark:text-rose-400" : "text-muted-foreground"}`}>
              {signed(value)}
            </span>
          </div>
        )
      })}
    </div>
  )
}

interface Props {
  session: SessionState
  closing?: ParticipantClosing
}

export function SessionClosing({ session, closing }: Props) {
  const rounds = closing?.rounds ?? []
  const scored = closing?.totalPoints !== undefined && closing.maxPoints !== undefined
  const anyChoice = rounds.some(r => r.choices.length > 0)

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <header className="flex flex-col gap-3 rounded-xl border border-primary/30 bg-primary/5 px-5 py-5">
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full border border-primary/40 bg-primary/10">
            <Flag className="size-5 text-primary" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-semibold tracking-tight">Oefening afgerond</h1>
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
          Hieronder staat per ronde welke keuze u heeft ingediend en wat die keuze deed op de zes
          dimensies. Geen enkele dimensie is &quot;het goede antwoord&quot; — de afweging ertussen is
          waar de oefening over gaat. De facilitator loopt de nabespreking met u door.
        </p>
        {closing?.teamName && (
          <p className="font-mono text-[10px] uppercase tracking-wider text-primary">Team {closing.teamName}</p>
        )}
      </header>

      {!closing && (
        <div className="rounded-xl border border-border bg-card px-5 py-6 text-center">
          <p className="text-sm text-muted-foreground">
            Deze terugblik is persoonlijk. Open de oefening op het toestel waarmee u heeft meegedaan.
          </p>
        </div>
      )}

      {closing && rounds.length === 0 && (
        <div className="rounded-xl border border-border bg-card px-5 py-6 text-center">
          <p className="text-sm text-muted-foreground">
            Er zijn geen gespeelde rondes vastgelegd voor deze sessie.
          </p>
        </div>
      )}

      {closing && rounds.length > 0 && !anyChoice && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-5 py-4">
          <p className="text-sm">U heeft deze oefening geen keuze ingediend, dus er is niets om terug te kijken.</p>
        </div>
      )}

      {rounds.map(round => (
        <section key={round.roundNumber} className="flex flex-col gap-3 rounded-xl border border-border bg-card px-5 py-4">
          <div className="flex items-baseline justify-between gap-3 border-b border-border pb-2">
            <div className="min-w-0">
              <span className="font-mono text-[10px] uppercase tracking-wider text-primary">Ronde {round.roundNumber}</span>
              <h2 className="truncate text-sm font-semibold">{round.title}</h2>
            </div>
            {round.points !== undefined && (
              <span className="shrink-0 rounded-full border border-border px-2 py-0.5 font-mono text-[10px] tabular-nums text-muted-foreground">
                {round.points} / 100
              </span>
            )}
          </div>

          {round.choices.length === 0 ? (
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Geen keuze ingediend in deze ronde
            </p>
          ) : (
            round.choices.map((choice, i) => (
              <div key={i} className="flex flex-col gap-2">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="rounded-full border border-primary/30 bg-primary/10 px-1.5 py-px font-mono text-[8px] uppercase tracking-wider text-primary">
                    {choice.roleLabel}
                  </span>
                  <span className="text-sm">{choice.optionLabel}</span>
                </div>
                {choice.outcomeVector ? (
                  <VectorBars vector={choice.outcomeVector} />
                ) : (
                  <p className="font-mono text-[10px] text-muted-foreground">
                    Aan deze keuze is geen scorevector gekoppeld — bespreek het effect met de facilitator.
                  </p>
                )}
                {choice.debriefNote && (
                  <p className="rounded-md border border-border bg-background/60 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                    {choice.debriefNote}
                  </p>
                )}
              </div>
            ))
          )}

          {round.perDimension && (
            <details className="group border-t border-border pt-2">
              <summary className="cursor-pointer list-none font-mono text-[10px] uppercase tracking-wider text-muted-foreground select-none">
                Uitkomst van de ronde
                <span className="ml-2 text-[8px] opacity-50 group-open:hidden">▶</span>
                <span className="ml-2 hidden text-[8px] opacity-50 group-open:inline">▼</span>
              </summary>
              <div className="pt-2">
                <VectorBars vector={round.perDimension} />
              </div>
            </details>
          )}
        </section>
      ))}

      {closing?.teamStandings && (
        <section className="flex flex-col gap-2 rounded-xl border border-border bg-card px-5 py-4">
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Teams naast elkaar</span>
          <ul className="flex flex-col divide-y divide-border">
            {closing.teamStandings.map(team => (
              <li key={team.name} className="flex items-center justify-between gap-3 py-1.5">
                <span className={`text-sm ${team.isMine ? "font-semibold text-primary" : ""}`}>
                  {team.name}{team.isMine ? " (uw team)" : ""}
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
