"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import type { EvaluationAspect } from "@/lib/graph/types"

interface AspectMeta {
  key: EvaluationAspect
  label: string
  hint: string
  appliesTo: Array<'inject' | 'round'>
}

// Order matters — this is the order rendered in the picker + inspector pills.
export const ASPECTS: AspectMeta[] = [
  { key: 'reliability',       label: 'Betrouwbaarheid',   hint: 'BOB-tag: feit / aanname / misleidend op de hele inject',       appliesTo: ['inject'] },
  { key: 'facts_assumptions', label: 'Feiten & aannames', hint: 'Markeer specifieke zinnen als feit/aanname/misleidend',        appliesTo: ['inject'] },
  { key: 'nis2',              label: 'NIS2',              hint: 'Koppel aan NIS2-testgebieden en meldplicht',                    appliesTo: ['inject', 'round'] },
  { key: 'decision_impact',   label: 'Beslis-impact',     hint: 'Voeg scoreImpact / dimensie toe (zichtbaar bij decisions)',    appliesTo: ['round'] },
  { key: 'lessons_learned',   label: 'Lessons learned',   hint: 'Toon leerdoelen en debrief-tekstvelden',                        appliesTo: ['round'] },
]

// Short badge label for node cards + inspector pills.
export const ASPECT_BADGE: Record<EvaluationAspect, string> = {
  reliability: 'BOB',
  facts_assumptions: 'FA',
  nis2: 'NIS2',
  decision_impact: 'DEC',
  lessons_learned: 'LL',
}

export function aspectsForNodeType(nodeType: 'inject' | 'round'): AspectMeta[] {
  return ASPECTS.filter(a => a.appliesTo.includes(nodeType))
}

// Undefined = legacy → show every field. Otherwise the array is the ground truth.
export function isAspectActive(aspects: EvaluationAspect[] | undefined, aspect: EvaluationAspect): boolean {
  if (aspects === undefined) return true
  return aspects.includes(aspect)
}

interface PickerProps {
  nodeType: 'inject' | 'round'
  initial: EvaluationAspect[]
  onConfirm: (aspects: EvaluationAspect[]) => void
  onSkip: () => void
}

export function EvaluationAspectPicker({ nodeType, initial, onConfirm, onSkip }: PickerProps) {
  const [selected, setSelected] = useState<EvaluationAspect[]>(initial)
  const options = aspectsForNodeType(nodeType)

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
  onChange,
}: {
  aspects: EvaluationAspect[] | undefined
  nodeType: 'inject' | 'round'
  onChange: (next: EvaluationAspect[]) => void
}) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const active: EvaluationAspect[] = aspects ?? aspectsForNodeType(nodeType).map(a => a.key)
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
          onConfirm={next => { onChange(next); setPickerOpen(false) }}
          onSkip={() => setPickerOpen(false)}
        />
      )}
    </div>
  )
}
