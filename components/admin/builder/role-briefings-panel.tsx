"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ROLE_META, ROLE_ORDER, type Role } from "@/lib/types"
import type { RoleBriefing } from "@/lib/graph/types"
import { Plus, Trash } from "lucide-react"

const ROLES: readonly Role[] = ROLE_ORDER

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  briefings: Partial<Record<Role, RoleBriefing>>
  onChange: (next: Partial<Record<Role, RoleBriefing>>) => void
}

// Phase 3 — one textarea per role for mandate text + inline bullet-list editor
// for playbookGaps. Saved back into ScenarioGraph.roleBriefings via onChange.
export function RoleBriefingsPanel({ open, onOpenChange, briefings, onChange }: Props) {
  const [local, setLocal] = useState<Partial<Record<Role, RoleBriefing>>>(briefings)

  function commit(next: Partial<Record<Role, RoleBriefing>>) {
    setLocal(next)
    onChange(next)
  }

  function setText(role: Role, text: string) {
    const existing = local[role] ?? { text: "" }
    commit({ ...local, [role]: { ...existing, text } })
  }

  function addGap(role: Role) {
    const existing = local[role] ?? { text: "" }
    const gaps = [...(existing.playbookGaps ?? []), ""]
    commit({ ...local, [role]: { ...existing, playbookGaps: gaps } })
  }

  function updateGap(role: Role, idx: number, value: string) {
    const existing = local[role] ?? { text: "" }
    const gaps = (existing.playbookGaps ?? []).map((g, i) => (i === idx ? value : g))
    commit({ ...local, [role]: { ...existing, playbookGaps: gaps } })
  }

  function removeGap(role: Role, idx: number) {
    const existing = local[role] ?? { text: "" }
    const gaps = (existing.playbookGaps ?? []).filter((_, i) => i !== idx)
    commit({ ...local, [role]: { ...existing, playbookGaps: gaps.length ? gaps : undefined } })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Rol-briefings & playbook-gaps</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          Voor elke rol: één-alinea mandate + de gaten in het IR-playbook die deze rol zal ontdekken.
          Elke gap moet ergens in de scenariocontent terugkomen (inject, situatie of les) — anders krijg je een validatie-waarschuwing.
        </p>
        <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto pr-2">
          {ROLES.map(role => {
            const meta = ROLE_META[role]
            const entry = local[role]
            return (
              <div key={role} className="rounded-lg border border-border bg-muted/20 p-3">
                <div className="mb-2 flex items-baseline justify-between gap-2">
                  <span className="font-mono text-sm font-semibold">{meta.label}</span>
                  <span className="font-mono text-[10px] text-muted-foreground">{role}</span>
                </div>
                <div className="mb-2">
                  <Label className="text-[11px] text-muted-foreground">Mandate / opening briefing</Label>
                  <Textarea
                    rows={3}
                    value={entry?.text ?? ""}
                    onChange={e => setText(role, e.target.value)}
                    placeholder={meta.mandateSummary}
                    className="text-xs"
                  />
                </div>
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <Label className="text-[11px] text-muted-foreground">Playbook-gaps</Label>
                    <Button size="sm" variant="ghost" onClick={() => addGap(role)} className="h-6 gap-1 text-[11px]">
                      <Plus className="size-3" /> Regel
                    </Button>
                  </div>
                  <ul className="flex flex-col gap-1">
                    {(entry?.playbookGaps ?? []).map((gap, idx) => (
                      <li key={idx} className="flex items-center gap-1">
                        <Input
                          value={gap}
                          onChange={e => updateGap(role, idx, e.target.value)}
                          placeholder="Bijv. backups nooit hersteld getest"
                          className="h-7 flex-1 text-xs"
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removeGap(role, idx)}
                          className="h-7 text-destructive"
                        >
                          <Trash className="size-3" />
                        </Button>
                      </li>
                    ))}
                    {(entry?.playbookGaps ?? []).length === 0 && (
                      <li className="text-[11px] text-muted-foreground italic">
                        Geen gaps voor deze rol.
                      </li>
                    )}
                  </ul>
                </div>
              </div>
            )
          })}
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Sluiten</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
