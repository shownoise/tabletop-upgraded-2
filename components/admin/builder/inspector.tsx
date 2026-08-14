"use client"

import { useEffect, useMemo, useState } from "react"
import type { Node } from "@xyflow/react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import type {
  DecisionNodeData, GraphFeatures, GraphNodeData,
  InjectNodeData, OutcomeNodeData, OutcomeVector, RoundNodeData, ScenarioGraph,
} from "@/lib/graph/types"
import { DEFAULT_EXPECTED_OPTIONS_PER_ROLE } from "@/lib/graph/types"
import { ROLE_META, ROLE_ORDER, type Role } from "@/lib/types"
import { Plus, Trash, Pencil, ArrowRight, AlertTriangle } from "lucide-react"
import {
  candidateDecisionsForInject,
  collectSetupInjectsForDecision,
} from "@/lib/graph/setup-injects"

// Minimal inspector. Alleen wat een auteur nodig heeft voor een story.
// Rest van de scoring-details (domein, owner, requiresCosign, consulted,
// aiPromptTemplate, dynamic, supervisionAreas, evaluationAspects) staan
// nog wel op de types voor backwards compat — hier niet zichtbaar.

interface Props {
  node: Node | null
  graphId: string
  features?: GraphFeatures
  graph?: ScenarioGraph
  onChange: (nodeId: string, data: GraphNodeData) => void
  onAddInject: (roundNodeId: string) => void
  onDelete: (nodeId: string) => void
  onDuplicate?: (nodeId: string) => void
  onSaveGraph: () => Promise<boolean>
  onSelectNode?: (nodeId: string) => void
}

const DIMS: Array<{ key: keyof OutcomeVector; label: string; hint: string }> = [
  { key: "CONT", label: "Containment", hint: "Verkleint dit de voetafdruk van de aanvaller?" },
  { key: "FOR",  label: "Forensiek",   hint: "Bewijs & volatiele data blijven bruikbaar?" },
  { key: "BC",   label: "Continuïteit", hint: "Downtime & workarounds — kosten aan operaties?" },
  { key: "JUR",  label: "Juridisch",   hint: "Meldplichten, contract, verzekeraar" },
  { key: "VER",  label: "Vertrouwen",  hint: "Klanten, medewerkers, toezicht, pers" },
  { key: "KOS",  label: "Kosten",      hint: "Uren + externe kosten" },
]

const ROLES: readonly Role[] = ROLE_ORDER

export function Inspector({ node, graph, onChange, onAddInject, onDelete, onDuplicate, onSelectNode }: Props) {
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
          <InjectForm
            data={data}
            nodeId={node.id}
            graph={graph}
            onSave={d => onChange(node.id, d)}
          />
        )}
        {data.kind === "decision" && (
          <DecisionForm
            data={data}
            nodeId={node.id}
            graph={graph}
            onSave={d => onChange(node.id, d)}
            onSelectNode={onSelectNode}
          />
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
      <div>
        <Label className="text-xs">Facilitator sturing (alleen zichtbaar op dashboard)</Label>
        <Textarea
          rows={4}
          value={(local.facilitatorNotes?.discussionGoal ?? "")}
          onChange={e => {
            const text = e.target.value
            const existing = local.facilitatorNotes ?? {
              discussionGoal: "",
              keyQuestions: [],
              hints: [],
              expectedDecisions: [],
              redFlags: [],
            }
            commit({ ...local, facilitatorNotes: { ...existing, discussionGoal: text } })
          }}
          placeholder="Wat test deze ronde? Welke spanning wil je oproepen? Wat doe je als het team blokkeert of te snel gaat?"
        />
        <p className="mt-1 text-[10px] text-muted-foreground">
          Deze tekst verschijnt alleen bij de facilitator tijdens de ronde. Deelnemers zien niets van dit veld.
        </p>
      </div>
      <Button size="sm" variant="outline" onClick={onAddInject} className="gap-2">
        <Plus className="size-3" /> Inject toevoegen
      </Button>
    </div>
  )
}

// ── Inject ─────────────────────────────────────────────────────────────

function InjectForm({
  data,
  nodeId,
  graph,
  onSave,
}: {
  data: InjectNodeData
  nodeId: string
  graph?: ScenarioGraph
  onSave: (d: InjectNodeData) => void
}) {
  const [local, setLocal] = useState(data)
  useEffect(() => setLocal(data), [data])
  function commit(next: InjectNodeData) { setLocal(next); onSave(next) }

  const target = local.targetRoles ?? []
  function toggleRole(r: Role) {
    const next = target.includes(r) ? target.filter(x => x !== r) : [...target, r]
    // Zichtbaarheid volgt targetRoles: leeg → 'shared' (iedereen), gevuld → 'exclusive'
    // (alleen die rollen). Voorheen was dit een aparte dropdown die niet doorwerkte
    // in de deelnemer-view (alleen scoring keek ernaar); we consolideren tot één
    // control zodat de bedoeling niet meer uit twee schermen bij elkaar te lezen is.
    const visibility: "shared" | "exclusive" = next.length > 0 ? "exclusive" : "shared"
    commit({ ...local, targetRoles: next.length ? next : undefined, visibility })
  }

  // Phase 1 — populate the setup-decision dropdown from the current graph.
  const setupCandidates = useMemo(() => {
    if (!graph) return []
    return candidateDecisionsForInject(graph, nodeId)
  }, [graph, nodeId])

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
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Type informatie (publiek)</Label>
          <select
            value={local.classification ?? ""}
            onChange={e => {
              const v = e.target.value
              commit({ ...local, classification: v ? (v as "feit" | "aanname") : undefined })
            }}
            className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs"
          >
            <option value="">— kies —</option>
            <option value="feit">Feit</option>
            <option value="aanname">Aanname</option>
          </select>
          <p className="mt-1 text-[10px] text-muted-foreground">
            Zichtbaar voor deelnemer als label bij de inject.
          </p>
        </div>
        <div>
          <Label className="text-xs">Ground truth (privé)</Label>
          <select
            value={local.reliability ?? ""}
            onChange={e => {
              const v = e.target.value
              commit({ ...local, reliability: v ? (v as "fact" | "assumption" | "misleading") : undefined })
            }}
            className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs"
          >
            <option value="">— optioneel —</option>
            <option value="fact">Feit (waar)</option>
            <option value="assumption">Aanname (onbekend)</option>
            <option value="misleading">Misleidend (bewust onwaar)</option>
          </select>
          <p className="mt-1 text-[10px] text-muted-foreground">
            Gestript uit deelnemer-payload tot review-fase. Voedt factcheck-paneel.
          </p>
        </div>
      </div>
      {!local.classification && (
        <p className="text-[10px] text-yellow-700 dark:text-yellow-400">
          Auteur moet publiek type kiezen — feit of aanname.
        </p>
      )}
      <div>
        <Label className="text-xs">Zet welke beslissing op?</Label>
        <select
          value={local.setsUpDecisionNodeId ?? ""}
          onChange={e => {
            const v = e.target.value
            commit({ ...local, setsUpDecisionNodeId: v || undefined })
          }}
          className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs"
        >
          <option value="">— geen setup-link —</option>
          {setupCandidates.map(c => (
            <option key={c.decisionId} value={c.decisionId}>
              R{c.roundNumber} · {truncate(c.label, 60)}
            </option>
          ))}
        </select>
        <p className="mt-1 text-[10px] text-muted-foreground">
          Elke beslissing zou minstens één inject moeten hebben die haar voorspelbaar maakt — anders komt de beslissing &quot;uit het niets&quot;.
        </p>
      </div>
      <div>
        <Label className="text-xs">Waarom deze inject? (facilitator-only)</Label>
        <Input
          value={local.facilitatorNote ?? ""}
          onChange={e => commit({ ...local, facilitatorNote: e.target.value || undefined })}
          placeholder="Wat test deze inject? Welke reactie verwacht je?"
        />
        <p className="mt-1 text-[10px] text-muted-foreground">
          Alleen zichtbaar op facilitator-dashboard. Deelnemers zien dit nooit.
        </p>
      </div>
    </div>
  )
}

// ── Decision ───────────────────────────────────────────────────────────

function DecisionForm({
  data,
  nodeId,
  graph,
  onSave,
  onSelectNode,
}: {
  data: DecisionNodeData
  nodeId: string
  graph?: ScenarioGraph
  onSave: (d: DecisionNodeData) => void
  onSelectNode?: (nodeId: string) => void
}) {
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

  const expected = graph?.expectedOptionsPerRole ?? DEFAULT_EXPECTED_OPTIONS_PER_ROLE

  // Which roles this scenario cares about — union of allowedRole across ALL
  // decision nodes in the graph. Used to flag "role in scenario but missing
  // here" (red pill).
  const scenarioRoles = useMemo<Set<Role>>(() => {
    const s = new Set<Role>()
    if (!graph) return s
    for (const n of graph.nodes) {
      if (n.type !== "decision") continue
      const dd = n.data as DecisionNodeData
      for (const opt of dd.options) if (opt.allowedRole) s.add(opt.allowedRole)
    }
    return s
  }, [graph])

  const setupInjects = useMemo(() => {
    if (!graph) return []
    return collectSetupInjectsForDecision(graph, nodeId)
  }, [graph, nodeId])

  // Roles present on THIS decision (via option.allowedRole).
  const rolesOnThisDecision = useMemo<Set<Role>>(() => {
    const s = new Set<Role>()
    for (const o of local.options) if (o.allowedRole) s.add(o.allowedRole)
    return s
  }, [local.options])

  // Count options per role for the summary pills.
  const countsPerRole = useMemo<Record<Role, number>>(() => {
    const c: Record<Role, number> = {
      ceo: 0, ciso: 0, cfo: 0, legal: 0, head_of_comms: 0,
      hr_lead: 0, ops_manager: 0, it_manager: 0,
    }
    for (const o of local.options) if (o.allowedRole) c[o.allowedRole] += 1
    return c
  }, [local.options])

  // Union: roles on this decision + roles in scenario. Sorted by ROLE_ORDER.
  const summaryRoles = useMemo<Role[]>(() => {
    const union = new Set<Role>([...rolesOnThisDecision, ...scenarioRoles])
    return ROLE_ORDER.filter(r => union.has(r))
  }, [rolesOnThisDecision, scenarioRoles])

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

      <DecisionSummary
        summaryRoles={summaryRoles}
        rolesOnThisDecision={rolesOnThisDecision}
        countsPerRole={countsPerRole}
        expected={expected}
      />

      <SetupInjectsSection
        setups={setupInjects}
        onSelectNode={onSelectNode}
      />

      <OptionsByRole
        options={local.options}
        onUpdate={updateOption}
        onRemove={removeOption}
        onAdd={addOption}
      />
    </div>
  )
}

// Compact summary block above the option grid — the primary at-a-glance view.
function DecisionSummary({
  summaryRoles,
  rolesOnThisDecision,
  countsPerRole,
  expected,
}: {
  summaryRoles: Role[]
  rolesOnThisDecision: Set<Role>
  countsPerRole: Record<Role, number>
  expected: number
}) {
  if (summaryRoles.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-muted/30 p-3 text-[11px] text-muted-foreground">
        Nog geen rollen gekoppeld — kies hieronder een rol om opties toe te voegen.
      </div>
    )
  }
  const chips = summaryRoles.filter(r => rolesOnThisDecision.has(r))
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3">
      <div className="mb-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Overzicht</div>
      <div className="mb-2 text-xs">
        <span className="text-muted-foreground">Rollen in deze beslissing: </span>
        {chips.length === 0
          ? <span className="text-muted-foreground italic">geen</span>
          : chips.map((r, i) => (
              <span key={r}>
                <span className="font-medium">{ROLE_META[r].label}</span>
                {i < chips.length - 1 ? <span className="text-muted-foreground"> · </span> : null}
              </span>
            ))
        }
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {summaryRoles.map(r => {
          const count = countsPerRole[r] ?? 0
          const tone =
            count === 0 ? "border-destructive/50 bg-destructive/10 text-destructive"
            : count >= expected ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
            : "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400"
          return (
            <div
              key={r}
              className={`flex items-center justify-between rounded border px-2 py-1 text-[11px] ${tone}`}
              title={
                count === 0
                  ? `Rol staat elders in het scenario maar heeft hier 0 opties.`
                  : count < expected
                    ? `Minder dan ${expected} opties — deelnemer krijgt weinig keuze.`
                    : `Genoeg opties (${expected} target).`
              }
            >
              <span className="truncate">{ROLE_META[r].label}</span>
              <span className="font-mono ml-2">{count}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function SetupInjectsSection({
  setups,
  onSelectNode,
}: {
  setups: Array<{ injectId: string; title: string; roundNumber: number }>
  onSelectNode?: (nodeId: string) => void
}) {
  if (setups.length === 0) {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-[11px] text-amber-800 dark:text-amber-300">
        <AlertTriangle className="size-3.5 shrink-0 mt-0.5" />
        <div>
          <div className="font-medium">Deze beslissing heeft geen setup-inject.</div>
          <div className="mt-0.5 text-[10.5px] opacity-90">
            Een deelnemer die oplet zou de beslissing moeten kunnen zien aankomen. Markeer een inject in
            dezelfde of vorige ronde met &quot;Zet welke beslissing op?&quot;.
          </div>
        </div>
      </div>
    )
  }
  return (
    <div className="rounded-lg border border-border bg-muted/20 p-3">
      <Label className="text-xs">Setup-inject(s)</Label>
      <ul className="mt-1 flex flex-col gap-1">
        {setups.map(s => (
          <li key={s.injectId} className="flex items-center justify-between gap-2 rounded border border-border bg-background px-2 py-1">
            <span className="min-w-0 flex-1 truncate text-xs">
              <span className="font-mono text-[10px] text-muted-foreground mr-1.5">R{s.roundNumber}</span>
              {s.title}
            </span>
            {onSelectNode && (
              <Button
                size="sm"
                variant="ghost"
                className="h-6 gap-1 shrink-0 text-[11px]"
                onClick={() => onSelectNode(s.injectId)}
                title="Selecteer deze inject in het canvas"
              >
                <ArrowRight className="size-3" /> Ga naar inject
              </Button>
            )}
          </li>
        ))}
      </ul>
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
  // Only one option is expanded across the whole grid at any time — expanding
  // a new row collapses the previous one. `expandAll` overrides: als true dan
  // negeren we expandedId en toont elke rij zijn editor.
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [expandAll, setExpandAll] = useState(false)

  const roleBuckets = new Map<Role | "__any__", Array<{ opt: DecisionNodeData["options"][number]; idx: number }>>()
  options.forEach((opt, idx) => {
    const key = (opt.allowedRole ?? "__any__") as Role | "__any__"
    const bucket = roleBuckets.get(key) ?? []
    bucket.push({ opt, idx })
    roleBuckets.set(key, bucket)
  })

  // Deterministic order: canonical ROLE_ORDER first, then "any role" at the bottom.
  const orderedRoles: Array<Role | "__any__"> = [
    ...ROLE_ORDER.filter(r => roleBuckets.has(r)),
    ...(roleBuckets.has("__any__") ? (["__any__"] as const) : []),
  ]

  const rolesWithoutOptions = ROLE_ORDER.filter(r => !roleBuckets.has(r))

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <Label className="text-xs">Opties per rol</Label>
        {options.length > 0 && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setExpandAll(prev => !prev)
              setExpandedId(null)
            }}
            className="h-6 text-[10px] font-mono uppercase tracking-wider"
            title={expandAll ? "Alles inklappen" : "Alles uitklappen"}
          >
            {expandAll ? "− Alles inklappen" : "+ Alles uitklappen"}
          </Button>
        )}
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
            <div className="flex flex-col gap-1.5">
              {bucket.map(({ opt, idx }) => (
                <OptionRow
                  key={opt.id}
                  option={opt}
                  expanded={expandAll || expandedId === opt.id}
                  onExpand={() => setExpandedId(prev => prev === opt.id ? null : opt.id)}
                  onChange={patch => onUpdate(idx, patch)}
                  onRemove={() => {
                    if (expandedId === opt.id) setExpandedId(null)
                    onRemove(idx)
                  }}
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

// Compact single-row option; expands to the full editor inline when clicked.
function OptionRow({
  option,
  expanded,
  onExpand,
  onChange,
  onRemove,
}: {
  option: DecisionNodeData["options"][number]
  expanded: boolean
  onExpand: () => void
  onChange: (patch: Partial<DecisionNodeData["options"][number]>) => void
  onRemove: () => void
}) {
  const vec = option.outcomeVector
  return (
    <div className={`rounded border ${expanded ? "border-primary/40 bg-background" : "border-border bg-background"}`}>
      {/* Collapsed row — always visible, one tight line. */}
      <div className="flex items-center gap-2 px-2 py-1.5">
        <span className="min-w-0 flex-1 truncate text-xs" title={option.label}>
          {option.label?.trim() ? truncate(option.label, 60) : <span className="text-muted-foreground italic">(zonder tekst)</span>}
        </span>
        <span className="hidden sm:inline font-mono text-[10px] text-muted-foreground shrink-0" title="Impact op de 6 dimensies">
          {formatVector(vec)}
        </span>
        {option.allowedRole && (
          <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground shrink-0">
            {ROLE_META[option.allowedRole].label}
          </span>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="h-6 w-6 p-0 shrink-0"
          onClick={onExpand}
          title={expanded ? "Inklappen" : "Bewerken"}
        >
          <Pencil className="size-3" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 w-6 p-0 shrink-0 text-destructive"
          onClick={onRemove}
          title="Optie verwijderen"
        >
          <Trash className="size-3" />
        </Button>
      </div>
      {expanded && (
        <div className="border-t border-border p-3">
          <OptionEditor option={option} onChange={onChange} otherRoles={ROLE_ORDER} />
        </div>
      )}
    </div>
  )
}

function OptionEditor({
  option,
  onChange,
  otherRoles,
}: {
  option: DecisionNodeData["options"][number]
  onChange: (patch: Partial<DecisionNodeData["options"][number]>) => void
  otherRoles: readonly Role[]
}) {
  const vec = option.outcomeVector ?? { CONT: 0, FOR: 0, BC: 0, JUR: 0, VER: 0, KOS: 0 }
  function setDim(dim: keyof OutcomeVector, v: number) {
    const clamped = Math.max(-2, Math.min(2, v))
    onChange({ outcomeVector: { ...vec, [dim]: clamped } })
  }

  return (
    <div className="flex flex-col gap-2">
      <Textarea
        rows={2}
        value={option.label}
        onChange={e => onChange({ label: e.target.value })}
        placeholder="Wat zegt deze keuze? (volledige zin)"
        className="text-xs resize-none min-h-[3rem]"
      />

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

// Format an outcomeVector into a tight single-line preview like "CONT+2 FOR+1 KOS-1".
// Zero-value dimensions are omitted. Undefined vector → em dash.
function formatVector(v: OutcomeVector | undefined): string {
  if (!v) return "—"
  const parts: string[] = []
  const order: Array<keyof OutcomeVector> = ["CONT", "FOR", "BC", "JUR", "VER", "KOS"]
  for (const k of order) {
    const n = v[k]
    if (typeof n !== "number" || n === 0) continue
    parts.push(`${k}${n > 0 ? "+" : ""}${n}`)
  }
  return parts.length > 0 ? parts.join(" ") : "—"
}

function truncate(s: string, max: number): string {
  if (!s) return ""
  if (s.length <= max) return s
  return s.slice(0, Math.max(0, max - 1)).trimEnd() + "…"
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
