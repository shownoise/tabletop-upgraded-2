"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import {
  addEdge,
  Background,
  ControlButton,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
  type OnConnect,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"

import { Palette } from "./palette"
import { Inspector } from "./inspector"
import { Toolbar } from "./toolbar"
import { SettingsPanel } from "./settings-panel"
import { StartNode } from "./nodes/start-node"
import { RoundNode } from "./nodes/round-node"
import { InjectNode } from "./nodes/inject-node"
import { OutcomeNode } from "./nodes/outcome-node"
import { DecisionNode } from "./nodes/decision-node"
import { SpecialNode } from "./nodes/special-node"
import { TypedEdge } from "./edges/typed-edge"
import { EXAMPLES } from "@/lib/graph/examples"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Sparkles, FileText, Workflow, LayoutGrid } from "lucide-react"
import { autoLayout } from "./layout"
import type {
  EvaluationAspect,
  GraphEdge,
  GraphNode,
  GraphNodeData,
  GraphNodeType,
  InjectNodeData,
  OutcomeNodeData,
  RoundNodeData,
  ScenarioGraph,
  StartNodeData,
} from "@/lib/graph/types"
import { EYE_SECURITY_RETAINER, DEFAULT_MELDPLICHT, DEFAULT_FEATURES } from "@/lib/graph/types"
import { validateGraph } from "@/lib/graph/validate"
import type { ScenarioType } from "@/lib/types"

const NODE_TYPES = {
  start: StartNode,
  round: RoundNode,
  inject: InjectNode,
  outcome: OutcomeNode,
  decision: DecisionNode,
  special: SpecialNode,
}

const EDGE_TYPES = {
  typed: TypedEdge,
}

const MIME = "application/scenario-node-type"

function newId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`
}

function initialGraph(): ScenarioGraph {
  const now = Date.now()
  const startId = newId("start")
  return {
    id: newId("graph"),
    name: "Untitled scenario",
    version: 1,
    scenarioType: "ransomware_double_extortion",
    nodes: [{ id: startId, type: "start", position: { x: 80, y: 200 }, data: { kind: "start" } }],
    edges: [],
    createdAt: now,
    updatedAt: now,
    // Retainer is always Eye Security (v2). Author cannot edit; engine reads this everywhere.
    irRetainerName: EYE_SECURITY_RETAINER.name,
    irRetainerProfile: EYE_SECURITY_RETAINER,
    meldplicht: DEFAULT_MELDPLICHT,
    features: DEFAULT_FEATURES,
  }
}

function defaultData(type: GraphNodeType, index: number): GraphNodeData {
  switch (type) {
    case "start":
      return { kind: "start" }
    case "round":
      return {
        kind: "round",
        title: `Ronde ${index}`,
        situation_update: "",
        timerMinutes: 15,
      } satisfies RoundNodeData
    case "inject":
      return {
        kind: "inject",
        type: "alert",
        title: "Nieuwe inject",
        content: "",
        urgency: "medium",
        channel: "email",
      } satisfies InjectNodeData
    case "decision":
      return {
        kind: "decision",
        prompt: "Wat besluit het team?",
        measuredBy: "participant_choice",
        options: [
          { id: newId("opt"), label: "Optie A" },
          { id: newId("opt"), label: "Optie B" },
        ],
      }
    case "special":
      return {
        kind: "special",
        type: "ransomware_negotiation",
        thresholds: [
          { id: newId("thr"), label: "Slecht", predicate: { op: "<", value: 0 } },
          { id: newId("thr"), label: "Goed", predicate: { op: ">=", value: 0 } },
        ],
      }
    case "outcome":
      return {
        kind: "outcome",
        key: `outcome_${index}`,
        label: "Outcome",
        narrative: "",
        scoreImpact: 0,
      } satisfies OutcomeNodeData
    default:
      return { kind: "start" } satisfies StartNodeData
  }
}

function toFlowNodes(graph: ScenarioGraph): Node[] {
  return graph.nodes.map(n => ({
    id: n.id,
    type: n.type,
    position: n.position,
    data: n.data as unknown as Record<string, unknown>,
  }))
}

function toFlowEdges(graph: ScenarioGraph): Edge[] {
  return graph.edges.map(e => ({
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle,
    targetHandle: e.targetHandle,
    label: e.label,
    type: "typed",
    data: { kind: e.type },
    animated: e.type === "inject",
  }))
}

function fromFlowNodes(nodes: Node[]): GraphNode[] {
  return nodes.map(n => ({
    id: n.id,
    type: (n.type ?? "round") as GraphNodeType,
    position: n.position,
    data: n.data as unknown as GraphNodeData,
  }))
}

function fromFlowEdges(edges: Edge[]): GraphEdge[] {
  return edges.map(e => {
    const kind = (e.data as { kind?: string } | undefined)?.kind
    const inferred = e.sourceHandle === "injects" ? "inject" : "sequence"
    return {
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle ?? undefined,
      targetHandle: e.targetHandle ?? undefined,
      type: (kind ?? inferred) as GraphEdge["type"],
      label: typeof e.label === "string" ? e.label : undefined,
    }
  })
}

function InnerCanvas() {
  const router = useRouter()
  const initial = useMemo(() => initialGraph(), [])
  const [graphMeta, setGraphMeta] = useState<Pick<ScenarioGraph, "id" | "name" | "version" | "scenarioType" | "createdAt" | "irRetainerName" | "irPlaybook" | "meldplicht" | "irRetainerProfile" | "features">>(
    {
      id: initial.id, name: initial.name, version: initial.version, scenarioType: initial.scenarioType, createdAt: initial.createdAt,
      irRetainerName: initial.irRetainerName, irRetainerProfile: initial.irRetainerProfile, meldplicht: initial.meldplicht, features: initial.features,
    },
  )
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(toFlowNodes(initial))
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<{ kind: "info" | "error"; text: string } | null>(null)
  const [startupOpen, setStartupOpen] = useState(true)
  const [templatesPickerOpen, setTemplatesPickerOpen] = useState(false)

  const wrapperRef = useRef<HTMLDivElement>(null)
  const { screenToFlowPosition, setCenter, fitView } = useReactFlow()

  const handleFocusNode = useCallback((nodeId: string) => {
    const n = nodes.find(x => x.id === nodeId)
    if (!n) return
    setCenter(n.position.x, n.position.y, { duration: 400, zoom: 1.2 })
    setSelectedId(nodeId)
  }, [nodes, setCenter])

  const handleAutoFixCoverage = useCallback((areaId: string) => {
    const id = `dec_${areaId}_${Math.random().toString(36).slice(2, 6)}`
    const startNode = nodes.find(n => n.type === "start")
    const anchor = startNode
      ? { x: startNode.position.x + 320, y: startNode.position.y + 120 + Math.random() * 120 }
      : { x: 320, y: 240 + Math.random() * 120 }
    const areaLabel = areaId.replace(/_/g, " ")
    // Auto-fix maakt een perRole DecisionNode met 2 placeholder per-rol opties
    // (CISO + Legal — meest voorkomend voor compliance-testgebieden). Author
    // vult de vraag/labels/scoring in via de inspector.
    const newFlowNode: Node = {
      id,
      type: "decision",
      position: anchor,
      data: {
        kind: "decision",
        prompt: `Wat doen we m.b.t. ${areaLabel}?`,
        measuredBy: "participant_choice",
        advancesGraph: false,
        perRole: true,
        options: [
          {
            id: `opt_${Math.random().toString(36).slice(2, 6)}`,
            label: `CISO — pro-actieve stap voor ${areaLabel}`,
            allowedRole: "ciso",
            scoreImpacts: { compliance_awareness: 2, decision_quality: 1 },
            qualityRank: "best",
          },
          {
            id: `opt_${Math.random().toString(36).slice(2, 6)}`,
            label: `Legal — vastlegging + juridisch afdekken`,
            allowedRole: "legal",
            scoreImpacts: { compliance_awareness: 2, communication_clarity: 1 },
            qualityRank: "best",
          },
          {
            id: `opt_${Math.random().toString(36).slice(2, 6)}`,
            label: "Uitstellen tot volgende ronde",
            scoreImpacts: { compliance_awareness: -2, decision_speed: -1 },
            qualityRank: "poor",
          },
        ],
        supervisionAreas: [areaId as never],
      } as unknown as Record<string, unknown>,
    }
    setNodes(prev => [...prev, newFlowNode])
    setSelectedId(id)
    setCenter(anchor.x, anchor.y, { duration: 400, zoom: 1.1 })
  }, [nodes, setNodes, setCenter])

  const selectedNode = useMemo(() => nodes.find(n => n.id === selectedId) ?? null, [nodes, selectedId])

  const buildGraph = useCallback((): ScenarioGraph => ({
    ...graphMeta,
    nodes: fromFlowNodes(nodes),
    edges: fromFlowEdges(edges),
    updatedAt: Date.now(),
  }), [graphMeta, nodes, edges])

  const onConnect: OnConnect = useCallback((connection: Connection) => {
    const targetNode = nodes.find(n => n.id === connection.target)
    const sourceNode = nodes.find(n => n.id === connection.source)
    let inferredType: GraphEdge["type"] = "sequence"
    if (targetNode?.type === "inject") {
      inferredType = "inject"
    } else if (sourceNode?.type === "decision" && connection.sourceHandle) {
      inferredType = "branch"
    } else if (sourceNode?.type === "special" && connection.sourceHandle) {
      inferredType = "branch"
    } else if (targetNode?.type === "outcome") {
      inferredType = "outcome"
    }
    setEdges(eds =>
      addEdge(
        {
          ...connection,
          id: newId("edge"),
          type: "typed",
          data: { kind: inferredType },
          animated: inferredType === "inject",
        },
        eds,
      ),
    )
  }, [nodes, setEdges])

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = "move"
  }, [])

  const onDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    const type = event.dataTransfer.getData(MIME) as GraphNodeType
    if (!type) return
    const position = screenToFlowPosition({ x: event.clientX, y: event.clientY })
    const roundCount = nodes.filter(n => n.type === "round").length
    const id = newId(type)
    // New inject/round nodes start opted-out (evaluationAspects: []) and immediately
    // trigger the aspect picker. Legacy nodes without the field stay in "show all" mode.
    const base = defaultData(type, roundCount + 1) as unknown as Record<string, unknown>
    const isPickable = type === "inject" || type === "round"
    const data = isPickable ? { ...base, evaluationAspects: [] as EvaluationAspect[] } : base
    const newNode: Node = { id, type, position, data }
    setNodes(ns => [...ns, newNode])
    setSelectedId(id)
  }, [nodes, screenToFlowPosition, setNodes])

  const handleNodeDataChange = useCallback((nodeId: string, data: GraphNodeData) => {
    setNodes(ns => ns.map(n => n.id === nodeId ? { ...n, data: data as unknown as Record<string, unknown> } : n))
  }, [setNodes])

  const handleDelete = useCallback((nodeId: string) => {
    setNodes(ns => ns.filter(n => n.id !== nodeId))
    setEdges(es => es.filter(e => e.source !== nodeId && e.target !== nodeId))
    setSelectedId(null)
  }, [setNodes, setEdges])

  const handleAddInject = useCallback((roundNodeId: string) => {
    const roundNode = nodes.find(n => n.id === roundNodeId)
    if (!roundNode) return
    const id = newId("inject")
    const base = defaultData("inject", 1) as unknown as Record<string, unknown>
    const newNode: Node = {
      id,
      type: "inject",
      position: { x: roundNode.position.x + 40, y: roundNode.position.y + 180 },
      data: { ...base, evaluationAspects: [] as EvaluationAspect[] },
    }
    const newEdge: Edge = {
      id: newId("edge"),
      source: roundNodeId,
      target: id,
      sourceHandle: "injects",
      type: "typed",
      data: { kind: "inject" },
      animated: true,
    }
    setNodes(ns => [...ns, newNode])
    setEdges(es => [...es, newEdge])
    setSelectedId(id)
  }, [nodes, setNodes, setEdges])

  const handleDuplicate = useCallback((nodeId: string) => {
    const source = nodes.find(n => n.id === nodeId)
    if (!source || source.type === "start") return
    const clonedData = JSON.parse(JSON.stringify(source.data)) as Record<string, unknown>
    // Regenerate nested ids on option/threshold arrays so no collisions.
    const opts = (clonedData as { options?: Array<{ id: string }> }).options
    if (Array.isArray(opts)) {
      opts.forEach(o => { o.id = newId("opt") })
    }
    const thr = (clonedData as { thresholds?: Array<{ id: string }> }).thresholds
    if (Array.isArray(thr)) {
      thr.forEach(t => { t.id = newId("thr") })
    }
    const id = newId(source.type ?? "node")
    const newNode: Node = {
      id,
      type: source.type,
      position: { x: source.position.x + 40, y: source.position.y + 40 },
      data: clonedData,
    }
    setNodes(ns => [...ns, newNode])
    setSelectedId(id)
  }, [nodes, setNodes])

  const handleAddNext = useCallback((nodeId: string) => {
    const source = nodes.find(n => n.id === nodeId)
    if (!source) return
    if (source.type === "decision" || source.type === "special") return
    const roundCount = nodes.filter(n => n.type === "round").length
    const id = newId("round")
    const newNode: Node = {
      id,
      type: "round",
      position: { x: source.position.x + 340, y: source.position.y },
      data: defaultData("round", roundCount + 1) as unknown as Record<string, unknown>,
    }
    const newEdge: Edge = {
      id: newId("edge"),
      source: nodeId,
      target: id,
      type: "typed",
      data: { kind: "sequence" },
    }
    setNodes(ns => [...ns, newNode])
    setEdges(es => [...es, newEdge])
    setSelectedId(id)
  }, [nodes, setNodes, setEdges])

  const handleNew = useCallback(() => {
    const g = initialGraph()
    setGraphMeta({
      id: g.id, name: g.name, version: g.version, scenarioType: g.scenarioType, createdAt: g.createdAt,
    })
    setNodes(toFlowNodes(g))
    setEdges([])
    setSelectedId(null)
  }, [setNodes, setEdges])

  const handleLoad = useCallback((g: ScenarioGraph) => {
    // Retainer is always Eye Security — override anything an older saved graph may hold.
    setGraphMeta({
      id: g.id, name: g.name, version: g.version, scenarioType: g.scenarioType, createdAt: g.createdAt,
      irRetainerName: EYE_SECURITY_RETAINER.name,
      irPlaybook: g.irPlaybook,
      meldplicht: g.meldplicht ?? DEFAULT_MELDPLICHT,
      irRetainerProfile: EYE_SECURITY_RETAINER,
      features: g.features ?? DEFAULT_FEATURES,
    })
    setNodes(toFlowNodes(g))
    setEdges(toFlowEdges(g))
    setSelectedId(null)
  }, [setNodes, setEdges])

  const persistGraph = useCallback(async (): Promise<boolean> => {
    const graph = buildGraph()
    // Cache in localStorage so the setup-form can still find it if the server
    // routes the next request to a different serverless instance without shared KV.
    try {
      window.localStorage.setItem(`scenario-graph:${graph.id}`, JSON.stringify(graph))
    } catch { /* ignore quota / SSR errors */ }
    const res = await fetch("/api/scenario-graph", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(graph),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      setStatus({ kind: "error", text: `Save failed: ${err.error ?? "Unknown error"}` })
      return false
    }
    return true
  }, [buildGraph])

  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      const ok = await persistGraph()
      if (ok) setStatus({ kind: "info", text: `Saved "${graphMeta.name}"` })
    } finally {
      setSaving(false)
    }
  }, [persistGraph, graphMeta.name])

  const handleValidate = useCallback(() => validateGraph(buildGraph()), [buildGraph])

  const handleAutoLayout = useCallback(() => {
    setNodes(prev => autoLayout(prev, edges))
    // Give React one tick to commit new positions before re-framing the viewport.
    setTimeout(() => fitView({ duration: 400, padding: 0.15 }), 0)
  }, [setNodes, edges, fitView])

  // Count injects reachable from each round node via inject-typed edges.
  const injectCountByRound = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const e of edges) {
      const kind = (e.data as { kind?: string } | undefined)?.kind
      const isInject = kind === "inject" || e.sourceHandle === "injects"
      if (!isInject) continue
      counts[e.source] = (counts[e.source] ?? 0) + 1
    }
    return counts
  }, [edges])

  // Enrich nodes with UI-only action callbacks and derived stats. These are
  // stripped by fromFlowNodes before persistence (JSON.stringify drops fns).
  const displayNodes = useMemo<Node[]>(() => {
    return nodes.map(n => {
      const isDecisionOrSpecial = n.type === "decision" || n.type === "special"
      const extra: Record<string, unknown> = {
        onDelete: n.type === "start" ? undefined : handleDelete,
        onDuplicate: n.type === "start" ? undefined : handleDuplicate,
        onAddNext: isDecisionOrSpecial ? undefined : handleAddNext,
      }
      if (n.type === "round") {
        extra._injectCount = injectCountByRound[n.id] ?? 0
      }
      return { ...n, data: { ...(n.data as Record<string, unknown>), ...extra } }
    })
  }, [nodes, handleDelete, handleDuplicate, handleAddNext, injectCountByRound])

  // Keyboard shortcuts: Delete/Backspace, Cmd/Ctrl+D, Escape, Cmd/Ctrl+K wizard.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = document.activeElement
      const tag = el?.tagName
      const editable = (el as HTMLElement | null)?.isContentEditable
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || editable) return
      const meta = e.metaKey || e.ctrlKey
      if (meta && e.key.toLowerCase() === "d") {
        if (!selectedId) return
        e.preventDefault()
        handleDuplicate(selectedId)
        return
      }
      if (e.key === "Escape") {
        setSelectedId(null)
        return
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        if (!selectedId) return
        const sel = nodes.find(n => n.id === selectedId)
        if (!sel || sel.type === "start") return
        e.preventDefault()
        handleDelete(selectedId)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [selectedId, nodes, handleDelete, handleDuplicate])

  const handlePublish = useCallback(async () => {
    const graph = buildGraph()
    // Validate voor informatie — laat de builder zelf beslissen. Onvolledige
    // graphs mogen publiceren; de facilitator vangt gaten tijdens de sessie op.
    const issues = validateGraph(graph)
    const errors = issues.filter(i => i.severity === "error")
    const res = await fetch("/api/scenario-graph", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(graph),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      setStatus({ kind: "error", text: `Save failed: ${err.error ?? "Unknown error"}` })
      return
    }
    if (errors.length > 0) {
      setStatus({ kind: "info", text: `Gepubliceerd met ${errors.length} openstaand${errors.length === 1 ? "e" : "e"} validate-item${errors.length === 1 ? "" : "s"} — je kan ze via Validate bekijken.` })
    }
    router.push(`/admin?graphId=${encodeURIComponent(graph.id)}`)
  }, [buildGraph, router])

  return (
    <div className="flex h-screen flex-col">
      <Toolbar
        graph={buildGraph()}
        onNameChange={name => setGraphMeta(g => ({ ...g, name }))}
        onScenarioTypeChange={t => setGraphMeta(g => ({ ...g, scenarioType: t as ScenarioType }))}
        onPlaybookChange={p => setGraphMeta(g => ({ ...g, irPlaybook: p }))}
        onSave={handleSave}
        onLoad={handleLoad}
        onNew={handleNew}
        onValidate={handleValidate}
        onPublish={handlePublish}
        saving={saving}
      />
      {status && (
        <div
          className={`px-4 py-2 font-mono text-xs ${
            status.kind === "error"
              ? "border-b border-destructive/50 bg-destructive/10 text-destructive"
              : "border-b border-border bg-primary/5 text-primary"
          }`}
        >
          {status.text}
        </div>
      )}
      <div className="flex flex-1 overflow-hidden">
        <aside className="flex w-64 shrink-0 flex-col border-r border-border bg-card overflow-y-auto">
          <div className="border-b border-border px-3 py-2">
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Palette</span>
          </div>
          <Palette />
          <SettingsPanel
            graph={buildGraph()}
            onGraphPatch={patch => setGraphMeta(g => ({ ...g, ...patch }))}
          />
        </aside>
        <div ref={wrapperRef} className="relative flex-1" onDragOver={onDragOver} onDrop={onDrop}>
          <ReactFlow
            nodes={displayNodes}
            edges={edges}
            nodeTypes={NODE_TYPES}
            edgeTypes={EDGE_TYPES}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={(_e, n) => setSelectedId(n.id)}
            onPaneClick={() => setSelectedId(null)}
            fitView
            snapToGrid
            snapGrid={[16, 16]}
            defaultEdgeOptions={{ type: "typed", animated: false, style: { strokeWidth: 2 } }}
            connectionLineStyle={{ strokeWidth: 2 }}
            connectionRadius={40}
            proOptions={{ hideAttribution: true }}
          >
            <Background />
            <Controls>
              <ControlButton onClick={handleAutoLayout} title="Auto-layout — zet nodes netjes uit elkaar">
                <LayoutGrid />
              </ControlButton>
            </Controls>
            <MiniMap
              pannable
              zoomable
              nodeStrokeWidth={2}
              nodeColor={(n) => {
                const t = (n.type ?? "round") as GraphNodeType
                return ({
                  start: "#334155",
                  round: "#0ea5e9",
                  inject: "#f59e0b",
                  decision: "#8b5cf6",
                  special: "#d946ef",
                  outcome: "#10b981",
                } as Record<GraphNodeType, string>)[t]
              }}
              className="!bg-card !border !border-border !rounded-lg"
            />
          </ReactFlow>
          {nodes.length <= 1 && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <span className="font-mono text-sm text-muted-foreground">
                Sleep een kaart uit het paneel links →  of druk Cmd+K voor de wizard
              </span>
            </div>
          )}
        </div>
        <aside className="w-80 shrink-0 border-l border-border bg-card">
          <Inspector
            node={selectedNode}
            graphId={graphMeta.id}
            features={graphMeta.features}
            onChange={handleNodeDataChange}
            onAddInject={handleAddInject}
            onDelete={handleDelete}
            onDuplicate={handleDuplicate}
            onSaveGraph={persistGraph}
          />
        </aside>
      </div>

      <Dialog open={templatesPickerOpen} onOpenChange={setTemplatesPickerOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Kies een template</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-2">
            {EXAMPLES.map(ex => (
              <button
                key={ex.key}
                type="button"
                onClick={() => {
                  handleLoad(ex.build())
                  setTemplatesPickerOpen(false)
                }}
                className="flex flex-col rounded-lg border border-border bg-background px-3 py-2 text-left transition-colors hover:border-primary/40"
              >
                <span className="font-mono text-sm">{ex.label}</span>
                <span className="text-[11px] text-muted-foreground">{ex.description}</span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={startupOpen} onOpenChange={setStartupOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Hoe wil je starten?</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 gap-2">
            <button
              type="button"
              onClick={() => { setStartupOpen(false); setTemplatesPickerOpen(true) }}
              className="flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-left transition-colors hover:border-primary/60"
            >
              <Workflow className="size-4 text-primary shrink-0 mt-0.5" />
              <div className="flex flex-col">
                <span className="font-mono text-sm font-medium">Voorbeeld</span>
                <span className="text-[11px] text-muted-foreground">
                  Start met een kant-en-klaar scenario dat je kunt aanpassen.
                </span>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setStartupOpen(false)}
              className="flex items-start gap-3 rounded-lg border border-border bg-background px-4 py-3 text-left transition-colors hover:border-primary/40"
            >
              <FileText className="size-4 text-primary shrink-0 mt-0.5" />
              <div className="flex flex-col">
                <span className="font-mono text-sm font-medium">Leeg canvas</span>
                <span className="text-[11px] text-muted-foreground">
                  Sleep nodes uit het palette om zelf te bouwen.
                </span>
              </div>
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function BuilderCanvas() {
  return (
    <ReactFlowProvider>
      <InnerCanvas />
    </ReactFlowProvider>
  )
}
