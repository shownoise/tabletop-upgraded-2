"use client"

import { useMemo, useState } from "react"
import { AlertCircle, CheckCircle, Circle, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import type { ScenarioGraph, MeldplichtConfig } from "@/lib/graph/types"
import { DEFAULT_MELDPLICHT } from "@/lib/graph/types"
import type { IrRetainerProfile } from "@/lib/types"
import { computeCoverage, previewSupervisionReport, SUPERVISION_AREAS } from "@/lib/engine/supervision"

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  graph: ScenarioGraph
  onGraphPatch?: (patch: Partial<ScenarioGraph>) => void
  onFocusNode?: (nodeId: string) => void
  onAutoFixCoverage?: (areaId: string) => void
}

type Tab = 'coverage' | 'meldplicht' | 'retainer' | 'preview'

export function CompliancePanel({ open, onOpenChange, graph, onGraphPatch, onFocusNode, onAutoFixCoverage }: Props) {
  const [tab, setTab] = useState<Tab>('coverage')

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[520px] sm:w-[520px] flex flex-col gap-3 overflow-hidden">
        <SheetHeader>
          <SheetTitle>Compliance</SheetTitle>
        </SheetHeader>
        <div className="flex gap-1 border-b border-border">
          {(['coverage','meldplicht','retainer','preview'] as Tab[]).map(t => (
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
          {tab === 'coverage' && <CoverageTab graph={graph} onFocusNode={onFocusNode} onAutoFix={onAutoFixCoverage} />}
          {tab === 'meldplicht' && <MeldplichtTab graph={graph} onGraphPatch={onGraphPatch} />}
          {tab === 'retainer' && <RetainerTab graph={graph} onGraphPatch={onGraphPatch} />}
          {tab === 'preview' && <PreviewTab graph={graph} />}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function CoverageTab({ graph, onFocusNode, onAutoFix }: { graph: ScenarioGraph; onFocusNode?: (id: string) => void; onAutoFix?: (areaId: string) => void }) {
  const entries = useMemo(() => computeCoverage(graph), [graph])
  const covered = entries.filter(e => e.coverageLevel !== 'none').length
  return (
    <div className="flex flex-col gap-2 text-xs">
      <div className={`font-mono text-[11px] ${covered === entries.length ? "text-emerald-500" : "text-muted-foreground"}`}>
        {covered}/{entries.length} gebieden gedekt
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

function MeldplichtTab({ graph, onGraphPatch }: { graph: ScenarioGraph; onGraphPatch?: (p: Partial<ScenarioGraph>) => void }) {
  const m = graph.meldplicht ?? DEFAULT_MELDPLICHT
  function patch(next: Partial<MeldplichtConfig>) {
    onGraphPatch?.({ meldplicht: { ...m, ...next } })
  }
  return (
    <div className="flex flex-col gap-3 text-xs">
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={m.enabled} onChange={e => patch({ enabled: e.target.checked })} className="size-3" />
        <span>Meldplicht spelen deze sessie</span>
      </label>
      <div>
        <div className="font-mono text-[10px] uppercase text-muted-foreground mb-1">Wanneer start de deadline-klok?</div>
        {(['start','round_1','round_2','round_3'] as const).map(v => (
          <label key={v} className="flex items-center gap-2">
            <input type="radio" checked={m.incidentDetectedAt === v} onChange={() => patch({ incidentDetectedAt: v })} />
            <span>{v.replace('_', ' ')}</span>
          </label>
        ))}
      </div>
      <div className="flex flex-col gap-1">
        <Toggle label="24u NCSC vroegtijdige waarschuwing" hint="Verplicht binnen 24 uur na constatering" value={m.ncsc24hEnabled} onChange={v => patch({ ncsc24hEnabled: v })} />
        <Toggle label="72u NCSC melding met initiële beoordeling" hint="Uiterlijk 72 uur" value={m.ncsc72hEnabled} onChange={v => patch({ ncsc72hEnabled: v })} />
        <Toggle label="Eindverslag / voortgangsverslag NCSC" hint="Uiterlijk 1 maand" value={m.ncscFinalEnabled} onChange={v => patch({ ncscFinalEnabled: v })} />
        <Toggle label="AP-melding (AVG)" hint="72u vanaf constatering" value={m.apEnabled} onChange={v => patch({ apEnabled: v })} />
        <Toggle label="Chasers automatisch vuren bij gemiste deadline" value={m.chasersEnabled} onChange={v => patch({ chasersEnabled: v })} />
      </div>
    </div>
  )
}

function Toggle({ label, hint, value, onChange }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex flex-col gap-0.5 rounded border border-border bg-background/40 px-2 py-1">
      <span className="flex items-center gap-2 text-[11px]">
        <input type="checkbox" checked={value} onChange={e => onChange(e.target.checked)} className="size-3" />
        {label}
      </span>
      {hint && <span className="text-[10px] text-muted-foreground pl-5">{hint}</span>}
    </label>
  )
}

function RetainerTab({ graph, onGraphPatch }: { graph: ScenarioGraph; onGraphPatch?: (p: Partial<ScenarioGraph>) => void }) {
  const p: IrRetainerProfile = graph.irRetainerProfile ?? {
    name: "",
    activationNumber: "",
    authorizedActivators: [],
    slaMinutesToFirstContact: 30,
    handoffChecklist: [],
    scopeIncludes: [],
    scopeExcludes: [],
  }
  function patch(next: Partial<IrRetainerProfile>) {
    onGraphPatch?.({ irRetainerProfile: { ...p, ...next } })
  }
  function warn(field: unknown) {
    return Array.isArray(field) ? field.length === 0 : !field
  }
  return (
    <div className="grid grid-cols-1 gap-2 text-xs">
      <FieldRow label="Naam retainer-partij" warning={warn(p.name)}>
        <Input value={p.name} onChange={e => patch({ name: e.target.value })} />
      </FieldRow>
      <FieldRow label="24/7 nummer" warning={warn(p.activationNumber)}>
        <Input value={p.activationNumber} onChange={e => patch({ activationNumber: e.target.value })} />
      </FieldRow>
      <FieldRow label="SLA minuten tot eerste contact">
        <Input type="number" min={0} value={p.slaMinutesToFirstContact} onChange={e => patch({ slaMinutesToFirstContact: Number(e.target.value) })} />
      </FieldRow>
      <FieldRow label="Geautoriseerde activators (komma)" warning={warn(p.authorizedActivators)}>
        <Input value={p.authorizedActivators.join(", ")} onChange={e => patch({ authorizedActivators: e.target.value.split(",").map(s => s.trim()).filter(Boolean) })} />
      </FieldRow>
      <FieldRow label="Overdrachtchecklist (per regel)" warning={warn(p.handoffChecklist)}>
        <Textarea rows={3} value={p.handoffChecklist.join("\n")} onChange={e => patch({ handoffChecklist: e.target.value.split("\n").map(s => s.trim()).filter(Boolean) })} className="text-[11px]" />
      </FieldRow>
      <FieldRow label="Scope includes (per regel)">
        <Textarea rows={2} value={p.scopeIncludes.join("\n")} onChange={e => patch({ scopeIncludes: e.target.value.split("\n").map(s => s.trim()).filter(Boolean) })} className="text-[11px]" />
      </FieldRow>
      <FieldRow label="Scope excludes (per regel)">
        <Textarea rows={2} value={p.scopeExcludes.join("\n")} onChange={e => patch({ scopeExcludes: e.target.value.split("\n").map(s => s.trim()).filter(Boolean) })} className="text-[11px]" />
      </FieldRow>
    </div>
  )
}

function FieldRow({ label, warning, children }: { label: string; warning?: boolean; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-0.5">
      <span className="font-mono text-[10px] uppercase text-muted-foreground flex items-center gap-1">
        {warning && <AlertCircle className="size-3 text-yellow-500" />}
        {label}
      </span>
      {children}
    </label>
  )
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
