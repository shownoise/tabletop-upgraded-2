"use client"

// Stap 1 — sessie en lobby. Alleen wat je nodig hebt om te kunnen starten:
// wie is binnen, welke rollen zijn gedekt, en waar gaat deze oefening over.
// Injectbeheer en specials staan bewust op de gereedschapsstap.

import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { EventModeHelp } from "@/components/admin/event-mode-help"
import { ParticipantsList } from "@/components/admin/participants-list"
import type { SessionState } from "@/lib/types"
import { tr, type Lang } from "@/lib/i18n"
import { RoleCoveragePanel } from "./role-coverage-panel"
import { STEP_PATH } from "./steps"

export function StepSessie({
  session,
  lang,
}: {
  session: SessionState
  lang: Lang
}) {
  const isLobby = session.status === "lobby"
  const readyCount = session.participants.filter(p => !!p.readyAt).length
  const totalRounds = session.graph
    ? session.graph.nodes.filter(n => n.type === "round").length
    : session.scenario.rounds.length

  return (
    <div className="flex flex-col gap-6">
      {/* Wat is de volgende zet. De knop zelf staat in de commandobalk boven;
          hier staat waarom hij wel of niet verstandig is. */}
      <section className="rounded-xl border border-primary/30 bg-primary/5 px-5 py-4">
        <p className="font-mono text-[10px] uppercase tracking-wider text-primary">Volgende zet</p>
        {isLobby ? (
          <p className="mt-1 text-sm text-foreground">
            {session.participants.length === 0
              ? "Nog niemand binnen. Deel de join-code hierboven; zodra er deelnemers zijn kun je starten."
              : `${readyCount} van ${session.participants.length} deelnemers staat op klaar. Start de sessie met de knop "${tr(lang, "startSession")}" rechtsboven.`}
          </p>
        ) : (
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-foreground">
            De oefening loopt.
            <Link
              href={STEP_PATH.ronde}
              className="inline-flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 px-2.5 py-1 font-mono text-[11px] uppercase tracking-wider text-primary hover:bg-primary/20"
            >
              Naar actieve ronde <ArrowRight className="size-3" />
            </Link>
          </p>
        )}
      </section>

      {session.mode === "event" && isLobby && <EventModeHelp joinCode={session.joinCode} />}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          {/* Dekking per rol: welke stoelen zijn gevuld. */}
          <RoleCoveragePanel session={session} />

          {/* Dekking per persoon: wie speelt wat, welke rol is overgenomen en
              wie heeft op dit moment mandaat. Dat is een andere vraag dan de
              paneel hierboven, dus staan ze naast elkaar. */}
          <ParticipantsList session={session} />
        </div>

        <aside className="flex flex-col gap-4">
          <section className="rounded-xl border border-border bg-card px-4 py-4">
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              {tr(lang, "scenarioSummary")}
            </span>
            <p className="mt-1 text-sm font-medium text-foreground">{session.scenario.scenario_title}</p>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              {session.scenario.scenario_summary}
            </p>
            <p className="mt-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              {totalRounds} {totalRounds === 1 ? "ronde" : "rondes"} ·{" "}
              {session.mode === "event" ? tr(lang, "mode_event") : tr(lang, "mode_training")}
            </p>
          </section>

          <section className="rounded-xl border border-border bg-card px-4 py-4">
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Beheer
            </span>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Injects, specials, reveal en de technische panelen staan op de
              gereedschapsstap, zodat ze de begeleiding niet in de weg zitten.
            </p>
            <Link
              href={STEP_PATH.gereedschap}
              className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1 font-mono text-[11px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
            >
              Naar gereedschap <ArrowRight className="size-3" />
            </Link>
          </section>

          {/* Sessie verwijderen staat hier NIET. Dat is bewust gescheiden van
              "oefening beëindigen" en staat alleen op de eindbespreking. */}
        </aside>
      </div>
    </div>
  )
}
