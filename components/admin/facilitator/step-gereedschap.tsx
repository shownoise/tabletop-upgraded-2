"use client"

// Gereedschap — alles wat beheer is en geen begeleidingsstap: injectbeheer,
// specials, reveal, routeplan, fact-check, meldplicht en het ruwe logboek.
//
// Niets hiervan is verwijderd; het staat alleen niet meer tussen de fase, de
// tijd en de beslisvraag in. Dat was probleem 1 van issue #105: de facilitator
// moest tijdens een live ronde langs alle injectteksten scrollen.
//
// Daarna bleef de stap zelf te vol: tien inklapbare blokken op één hoop, en de
// facilitator moest ze allemaal lezen om te weten welke hij nú nodig had. De
// panelen staan daarom gegroepeerd op *wanneer* je ze nodig hebt:
//
//   Tijdens een ronde — handelingen die het team meteen raken (inject, special,
//                       meldplicht-stand, reveal). Open wat je echt gebruikt.
//   Nakijken         — controle op wat al gebeurd is; kan altijd wachten.
//   Na de oefening   — het toezichthouder-rapport. Ingeklapt achter één regel.
//   Techniek         — het ruwe logboek.
//
// De scheiding is puur presentatie: dezelfde panelen, dezelfde props, dezelfde
// zichtbaarheidsvoorwaarden als eerst.

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { FactCheckPanel } from "@/components/admin/fact-check-panel"
import { GraphPathPanel } from "@/components/admin/graph-path-panel"
import { InjectControls } from "@/components/admin/inject-controls"
import { InjectRoutePlan } from "@/components/admin/inject-route-plan"
import { PremadeInjectPanel } from "@/components/admin/premade-inject-panel"
import { RegulatoryObligationsPanel } from "@/components/admin/regulatory-obligations-panel"
import { RevealPanel } from "@/components/admin/reveal-panel"
import { SpecialsPanel } from "@/components/admin/specials-panel"
import { SupervisionReportSection } from "./supervision-report-section"
import { api } from "@/lib/api-client"
import { buildTeamRoles } from "@/lib/team-roster"
import { tr, type Lang } from "@/lib/i18n"
import type { DecisionNodeData } from "@/lib/graph/types"
import type { SessionState } from "@/lib/types"
import type { FacilitatorActions } from "./facilitator-shell"

export function StepGereedschap({
  session,
  lang,
  actions,
}: {
  session: SessionState
  lang: Lang
  actions: FacilitatorActions
}) {
  const currentIndex = session.currentRound
  const currentRound = currentIndex >= 0 ? session.scenario.rounds[currentIndex] : null
  const isActive = session.status === "active"
  const isCoreEvent = session.mode === "event" && !!session.graph

  // Wacht de graph op een keuze van de facilitator? Dan is het scenario-pad geen
  // naslag maar een blokkade: die hoort open en bovenaan te staan. Dit is ook de
  // enige UI voor zo'n keuze (`FacilitatorDecisionPicker` in graph-path-panel),
  // dus in event-modus — waar het paneel normaal verborgen is — tonen we hem
  // alsnog zodra er een keuze wacht. Anders loopt de sessie vast.
  const graphNode = session.graph && session.graphState
    ? session.graph.nodes.find(n => n.id === session.graphState!.currentNodeId)
    : undefined
  const needsFacilitatorPick =
    graphNode?.type === "decision" &&
    (graphNode.data as DecisionNodeData).measuredBy === "facilitator_trigger"

  const showPremade = !isCoreEvent && isActive && session.roundPhase === "discussion"
  const showSpecials =
    !isCoreEvent && !!session.config.specialsMode && session.config.specialsMode !== "off"
  const showReveal = !!session.graph
  // Het paneel rendert zelf `null` zonder regime of verplichtingen; dat zou een
  // leeg open blok opleveren, dus hier al weggefilterd.
  const showObligations =
    !isCoreEvent &&
    !!session.regulatoryRegime &&
    (session.regulatoryObligations?.length ?? 0) > 0
  const showRoutePlan = !isCoreEvent && (!!session.injectRoutePlan || isActive)
  const showGraphPath = !!session.graph && (!isCoreEvent || needsFacilitatorPick)
  const showFactCheck = !isCoreEvent
  const showNakijken = showRoutePlan || (showGraphPath && !needsFacilitatorPick) || showFactCheck

  return (
    <div className="flex flex-col gap-8">
      <p className="max-w-3xl text-sm text-muted-foreground">
        Beheer en techniek, gegroepeerd op wanneer je het nodig hebt. Deze panelen
        horen niet in de hoofdflow, maar werken hier precies zoals eerst.
      </p>

      <ToolGroup
        title="Tijdens een ronde"
        hint="Handelingen die de deelnemers meteen zien. Alles hier is definitief."
      >
        {showGraphPath && needsFacilitatorPick && (
          <ToolSection title="Scenario-pad — keuze vereist" defaultOpen>
            <GraphPathPanel session={session} />
          </ToolSection>
        )}

        {/* Inline label i.p.v. tr(lang, "injectControls") ("Injectbeheer"): dit blok
            is tijdens een ronde een handeling, geen beheeroverzicht. */}
        <ToolSection title="Inject sturen" defaultOpen>
          <div className="flex flex-col gap-4">
            {currentRound && (
              <Badge
                variant="outline"
                className="w-fit border-primary/40 bg-primary/10 font-mono text-[10px] uppercase tracking-wider text-primary"
              >
                R{currentIndex + 1} — {currentRound.title}
              </Badge>
            )}
            <InjectControls session={session} disabled={actions.working !== null} lang={lang} />
            {showPremade && <PremadeInjectPanel session={session} />}
          </div>
        </ToolSection>

        {showObligations && (
          <ToolSection title="Meldplicht — stand van zaken" defaultOpen>
            <RegulatoryObligationsPanel session={session} />
          </ToolSection>
        )}

        {showSpecials && (
          <ToolSection title="Speciale gebeurtenissen">
            <SpecialsPanel session={session} />
          </ToolSection>
        )}

        {showReveal && (
          <ToolSection title="Reveal voor de zaal">
            <RevealPanel visible currentRound={Math.max(currentIndex + 1, 1)} session={session} />
          </ToolSection>
        )}
      </ToolGroup>

      {showNakijken && (
        <ToolGroup
          title="Nakijken"
          hint="Controle op wat er al gebeurd is. Hoeft nooit midden in een ronde."
        >
          {showRoutePlan && (
            <ToolSection title="Verdeling injects">
              <InjectRoutePlan
                session={session}
                teamRoles={buildTeamRoles()}
                onReplot={async () => { await api.replotInjects() }}
              />
            </ToolSection>
          )}

          {showGraphPath && !needsFacilitatorPick && (
            <ToolSection title="Scenario-pad">
              <GraphPathPanel session={session} />
            </ToolSection>
          )}

          {showFactCheck && (
            <ToolSection title="Factcheck deelnemers">
              <FactCheckPanel session={session} />
            </ToolSection>
          )}
        </ToolGroup>
      )}

      {!isCoreEvent && (
        <ToolGroup
          title="Na de oefening"
          hint="Verantwoording voor de toezichthouder. Lees je in het nagesprek, niet tijdens het spelen."
        >
          <SupervisionReportSection />
        </ToolGroup>
      )}

      <ToolGroup title="Techniek" hint="Alleen nodig als iets niet lijkt te werken.">
        <ToolSection title={tr(lang, "eventLog")}>
          <div className="flex max-h-80 flex-col gap-2 overflow-y-auto">
            {session.timeline.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nog geen gebeurtenissen.</p>
            ) : (
              [...session.timeline].reverse().slice(0, 50).map(ev => (
                <div key={ev.id} className="flex items-start gap-2 text-xs">
                  <span className="mt-0.5 shrink-0 font-mono text-[9px] text-muted-foreground">
                    {new Date(ev.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <span className="leading-relaxed text-muted-foreground">
                    {ev.type.replace(/_/g, " ")}
                    {(ev.data as { name?: string }).name ? ` — ${(ev.data as { name?: string }).name}` : ""}
                  </span>
                </div>
              ))
            )}
          </div>
        </ToolSection>
      </ToolGroup>
    </div>
  )
}

// Eén kopje per moment waarop je gereedschap nodig hebt. Niet inklapbaar: het
// kopje is juist het ding dat in één blik moet zeggen waar de facilitator moet
// zijn — dat werkt niet als je er eerst op moet klikken.
function ToolGroup({
  title,
  hint,
  children,
}: {
  title: string
  hint: string
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-3">
      <header className="flex flex-col gap-0.5">
        <h2 className="font-mono text-xs uppercase tracking-widest text-foreground">{title}</h2>
        <p className="text-[11px] text-muted-foreground">{hint}</p>
      </header>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  )
}

// Eén inklapbaar blok per gereedschap. Dicht als uitgangspunt, zodat de pagina
// niet opnieuw één lange stapel wordt.
function ToolSection({
  title,
  defaultOpen = false,
  children,
}: {
  title: string
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section className="rounded-xl border border-border bg-card">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-5 py-3 text-left transition-colors hover:bg-muted/30"
      >
        <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">{title}</span>
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {open ? "Inklappen" : "Uitklappen"}
        </span>
      </button>
      {open && <div className="border-t border-border p-5">{children}</div>}
    </section>
  )
}
