"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import type { EvaluationAspect, GraphFeatures } from "@/lib/graph/types"
import { DEFAULT_FEATURES } from "@/lib/graph/types"

interface AspectMeta {
  key: EvaluationAspect
  label: string
  hint: string
  appliesTo: Array<'inject' | 'round'>
}

// Order matters — this is the order rendered in the picker + inspector pills.
export const ASPECTS: AspectMeta[] = [
  { key: 'reliability',       label: 'Betrouwbaarheid',   hint: 'BOB-tag + markeer specifieke zinnen als feit / aanname / misleidend', appliesTo: ['inject'] },
  { key: 'nis2',              label: 'NIS2',              hint: 'Koppel aan NIS2-testgebieden en meldplicht',                          appliesTo: ['inject', 'round'] },
  { key: 'decision_impact',   label: 'Beslis-impact',     hint: 'Voeg scoreImpact / dimensie toe (zichtbaar bij decisions)',          appliesTo: ['round'] },
  { key: 'lessons_learned',   label: 'Lessons learned',   hint: 'Toon leerdoelen en debrief-tekstvelden',                              appliesTo: ['round'] },
]

// Short badge label for node cards + inspector pills.
// 'facts_assumptions' is kept as an alias so old graphs render — it is normalized
// to 'reliability' before any UI logic uses it.
export const ASPECT_BADGE: Record<EvaluationAspect, string> = {
  reliability: 'BOB',
  facts_assumptions: 'BOB',
  nis2: 'NIS2',
  decision_impact: 'DEC',
  lessons_learned: 'LL',
}

// Legacy 'facts_assumptions' → 'reliability'. De-dupes after mapping so the
// UI never renders the same pill twice.
export function normalizeAspects(aspects: EvaluationAspect[] | undefined): EvaluationAspect[] | undefined {
  if (aspects === undefined) return undefined
  const mapped = aspects.map(a => (a === 'facts_assumptions' ? 'reliability' as const : a))
  return Array.from(new Set(mapped))
}

export function aspectsForNodeType(nodeType: 'inject' | 'round', features?: GraphFeatures): AspectMeta[] {
  const f = features ?? DEFAULT_FEATURES
  return ASPECTS.filter(a => a.appliesTo.includes(nodeType)).filter(a => {
    if (a.key === 'reliability') return f.reliability
    if (a.key === 'nis2')        return f.compliance
    if (a.key === 'decision_impact' || a.key === 'lessons_learned') return f.scoring
    return true
  })
}

// Undefined = legacy → show every field. Otherwise the array is the ground truth.
// Normalizes 'facts_assumptions' → 'reliability' before checking.
export function isAspectActive(aspects: EvaluationAspect[] | undefined, aspect: EvaluationAspect): boolean {
  if (aspects === undefined) return true
  const normalized = normalizeAspects(aspects) ?? []
  const target = aspect === 'facts_assumptions' ? 'reliability' : aspect
  return normalized.includes(target)
}

interface PickerProps {
  nodeType: 'inject' | 'round'
  initial: EvaluationAspect[]
  features?: GraphFeatures
  onConfirm: (aspects: EvaluationAspect[]) => void
  onSkip: () => void
}

export function EvaluationAspectPicker({ nodeType, initial, features, onConfirm, onSkip }: PickerProps) {
  const [selected, setSelected] = useState<EvaluationAspect[]>(initial)
  const options = aspectsForNodeType(nodeType, features)

  function toggle(k: EvaluationAspect) {
    setSelected(prev => prev.includes(k) ? prev.filter(x => x !== k) : [...prev, k])
  }

  return (
    <Dialog open onOpenChange={o => { if (!o) onSkip() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Wat wil je hier beoordelen?</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          Kies alleen wat je wil scoren. Andere velden blijven weg uit de inspector — je kan later altijd meer aspecten toevoegen.
        </p>
        <div className="flex flex-col gap-1">
          {options.map(a => (
            <label key={a.key} className="flex items-start gap-2 rounded border border-border bg-background px-2 py-1.5 cursor-pointer hover:border-primary/40">
              <input
                type="checkbox"
                checked={selected.includes(a.key)}
                onChange={() => toggle(a.key)}
                className="size-3.5 mt-0.5"
              />
              <div className="flex flex-col leading-tight">
                <span className="font-mono text-[11px] font-medium">{a.label}</span>
                <span className="text-[10px] text-muted-foreground">{a.hint}</span>
              </div>
            </label>
          ))}
        </div>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onSkip}>Skip / minimal</Button>
          <Button size="sm" onClick={() => onConfirm(selected)}>Toepassen</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Small strip shown at the top of the inspector: active pills + "meer beoordelen" button.
export function AspectPillBar({
  aspects,
  nodeType,
  features,
  onChange,
}: {
  aspects: EvaluationAspect[] | undefined
  nodeType: 'inject' | 'round'
  features?: GraphFeatures
  onChange: (next: EvaluationAspect[]) => void
}) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const active: EvaluationAspect[] = aspects ?? aspectsForNodeType(nodeType, features).map(a => a.key)
  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-border bg-background/40 px-3 py-2">
      <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground mr-1">Beoordelen</span>
      {active.length === 0 && (
        <span className="text-[10px] italic text-muted-foreground">— minimaal —</span>
      )}
      {active.map(k => (
        <span
          key={k}
          className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 font-mono text-[10px] text-primary"
        >
          {ASPECT_BADGE[k]}
        </span>
      ))}
      <button
        type="button"
        onClick={() => setPickerOpen(true)}
        className="ml-auto font-mono text-[10px] text-muted-foreground hover:text-foreground underline"
      >
        Meer beoordelen ▾
      </button>
      {pickerOpen && (
        <EvaluationAspectPicker
          nodeType={nodeType}
          initial={active}
          features={features}
          onConfirm={next => { onChange(next); setPickerOpen(false) }}
          onSkip={() => setPickerOpen(false)}
        />
      )}
    </div>
  )
}
