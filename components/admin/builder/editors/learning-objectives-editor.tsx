"use client"

import { Trash2, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { LearningObjective, ModuleId, SpecialType } from "@/lib/types"

const MODULE_IDS: ModuleId[] = [
  "detection_sensemaking",
  "triage_containment",
  "business_continuity",
  "crisis_communication",
  "legal_regulatory",
  "ransom_negotiation",
  "recovery_lessons",
  "insider_investigation",
  "supply_chain_response",
  "forensic_attribution",
]

const MEASURED_BY: LearningObjective["measuredBy"][] = ["decision", "timing", "special", "manual"]
const SPECIAL_TYPES: SpecialType[] = ["ransomware_negotiation", "ap_notification", "journalist_qa"]

function makeId(prefix: string) { return `${prefix}_${Math.random().toString(36).slice(2, 8)}` }

interface Props {
  value: LearningObjective[]
  onChange: (next: LearningObjective[]) => void
}

export function LearningObjectivesEditor({ value, onChange }: Props) {
  function update(idx: number, patch: Partial<LearningObjective>) {
    onChange(value.map((o, i) => i === idx ? { ...o, ...patch } : o))
  }

  function add() {
    onChange([
      ...value,
      {
        id: makeId("obj"),
        description: "",
        module: "detection_sensemaking",
        measuredBy: "decision",
      },
    ])
  }

  function remove(idx: number) {
    onChange(value.filter((_, i) => i !== idx))
  }

  return (
    <div className="flex flex-col gap-2">
      {value.map((obj, idx) => (
        <div key={obj.id} className="flex flex-col gap-1.5 rounded border border-border bg-background p-2">
          <div className="flex items-center gap-1">
            <Input
              value={obj.description}
              onChange={e => update(idx, { description: e.target.value })}
              placeholder="Description (max 15 words, action-oriented)"
              className="h-7 text-xs"
            />
            <Button type="button" variant="ghost" size="sm" onClick={() => remove(idx)} className="h-7 text-destructive shrink-0">
              <Trash2 className="size-3" />
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <div className="flex flex-col gap-1">
              <Label className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Module</Label>
              <select
                value={obj.module}
                onChange={e => update(idx, { module: e.target.value as ModuleId })}
                className="rounded border border-border bg-background px-1.5 py-1 font-mono text-[10px]"
              >
                {MODULE_IDS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <Label className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Measured by</Label>
              <select
                value={obj.measuredBy}
                onChange={e => update(idx, { measuredBy: e.target.value as LearningObjective["measuredBy"] })}
                className="rounded border border-border bg-background px-1.5 py-1 font-mono text-[10px]"
              >
                {MEASURED_BY.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>
          {obj.measuredBy === "decision" && (
            <div className="flex flex-col gap-1">
              <Label className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                Trigger action IDs (comma-separated)
              </Label>
              <Input
                value={(obj.triggerActionIds ?? []).join(", ")}
                onChange={e => update(idx, {
                  triggerActionIds: e.target.value.split(",").map(s => s.trim()).filter(Boolean),
                })}
                placeholder="r1-a1, r1-a2"
                className="h-7 font-mono text-[11px]"
              />
            </div>
          )}
          {obj.measuredBy === "special" && (
            <div className="flex flex-col gap-1">
              <Label className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Trigger special type</Label>
              <select
                value={obj.triggerSpecialType ?? ""}
                onChange={e => update(idx, {
                  triggerSpecialType: e.target.value ? (e.target.value as SpecialType) : undefined,
                })}
                className="rounded border border-border bg-background px-1.5 py-1 font-mono text-[10px]"
              >
                <option value="">—</option>
                {SPECIAL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          )}
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={add} className="gap-1.5 h-7">
        <Plus className="size-3" />
        Add objective
      </Button>
    </div>
  )
}
