"use client"

import { useMemo, useState } from "react"
import { ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CompliancePanel } from "./compliance-panel"
import type { ScenarioGraph, MeldplichtProfile } from "@/lib/graph/types"
import { DEFAULT_MELDPLICHT, EYE_SECURITY_RETAINER } from "@/lib/graph/types"
import { computeCoverage } from "@/lib/engine/supervision"

interface Props {
  graph: ScenarioGraph
  onGraphPatch?: (patch: Partial<ScenarioGraph>) => void
  onFocusNode?: (nodeId: string) => void
  onAutoFixCoverage?: (areaId: string) => void
}

const PROFILE_LABEL: Record<MeldplichtProfile, string> = {
  personal_data_only: 'AVG',
  critical_service_only: 'NIS2',
  both: 'AVG + NIS2',
}

export function ComplianceRail({ graph, onGraphPatch, onFocusNode, onAutoFixCoverage }: Props) {
  const [open, setOpen] = useState(false)
  const entries = useMemo(() => computeCoverage(graph), [graph])
  const covered = entries.filter(e => e.coverageLevel !== 'none').length
  const missing = entries.filter(e => e.coverageLevel === 'none')
  const profile: MeldplichtProfile = graph.meldplicht?.incidentProfile ?? DEFAULT_MELDPLICHT.incidentProfile ?? 'both'
  const retainerName = graph.irRetainerName ?? EYE_SECURITY_RETAINER.name

  function autoFixAll() {
    // Drop a suggestion node per missing area. Handled by canvas's onAutoFixCoverage.
    missing.forEach(m => onAutoFixCoverage?.(m.area))
  }

  return (
    <div className="flex flex-col gap-2 border-t border-border px-3 py-3 bg-background/40">
      <div className="flex items-center gap-1.5">
        <ShieldCheck className="size-3 text-primary" />
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Compliance</span>
      </div>
      <div className="flex items-center gap-2">
        <span aria-hidden className={`inline-block size-2 rounded-full ${
          covered === entries.length ? "bg-emerald-500" : covered === 0 ? "bg-red-500" : "bg-yellow-500"
        }`} />
        <span className="font-mono text-[11px]">{covered}/{entries.length} gedekt</span>
      </div>
      {missing.length > 0 && onAutoFixCoverage && (
        <Button size="sm" variant="outline" className="h-7 text-[10px] justify-start" onClick={autoFixAll}>
          Auto-fix {missing.length} ontbrekende
        </Button>
      )}
      <Button size="sm" variant="ghost" className="h-7 text-[10px] justify-start" onClick={() => setOpen(true)}>
        Open compliance…
      </Button>
      <div className="flex flex-col gap-1 border-t border-border pt-2 font-mono text-[10px] text-muted-foreground">
        <div className="flex items-center justify-between">
          <span>Meldplicht</span>
          <span className="text-foreground">{PROFILE_LABEL[profile]}</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Retainer</span>
          <span className="text-foreground">{retainerName}</span>
        </div>
      </div>
      <CompliancePanel
        open={open}
        onOpenChange={setOpen}
        graph={graph}
        onGraphPatch={onGraphPatch}
        onFocusNode={onFocusNode}
        onAutoFixCoverage={onAutoFixCoverage}
      />
    </div>
  )
}
