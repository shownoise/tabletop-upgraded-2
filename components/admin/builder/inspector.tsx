"use client"

import { useEffect, useState } from "react"
import type { Node } from "@xyflow/react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import type {
  DecisionNodeData,
  GraphNodeData,
  InjectNodeData,
  OutcomeNodeData,
  RoundNodeData,
  SpecialNodeData,
} from "@/lib/graph/types"
import { ROLE_META } from "@/lib/types"
import type {
  BobPhase,
  FacilitatorNotes,
  InjectChannel,
  InjectReliability,
  InjectType,
  LearningObjective,
  Role,
  RoleAction,
  SpecialType,
  Urgency,
} from "@/lib/types"
import { RoleActionsEditor } from "./editors/role-actions-editor"
import { FacilitatorNotesEditor } from "./editors/facilitator-notes-editor"
import { LearningObjectivesEditor } from "./editors/learning-objectives-editor"
import { TargetRolesEditor } from "./editors/target-roles-editor"
import { NODE_THEME } from "./node-theme"
import type { GraphNodeType } from "@/lib/graph/types"

interface Props {
  node: Node | null
  graphId: string
  onChange: (nodeId: string, data: GraphNodeData) => void
  onAddInject: (roundNodeId: string) => void
  onDelete: (nodeId: string) => void
  onDuplicate?: (nodeId: string) => void
  onSaveGraph: () => Promise<boolean>
}

const INJECT_TYPES: InjectType[] = [
  "alert", "intel", "media", "executive", "technical", "regulatory", "social", "internal",
]
const INJECT_CHANNELS: InjectChannel[] = [
  "email", "sms", "phone", "teams", "siem", "edr", "news", "memo", "ransom_note",
  "whatsapp", "slack", "siem_alert", "news_ticker", "system_alert", "raw",
]
const URGENCIES: Urgency[] = ["low", "medium", "high", "critical"]

const SPECIAL_TYPES: SpecialType[] = ["ransomware_negotiation", "ap_notification", "journalist_qa"]
const OPS: Array<"<" | "<=" | ">" | ">=" | "=="> = ["<", "<=", ">", ">=", "=="]
const DIMENSIONS = [
  "decision_speed", "decision_quality", "escalation_timing", "mandate_clarity",
  "framework_adherence", "dilemma_participation", "communication_clarity", "compliance_awareness",
] as const
type Dim = typeof DIMENSIONS[number]

function makeId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}`
}

export function Inspector({ node, graphId, onChange, onAddInject, onDelete, onDuplicate, onSaveGraph }: Props) {
  if (!node) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-4 text-center">
        <p className="text-xs text-muted-foreground">Select a node to edit its properties.</p>
      </div>
    )
  }

  const data = node.data as unknown as GraphNodeData

  const nodeType = (node.type ?? "round") as GraphNodeType
  const theme = NODE_THEME[nodeType]
  const ThemeIcon = theme.icon

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="flex flex-col gap-2 border-b border-border px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`flex size-7 items-center justify-center rounded-md ${theme.headerBg} ${theme.headerFg}`}>
              <ThemeIcon className="size-3.5" />
            </div>
            <div className="flex flex-col leading-tight">
              <span className={`font-mono text-[11px] font-medium ${theme.accentText}`}>{theme.label}</span>
              <span className="font-mono text-[10px] text-muted-foreground">{node.id.slice(0, 10)}</span>
            </div>
          </div>
        </div>
        {node.type !== "start" && (
          <div className="flex items-center gap-2">
            {onDuplicate && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => onDuplicate(node.id)}
              >
                Duplicate
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-destructive hover:text-destructive"
              onClick={() => onDelete(node.id)}
            >
              Delete
            </Button>
          </div>
        )}
      </div>
      <div className="flex-1 p-4">
        {data.kind === "start" && <StartForm />}
        {data.kind === "round" && (
          <RoundForm
            key={node.id}
            data={data}
            onSave={next => onChange(node.id, next)}
            onAddInject={() => onAddInject(node.id)}
            graphId={graphId}
            nodeId={node.id}
            onSaveGraph={onSaveGraph}
          />
        )}
        {data.kind === "inject" && (
          <InjectForm key={node.id} data={data} onSave={next => onChange(node.id, next)} />
        )}
        {data.kind === "decision" && (
          <DecisionForm
            key={node.id}
            data={data}
            onSave={next => onChange(node.id, next)}
            graphId={graphId}
            nodeId={node.id}
            onSaveGraph={onSaveGraph}
          />
        )}
        {data.kind === "special" && (
          <SpecialForm key={node.id} data={data} onSave={next => onChange(node.id, next)} />
        )}
        {data.kind === "outcome" && (
          <OutcomeForm key={node.id} data={data} onSave={next => onChange(node.id, next)} />
        )}
      </div>
    </div>
  )
}

function StartForm() {
  return (
    <p className="text-xs text-muted-foreground">
      The start node marks where the scenario begins. Connect a sequence edge from here to your first round.
    </p>
  )
}

function RoundForm({
  data,
  onSave,
  onAddInject,
  graphId,
  nodeId,
  onSaveGraph,
}: {
  data: RoundNodeData
  onSave: (d: RoundNodeData) => void
  onAddInject: () => void
  graphId: string
  nodeId: string
  onSaveGraph: () => Promise<boolean>
}) {
  const [local, setLocal] = useState<RoundNodeData>(data)
  const [aiBusy, setAiBusy] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  useEffect(() => { setLocal(data) }, [data])

  function commit(next: RoundNodeData) {
    setLocal(next)
    onSave(next)
  }

  async function aiFill() {
    setAiBusy(true)
    setAiError(null)
    try {
      const ok = await onSaveGraph()
      if (!ok) throw new Error("Save failed — cannot run AI-fill")
      const res = await fetch("/api/scenario-graph/ai-fill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ graphId, nodeId }),
      })
      const payload = await res.json()
      if (!res.ok || !payload.data) throw new Error(payload.error ?? "AI-fill failed")
      commit({ ...local, ...payload.data, kind: "round" })
    } catch (err) {
      setAiError(err instanceof Error ? err.message : String(err))
    } finally {
      setAiBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <Field label="Title">
        <Input value={local.title} onChange={e => commit({ ...local, title: e.target.value })} />
      </Field>
      <Field label="Situation update">
        <Textarea
          rows={5}
          value={local.situation_update}
          onChange={e => commit({ ...local, situation_update: e.target.value })}
        />
      </Field>
      <Field label="Timer (minutes)">
        <Input
          type="number"
          min={1}
          value={local.timerMinutes ?? ""}
          onChange={e => commit({ ...local, timerMinutes: e.target.value ? Number(e.target.value) : undefined })}
        />
      </Field>
      <Field label="BOB fase">
        <select
          value={local.bobPhase ?? ""}
          onChange={e => commit({ ...local, bobPhase: e.target.value ? (e.target.value as BobPhase) : undefined })}
          className="rounded border border-border bg-background px-2 py-1.5 text-xs font-mono"
        >
          <option value="">— geen —</option>
          <option value="beeldvorming">Beeldvorming (feiten verzamelen)</option>
          <option value="oordeel">Oordeelsvorming (opties wegen)</option>
          <option value="besluit">Besluitvorming (kiezen)</option>
        </select>
      </Field>
      <Field label="Opening prompts (BOB-kickstart)">
        <StringListEditor
          value={local.openingPrompts ?? []}
          onChange={v => commit({ ...local, openingPrompts: v.length ? v : undefined })}
          placeholder="Wat weten we zeker? Wat is aanname?"
        />
      </Field>
      <Field label="IR-perspectief (alleen facilitator)">
        <Textarea
          rows={4}
          value={local.facilitatorPerspective ?? ""}
          onChange={e => commit({ ...local, facilitatorPerspective: e.target.value || undefined })}
          placeholder="Als IR-consultant zou je nu adviseren: ... Deze tekst zie jij als facilitator in story-view."
          className="text-xs"
        />
      </Field>

      <Section title="Role actions" count={local.roleActions?.length ?? 0}>
        <RoleActionsEditor
          value={local.roleActions ?? []}
          onChange={(v: RoleAction[]) => commit({ ...local, roleActions: v })}
          suggestedIdPrefix={nodeId.slice(0, 6)}
        />
      </Section>

      <Section title="Facilitator notes">
        <FacilitatorNotesEditor
          value={local.facilitatorNotes}
          onChange={(v: FacilitatorNotes) => commit({ ...local, facilitatorNotes: v })}
        />
      </Section>

      <Section title="Learning objectives" count={local.learningObjectives?.length ?? 0}>
        <LearningObjectivesEditor
          value={local.learningObjectives ?? []}
          onChange={(v: LearningObjective[]) => commit({ ...local, learningObjectives: v })}
        />
      </Section>

      <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
        <Button type="button" variant="outline" size="sm" onClick={onAddInject}>Add inject</Button>
        <Button type="button" variant="outline" size="sm" onClick={aiFill} disabled={aiBusy}>
          {aiBusy ? "AI…" : "AI-fill"}
        </Button>
      </div>
      {aiError && <p className="text-[11px] text-destructive">{aiError}</p>}
    </div>
  )
}

function Section({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  return (
    <details className="rounded border border-border bg-background/40 group">
      <summary className="cursor-pointer px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground select-none list-none flex items-center justify-between">
        <span>{title}{typeof count === "number" ? ` (${count})` : ""}</span>
        <span className="text-[8px] opacity-50 group-open:hidden">▶</span>
        <span className="text-[8px] opacity-50 hidden group-open:inline">▼</span>
      </summary>
      <div className="px-2.5 pb-2.5 pt-1">
        {children}
      </div>
    </details>
  )
}

function InjectForm({ data, onSave }: { data: InjectNodeData; onSave: (d: InjectNodeData) => void }) {
  const [local, setLocal] = useState<InjectNodeData>(data)
  useEffect(() => { setLocal(data) }, [data])

  function commit(next: InjectNodeData) {
    setLocal(next)
    onSave(next)
  }

  return (
    <div className="flex flex-col gap-3">
      <Field label="Title">
        <Input value={local.title} onChange={e => commit({ ...local, title: e.target.value })} />
      </Field>
      <Field label="Content">
        <Textarea
          rows={5}
          value={local.content}
          onChange={e => commit({ ...local, content: e.target.value })}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Type">
          <select
            value={local.type}
            onChange={e => commit({ ...local, type: e.target.value as InjectType })}
            className="rounded border border-border bg-background px-2 py-1.5 text-xs font-mono"
          >
            {INJECT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Channel">
          <select
            value={local.channel ?? ""}
            onChange={e => commit({ ...local, channel: e.target.value ? (e.target.value as InjectChannel) : undefined })}
            className="rounded border border-border bg-background px-2 py-1.5 text-xs font-mono"
          >
            <option value="">—</option>
            {INJECT_CHANNELS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Urgency">
          <select
            value={local.urgency}
            onChange={e => commit({ ...local, urgency: e.target.value as Urgency })}
            className="rounded border border-border bg-background px-2 py-1.5 text-xs font-mono"
          >
            {URGENCIES.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </Field>
        <Field label="Timestamp">
          <Input
            value={local.timestamp ?? ""}
            onChange={e => commit({ ...local, timestamp: e.target.value || undefined })}
            placeholder="HH:MM"
          />
        </Field>
        <Field label="Delivery delay (sec after round start)">
          <Input
            type="number"
            min={0}
            value={local.deliverySeconds ?? ""}
            onChange={e => commit({ ...local, deliverySeconds: e.target.value ? Number(e.target.value) : undefined })}
            placeholder="0 = direct"
          />
        </Field>
        <Field label="Betrouwbaarheid (BOB)">
          <select
            value={local.reliability ?? ""}
            onChange={e => commit({ ...local, reliability: e.target.value ? (e.target.value as InjectReliability) : undefined })}
            className="rounded border border-border bg-background px-2 py-1.5 text-xs font-mono"
          >
            <option value="">— niet gespecificeerd —</option>
            <option value="fact">✓ Feit (bevestigd)</option>
            <option value="assumption">? Aanname</option>
            <option value="unverified">⚠ Ongeverifieerd</option>
            <option value="misleading">✗ Misleidend (verborgen voor participant)</option>
          </select>
          <p className="mt-1 font-mono text-[10px] text-muted-foreground leading-snug">
            Alleen jij (facilitator) ziet dit. Participanten moeten zelf de betrouwbaarheid bepalen.
          </p>
        </Field>
      </div>

      <Section title="Sender">
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-1">
            <Label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Source</Label>
            <Input
              value={local.source ?? ""}
              onChange={e => commit({ ...local, source: e.target.value || undefined })}
              placeholder="Organisation or system"
              className="h-8"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Sender name</Label>
            <Input
              value={local.senderName ?? ""}
              onChange={e => commit({ ...local, senderName: e.target.value || undefined })}
              className="h-8"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Sender handle</Label>
            <Input
              value={local.senderHandle ?? ""}
              onChange={e => commit({ ...local, senderHandle: e.target.value || undefined })}
              placeholder="@handle or +31…"
              className="h-8"
            />
          </div>
        </div>
      </Section>

      <Section title="Targeting">
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-1">
            <Label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Target team</Label>
            <select
              value={local.targetTeam ?? "all"}
              onChange={e => commit({ ...local, targetTeam: e.target.value as "all" | "crisis_management" | "technical_it" })}
              className="rounded border border-border bg-background px-2 py-1.5 text-xs font-mono"
            >
              <option value="all">All</option>
              <option value="crisis_management">Crisis management</option>
              <option value="technical_it">Technical / IT</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <Label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Target roles (overrides team)
            </Label>
            <TargetRolesEditor
              value={local.targetRoles}
              onChange={(v: Role[] | undefined) => commit({ ...local, targetRoles: v })}
            />
          </div>
          <label className="flex items-center gap-2 text-[11px] pt-1">
            <input
              type="checkbox"
              checked={local.nis2Relevant ?? false}
              onChange={e => commit({ ...local, nis2Relevant: e.target.checked || undefined })}
              className="size-3"
            />
            <span>NIS2 relevant</span>
          </label>
        </div>
      </Section>
    </div>
  )
}

function DecisionForm({
  data,
  onSave,
  graphId,
  nodeId,
  onSaveGraph,
}: {
  data: DecisionNodeData
  onSave: (d: DecisionNodeData) => void
  graphId: string
  nodeId: string
  onSaveGraph: () => Promise<boolean>
}) {
  const [local, setLocal] = useState<DecisionNodeData>(data)
  const [aiBusy, setAiBusy] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  useEffect(() => { setLocal(data) }, [data])

  function commit(next: DecisionNodeData) {
    setLocal(next)
    onSave(next)
  }

  async function suggestOptions() {
    setAiBusy(true)
    setAiError(null)
    try {
      const ok = await onSaveGraph()
      if (!ok) throw new Error("Save failed — cannot run AI-suggest")
      const res = await fetch("/api/scenario-graph/ai-suggest-options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ graphId, nodeId }),
      })
      const payload = await res.json()
      if (!res.ok || !payload.options) throw new Error(payload.error ?? "AI-suggest failed")
      const suggested = (payload.options as Array<{ label: string }>).map(o => ({
        id: makeId("opt"),
        label: o.label,
      }))
      commit({ ...local, options: [...local.options, ...suggested] })
    } catch (err) {
      setAiError(err instanceof Error ? err.message : String(err))
    } finally {
      setAiBusy(false)
    }
  }

  function updateOption(idx: number, patch: Partial<DecisionNodeData["options"][number]>) {
    const options = local.options.map((o, i) => i === idx ? { ...o, ...patch } : o)
    commit({ ...local, options })
  }

  function addOption() {
    commit({ ...local, options: [...local.options, { id: makeId("opt"), label: `Optie ${local.options.length + 1}` }] })
  }

  function removeOption(idx: number) {
    commit({ ...local, options: local.options.filter((_, i) => i !== idx) })
  }

  return (
    <div className="flex flex-col gap-3">
      <Field label="Prompt">
        <Textarea rows={3} value={local.prompt} onChange={e => commit({ ...local, prompt: e.target.value })} />
      </Field>
      <Field label="Measured by">
        <select
          value={local.measuredBy}
          onChange={e => commit({ ...local, measuredBy: e.target.value as DecisionNodeData["measuredBy"] })}
          className="rounded border border-border bg-background px-2 py-1.5 text-xs font-mono"
        >
          <option value="participant_choice">Participant choice</option>
          <option value="facilitator_trigger">Facilitator trigger</option>
        </select>
      </Field>
      <Field label="Trigger role (optional)">
        <select
          value={local.triggerRole ?? ""}
          onChange={e => commit({ ...local, triggerRole: e.target.value ? (e.target.value as Role) : undefined })}
          className="rounded border border-border bg-background px-2 py-1.5 text-xs font-mono"
        >
          <option value="">—</option>
          {(Object.keys(ROLE_META) as Role[]).map(r => (
            <option key={r} value={r}>{ROLE_META[r].label}</option>
          ))}
        </select>
      </Field>
      <label className="flex items-center gap-2 text-[11px] pt-1">
        <input
          type="checkbox"
          checked={local.advancesGraph !== false}
          onChange={e => commit({ ...local, advancesGraph: e.target.checked ? undefined : false })}
          className="size-3"
        />
        <span>Beslissing laat graph vertakken (uit = alleen scoring, geen branch)</span>
      </label>
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Options</span>
          <div className="flex items-center gap-2">
            <Button type="button" size="sm" variant="outline" onClick={suggestOptions} disabled={aiBusy}>
              {aiBusy ? "AI…" : "AI-suggest"}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={addOption}>+ Add</Button>
          </div>
        </div>
        {aiError && <p className="text-[11px] text-destructive">{aiError}</p>}
        {local.options.map((opt, idx) => (
          <div key={opt.id} className="flex flex-col gap-1 rounded border border-border bg-background p-2">
            <div className="flex items-center gap-2">
              <Input
                value={opt.label}
                onChange={e => updateOption(idx, { label: e.target.value })}
                placeholder="Label"
                className="h-7"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeOption(idx)}
                className="h-7 text-destructive"
              >
                Remove
              </Button>
            </div>
            <Input
              value={opt.roleActionId ?? ""}
              onChange={e => updateOption(idx, { roleActionId: e.target.value || undefined })}
              placeholder="Optional: matching roleAction id"
              className="h-7 font-mono text-[11px]"
            />
            <div className="flex items-center gap-1.5">
              <select
                value={opt.linkedDimension ?? ""}
                onChange={e => updateOption(idx, { linkedDimension: e.target.value ? (e.target.value as Dim) : undefined })}
                className="rounded border border-border bg-background px-1.5 py-1 font-mono text-[10px] flex-1"
              >
                <option value="">— dimension —</option>
                {DIMENSIONS.map(d => <option key={d} value={d}>{d.replace(/_/g, " ")}</option>)}
              </select>
              <Input
                type="number"
                min={-10}
                max={10}
                value={opt.scoreImpact ?? ""}
                onChange={e => updateOption(idx, { scoreImpact: e.target.value ? Number(e.target.value) : undefined })}
                placeholder="±10"
                className="h-7 w-16 font-mono text-[11px]"
              />
            </div>
            <Textarea
              rows={2}
              value={opt.lessonLearned ?? ""}
              onChange={e => updateOption(idx, { lessonLearned: e.target.value })}
              placeholder="Lesson learned"
              className="text-[11px]"
            />
          </div>
        ))}
      </div>
    </div>
  )
}

function SpecialForm({ data, onSave }: { data: SpecialNodeData; onSave: (d: SpecialNodeData) => void }) {
  const [local, setLocal] = useState<SpecialNodeData>(data)
  useEffect(() => { setLocal(data) }, [data])

  function commit(next: SpecialNodeData) {
    setLocal(next)
    onSave(next)
  }

  function updateThreshold(idx: number, patch: Partial<SpecialNodeData["thresholds"][number]>) {
    const thresholds = local.thresholds.map((t, i) =>
      i === idx ? { ...t, ...patch, predicate: { ...t.predicate, ...(patch.predicate ?? {}) } } : t,
    )
    commit({ ...local, thresholds })
  }

  function addThreshold() {
    commit({
      ...local,
      thresholds: [
        ...local.thresholds,
        { id: makeId("thr"), label: `Threshold ${local.thresholds.length + 1}`, predicate: { op: ">=", value: 0 } },
      ],
    })
  }

  function removeThreshold(idx: number) {
    commit({ ...local, thresholds: local.thresholds.filter((_, i) => i !== idx) })
  }

  return (
    <div className="flex flex-col gap-3">
      <Field label="Type">
        <select
          value={local.type}
          onChange={e => commit({ ...local, type: e.target.value as SpecialType })}
          className="rounded border border-border bg-background px-2 py-1.5 text-xs font-mono"
        >
          {SPECIAL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </Field>
      <Field label="Assigned role (optional)">
        <select
          value={local.assignedRole ?? ""}
          onChange={e => commit({ ...local, assignedRole: e.target.value ? (e.target.value as Role) : undefined })}
          className="rounded border border-border bg-background px-2 py-1.5 text-xs font-mono"
        >
          <option value="">Auto</option>
          {(Object.keys(ROLE_META) as Role[]).map(r => (
            <option key={r} value={r}>{ROLE_META[r].label}</option>
          ))}
        </select>
      </Field>
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Thresholds</span>
          <Button type="button" size="sm" variant="outline" onClick={addThreshold}>+ Add</Button>
        </div>
        {local.thresholds.map((t, idx) => (
          <div key={t.id} className="flex flex-col gap-1 rounded border border-border bg-background p-2">
            <div className="flex items-center gap-2">
              <Input
                value={t.label}
                onChange={e => updateThreshold(idx, { label: e.target.value })}
                placeholder="Label"
                className="h-7"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeThreshold(idx)}
                className="h-7 text-destructive"
              >
                Remove
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={t.predicate.op}
                onChange={e => updateThreshold(idx, { predicate: { op: e.target.value as (typeof OPS)[number], value: t.predicate.value } })}
                className="rounded border border-border bg-background px-2 py-1 text-xs font-mono"
              >
                {OPS.map(op => <option key={op} value={op}>{op}</option>)}
              </select>
              <Input
                type="number"
                value={t.predicate.value}
                onChange={e => updateThreshold(idx, { predicate: { op: t.predicate.op, value: Number(e.target.value) } })}
                className="h-7 w-24"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function OutcomeForm({ data, onSave }: { data: OutcomeNodeData; onSave: (d: OutcomeNodeData) => void }) {
  const [local, setLocal] = useState<OutcomeNodeData>(data)
  useEffect(() => { setLocal(data) }, [data])

  function commit(next: OutcomeNodeData) {
    setLocal(next)
    onSave(next)
  }

  return (
    <div className="flex flex-col gap-3">
      <Field label="Key">
        <Input value={local.key} onChange={e => commit({ ...local, key: e.target.value })} />
      </Field>
      <Field label="Label">
        <Input value={local.label} onChange={e => commit({ ...local, label: e.target.value })} />
      </Field>
      <Field label="Narrative">
        <Textarea rows={5} value={local.narrative} onChange={e => commit({ ...local, narrative: e.target.value })} />
      </Field>
      <Field label="Score impact">
        <Input
          type="number"
          value={local.scoreImpact ?? ""}
          onChange={e => commit({ ...local, scoreImpact: e.target.value ? Number(e.target.value) : undefined })}
        />
      </Field>
      <Field label="Linked dimension (optional)">
        <select
          value={local.linkedDimension ?? ""}
          onChange={e => commit({ ...local, linkedDimension: e.target.value ? (e.target.value as Dim) : undefined })}
          className="rounded border border-border bg-background px-2 py-1.5 text-xs font-mono"
        >
          <option value="">—</option>
          {DIMENSIONS.map(d => <option key={d} value={d}>{d.replace(/_/g, " ")}</option>)}
        </select>
      </Field>
      <Field label="Lesson learned (voor rapport)">
        <Textarea
          rows={2}
          value={local.lessonLearned ?? ""}
          onChange={e => commit({ ...local, lessonLearned: e.target.value })}
          placeholder="Wat leert het team hiervan?"
        />
      </Field>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <Label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{label}</Label>
      {children}
    </div>
  )
}

function StringListEditor({
  value, onChange, placeholder,
}: { value: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  function update(idx: number, next: string) { onChange(value.map((v, i) => i === idx ? next : v)) }
  return (
    <div className="flex flex-col gap-1">
      {value.map((item, idx) => (
        <div key={idx} className="flex items-center gap-1">
          <Input value={item} onChange={e => update(idx, e.target.value)} placeholder={placeholder} className="h-7 text-xs" />
          <Button
            type="button" variant="ghost" size="sm"
            onClick={() => onChange(value.filter((_, i) => i !== idx))}
            className="h-7 text-destructive shrink-0 px-2"
          >×</Button>
        </div>
      ))}
      <Button
        type="button" variant="outline" size="sm"
        onClick={() => onChange([...value, ""])}
        className="h-7 self-start"
      >+ Voeg toe</Button>
    </div>
  )
}
