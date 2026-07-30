"use client"

import { useState, useEffect } from "react"
import type { DecisionNodeData, InjectNodeData, OutcomeVector, RoundNodeData } from "@/lib/graph/types"

// Kleine, compacte inspectorpanelen voor de scoring-annotatie uit Deel A/B.
// Alle velden zijn optioneel — legacy nodes zonder annotatie blijven werken;
// de scoring-adapter valt terug op inferentie zolang de velden leeg zijn.

const DIM_LABELS: Record<keyof OutcomeVector, string> = {
  CONT: "Containment",
  FOR:  "Forensische integriteit",
  BC:   "Bedrijfscontinuïteit",
  JUR:  "Juridisch",
  VER:  "Vertrouwen",
  KOS:  "Kosten",
}

const DIM_ORDER: Array<keyof OutcomeVector> = ["CONT", "FOR", "BC", "JUR", "VER", "KOS"]

// ── Round-scoring panel ────────────────────────────────────────────────

export function RoundScoringFields({ data, onSave }: { data: RoundNodeData; onSave: (next: RoundNodeData) => void }) {
  const [designTime, setDesignTime] = useState<string>(String(data.scoring?.designTimeMinutes ?? ""))
  const [weights, setWeights] = useState<OutcomeVector>(data.scoring?.outcomeWeights ?? { CONT: 1, FOR: 1, BC: 1, JUR: 1, VER: 1, KOS: 1 })
  const [showWeights, setShowWeights] = useState(!!data.scoring?.outcomeWeights)

  useEffect(() => {
    setDesignTime(String(data.scoring?.designTimeMinutes ?? ""))
    setWeights(data.scoring?.outcomeWeights ?? { CONT: 1, FOR: 1, BC: 1, JUR: 1, VER: 1, KOS: 1 })
    setShowWeights(!!data.scoring?.outcomeWeights)
  }, [data])

  function commit(patch: Partial<NonNullable<RoundNodeData['scoring']>>) {
    const nextScoring = { ...data.scoring, ...patch }
    // Als alles undefined is → hele scoring-veld verwijderen.
    const cleaned = Object.fromEntries(Object.entries(nextScoring).filter(([, v]) => v !== undefined))
    onSave({ ...data, scoring: Object.keys(cleaned).length === 0 ? undefined : (cleaned as RoundNodeData['scoring']) })
  }

  return (
    <details className="border rounded p-3 mt-4 bg-muted/30" open={showWeights || !!data.scoring?.designTimeMinutes}>
      <summary className="cursor-pointer text-xs font-mono uppercase tracking-wide text-muted-foreground">
        Scoring §5 / §7.1
      </summary>
      <div className="mt-3 space-y-3">
        <label className="block">
          <span className="text-xs text-muted-foreground">Design time (Δ_ref, minuten)</span>
          <input
            type="number" min={1} max={120}
            value={designTime}
            onChange={e => setDesignTime(e.target.value)}
            onBlur={() => commit({ designTimeMinutes: designTime === "" ? undefined : Number(designTime) })}
            className="w-24 border rounded px-2 py-1 text-sm mt-1"
            placeholder="20"
          />
          <span className="text-[10px] text-muted-foreground ml-2">
            Referentietijd voor tempo-scoring. Leeg → val terug op timerMinutes.
          </span>
        </label>

        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={showWeights}
            onChange={e => {
              setShowWeights(e.target.checked)
              if (!e.target.checked) commit({ outcomeWeights: undefined })
            }}
          />
          <span>Custom weging per dimensie (anders: gelijk gewicht)</span>
        </label>

        {showWeights && (
          <div className="grid grid-cols-3 gap-2">
            {DIM_ORDER.map(dim => (
              <label key={dim} className="text-xs">
                <span className="block text-muted-foreground">{dim} — {DIM_LABELS[dim]}</span>
                <input
                  type="number" min={0} max={5} step={0.5}
                  value={weights[dim]}
                  onChange={e => {
                    const v = Number(e.target.value)
                    const next = { ...weights, [dim]: v }
                    setWeights(next)
                    commit({ outcomeWeights: next })
                  }}
                  className="w-full border rounded px-2 py-1 text-sm mt-1"
                />
              </label>
            ))}
          </div>
        )}
      </div>
    </details>
  )
}

// ── Inject-scoring panel ───────────────────────────────────────────────

export function InjectScoringFields({ data, onSave }: { data: InjectNodeData; onSave: (next: InjectNodeData) => void }) {
  return (
    <details className="border rounded p-3 mt-4 bg-muted/30" open={!!data.importance || !!data.correctRoute}>
      <summary className="cursor-pointer text-xs font-mono uppercase tracking-wide text-muted-foreground">
        Scoring §3.1 / §4.2c
      </summary>
      <div className="mt-3 space-y-3">
        <label className="block">
          <span className="text-xs text-muted-foreground">Importance (crucial / info)</span>
          <select
            value={data.importance ?? ""}
            onChange={e => onSave({ ...data, importance: e.target.value === "" ? undefined : e.target.value as 'crucial' | 'info' })}
            className="w-full border rounded px-2 py-1 text-sm mt-1"
          >
            <option value="">— auto (uit urgency + nis2Relevant) —</option>
            <option value="crucial">crucial (materieel event)</option>
            <option value="info">info (achtergrond / ruis)</option>
          </select>
          <span className="text-[10px] text-muted-foreground block mt-1">
            Crucial telt in D-noemer van BESLUIT + materieel event voor ADAPT.
          </span>
        </label>

        <label className="block">
          <span className="text-xs text-muted-foreground">correctRoute (misroute: welke rol had 'm moeten krijgen)</span>
          <select
            value={data.correctRoute ?? ""}
            onChange={e => onSave({ ...data, correctRoute: e.target.value === "" ? undefined : e.target.value as InjectNodeData['correctRoute'] })}
            className="w-full border rounded px-2 py-1 text-sm mt-1"
          >
            <option value="">— geen misroute —</option>
            <option value="ceo">CEO</option>
            <option value="ciso">CISO</option>
            <option value="cfo">CFO</option>
            <option value="legal">Legal</option>
            <option value="head_of_comms">Head of Comms</option>
            <option value="hr_lead">HR Lead</option>
            <option value="ops_manager">Ops Manager</option>
            <option value="it_manager">IT Manager</option>
            <option value="system_admin">System Admin</option>
          </select>
        </label>
      </div>
    </details>
  )
}

// ── Decision-option scoring panel ──────────────────────────────────────

export function OptionScoringFields({
  option,
  onChange,
}: {
  option: DecisionNodeData['options'][number]
  onChange: (patch: Partial<DecisionNodeData['options'][number]>) => void
}) {
  const [vec, setVec] = useState<OutcomeVector>(option.outcomeVector ?? { CONT: 0, FOR: 0, BC: 0, JUR: 0, VER: 0, KOS: 0 })
  const [enabled, setEnabled] = useState(!!option.outcomeVector)

  useEffect(() => {
    setVec(option.outcomeVector ?? { CONT: 0, FOR: 0, BC: 0, JUR: 0, VER: 0, KOS: 0 })
    setEnabled(!!option.outcomeVector)
  }, [option])

  function updateDim(dim: keyof OutcomeVector, v: number) {
    const next = { ...vec, [dim]: clamp(v) }
    setVec(next)
    onChange({ outcomeVector: next })
  }

  return (
    <details className="border rounded p-2 mt-2 bg-muted/20" open={enabled}>
      <summary className="cursor-pointer text-[11px] text-muted-foreground">
        Outcome-vector §5 {option.implicit && <span className="ml-2 text-amber-600">(implicit)</span>}
      </summary>
      <div className="mt-2 space-y-2">
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={enabled}
            onChange={e => {
              setEnabled(e.target.checked)
              onChange({ outcomeVector: e.target.checked ? vec : undefined })
            }}
          />
          <span>Vector zetten (anders: uit scoreImpacts + qualityRank afgeleid)</span>
        </label>
        {enabled && (
          <div className="grid grid-cols-6 gap-1">
            {DIM_ORDER.map(dim => (
              <label key={dim} className="text-[10px] text-center">
                <span className="block text-muted-foreground">{dim}</span>
                <input
                  type="number" min={-2} max={2} step={1}
                  value={vec[dim]}
                  onChange={e => updateDim(dim, Number(e.target.value))}
                  className="w-full border rounded px-1 py-0.5 text-xs text-center"
                />
              </label>
            ))}
          </div>
        )}
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={!!option.implicit}
            onChange={e => onChange({ implicit: e.target.checked || undefined })}
          />
          <span>Implicit "geen besluit" optie (Deel B §7.1)</span>
        </label>
      </div>
    </details>
  )
}

function clamp(v: number): number {
  return Math.max(-2, Math.min(2, Math.round(v)))
}
