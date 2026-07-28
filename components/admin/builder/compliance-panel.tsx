"use client"

import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import type { ScenarioGraph, MeldplichtConfig, MeldplichtProfile } from "@/lib/graph/types"
import { DEFAULT_MELDPLICHT, meldplichtFromProfile } from "@/lib/graph/types"
import { computeCoverage, previewSupervisionReport, SUPERVISION_AREAS } from "@/lib/engine/supervision"

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  graph: ScenarioGraph
  onGraphPatch?: (patch: Partial<ScenarioGraph>) => void
  onFocusNode?: (nodeId: string) => void
  onAutoFixCoverage?: (areaId: string) => void
}

type Tab = 'coverage' | 'preview'

export function CompliancePanel({ open, onOpenChange, graph, onGraphPatch, onFocusNode, onAutoFixCoverage }: Props) {
  const [tab, setTab] = useState<Tab>('coverage')

  // WHY: close the Sheet before focusing a node so setCenter can animate on an
  // unobstructed canvas (the right-side Sheet would otherwise sit over the target).
  const focusThenClose = (id: string) => {
    onOpenChange(false)
    setTimeout(() => onFocusNode?.(id), 220)
  }
  const autoFixThenClose = (areaId: string) => {
    onOpenChange(false)
    setTimeout(() => onAutoFixCoverage?.(areaId), 220)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[520px] sm:w-[520px] flex flex-col gap-3 overflow-hidden">
        <SheetHeader>
          <SheetTitle>Compliance</SheetTitle>
        </SheetHeader>
        <MeldplichtCard graph={graph} onGraphPatch={onGraphPatch} />
        <div className="flex gap-1 border-b border-border">
          {(['coverage','preview'] as Tab[]).map(t => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`px-2 py-1 text-xs font-mono uppercase tracking-wider ${tab === t ? "text-tt-accent border-b-2 border-tt-accent" : "text-muted-foreground hover:text-foreground"}`}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto">
          {tab === 'coverage' && <CoverageTab graph={graph} onFocusNode={onFocusNode ? focusThenClose : undefined} onAutoFix={onAutoFixCoverage ? autoFixThenClose : undefined} />}
          {tab === 'preview' && <PreviewTab graph={graph} />}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function CoverageTab({ graph, onFocusNode, onAutoFix }: { graph: ScenarioGraph; onFocusNode?: (id: string) => void; onAutoFix?: (areaId: string) => void }) {
  const entries = useMemo(() => computeCoverage(graph), [graph])
  const covered = entries.filter(e => e.coverageLevel !== 'none').length
  const missing = entries.filter(e => e.coverageLevel === 'none')
  return (
    <div className="flex flex-col gap-2 text-xs">
      <div className="flex items-center justify-between">
        <div className={`font-mono text-[11px] ${covered === entries.length ? "text-emerald-500" : "text-muted-foreground"}`}>
          {covered}/{entries.length} gebieden gedekt
        </div>
        {onAutoFix && missing.length > 0 && (
          <Button
            size="sm"
            variant="outline"
            className="h-6 px-2 text-[10px]"
            onClick={() => missing.forEach(m => onAutoFix(m.area))}
          >
            Auto-fix {missing.length} ontbrekende
          </Button>
        )}
      </div>
      <ul className="flex flex-col divide-y divide-border">
        {entries.map(e => (
          <li key={e.area} className="flex items-start gap-2 py-2">
            <span aria-hidden className={`mt-0.5 inline-block size-2 rounded-full ${
              e.coverageLevel === 'good' ? "bg-emerald-500" : e.coverageLevel === 'thin' ? "bg-yellow-500" : "bg-red-500"
            }`} />
            <div className="flex-1">
              <div className="flex items-center gap-1">
                <span className="font-mono text-[10px] text-muted-foreground">{e.meta.numberLabel}.</span>
                <span className="font-mono text-[11px]">{e.meta.label}</span>
              </div>
              <div className="text-[10px] text-muted-foreground">
                {e.touchedByNodes.length} nodes · {e.touchedByActions.length} actions
              </div>
              {e.touchedByNodes.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {e.touchedByNodes.map(nid => (
                    <button
                      key={nid}
                      type="button"
                      onClick={() => onFocusNode?.(nid)}
                      className="rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground hover:text-foreground"
                    >
                      {nid.slice(0, 8)}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {e.coverageLevel === 'none' && onAutoFix && (
              <Button size="sm" variant="outline" className="h-6 px-2 text-[10px]" onClick={() => onAutoFix(e.area)}>
                Auto-fix
              </Button>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

function MeldplichtCard({ graph, onGraphPatch }: { graph: ScenarioGraph; onGraphPatch?: (p: Partial<ScenarioGraph>) => void }) {
  const m = graph.meldplicht ?? DEFAULT_MELDPLICHT
  const profile: MeldplichtProfile = m.incidentProfile ?? deriveProfile(m)

  function setProfile(next: MeldplichtProfile) {
    onGraphPatch?.({ meldplicht: meldplichtFromProfile(next, { incidentDetectedAt: m.incidentDetectedAt }) })
  }
  function setClockStart(next: MeldplichtConfig['incidentDetectedAt']) {
    onGraphPatch?.({ meldplicht: { ...m, incidentDetectedAt: next } })
  }

  const PROFILES: Array<{ id: MeldplichtProfile; title: string; hint: string }> = [
    { id: 'personal_data_only',   title: 'AVG-incident',       hint: 'Persoonsgegevens gelekt → AP-melding (72u)' },
    { id: 'critical_service_only',title: 'NIS2 verstoring',    hint: 'Kritieke dienst uitgevallen → NCSC 24u / 72u' },
    { id: 'both',                 title: 'Beide — brede impact', hint: 'AVG én NIS2 spelen tegelijk' },
  ]

  return (
    <div className="flex flex-col gap-2 rounded border border-border bg-background/40 p-3">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Meldplicht — incidentprofiel</span>
        <span className="font-mono text-[10px] text-muted-foreground">Retainer · Eye Security</span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {PROFILES.map(p => (
          <button
            key={p.id}
            type="button"
            onClick={() => setProfile(p.id)}
            className={`flex flex-col gap-1 rounded-lg border px-2 py-1.5 text-left transition-colors ${
              profile === p.id
                ? "border-primary/60 bg-primary/5"
                : "border-border bg-background hover:border-primary/30"
            }`}
          >
            <span className="font-mono text-[11px] font-medium">{p.title}</span>
            <span className="text-[10px] text-muted-foreground leading-snug">{p.hint}</span>
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Klok start bij</span>
        <div className="flex gap-1">
          {(['start','round_1','round_2','round_3'] as const).map(v => (
            <button
              key={v}
              type="button"
              onClick={() => setClockStart(v)}
              className={`rounded border px-1.5 py-0.5 font-mono text-[10px] ${
                m.incidentDetectedAt === v
                  ? "border-primary/60 bg-primary/10 text-primary"
                  : "border-border bg-background text-muted-foreground hover:text-foreground"
              }`}
            >
              {v.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>
      <DerivedTimelineStrip config={meldplichtFromProfile(profile, { incidentDetectedAt: m.incidentDetectedAt })} />
    </div>
  )
}

function DerivedTimelineStrip({ config }: { config: MeldplichtConfig }) {
  const items: string[] = []
  if (config.ncsc24hEnabled) items.push("24u → NCSC waarschuwing")
  if (config.ncsc72hEnabled) items.push("72u → NCSC melding")
  if (config.apEnabled)      items.push("72u → AP-melding (AVG)")
  if (config.ncscFinalEnabled) items.push("1 mnd → eindverslag NCSC")
  if (items.length === 0) return null
  return (
    <div className="flex flex-wrap gap-1.5 border-t border-border pt-2">
      {items.map(t => (
        <span key={t} className="inline-flex items-center rounded-full bg-background px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
          {t}
        </span>
      ))}
    </div>
  )
}

function deriveProfile(m: MeldplichtConfig): MeldplichtProfile {
  if (m.apEnabled && (m.ncsc24hEnabled || m.ncsc72hEnabled)) return 'both'
  if (m.apEnabled) return 'personal_data_only'
  if (m.ncsc24hEnabled || m.ncsc72hEnabled) return 'critical_service_only'
  return 'both'
}

function PreviewTab({ graph }: { graph: ScenarioGraph }) {
  const outcomes = graph.nodes.filter(n => n.type === 'outcome')
  return (
    <div className="flex flex-col gap-3 text-xs">
      {outcomes.length === 0 && <p className="text-muted-foreground italic">Geen outcome-nodes in deze graph.</p>}
      {outcomes.map(o => {
        const report = previewSupervisionReport(graph, o.id)
        const data = o.data as { key?: string; label?: string; narrative?: string }
        return (
          <div key={o.id} className="rounded border border-border p-2">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[11px]">{data.label ?? o.id.slice(0, 8)}</span>
              <span className={`font-mono text-[10px] ${report.overallScore >= 2.5 ? "text-emerald-500" : report.overallScore >= 1.5 ? "text-yellow-500" : "text-red-500"}`}>
                gem. {report.overallScore.toFixed(1)}
              </span>
            </div>
            {data.narrative && <p className="mt-1 text-[10px] text-muted-foreground leading-relaxed">{data.narrative.slice(0, 200)}…</p>}
            <ul className="mt-2 grid grid-cols-2 gap-x-2 gap-y-0.5">
              {SUPERVISION_AREAS.map(a => {
                const r = report.areas.find(x => x.area === a.id)
                const s = r?.score ?? 0
                return (
                  <li key={a.id} className="flex items-center gap-1 text-[10px]">
                    <span className={`inline-block size-1.5 rounded-full ${
                      s === 3 ? "bg-emerald-500" : s === 2 ? "bg-emerald-400/70" : s === 1 ? "bg-yellow-500" : "bg-red-500/70"
                    }`} />
                    <span className="text-muted-foreground">{a.numberLabel}.</span>
                    <span className="truncate flex-1">{a.label}</span>
                    <span className="font-mono">{r?.evidence.length ? s : "—"}</span>
                  </li>
                )
              })}
            </ul>
            <label className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground">
              <input type="checkbox" className="size-3" /> Kan sluitingsbewijs ontstaan uit deze outcome?
            </label>
          </div>
        )
      })}
    </div>
  )
}

