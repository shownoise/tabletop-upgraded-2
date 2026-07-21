"use client"

import type { SessionState } from "@/lib/types"

export function ScenarioSummary({ session }: { session: SessionState }) {
  const { scenario, config } = session
  return (
    <div className="rounded-lg border border-border bg-card">
      <header className="border-b border-border px-5 py-3 md:px-6">
        <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Scenario</span>
      </header>
      <div className="flex flex-col gap-4 p-5 md:p-6">
        <h2 className="text-balance text-xl font-medium tracking-tight md:text-2xl">{scenario.scenario_title}</h2>
        <p className="text-pretty leading-relaxed text-muted-foreground">{scenario.scenario_summary}</p>

        <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-border pt-4 font-mono text-xs md:grid-cols-4">
          <Meta label="Sector" value={config.sector} />
          <Meta label="Size" value={config.companySize} />
          <Meta label="IT maturity" value={config.itMaturity ?? ""} />
          <Meta label="Type" value={config.scenarioType} />
          <Meta label="Duration" value={config.duration} />
          <Meta label="Team structure" value={config.teamStructure ?? ""} />
          <Meta label="Crown jewels" value={config.crownJewels} className="col-span-2" />
          <Meta label="Critical systems" value={config.criticalSystems} className="col-span-2" />
        </dl>
      </div>
    </div>
  )
}

function Meta(props: { label: string; value: string; className?: string }) {
  return (
    <div className={`flex flex-col gap-1 ${props.className ?? ""}`}>
      <dt className="uppercase tracking-wider text-muted-foreground">{props.label}</dt>
      <dd className="text-foreground">{props.value || "—"}</dd>
    </div>
  )
}
