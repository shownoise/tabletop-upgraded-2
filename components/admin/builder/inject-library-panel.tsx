"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ROLE_META, ROLE_ORDER, type Role } from "@/lib/types"
import type { InjectChannel, Urgency } from "@/lib/types"
import type { PremadeInject } from "@/lib/graph/types"
import { Plus, Trash } from "lucide-react"

const CHANNELS: InjectChannel[] = [
  "whatsapp", "slack", "email", "sms", "phone", "teams",
  "siem", "edr", "news", "memo", "ransom_note",
  "siem_alert", "news_ticker", "system_alert", "raw",
]
const URGENCIES: Urgency[] = ["low", "medium", "high", "critical"]
const CLASSIFICATIONS: Array<PremadeInject['classification']> = ["feit", "aanname", "fabel"]
const ROLES: readonly Role[] = ROLE_ORDER

// Phase 5 — helper for a blank "add new" entry. Sensible defaults + a random id.
export function createBlankPremadeInject(): PremadeInject {
  const id = `plib_${Math.random().toString(36).slice(2, 8)}`
  return {
    id,
    label: "",
    channel: "whatsapp",
    urgency: "medium",
    classification: "feit",
    senderName: "",
    title: "",
    content: "",
    targetRoles: [],
    facilitatorNote: "",
  }
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  library: PremadeInject[]
  onChange: (next: PremadeInject[]) => void
}

// Phase 5 — CRUD panel for the scenario-scoped noise-inject library. Mirrors
// RoleBriefingsPanel's plumbing pattern: commits on every keystroke via onChange.
export function InjectLibraryPanel({ open, onOpenChange, library, onChange }: Props) {
  const [local, setLocal] = useState<PremadeInject[]>(library)

  function commit(next: PremadeInject[]) {
    setLocal(next)
    onChange(next)
  }

  function addNew() {
    commit([...local, createBlankPremadeInject()])
  }

  function remove(id: string) {
    commit(local.filter(x => x.id !== id))
  }

  function update(id: string, patch: Partial<PremadeInject>) {
    commit(local.map(x => (x.id === id ? { ...x, ...patch } : x)))
  }

  function toggleRole(entry: PremadeInject, role: Role) {
    const current = entry.targetRoles ?? []
    const next = current.includes(role) ? current.filter(r => r !== role) : [...current, role]
    update(entry.id, { targetRoles: next })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Ruis-bibliotheek (ad-hoc injects)</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          Ad-hoc &quot;ruis-injects&quot; die de facilitator tijdens de discussie-fase kan afvuren.
          Deze injects zijn puur context — ze worden nooit gescoord en zijn niet gekoppeld aan een
          ronde of beslissing. Gebruik ze om druk op te voeren, aandacht te testen, of feit/aanname/fabel
          te oefenen.
        </p>

        <div className="flex justify-end">
          <Button size="sm" variant="outline" onClick={addNew} className="h-7 gap-1 text-[11px]">
            <Plus className="size-3" /> Nieuwe ruis-inject
          </Button>
        </div>

        <div className="flex max-h-[60vh] flex-col gap-3 overflow-y-auto pr-2">
          {local.length === 0 && (
            <p className="text-xs italic text-muted-foreground">
              Nog geen ruis-injects. Klik &quot;Nieuwe ruis-inject&quot; om er één toe te voegen.
            </p>
          )}
          {local.map(entry => (
            <div key={entry.id} className="rounded-lg border border-border bg-muted/20 p-3">
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="flex-1">
                  <Label className="text-[11px] text-muted-foreground">Label (facilitator-knop)</Label>
                  <Input
                    value={entry.label}
                    onChange={e => update(entry.id, { label: e.target.value })}
                    placeholder="Bijv. Ouder belt bezorgd"
                    className="h-8 text-xs"
                  />
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => remove(entry.id)}
                  className="mt-4 h-7 text-destructive"
                  title="Verwijder"
                >
                  <Trash className="size-3" />
                </Button>
              </div>

              <div className="mb-2 grid grid-cols-3 gap-2">
                <div>
                  <Label className="text-[11px] text-muted-foreground">Kanaal</Label>
                  <select
                    value={entry.channel ?? "whatsapp"}
                    onChange={e => update(entry.id, { channel: e.target.value as InjectChannel })}
                    className="h-8 w-full rounded border border-border bg-background px-2 font-mono text-[11px]"
                  >
                    {CHANNELS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <Label className="text-[11px] text-muted-foreground">Urgentie</Label>
                  <select
                    value={entry.urgency ?? "medium"}
                    onChange={e => update(entry.id, { urgency: e.target.value as Urgency })}
                    className="h-8 w-full rounded border border-border bg-background px-2 font-mono text-[11px]"
                  >
                    {URGENCIES.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div>
                  <Label className="text-[11px] text-muted-foreground">Classificatie</Label>
                  <select
                    value={entry.classification ?? ""}
                    onChange={e => update(entry.id, { classification: (e.target.value || undefined) as PremadeInject['classification'] })}
                    className="h-8 w-full rounded border border-border bg-background px-2 font-mono text-[11px]"
                  >
                    <option value="">— geen —</option>
                    {CLASSIFICATIONS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              <div className="mb-2">
                <Label className="text-[11px] text-muted-foreground">Afzender (senderName)</Label>
                <Input
                  value={entry.senderName ?? ""}
                  onChange={e => update(entry.id, { senderName: e.target.value })}
                  placeholder="Bijv. Anoniem / Erika van der Meer / Journalist"
                  className="h-8 text-xs"
                />
              </div>

              <div className="mb-2">
                <Label className="text-[11px] text-muted-foreground">Titel</Label>
                <Input
                  value={entry.title}
                  onChange={e => update(entry.id, { title: e.target.value })}
                  placeholder="Bijv. WhatsApp van conciërge"
                  className="h-8 text-xs"
                />
              </div>

              <div className="mb-2">
                <Label className="text-[11px] text-muted-foreground">Content (wat deelnemer ziet)</Label>
                <Textarea
                  rows={3}
                  value={entry.content}
                  onChange={e => update(entry.id, { content: e.target.value })}
                  placeholder="Vrije tekst — de deelnemer ziet dit één op één."
                  className="text-xs"
                />
              </div>

              <div className="mb-2">
                <Label className="text-[11px] text-muted-foreground">
                  Doelrollen (leeg = iedereen)
                </Label>
                <div className="mt-1 flex flex-wrap gap-1">
                  {ROLES.map(role => {
                    const selected = entry.targetRoles?.includes(role)
                    return (
                      <button
                        key={role}
                        type="button"
                        onClick={() => toggleRole(entry, role)}
                        className={`rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider transition-colors ${
                          selected
                            ? "border-primary/40 bg-primary/10 text-primary"
                            : "border-border bg-background text-muted-foreground hover:border-primary/40"
                        }`}
                      >
                        {ROLE_META[role].label}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <Label className="text-[11px] text-muted-foreground">
                  Facilitator-notitie (optioneel, waarom staat deze in de bibliotheek)
                </Label>
                <Textarea
                  rows={2}
                  value={entry.facilitatorNote ?? ""}
                  onChange={e => update(entry.id, { facilitatorNote: e.target.value })}
                  placeholder="Bijv. inzetten als team te snel op één spoor gaat"
                  className="text-xs"
                />
              </div>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Sluiten</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
