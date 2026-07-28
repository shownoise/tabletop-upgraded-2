"use client"

import { Settings2 } from "lucide-react"
import type { GraphFeatures, ScenarioGraph } from "@/lib/graph/types"
import { DEFAULT_FEATURES } from "@/lib/graph/types"

interface Props {
  graph: ScenarioGraph
  onGraphPatch?: (patch: Partial<ScenarioGraph>) => void
}

interface FeatureRow {
  key: keyof GraphFeatures
  label: string
  hint: string
}

const FEATURES: FeatureRow[] = [
  { key: 'reliability', label: 'Betrouwbaarheid (BOB)', hint: 'Feit / aanname / misleidend als tag + span-marker op injects.' },
  { key: 'compliance',  label: 'Compliance & meldplicht', hint: 'Meldplicht-profielen, NIS2-testgebieden en coverage-panel actief.' },
  { key: 'scoring',     label: 'Score & dimensies',      hint: 'Punten per keuze + cumulatieve score kiest automatisch outcome.' },
]

export function SettingsPanel({ graph, onGraphPatch }: Props) {
  const features = graph.features ?? DEFAULT_FEATURES

  function toggle(key: keyof GraphFeatures) {
    onGraphPatch?.({ features: { ...features, [key]: !features[key] } })
  }

  return (
    <div className="flex flex-col gap-2 border-b border-border px-3 py-3 bg-background/40">
      <div className="flex items-center gap-1.5">
        <Settings2 className="size-3 text-primary" />
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Scenario functies</span>
      </div>
      {FEATURES.map(f => (
        <label key={f.key} className="flex items-start gap-2 cursor-pointer group">
          <input
            type="checkbox"
            checked={features[f.key]}
            onChange={() => toggle(f.key)}
            className="size-3.5 mt-0.5"
          />
          <div className="flex flex-col leading-tight">
            <span className="font-mono text-[11px] group-hover:text-foreground">{f.label}</span>
            <span className="text-[10px] text-muted-foreground">{f.hint}</span>
          </div>
        </label>
      ))}
    </div>
  )
}
