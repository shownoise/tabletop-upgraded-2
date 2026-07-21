"use client"

import { Trash2, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import type { FacilitatorNotes } from "@/lib/types"

interface Props {
  value: FacilitatorNotes | undefined
  onChange: (next: FacilitatorNotes) => void
}

const EMPTY: FacilitatorNotes = {
  discussionGoal: "",
  keyQuestions: [],
  hints: [],
  expectedDecisions: [],
  redFlags: [],
}

export function FacilitatorNotesEditor({ value, onChange }: Props) {
  const notes = value ?? EMPTY

  function update(patch: Partial<FacilitatorNotes>) {
    onChange({ ...notes, ...patch })
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-1">
        <Label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Discussion goal</Label>
        <Textarea
          rows={2}
          value={notes.discussionGoal}
          onChange={e => update({ discussionGoal: e.target.value })}
          className="text-xs"
        />
      </div>
      <StringList label="Key questions" value={notes.keyQuestions} onChange={v => update({ keyQuestions: v })} />
      <StringList label="Hints" value={notes.hints} onChange={v => update({ hints: v })} />
      <StringList label="Expected decisions" value={notes.expectedDecisions} onChange={v => update({ expectedDecisions: v })} />
      <StringList label="Red flags" value={notes.redFlags} onChange={v => update({ redFlags: v })} />
    </div>
  )
}

function StringList({ label, value, onChange }: { label: string; value: string[]; onChange: (v: string[]) => void }) {
  function update(idx: number, next: string) {
    onChange(value.map((v, i) => i === idx ? next : v))
  }
  function add() { onChange([...value, ""]) }
  function remove(idx: number) { onChange(value.filter((_, i) => i !== idx)) }

  return (
    <div className="flex flex-col gap-1">
      <Label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{label}</Label>
      {value.map((item, idx) => (
        <div key={idx} className="flex items-center gap-1">
          <Input value={item} onChange={e => update(idx, e.target.value)} className="h-7 text-xs" />
          <Button type="button" variant="ghost" size="sm" onClick={() => remove(idx)} className="h-7 text-destructive shrink-0">
            <Trash2 className="size-3" />
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={add} className="gap-1.5 h-7">
        <Plus className="size-3" />
        Add
      </Button>
    </div>
  )
}
