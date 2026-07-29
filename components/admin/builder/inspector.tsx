"use client"

import { useEffect, useRef, useState } from "react"
import type { Node } from "@xyflow/react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import type {
  DecisionNodeData,
  DynamicFillConfig,
  DynamicFillToken,
  EvaluationAspect,
  GraphFeatures,
  GraphNodeData,
  InjectNodeData,
  OutcomeNodeData,
  RoundNodeData,
  SpecialNodeData,
} from "@/lib/graph/types"
import type { ChoiceQuality, ScoreImpacts } from "@/lib/types"
import { DYNAMIC_FILL_TOKENS } from "@/lib/graph/types"
import { AspectPillBar, isAspectActive } from "./evaluation-aspects"
import { ROLE_META } from "@/lib/types"
import type {
  BobPhase,
  FacilitatorNotes,
  InjectChannel,
  InjectReliability,
  InjectSpanAnnotation,
  InjectType,
  LearningObjective,
  Role,
  RoleAction,
  SpecialType,
  Urgency,
} from "@/lib/types"
import { SUPERVISION_AREAS, type SupervisionArea } from "@/lib/engine/supervision"
import { getSelectionRange, selectionRectRelativeTo, splitTextByAnnotations } from "@/components/shared/span-annotator"
import { RoleActionsEditor } from "./editors/role-actions-editor"
import { FacilitatorNotesEditor } from "./editors/facilitator-notes-editor"
import { LearningObjectivesEditor } from "./editors/learning-objectives-editor"
import { TargetRolesEditor } from "./editors/target-roles-editor"
import { NODE_THEME } from "./node-theme"
import type { GraphNodeType } from "@/lib/graph/types"

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

export function Inspector({ node, graphId, features, onChange, onAddInject, onDelete, onDuplicate, onSaveGraph }: Props) {
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
            features={features}
            onSave={next => onChange(node.id, next)}
            onAddInject={() => onAddInject(node.id)}
            graphId={graphId}
            nodeId={node.id}
            onSaveGraph={onSaveGraph}
          />
        )}
        {data.kind === "inject" && (
          <InjectForm key={node.id} data={data} features={features} onSave={next => onChange(node.id, next)} />
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
  features,
  onSave,
  onAddInject,
  graphId,
  nodeId,
  onSaveGraph,
}: {
  data: RoundNodeData
  features?: GraphFeatures
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

  const showLessons = isAspectActive(local.evaluationAspects, 'lessons_learned')

  return (
    <div className="flex flex-col gap-3">
      <AspectPillBar
        aspects={local.evaluationAspects}
        nodeType="round"
        features={features}
        onChange={next => commit({ ...local, evaluationAspects: next })}
      />
      <DynamicFillSection
        value={local.dynamic}
        onChange={next => commit({ ...local, dynamic: next })}
      />
      <AiPromptSection
        kind="round"
        value={local.aiPromptTemplate}
        onChange={next => commit({ ...local, aiPromptTemplate: next })}
      />
      <Field label="Title">
        <Input value={local.title} onChange={e => commit({ ...local, title: e.target.value })} />
      </Field>
      <Field label="Situation update">
        <Textarea
          rows={5}
          value={local.situation_update}
          onChange={e => commit({ ...local, situation_update: e.target.value })}
          className={local.dynamic?.enabled ? "border-l-4 border-l-amber-500/60" : undefined}
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

      {showLessons && (
        <Section title="Learning objectives" count={local.learningObjectives?.length ?? 0}>
          <LearningObjectivesEditor
            value={local.learningObjectives ?? []}
            onChange={(v: LearningObjective[]) => commit({ ...local, learningObjectives: v })}
          />
        </Section>
      )}

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

function InjectForm({ data, features, onSave }: { data: InjectNodeData; features?: GraphFeatures; onSave: (d: InjectNodeData) => void }) {
  const [local, setLocal] = useState<InjectNodeData>(data)
  const [markSpans, setMarkSpans] = useState(false)
  const [participantPreview, setParticipantPreview] = useState(false)
  useEffect(() => { setLocal(data) }, [data])

  function commit(next: InjectNodeData) {
    setLocal(next)
    onSave(next)
  }

  // Reliability now covers both the BOB-select AND the span-editor for feit/aanname/misleidend.
  const showReliability = isAspectActive(local.evaluationAspects, 'reliability')
  const showNis2 = isAspectActive(local.evaluationAspects, 'nis2')

  return (
    <div className="flex flex-col gap-3">
      <AspectPillBar
        aspects={local.evaluationAspects}
        nodeType="inject"
        features={features}
        onChange={next => commit({ ...local, evaluationAspects: next })}
      />
      <DynamicFillSection
        value={local.dynamic}
        onChange={next => commit({ ...local, dynamic: next })}
      />
      <AiPromptSection
        kind="inject"
        value={local.aiPromptTemplate}
        onChange={next => commit({ ...local, aiPromptTemplate: next })}
      />
      <div className="flex flex-wrap items-center gap-3 rounded border border-border bg-background/40 px-2 py-1.5">
        {showReliability && (
          <label className="flex items-center gap-1 text-[11px]">
            <input
              type="checkbox"
              checked={markSpans}
              onChange={e => setMarkSpans(e.target.checked)}
              className="size-3"
            />
            <span>Markeer spans</span>
          </label>
        )}
        <label className="flex items-center gap-1 text-[11px]">
          <input
            type="checkbox"
            checked={participantPreview}
            onChange={e => setParticipantPreview(e.target.checked)}
            className="size-3"
          />
          <span>Test kijk (participant preview)</span>
        </label>
      </div>
      <Field label="Title">
        <Input value={local.title} onChange={e => commit({ ...local, title: e.target.value })} />
      </Field>
      <Field label="Content">
        {showReliability && markSpans ? (
          <InjectSpanEditor
            content={local.content}
            annotations={local.groundTruthAnnotations ?? []}
            onChange={anns => commit({ ...local, groundTruthAnnotations: anns.length ? anns : undefined })}
          />
        ) : participantPreview ? (
          <div className="whitespace-pre-wrap rounded border border-border bg-background px-2 py-1.5 text-xs">
            {local.content || <span className="text-muted-foreground italic">— leeg —</span>}
          </div>
        ) : (
          <Textarea
            rows={5}
            value={local.content}
            onChange={e => commit({ ...local, content: e.target.value })}
            className={local.dynamic?.enabled ? "border-l-4 border-l-amber-500/60" : undefined}
          />
        )}
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
        {showReliability && (
          <Field label="Betrouwbaarheid (BOB)">
            <select
              value={local.reliability ?? ""}
              onChange={e => commit({ ...local, reliability: e.target.value ? (e.target.value as InjectReliability) : undefined })}
              className="rounded border border-border bg-background px-2 py-1.5 text-xs font-mono"
            >
              <option value="">— niet gespecificeerd —</option>
              <option value="fact">✓ Feit (bevestigd)</option>
              <option value="assumption">? Aanname</option>
              <option value="misleading">✗ Misleidend (verborgen voor participant)</option>
            </select>
            <p className="mt-1 font-mono text-[10px] text-muted-foreground leading-snug">
              Alleen jij (facilitator) ziet dit. Participanten moeten zelf de betrouwbaarheid bepalen.
            </p>
          </Field>
        )}
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
          {showNis2 && (
            <label className="flex items-center gap-2 text-[11px] pt-1">
              <input
                type="checkbox"
                checked={local.nis2Relevant ?? false}
                onChange={e => commit({ ...local, nis2Relevant: e.target.checked || undefined })}
                className="size-3"
              />
              <span>NIS2 relevant</span>
            </label>
          )}
        </div>
      </Section>

      {showNis2 && (
        <Section title="Testgebieden (toezichthouder)" count={local.supervisionAreas?.length ?? 0}>
          <SupervisionAreasSelect
            value={local.supervisionAreas ?? []}
            onChange={v => commit({ ...local, supervisionAreas: v.length ? v : undefined })}
          />
        </Section>
      )}
    </div>
  )
}

function AiPromptSection({
  value,
  onChange,
  kind,
}: {
  value: string | undefined
  onChange: (next: string | undefined) => void
  kind: 'round' | 'inject'
}) {
  const [open, setOpen] = useState(false)
  const hasValue = (value ?? "").trim().length > 0
  const placeholder = kind === 'round'
    ? "Bijv: Schrijf een openingssituatie voor een ransomware-aanval op een {{sector}}-organisatie, focus op {{criticalSystems}}. Toon van SOC."
    : "Bijv: Schrijf de eerste ransom-note van de aanvaller aan een {{sector}}-organisatie."
  return (
    <details className="rounded border border-border bg-background/40" open={open} onToggle={e => setOpen((e.target as HTMLDetailsElement).open)}>
      <summary className="cursor-pointer px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground select-none list-none flex items-center justify-between">
        <span>AI opening-prompt{hasValue ? " ●" : ""}</span>
        <span className="text-[8px] opacity-50">{open ? "▼" : "▶"}</span>
      </summary>
      <div className="px-2.5 pb-2.5 pt-1 flex flex-col gap-2">
        <p className="font-mono text-[10px] text-muted-foreground leading-snug">
          Bij sessie-start stuurt Claude deze prompt (na token-fill) en schrijft de {kind === 'round' ? 'situatie-update' : 'inject-inhoud'} zelf. Tokens zoals <code>{"{{sector}}"}</code> worden eerst vervangen.
        </p>
        <Textarea
          rows={4}
          value={value ?? ""}
          onChange={e => onChange(e.target.value || undefined)}
          placeholder={placeholder}
          className="text-xs"
        />
      </div>
    </details>
  )
}

function DynamicFillSection({
  value,
  onChange,
}: {
  value: DynamicFillConfig | undefined
  onChange: (next: DynamicFillConfig | undefined) => void
}) {
  const enabled = value?.enabled ?? false
  const fillFrom = value?.fillFrom ?? []
  const [open, setOpen] = useState(false)

  function toggleToken(t: DynamicFillToken) {
    const next = fillFrom.includes(t) ? fillFrom.filter(x => x !== t) : [...fillFrom, t]
    onChange({ enabled: true, fillFrom: next })
  }

  return (
    <details className="rounded border border-border bg-background/40" open={open} onToggle={e => setOpen((e.target as HTMLDetailsElement).open)}>
      <summary className="cursor-pointer px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground select-none list-none flex items-center justify-between">
        <span>Dynamisch invullen{enabled ? ` (${fillFrom.length})` : ""}</span>
        <span className="text-[8px] opacity-50">{open ? "▼" : "▶"}</span>
      </summary>
      <div className="px-2.5 pb-2.5 pt-1 flex flex-col gap-2">
        <label className="flex items-center gap-2 text-[11px]">
          <input
            type="checkbox"
            checked={enabled}
            onChange={e => onChange(e.target.checked ? { enabled: true, fillFrom } : undefined)}
            className="size-3"
          />
          <span>Vul in op basis van gameconfig bij sessie-start</span>
        </label>
        {enabled && (
          <>
            <div className="flex flex-wrap gap-1">
              {DYNAMIC_FILL_TOKENS.map(t => (
                <label key={t} className="inline-flex items-center gap-1 rounded border border-border bg-background px-1.5 py-0.5 text-[10px] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={fillFrom.includes(t)}
                    onChange={() => toggleToken(t)}
                    className="size-3"
                  />
                  <span className="font-mono">{`{{${t}}}`}</span>
                </label>
              ))}
            </div>
            <p className="font-mono text-[10px] text-muted-foreground leading-snug">
              Gebruik tokens in title / content, bv. <code>{"{{sector}}"}</code>. Alleen tokens die je hier aanvinkt worden vervangen bij sessie-start.
            </p>
          </>
        )}
      </div>
    </details>
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
      <label className="flex items-center gap-2 text-[11px]">
        <input
          type="checkbox"
          checked={local.perRole === true}
          onChange={e => commit({ ...local, perRole: e.target.checked || undefined })}
          className="size-3"
        />
        <span>Elke rol kiest eigen optie (per-rol keuzes ipv één facilitator-pick)</span>
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
          <DecisionOptionEditor
            key={opt.id}
            option={opt}
            perRole={local.perRole === true}
            onChange={patch => updateOption(idx, patch)}
            onRemove={() => removeOption(idx)}
          />
        ))}
      </div>
      <Section title="Testgebieden (toezichthouder)" count={local.supervisionAreas?.length ?? 0}>
        <SupervisionAreasSelect
          value={local.supervisionAreas ?? []}
          onChange={v => commit({ ...local, supervisionAreas: v.length ? v : undefined })}
        />
      </Section>
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
      <Field label="Score-bandbreedte (automatisch kiezen op cumulatieve score)">
        <div className="flex items-center gap-2">
          <Input
            type="number"
            placeholder="min"
            value={local.scoreRange?.min ?? ""}
            onChange={e => commit({
              ...local,
              scoreRange: {
                ...local.scoreRange,
                min: e.target.value === "" ? undefined : Number(e.target.value),
              },
            })}
            className="h-7 w-24 font-mono text-[11px]"
          />
          <span className="font-mono text-[10px] text-muted-foreground">t/m</span>
          <Input
            type="number"
            placeholder="max"
            value={local.scoreRange?.max ?? ""}
            onChange={e => commit({
              ...local,
              scoreRange: {
                ...local.scoreRange,
                max: e.target.value === "" ? undefined : Number(e.target.value),
              },
            })}
            className="h-7 w-24 font-mono text-[11px]"
          />
        </div>
        <p className="mt-1 font-mono text-[10px] text-muted-foreground leading-snug">
          Beide inclusief. Laat leeg voor "geen ondergrens" / "geen bovengrens". Alleen actief als "Score" feature aan staat.
        </p>
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

const SPAN_TAG_STYLE: Record<InjectReliability, { underline: string; dot: string; label: string }> = {
  fact:       { underline: "decoration-emerald-500/60", dot: "bg-emerald-500", label: "Feit" },
  assumption: { underline: "decoration-yellow-500/60", dot: "bg-yellow-500",  label: "Aanname" },
  misleading: { underline: "decoration-red-500/60",    dot: "bg-red-500",     label: "Misleidend" },
}

function InjectSpanEditor({
  content,
  annotations,
  onChange,
}: {
  content: string
  annotations: InjectSpanAnnotation[]
  onChange: (next: InjectSpanAnnotation[]) => void
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [toolbar, setToolbar] = useState<{ x: number; y: number; start: number; end: number } | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)

  function handleMouseUp() {
    const sel = getSelectionRange(rootRef.current)
    if (!sel) { setToolbar(null); return }
    const rect = selectionRectRelativeTo(rootRef.current)
    if (!rect) { setToolbar(null); return }
    setToolbar({ ...rect, ...sel })
  }

  function addAnnotation(tag: InjectReliability) {
    if (!toolbar) return
    const id = `sp_${Math.random().toString(36).slice(2, 8)}`
    onChange([...annotations, { id, start: toolbar.start, end: toolbar.end, tag }])
    setToolbar(null)
    window.getSelection()?.removeAllRanges()
  }

  function removeAnnotation(id: string) {
    onChange(annotations.filter(a => a.id !== id))
    setEditingId(null)
  }

  function updateAnnotation(id: string, patch: Partial<InjectSpanAnnotation>) {
    onChange(annotations.map(a => a.id === id ? { ...a, ...patch } : a))
  }

  const segs = splitTextByAnnotations<InjectReliability>(content, annotations)
  const editing = editingId ? annotations.find(a => a.id === editingId) ?? null : null

  return (
    <div className="flex flex-col gap-1">
      <div className="text-[10px] text-muted-foreground">
        Selecteer een woord of zin en klik op een label om te markeren.
      </div>
      <div
        ref={rootRef}
        onMouseUp={handleMouseUp}
        className="relative whitespace-pre-wrap rounded border border-border bg-background px-2 py-1.5 text-xs leading-relaxed select-text"
      >
        {segs.map((seg, i) => {
          const slice = content.slice(seg.start, seg.end)
          if (!seg.tag || !seg.annotationId) return <span key={i}>{slice}</span>
          const style = SPAN_TAG_STYLE[seg.tag]
          return (
            <button
              key={i}
              type="button"
              onClick={(e) => { e.stopPropagation(); setEditingId(seg.annotationId!) }}
              className={`underline decoration-2 ${style.underline} cursor-pointer bg-transparent p-0 text-inherit font-inherit`}
              title="Klik om te bewerken"
            >
              {slice}
            </button>
          )
        })}
        {toolbar && (
          <div
            className="absolute z-20 -translate-x-1/2 -translate-y-full rounded-md border border-border bg-popover shadow-md flex items-center gap-1 px-1.5 py-1"
            style={{ left: toolbar.x, top: toolbar.y }}
          >
            {(["fact", "assumption", "misleading"] as InjectReliability[]).map(tag => (
              <button
                key={tag}
                type="button"
                onClick={() => addAnnotation(tag)}
                className="rounded px-1.5 py-0.5 text-[10px] font-mono hover:bg-accent"
                title={SPAN_TAG_STYLE[tag].label}
              >
                <span className={`inline-block size-1.5 rounded-full ${SPAN_TAG_STYLE[tag].dot} mr-1 align-middle`} />
                {SPAN_TAG_STYLE[tag].label}
              </button>
            ))}
          </div>
        )}
      </div>
      {editing && (
        <div className="flex flex-col gap-1 rounded border border-border bg-background/60 p-2 text-[11px]">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase text-muted-foreground">
              {SPAN_TAG_STYLE[editing.tag].label} — "{content.slice(editing.start, editing.end).slice(0, 40)}"
            </span>
            <div className="flex gap-1">
              <Button type="button" size="sm" variant="outline" className="h-6 px-2 text-[10px]" onClick={() => setEditingId(null)}>Sluit</Button>
              <Button type="button" size="sm" variant="ghost" className="h-6 px-2 text-[10px] text-destructive" onClick={() => removeAnnotation(editing.id)}>Verwijder</Button>
            </div>
          </div>
          <Textarea
            rows={2}
            value={editing.authorNote ?? ""}
            onChange={e => updateAnnotation(editing.id, { authorNote: e.target.value || undefined })}
            placeholder="Optionele toelichting (zichtbaar in review)"
            className="text-[11px]"
          />
        </div>
      )}
    </div>
  )
}

const DECISION_PRIMARY_DIMS: Array<{ key: 'decision_speed' | 'decision_quality' | 'compliance_awareness' | 'communication_clarity'; label: string }> = [
  { key: 'decision_speed',        label: 'Snelheid' },
  { key: 'decision_quality',      label: 'Kwaliteit' },
  { key: 'compliance_awareness',  label: 'Compliance' },
  { key: 'communication_clarity', label: 'Communicatie' },
]

const DECISION_QUALITY_RANKS: Array<{ key: ChoiceQuality; label: string; className: string }> = [
  { key: 'best',  label: 'Best',      className: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/40' },
  { key: 'good',  label: 'Goed',      className: 'bg-sky-500/15 text-sky-600 border-sky-500/40' },
  { key: 'poor',  label: 'Kon beter', className: 'bg-amber-500/15 text-amber-600 border-amber-500/40' },
  { key: 'wrong', label: 'Fout',      className: 'bg-red-500/15 text-red-600 border-red-500/40' },
]

function DecisionOptionEditor({
  option,
  perRole,
  onChange,
  onRemove,
}: {
  option: DecisionNodeData["options"][number]
  perRole: boolean
  onChange: (patch: Partial<DecisionNodeData["options"][number]>) => void
  onRemove: () => void
}) {
  return (
    <div className="flex flex-col gap-2 rounded border border-border bg-background p-2">
      <div className="flex items-center gap-2">
        <Input
          value={option.label}
          onChange={e => onChange({ label: e.target.value })}
          placeholder="Label van deze keuze"
          className="h-7"
        />
        <Button type="button" variant="ghost" size="sm" onClick={onRemove} className="h-7 text-destructive">
          Remove
        </Button>
      </div>
      {perRole && (
        <select
          value={option.allowedRole ?? ""}
          onChange={e => onChange({ allowedRole: e.target.value ? (e.target.value as Role) : undefined })}
          className="rounded border border-border bg-background px-2 py-1 font-mono text-[10px]"
        >
          <option value="">Voor alle rollen</option>
          {(Object.keys(ROLE_META) as Role[]).map(r => (
            <option key={r} value={r}>{ROLE_META[r].label}</option>
          ))}
        </select>
      )}
      {/* Score-impact per dimensie (max 2 raken is prima) */}
      <div className="grid grid-cols-2 gap-1.5">
        {DECISION_PRIMARY_DIMS.map(d => (
          <label key={d.key} className="flex items-center gap-1.5 rounded border border-border bg-background px-1.5 py-1">
            <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground flex-1 min-w-0 truncate">{d.label}</span>
            <Input
              type="number"
              min={-5}
              max={5}
              value={option.scoreImpacts?.[d.key] ?? ""}
              onChange={e => {
                const raw = e.target.value
                const next: ScoreImpacts = { ...(option.scoreImpacts ?? {}) }
                if (raw === "" || Number(raw) === 0) delete next[d.key]
                else next[d.key] = Number(raw)
                onChange({ scoreImpacts: Object.keys(next).length ? next : undefined })
              }}
              placeholder="0"
              className="h-6 w-14 font-mono text-[11px] text-right"
            />
          </label>
        ))}
      </div>
      {/* Kwaliteit-ranking */}
      <div className="flex items-center gap-1.5">
        <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground shrink-0">Kwaliteit</span>
        <div className="flex gap-1 flex-1">
          {DECISION_QUALITY_RANKS.map(r => {
            const on = option.qualityRank === r.key
            return (
              <button
                key={r.key}
                type="button"
                onClick={() => onChange({ qualityRank: on ? undefined : r.key })}
                className={`rounded border px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider transition-colors ${
                  on ? r.className : "border-border bg-background text-muted-foreground hover:border-primary/40"
                }`}
              >
                {r.label}
              </button>
            )
          })}
        </div>
      </div>
      <Textarea
        rows={2}
        value={option.facilitatorCommentary ?? ""}
        onChange={e => onChange({ facilitatorCommentary: e.target.value || undefined })}
        placeholder="IR-retainer perspectief — verschijnt in review-fase én rapport"
        className="text-[11px]"
      />
      <Textarea
        rows={2}
        value={option.lessonLearned ?? ""}
        onChange={e => onChange({ lessonLearned: e.target.value || undefined })}
        placeholder="Lesson learned (1 zin voor debrief)"
        className="text-[11px]"
      />
    </div>
  )
}

function SupervisionAreasSelect({
  value,
  onChange,
}: {
  value: SupervisionArea[]
  onChange: (next: SupervisionArea[]) => void
}) {
  function toggle(id: SupervisionArea) {
    onChange(value.includes(id) ? value.filter(v => v !== id) : [...value, id])
  }
  return (
    <div className="grid grid-cols-1 gap-1">
      {SUPERVISION_AREAS.map(a => (
        <label key={a.id} className="flex items-start gap-2 text-[11px]">
          <input
            type="checkbox"
            checked={value.includes(a.id)}
            onChange={() => toggle(a.id)}
            className="size-3 mt-0.5"
          />
          <span>
            <span className="font-mono text-[10px] text-muted-foreground">{a.numberLabel}.</span>{" "}
            <span>{a.label}</span>
          </span>
        </label>
      ))}
    </div>
  )
}
