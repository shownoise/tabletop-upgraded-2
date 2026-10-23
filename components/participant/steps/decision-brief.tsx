"use client"

import { HelpCircle, Gavel, MessageSquare, UserX } from "lucide-react"
import { ROLE_META, type Role } from "@/lib/types"
import { joinNL, type MandateView } from "./mandate"

// De beslisvraag plus wie wat mag. Staat op de ronde-intro, tijdens het overleg
// én boven de keuze — issue #105 §6: deelnemers wisten niet waarover ze
// informatie moesten verzamelen omdat de vraag pas in de laatste fase kwam.

function roleLabel(role: Role): string {
  return ROLE_META[role]?.label ?? role
}

export function DecisionBrief({
  view,
  deadline,
}: {
  view: MandateView | null
  // Eén regel over de tijd die er nog is. Komt van de rondeklok in de HUD.
  deadline?: string
}) {
  if (!view) {
    return (
      <section className="rounded-lg border border-dashed border-border bg-muted/20 px-4 py-3">
        <p className="flex items-start gap-2 text-xs text-muted-foreground">
          <HelpCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>
            De beslisvraag van deze ronde is nog niet vrijgegeven. Hij verschijnt hier zodra de
            facilitator hem opent.
          </span>
        </p>
      </section>
    )
  }

  const { decision, mandate, coverage, mine } = view
  const mandated = mandate.mandatedRoles
  const myMandates = mandate.myRoles
  const inherited = new Set(mine?.inherited ?? [])

  // Wie levert input: elke rol die iemand draagt en die deze keuze niet bezit.
  const mandatedSet = new Set([...mandated, ...mandate.unoccupiedMandates])
  const advisors = coverage
    .filter(c => c.status !== "onbezet" && !mandatedSet.has(c.role))
    .map(c => c.role)

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
      <div className="flex flex-col gap-1">
        <span className="font-mono text-[10px] uppercase tracking-widest text-primary">
          Beslisvraag van deze ronde
        </span>
        <p className="text-sm font-medium leading-snug text-foreground">{decision.prompt}</p>
        {deadline && (
          <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Deadline: {deadline}
          </p>
        )}
      </div>

      <dl className="flex flex-col gap-2 border-t border-primary/20 pt-2.5">
        <div className="flex items-start gap-2">
          <Gavel className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
          <div className="min-w-0">
            <dt className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
              Mandaat
            </dt>
            <dd className="text-xs text-foreground">
              {mandated.length > 0
                ? mandated.map(roleLabel).join(" · ")
                : "Deze keuze is niet aan een rol gebonden — iedereen mag indienen."}
              {myMandates.length > 0 && (
                <span className="mt-0.5 block text-[11px] text-primary">
                  Jij dient in namens {joinNL(myMandates.map(roleLabel))}
                  {myMandates.some(r => inherited.has(r)) ? " (overgenomen rol)" : ""}.
                </span>
              )}
            </dd>
          </div>
        </div>

        <div className="flex items-start gap-2">
          <MessageSquare className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
          <div className="min-w-0">
            <dt className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
              Levert input
            </dt>
            <dd className="text-xs text-muted-foreground">
              {advisors.length > 0
                ? advisors.map(roleLabel).join(" · ")
                : "Geen andere bezette rollen in deze oefening."}
            </dd>
          </div>
        </div>

        {mandate.unoccupiedMandates.length > 0 && (
          <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/5 px-2.5 py-2">
            <UserX className="mt-0.5 size-3.5 shrink-0 text-amber-700 dark:text-amber-400" aria-hidden />
            <div className="min-w-0">
              <dt className="font-mono text-[9px] uppercase tracking-widest text-amber-700 dark:text-amber-400">
                Niet bezet
              </dt>
              <dd className="text-xs text-amber-900 dark:text-amber-100">
                {mandate.unoccupiedMandates.map(roleLabel).join(" · ")} draagt niemand. Die keuze
                blijft leeg en gaat als &quot;geen besluit binnen de tijd&quot; de bespreking in. De
                ronde loopt gewoon door.
              </dd>
            </div>
          </div>
        )}
      </dl>
    </section>
  )
}
