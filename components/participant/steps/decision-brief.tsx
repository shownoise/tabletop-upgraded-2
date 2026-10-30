"use client"

import { Clock, HelpCircle, Gavel, MessageSquare, UserX } from "lucide-react"
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

  const { decision, mandate, coverage, mine, nietAanZet } = view
  const mandated = mandate.mandatedRoles
  const myMandates = mandate.myRoles
  const inherited = new Set(mine?.inherited ?? [])

  const mandatedSet = new Set([...mandated, ...mandate.unoccupiedMandates])

  // Wie er deze ronde niet aan zet is, en dat is iets anders dan "levert
  // input". Hier stond één groep onder de kop "Levert input": elke bezette rol
  // zonder mandaat. Maar bij een keuze per rol heeft wie een optie heeft ook
  // het mandaat — dus die groep is in werkelijkheid "heeft deze ronde niets te
  // kiezen". In het Eye Security-scenario is dat de hele kern: om 02:48 zit het
  // crisisteam niet bijeen, en dan hoort de UI dat te zeggen in plaats van te
  // suggereren dat die mensen input leveren.
  //
  // `nietAanZet` komt uit de rolverdeling van de sessie, niet uit `coverage`:
  // dat laatste universum bevat juist alleen de rollen van dít beslispunt.
  const nietAanZetSet = new Set(nietAanZet)
  // Wie wél een optie heeft maar niet het mandaat: dat kan als iemand anders
  // die rol draagt. Die levert dan echt input.
  const advisors = coverage
    .filter(c => c.status !== "onbezet" && !mandatedSet.has(c.role) && !nietAanZetSet.has(c.role))
    .map(c => c.role)

  return (
    <section
      data-tour="deelnemer-beslisvraag"
      className="flex flex-col gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3"
    >
      <div className="flex flex-col gap-1">
        <span className="font-mono text-[10px] uppercase tracking-widest text-primary">
          Beslisvraag van deze ronde
        </span>
        <p className="text-sm font-medium leading-snug text-foreground">{decision.prompt}</p>
        {/* De vraag alleen was vaak te kort om de context eruit te halen: wat
            is er al bekend, waar knelt het, en waar gaat deze keuze níet over. */}
        {decision.context && (
          <p className="text-xs leading-relaxed text-muted-foreground">{decision.context}</p>
        )}
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

        {advisors.length > 0 && (
          <div className="flex items-start gap-2">
            <MessageSquare className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
            <div className="min-w-0">
              <dt className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
                Levert input
              </dt>
              <dd className="text-xs text-muted-foreground">
                {advisors.map(roleLabel).join(" · ")}
              </dd>
            </div>
          </div>
        )}

        {/* De rollen die deze ronde niets te kiezen hebben. Dit is bewust een
            eigen regel: een scenario mag een ronde met een kleine bezetting
            openen — om 02:48 is het crisisteam niet bijeen — en dan moet hier
            staan dat die mensen er nog niet bij zijn, niet dat zij input
            leveren. */}
        {nietAanZet.length > 0 && (
          <div className="flex items-start gap-2">
            <Clock className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
            <div className="min-w-0">
              <dt className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
                Deze ronde niet aan zet
              </dt>
              <dd className="text-xs text-muted-foreground">
                {nietAanZet.map(roleLabel).join(" · ")}
                <span className="mt-0.5 block text-[11px]">
                  Deze rollen hebben in deze ronde geen keuze. Lees de rondetekst: soms zijn ze
                  nog niet gealarmeerd, soms komen ze later aan de beurt.
                </span>
              </dd>
            </div>
          </div>
        )}

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
