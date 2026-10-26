"use client"

// Gereedschap — alles wat beheer is en geen begeleidingsstap: injectbeheer,
// specials, reveal, routeplan, fact-check, meldplicht en het ruwe logboek.
//
// Niets hiervan is verwijderd; het staat alleen niet meer tussen de fase, de
// tijd en de beslisvraag in. Dat was probleem 1 van issue #105: de facilitator
// moest tijdens een live ronde langs alle injectteksten scrollen.

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
import { SupervisionReportView } from "@/components/admin/supervision-report"
import { api } from "@/lib/api-client"
import { buildTeamRoles } from "@/lib/team-roster"
import { tr, type Lang } from "@/lib/i18n"
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

  return (
    <div className="flex flex-col gap-6">
      <p className="max-w-3xl text-sm text-muted-foreground">
        Beheer en techniek. Deze panelen horen niet in de hoofdflow, maar werken
        hier precies zoals eerst.
      </p>

      <ToolSection title={tr(lang, "injectControls")} defaultOpen>
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
          {!isCoreEvent && isActive && session.roundPhase === "discussion" && (
            <PremadeInjectPanel session={session} />
          )}
          {!isCoreEvent && (session.injectRoutePlan || isActive) && (
            <InjectRoutePlan
              session={session}
              teamRoles={buildTeamRoles()}
              onReplot={async () => { await api.replotInjects() }}
            />
          )}
        </div>
      </ToolSection>

      {!isCoreEvent && session.config.specialsMode && session.config.specialsMode !== "off" && (
        <ToolSection title="Speciale gebeurtenissen">
          <SpecialsPanel session={session} />
        </ToolSection>
      )}

      {session.graph && (
        <ToolSection title="Reveal voor de zaal">
          <RevealPanel visible currentRound={Math.max(currentIndex + 1, 1)} session={session} />
        </ToolSection>
      )}

      {!isCoreEvent && (
        <ToolSection title="Meldplicht en toezicht">
          <div className="flex flex-col gap-4">
            <RegulatoryObligationsPanel session={session} />
            <SupervisionReportView />
          </div>
        </ToolSection>
      )}

      {!isCoreEvent && (
        <ToolSection title="Scenario-techniek">
          <div className="flex flex-col gap-4">
            {session.graph && <GraphPathPanel session={session} />}
            <FactCheckPanel session={session} />
          </div>
        </ToolSection>
      )}

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
    </div>
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
