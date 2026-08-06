"use client"

import { useEffect, useState } from "react"
import type { Node } from "@xyflow/react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import type {
  DecisionNodeData, GraphFeatures, GraphNodeData,
  InjectNodeData, OutcomeNodeData, OutcomeVector, RoundNodeData,
} from "@/lib/graph/types"
import { ROLE_META, type Role } from "@/lib/types"
import { Plus, Trash } from "lucide-react"

// Minimal inspector. Alleen wat een auteur nodig heeft voor een story.
// Rest van de scoring-details (domein, owner, requiresCosign, consulted,
// aiPromptTemplate, dynamic, supervisionAreas, evaluationAspects) staan
// nog wel op de types voor backwards compat — hier niet zichtbaar.

interface Props {
  node: Node | null
  graphId: string
  features?: GraphFeatures
  onChange: (nodeId: string, data: GraphNodeData) => void
  onAddInject: (roundNodeId: string) => void
  onDelete: (nodeId: string) => void
  onDuplicate?: (nodeId: string) => void
  onSaveGraph: () => Promise<boolean>
}

const DIMS: Array<{ key: keyof OutcomeVector; label: string; hint: string }> = [
  { key: "CONT", label: "Containment", hint: "Verkleint dit de voetafdruk van de aanvaller?" },
  { key: "FOR",  label: "Forensiek",   hint: "Bewijs & volatiele data blijven bruikbaar?" },
  { key: "BC",   label: "Continuïteit", hint: "Downtime & workarounds — kosten aan operaties?" },
  { key: "JUR",  label: "Juridisch",   hint: "Meldplichten, contract, verzekeraar" },
  { key: "VER",  label: "Vertrouwen",  hint: "Klanten, medewerkers, toezicht, pers" },
  { key: "KOS",  label: "Kosten",      hint: "Uren + externe kosten" },
]

const ROLES: Role[] = Object.keys(ROLE_META) as Role[]

export function Inspector({ node, onChange, onAddInject, onDelete, onDuplicate }: Props) {
  if (!node) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-6 text-center text-muted-foreground">
        <p className="text-sm">Selecteer een node</p>
        <p className="mt-1 text-xs">Klik op een ronde, inject of decision om te bewerken.</p>
      </div>
    )
  }

  const data = node.data as unknown as GraphNodeData

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-border p-3">
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          {data.kind}
        </span>
        <div className="flex items-center gap-1">
          {onDuplicate && (
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => onDuplicate(node.id)}>Dupliceer</Button>
          )}
          <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive" onClick={() => onDelete(node.id)}>
            <Trash className="size-3" />
          </Button>
        </div>
      </header>
      <div className="flex-1 overflow-y-auto p-4">
        {data.kind === "start" && <StartForm />}
        {data.kind === "round" && (
          <RoundForm data={data} onSave={d => onChange(node.id, d)} onAddInject={() => onAddInject(node.id)} />
        )}
        {data.kind === "inject" && (
          <InjectForm data={data} onSave={d => onChange(node.id, d)} />
        )}
        {data.kind === "decision" && (
          <DecisionForm data={data} onSave={d => onChange(node.id, d)} />
        )}
        {data.kind === "outcome" && (
          <OutcomeForm data={data} onSave={d => onChange(node.id, d)} />
        )}
        {data.kind === "special" && (
          <p className="text-xs text-muted-foreground">Special-nodes worden niet meer bewerkt — bestaande scenarios blijven werken.</p>
        )}
        {data.kind === "chaser" && (
          <p className="text-xs text-muted-foreground">Chaser-nodes worden niet meer bewerkt — bestaande scenarios blijven werken.</p>
        )}
      </div>
    </div>
  )
}

function StartForm() {
  return (
    <p className="text-xs text-muted-foreground">
      De start-node is het begin van je scenario. Verbind een sequence-edge naar de eerste ronde.
    </p>
  )
}

// ── Round ──────────────────────────────────────────────────────────────

function RoundForm({ data, onSave, onAddInject }: { data: RoundNodeData; onSave: (d: RoundNodeData) => void; onAddInject: () => void }) {
  const [local, setLocal] = useState(data)
  useEffect(() => setLocal(data), [data])
  function commit(next: RoundNodeData) { setLocal(next); onSave(next) }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Label className="text-xs">Titel</Label>
        <Input
          value={local.title}
          onChange={e => commit({ ...local, title: e.target.value })}
          placeholder="Ronde 1 — Detectie"
        />
      </div>
      <div>
        <Label className="text-xs">Situatie</Label>
        <Textarea
          rows={5}
          value={local.situation_update}
          onChange={e => commit({ ...local, situation_update: e.target.value })}
          placeholder="Wat gebeurt er in deze ronde? Wat weet het team?"
        />
      </div>
      <div>
        <Label className="text-xs">Tijd per ronde (minuten)</Label>
        <Input
          type="number" min={1} max={60}
          value={local.timerMinutes ?? ""}
          onChange={e => commit({ ...local, timerMinutes: e.target.value ? Number(e.target.value) : undefined })}
          placeholder="15"
          className="w-24"
        />
      </div>
      <Button size="sm" variant="outline" onClick={onAddInject} className="gap-2">
        <Plus className="size-3" /> Inject toevoegen
      </Button>
    </div>
  )
}

// ── Inject ─────────────────────────────────────────────────────────────

function InjectForm({ data, onSave }: { data: InjectNodeData; onSave: (d: InjectNodeData) => void }) {
  const [local, setLocal] = useState(data)
  useEffect(() => setLocal(data), [data])
  function commit(next: InjectNodeData) { setLocal(next); onSave(next) }

  const target = local.targetRoles ?? []
  function toggleRole(r: Role) {
    const next = target.includes(r) ? target.filter(x => x !== r) : [...target, r]
    commit({ ...local, targetRoles: next.length ? next : undefined })
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Label className="text-xs">Titel</Label>
        <Input
          value={local.title ?? ""}
          onChange={e => commit({ ...local, title: e.target.value })}
          placeholder="MDR-alert — verdachte activiteit"
        />
      </div>
      <div>
        <Label className="text-xs">Content</Label>
        <Textarea
          rows={4}
          value={local.content ?? ""}
          onChange={e => commit({ ...local, content: e.target.value })}
          placeholder="Wat komt er binnen? Bericht + context."
        />
      </div>
      <div>
        <Label className="text-xs">Voor wie? (klik om te selecteren, leeg = iedereen)</Label>
        <div className="mt-1 grid grid-cols-2 gap-1">
          {ROLES.map(r => (
            <button
              key={r}
              type="button"
              onClick={() => toggleRole(r)}
              className={`rounded border px-2 py-1 text-left text-xs transition-colors ${
                target.includes(r) ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40"
              }`}
            >
              {ROLE_META[r].label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <Label className="text-xs">Vertraging binnen ronde (seconden)</Label>
        <Input
          type="number" min={0} max={900}
          value={local.deliverySeconds ?? ""}
          onChange={e => commit({ ...local, deliverySeconds: e.target.value ? Number(e.target.value) : undefined })}
          placeholder="0 = direct bij start, 180 = na 3 min"
          className="w-full"
        />
        <p className="text-[10px] text-muted-foreground mt-1">
          Leeg of 0 = inject verschijnt direct bij ronde-start. Hoger = drip-effect (bijv. 60/180/300).
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Belang</Label>
          <select
            value={local.importance ?? "info"}
            onChange={e => commit({ ...local, importance: e.target.value as "crucial" | "info" })}
            className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs"
          >
            <option value="info">info (achtergrond)</option>
            <option value="crucial">crucial (materieel)</option>
          </select>
        </div>
        <div>
          <Label className="text-xs">Zichtbaarheid</Label>
          <select
            value={local.visibility ?? "shared"}
            onChange={e => commit({ ...local, visibility: e.target.value as "shared" | "exclusive" })}
            className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs"
          >
            <option value="shared">iedereen (default)</option>
            <option value="exclusive">alleen doelrollen</option>
          </select>
        </div>
      </div>
    </div>
  )
}

// ── Decision ───────────────────────────────────────────────────────────

function DecisionForm({ data, onSave }: { data: DecisionNodeData; onSave: (d: DecisionNodeData) => void }) {
  const [local, setLocal] = useState(data)
  useEffect(() => setLocal(data), [data])
  function commit(next: DecisionNodeData) { setLocal(next); onSave(next) }

  function updateOption(idx: number, patch: Partial<DecisionNodeData["options"][number]>) {
    commit({ ...local, options: local.options.map((o, i) => i === idx ? { ...o, ...patch } : o) })
  }

  function addOption(role?: Role) {
    const id = `opt_${Math.random().toString(36).slice(2, 8)}`
    commit({ ...local, options: [...local.options, { id, label: ``, allowedRole: role }] })
  }

  function removeOption(idx: number) {
    commit({ ...local, options: local.options.filter((_, i) => i !== idx) })
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Label className="text-xs">Vraag</Label>
        <Textarea
          rows={2}
          value={local.prompt}
          onChange={e => commit({ ...local, prompt: e.target.value })}
          placeholder="Wat kies je?"
        />
      </div>

      <OptionsByRole
        options={local.options}
        onUpdate={updateOption}
        onRemove={removeOption}
        onAdd={addOption}
      />
    </div>
  )
}

// Groups options by allowedRole so the author sees "one card per role" with
// the role's options nested inside. Options without an allowedRole are
// grouped under "— voor alle rollen —". Roles without any options only show
// up via the "+ Rol toevoegen" dropdown.
function OptionsByRole({
  options,
  onUpdate,
  onRemove,
  onAdd,
}: {
  options: DecisionNodeData["options"]
  onUpdate: (idx: number, patch: Partial<DecisionNodeData["options"][number]>) => void
  onRemove: (idx: number) => void
  onAdd: (role?: Role) => void
}) {
  const roleBuckets = new Map<Role | "__any__", Array<{ opt: DecisionNodeData["options"][number]; idx: number }>>()
  options.forEach((opt, idx) => {
    const key = (opt.allowedRole ?? "__any__") as Role | "__any__"
    const bucket = roleBuckets.get(key) ?? []
    bucket.push({ opt, idx })
    roleBuckets.set(key, bucket)
  })

  // Deterministic order: roles that already have options first (in ROLES order),
  // then "any role" at the bottom.
  const orderedRoles: Array<Role | "__any__"> = [
    ...ROLES.filter(r => roleBuckets.has(r)),
    ...(roleBuckets.has("__any__") ? (["__any__"] as const) : []),
  ]

  const rolesWithoutOptions = ROLES.filter(r => !roleBuckets.has(r))

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <Label className="text-xs">Opties per rol</Label>
      </div>

      {orderedRoles.map(roleKey => {
        const bucket = roleBuckets.get(roleKey) ?? []
        const label = roleKey === "__any__" ? "Voor alle rollen" : ROLE_META[roleKey].label
        return (
          <div key={roleKey} className="rounded-lg border border-border bg-muted/20 p-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">{label}</span>
                <span className="font-mono text-[10px] text-muted-foreground">
                  {bucket.length} {bucket.length === 1 ? "optie" : "opties"}
                </span>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onAdd(roleKey === "__any__" ? undefined : roleKey)}
                className="h-7 gap-1 text-xs"
              >
                <Plus className="size-3" /> Optie
              </Button>
            </div>
            <div className="flex flex-col gap-2">
              {bucket.map(({ opt, idx }) => (
                <OptionEditor
                  key={opt.id}
                  option={opt}
                  onChange={patch => onUpdate(idx, patch)}
                  onRemove={() => onRemove(idx)}
                  otherRoles={ROLES}
                />
              ))}
            </div>
          </div>
        )
      })}

      {rolesWithoutOptions.length > 0 && (
        <div className="rounded-lg border border-dashed border-border bg-background p-2">
          <Label className="text-[10px] text-muted-foreground">Rol toevoegen</Label>
          <select
            value=""
            onChange={e => {
              const v = e.target.value
              if (!v) return
              onAdd(v === "__any__" ? undefined : (v as Role))
            }}
            className="mt-1 w-full rounded border border-border bg-background px-2 py-1.5 text-xs"
          >
            <option value="">— kies een rol om opties voor toe te voegen —</option>
            {rolesWithoutOptions.map(r => (
              <option key={r} value={r}>{ROLE_META[r].label}</option>
            ))}
            {!roleBuckets.has("__any__") && (
              <option value="__any__">Voor alle rollen</option>
            )}
          </select>
        </div>
      )}

      {orderedRoles.length === 0 && (
        <div className="rounded border border-dashed border-border bg-background p-4 text-center text-xs text-muted-foreground">
          Nog geen opties. Kies een rol hierboven om opties toe te voegen.
        </div>
      )}
    </div>
  )
}

function OptionEditor({
  option,
  onChange,
  onRemove,
  otherRoles,
}: {
  option: DecisionNodeData["options"][number]
  onChange: (patch: Partial<DecisionNodeData["options"][number]>) => void
  onRemove: () => void
  otherRoles: Role[]
}) {
  const vec = option.outcomeVector ?? { CONT: 0, FOR: 0, BC: 0, JUR: 0, VER: 0, KOS: 0 }
  function setDim(dim: keyof OutcomeVector, v: number) {
    const clamped = Math.max(-2, Math.min(2, v))
    onChange({ outcomeVector: { ...vec, [dim]: clamped } })
  }

  return (
    <div className="flex flex-col gap-2 rounded border border-border bg-background p-3">
      <div className="flex items-start gap-2">
        <Textarea
          rows={2}
          value={option.label}
          onChange={e => onChange({ label: e.target.value })}
          placeholder="Wat zegt deze keuze? (volledige zin)"
          className="flex-1 text-xs resize-none min-h-[3rem]"
        />
        <Button size="sm" variant="ghost" onClick={onRemove} className="h-8 text-destructive shrink-0" title="Optie verwijderen">
          <Trash className="size-3" />
        </Button>
      </div>

      {/* Rol-hertoewijzing beschikbaar zodat een auteur een optie kan verplaatsen naar een andere rol-groep. */}
      <div>
        <Label className="text-[10px] text-muted-foreground">Verplaatsen naar rol</Label>
        <select
          value={option.allowedRole ?? ""}
          onChange={e => onChange({ allowedRole: e.target.value ? (e.target.value as Role) : undefined })}
          className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs"
        >
          <option value="">— voor alle rollen —</option>
          {otherRoles.map(r => (
            <option key={r} value={r}>{ROLE_META[r].label}</option>
          ))}
        </select>
      </div>

      <div>
        <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">
          Impact op de 6 dimensies (−2 slecht … +2 goed)
        </div>
        <div className="grid grid-cols-6 gap-1">
          {DIMS.map(d => (
            <label key={d.key} className="text-center" title={d.hint}>
              <div className="text-[9px] font-mono text-muted-foreground">{d.key}</div>
              <input
                type="number" min={-2} max={2} step={1}
                value={vec[d.key]}
                onChange={e => setDim(d.key, Number(e.target.value) || 0)}
                className={`w-full rounded border border-border bg-background px-1 py-1 text-center font-mono text-xs ${
                  vec[d.key] > 0 ? "text-primary" : vec[d.key] < 0 ? "text-destructive" : ""
                }`}
              />
            </label>
          ))}
        </div>
      </div>

      <div>
        <Label className="text-[10px] text-muted-foreground">Debrief-noot</Label>
        <Textarea
          rows={3}
          value={option.lessonLearned ?? ""}
          onChange={e => onChange({ lessonLearned: e.target.value || undefined })}
          placeholder="Wat leren we hiervan? Kort maar concreet."
          className="text-xs resize-none min-h-[4rem]"
        />
      </div>
    </div>
  )
}

// ── Outcome ────────────────────────────────────────────────────────────

function OutcomeForm({ data, onSave }: { data: OutcomeNodeData; onSave: (d: OutcomeNodeData) => void }) {
  const [local, setLocal] = useState(data)
  useEffect(() => setLocal(data), [data])
  function commit(next: OutcomeNodeData) { setLocal(next); onSave(next) }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Label className="text-xs">Titel</Label>
        <Input
          value={local.label}
          onChange={e => commit({ ...local, label: e.target.value })}
          placeholder="Contained met kop en staart"
        />
      </div>
      <div>
        <Label className="text-xs">Verhaal (wat gebeurt er nu?)</Label>
        <Textarea
          rows={6}
          value={local.narrative}
          onChange={e => commit({ ...local, narrative: e.target.value })}
          placeholder="Beschrijf de afsluiting van deze route — wat is de uitkomst voor de organisatie?"
        />
      </div>
      <div>
        <Label className="text-xs">Debrief-noot</Label>
        <Textarea
          rows={3}
          value={local.lessonLearned ?? ""}
          onChange={e => commit({ ...local, lessonLearned: e.target.value || undefined })}
          placeholder="Wat leren we van dit pad?"
          className="text-xs resize-none"
        />
      </div>
    </div>
  )
}
