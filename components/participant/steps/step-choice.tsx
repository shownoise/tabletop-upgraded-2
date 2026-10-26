"use client"

import { useState } from "react"
import { CheckCircle, Gavel, MessageSquare, Scale, UserX } from "lucide-react"
import type { OutcomeDimension } from "@/lib/scoring/constants"
import { DIMENSION_META, dimensionImpacts } from "@/lib/scoring/dimensions"
import { roleCoverageInUse } from "@/lib/session-roles"
import { ROLE_META, type ActiveDecisionPending, type Role, type SessionState } from "@/lib/types"
import { api } from "@/lib/api-client"
import { DecisionBrief } from "./decision-brief"
import { joinNL, type MandateView } from "./mandate"

// Stap 5 — de keuze. Bovenaan de beslisvraag met deadline en mandaatrol, daarna
// de opties.
//
// Wie mag indienen komt uit `decisionMandate()` via `mandateView()`, nooit uit
// sessionStorage. Dat was bug §1: `canSubmit = !!participantId && !!activeRole`
// met een lege sessionStorage-sleutel, waardoor er in de beslissingsfase geen
// enkele keuzekaart verscheen terwijl de server de rol wél kende.

function roleLabel(role: Role): string {
  return ROLE_META[role]?.label ?? role
}

// De projectie voor de deelnemer stuurt per optie alleen id, label en
// `allowedRole` mee; `outcomeVector` blijft op de server (lib/session-store.ts,
// projectActiveDecision) zodat de weging niet vóór het indienen uitlekt. Zodra
// die projectie de vector wél meestuurt toont dit scherm de *richting* per
// dimensie — pijlen, geen getallen, want het getal hoort bij de nabespreking.
type OptionWithVector = ActiveDecisionPending & {
  outcomeVector?: Partial<Record<OutcomeDimension, number>>
}

function DimensionDirections({ vector }: { vector: Partial<Record<OutcomeDimension, number>> }) {
  const touched = dimensionImpacts(vector).filter(i => i.value !== 0)
  if (touched.length === 0) return null
  return (
    <ul className="flex flex-wrap gap-1.5">
      {touched.map(i => (
        <li
          key={i.key}
          title={DIMENSION_META[i.key].question}
          className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-px font-mono text-[9px] uppercase tracking-wider ${
            i.direction === "positief"
              ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-400"
              : "border-red-500/40 text-red-700 dark:text-red-400"
          }`}
        >
          <span aria-hidden>{i.arrow}</span>
          {i.label}
        </li>
      ))}
    </ul>
  )
}

export function StepChoice({
  session,
  participantId,
  participantName,
  view,
  deadline,
}: {
  session: SessionState
  participantId: string | null
  participantName: string
  view: MandateView | null
  deadline?: string
}) {
  const [selected, setSelected] = useState<string | null>(null)
  const [reasoning, setReasoning] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!view) {
    return (
      <p className="rounded-lg border border-dashed border-border bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
        De facilitator heeft de keuze van deze ronde nog niet opengezet.
      </p>
    )
  }

  const roundIndex = session.currentRound
  const options = (session.activeDecision?.options ?? []) as OptionWithVector[]

  // Event-modus met een teamdevice: niemand claimt een rol en dat ene tablet
  // dient namens álle rollen in. Dekking is daar een eigenschap van het team,
  // niet van een persoon. Zelfde regel als de server in
  // app/api/session/submit-decision/route.ts; zodra er wél iemand een rol
  // claimt geldt het echte mandaat weer.
  const teamDevice = session.mode === "event" && !roleCoverageInUse(session)

  const mandateById = new Map(view.mandate.options.map(o => [o.optionId, o]))
  const byId = new Map(
    options.map(o => {
      const m = mandateById.get(o.optionId)
      if (teamDevice) {
        return [o.optionId, { optionId: o.optionId, canSubmit: !!participantId, asRole: o.allowedRole, viaInheritance: false }] as const
      }
      return [o.optionId, m ?? { optionId: o.optionId, canSubmit: false, viaInheritance: false }] as const
    }),
  )

  const mySubmissions = (session.submittedDecisions ?? []).filter(
    d => d.roundIndex === roundIndex && d.participantId === participantId,
  )
  const submittedOptionIds = new Set(mySubmissions.map(d => d.actionId))

  // Opties die ik zelf mag indienen. Is die lijst leeg terwijl er wél opties
  // zijn, dan adviseer ik en dient een ander in — dat zeggen we expliciet in
  // plaats van de knoppen stil uit te zetten.
  const mine = options.filter(o => byId.get(o.optionId)?.canSubmit)
  const iAdvise = mine.length === 0 && options.length > 0
  // Draag je meer dan één gemandateerde rol, dan dien je meerdere keren in.
  const myRoleCount = new Set(mine.map(o => byId.get(o.optionId)?.asRole).filter(Boolean)).size

  async function submit() {
    if (!participantId || !selected || busy) return
    const mandate = byId.get(selected)
    if (!mandate?.canSubmit) return
    setBusy(true)
    setError(null)
    try {
      await api.submitDecision({
        participantId,
        participantName,
        roundIndex,
        actionId: selected,
        reasoning: reasoning.trim(),
        // De rol waaronder dit landt. Bij een overgenomen rol is dat niet de
        // eigen rol, en de server weigert een rol die niet bij de optie hoort.
        activeRole: mandate.asRole,
      })
      setSelected(null)
      setReasoning("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Indienen mislukt")
    } finally {
      setBusy(false)
    }
  }

  const selectedMandate = selected ? byId.get(selected) : undefined

  return (
    <>
      <DecisionBrief view={view} deadline={deadline} />

      {mySubmissions.length > 0 && (
        <section className="flex flex-col gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/5 px-4 py-3">
          <span className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-widest text-emerald-700 dark:text-emerald-400">
            <CheckCircle className="size-3.5" aria-hidden /> Ingediend
          </span>
          <ul className="flex flex-col gap-1">
            {mySubmissions.map(d => (
              <li key={`${d.actionId}-${d.role}`} className="text-xs text-foreground">
                {d.actionLabel}
                <span className="text-muted-foreground"> — namens {roleLabel(d.role)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {iAdvise && (
        <p className="flex items-start gap-2 rounded-lg border border-border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
          <MessageSquare className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>
            Deze keuze is niet van jou. Jij adviseert
            {view.mandate.mandatedRoles.length > 0
              ? `: ${joinNL(view.mandate.mandatedRoles.map(roleLabel))} dient in.`
              : "; de gemandateerde rol dient in."}{" "}
            Zeg hardop wat jouw rol van deze opties vindt.
          </span>
        </p>
      )}

      {myRoleCount > 1 && (
        <p className="rounded-lg border border-border bg-muted/30 px-4 py-2.5 text-xs text-muted-foreground">
          Je dient deze ronde voor {myRoleCount} rollen in — {mySubmissions.length} daarvan staat al
          ingediend. Elke keuze landt onder de rol die erbij staat.
        </p>
      )}

      <section className="flex flex-col gap-2">
        <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
          De opties
        </span>
        {/* Deze regel stond onder elke optie afzonderlijk en verscheen daardoor
            zestien keer op één scherm — het grootste deel van de tekst daar.
            Issue #105 verbiedt herhaalde tekst, dus hij staat nu één keer. */}
        {options.length > 0 && !options.some(o => o.outcomeVector) && (
          <p className="flex items-start gap-2 text-[11px] text-muted-foreground">
            <Scale className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span>
              Elke optie werkt door op de zes dimensies. Wat precies, hoor je bij de nabespreking —
              je kiest nu op wat je weet.
            </span>
          </p>
        )}
        {options.length === 0 && (
          <p className="rounded-lg border border-dashed border-border bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
            Er staan voor deze ronde geen opties open.
          </p>
        )}
        <ul className="flex flex-col gap-2">
          {options.map(opt => {
            const mandate = byId.get(opt.optionId)
            const canSubmit = !!mandate?.canSubmit && !submittedOptionIds.has(opt.optionId)
            const isSelected = selected === opt.optionId
            const done = submittedOptionIds.has(opt.optionId)
            return (
              <li key={opt.optionId}>
                <button
                  type="button"
                  onClick={() => canSubmit && setSelected(isSelected ? null : opt.optionId)}
                  disabled={!canSubmit}
                  aria-pressed={isSelected}
                  className={`flex w-full flex-col gap-1.5 rounded-lg border px-3 py-2.5 text-left transition-colors ${
                    isSelected
                      ? "border-primary bg-primary/10"
                      : done
                        ? "border-emerald-500/40 bg-emerald-500/5"
                        : canSubmit
                          ? "border-border bg-card hover:border-primary/40"
                          : "border-border bg-card/40 cursor-default"
                  }`}
                >
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-foreground">{opt.optionLabel}</span>
                    {/* De rolchip kleurt amber als je die rol hebt overgenomen.
                        Een tweede badge met de tekst "overgenomen rol" stond
                        dertien keer op hetzelfde scherm; de kleur plus de
                        tooltip zegt het even goed en leest rustiger. */}
                    {opt.allowedRole && (
                      <span
                        title={mandate?.viaInheritance
                          ? `${roleLabel(opt.allowedRole)} — rol die jij hebt overgenomen`
                          : roleLabel(opt.allowedRole)}
                        className={`rounded-full border px-1.5 py-px font-mono text-[9px] uppercase tracking-wider ${
                          mandate?.viaInheritance
                            ? "border-amber-500/40 text-amber-700 dark:text-amber-400"
                            : "border-border text-muted-foreground"
                        }`}
                      >
                        {roleLabel(opt.allowedRole)}
                      </span>
                    )}
                  </span>
                  {opt.outcomeVector ? <DimensionDirections vector={opt.outcomeVector} /> : null}
                  {!canSubmit && !done && (
                    <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <Gavel className="size-3 shrink-0" aria-hidden />
                      {opt.allowedRole
                        ? `Alleen ${roleLabel(opt.allowedRole)} kan dit indienen.`
                        : "Deze optie staat niet voor jou open."}
                    </span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      </section>

      {view.mandate.unoccupiedMandates.length > 0 && (
        <p className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/5 px-4 py-3 text-xs text-amber-900 dark:text-amber-100">
          <UserX className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>
            {view.mandate.unoccupiedMandates.map(roleLabel).join(" · ")} draagt niemand aan deze
            tafel. Die keuze blijft leeg en gaat als &quot;geen besluit binnen de tijd&quot; de
            bespreking in. De ronde loopt gewoon door — je hoeft er niet op te wachten.
          </span>
        </p>
      )}

      {mine.length > 0 && (
        <section className="flex flex-col gap-2 border-t border-border pt-3">
          <label className="flex flex-col gap-1">
            <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
              Waarom deze keuze? (optioneel)
            </span>
            <textarea
              value={reasoning}
              onChange={e => setReasoning(e.target.value)}
              rows={2}
              maxLength={2000}
              placeholder="Eén regel is genoeg — dit lees je terug in de review."
              className="resize-none rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
            />
          </label>

          {selectedMandate?.viaInheritance && selectedMandate.asRole && (
            <p className="rounded-md border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-xs text-amber-900 dark:text-amber-100">
              Je dient dit in namens {roleLabel(selectedMandate.asRole)} — een rol die niemand heeft
              geclaimd en die jij erbij draagt. Mandaat en perspectief zijn die van die rol, niet
              van je eigen.
            </p>
          )}
          {selectedMandate && !selectedMandate.viaInheritance && selectedMandate.asRole && (
            <p className="text-xs text-muted-foreground">
              Je dient in namens {roleLabel(selectedMandate.asRole)}.
            </p>
          )}

          {error && <p className="text-xs text-destructive">{error}</p>}

          <button
            type="button"
            onClick={submit}
            disabled={!selected || busy}
            className="self-start rounded-md bg-primary px-5 py-2.5 font-mono text-xs uppercase tracking-wider text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? "Indienen…" : "Keuze indienen"}
          </button>
          {!selected && (
            <p className="text-[11px] text-muted-foreground">Kies eerst een optie hierboven.</p>
          )}
        </section>
      )}
    </>
  )
}
