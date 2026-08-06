"use client"

import { useState } from "react"
import { Loader2, Sparkles } from "lucide-react"
import { AiWizardDialog } from "./ai-wizard-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { PremadeInject, RoleBriefing, ScenarioGraph } from "@/lib/graph/types"
import type { GraphIssue } from "@/lib/graph/validate"
import type { Role, ScenarioType } from "@/lib/types"
import { EXAMPLES } from "@/lib/graph/examples"
import { PreviewDialog } from "./preview-dialog"
import { DryRunDialog } from "./dry-run-dialog"
import { RoleBriefingsPanel } from "./role-briefings-panel"
import { InjectLibraryPanel } from "./inject-library-panel"

interface Props {
  graph: ScenarioGraph
  onNameChange: (name: string) => void
  onScenarioTypeChange: (t: ScenarioType) => void
  onPlaybookChange: (playbook: string | undefined) => void
  onSave: () => Promise<void>
  onLoad: (g: ScenarioGraph) => void
  onNew: () => void
  onValidate: () => GraphIssue[]
  onPublish: () => Promise<void>
  onRoleBriefingsChange?: (next: Partial<Record<Role, RoleBriefing>>) => void
  onInjectLibraryChange?: (next: PremadeInject[]) => void
  saving?: boolean
}

const SCENARIO_TYPES: ScenarioType[] = [
  "ransomware_double_extortion",
  "insider_threat",
  "bec_cfo_fraud",
  "supply_chain_compromise",
]

export function Toolbar({
  graph,
  onNameChange,
  onScenarioTypeChange,
  onPlaybookChange,
  onSave,
  onLoad,
  onNew,
  onValidate,
  onPublish,
  onRoleBriefingsChange,
  onInjectLibraryChange,
  saving,
}: Props) {
  const [loadOpen, setLoadOpen] = useState(false)
  const [templatesOpen, setTemplatesOpen] = useState(false)
  const [aiWizardOpen, setAiWizardOpen] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [dryRunOpen, setDryRunOpen] = useState(false)
  const [rolesOpen, setRolesOpen] = useState(false)
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [loadable, setLoadable] = useState<ScenarioGraph[] | null>(null)
  const [issues, setIssues] = useState<GraphIssue[] | null>(null)
  const [publishing, setPublishing] = useState(false)

  async function openLoad() {
    setLoadOpen(true)
    const res = await fetch("/api/scenario-graph")
    const data = await res.json() as { ok: boolean; graphs: ScenarioGraph[] }
    setLoadable(data.graphs)
  }

  function handleNew() {
    if (!confirm("Discard the current graph and start over?")) return
    onNew()
  }

  function handleValidate() {
    setIssues(onValidate())
  }

  async function handlePublish() {
    setPublishing(true)
    try {
      await onPublish()
    } finally {
      setPublishing(false)
    }
  }

  return (
    <div className="flex items-center gap-3 border-b border-border bg-card px-4 py-2">
      {/* Meta group — identity of this scenario */}
      <div className="flex flex-1 items-center gap-2">
        <Label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground shrink-0">Naam</Label>
        <Input
          value={graph.name}
          onChange={e => onNameChange(e.target.value)}
          className="h-8 max-w-xs"
        />
        <select
          value={graph.scenarioType}
          onChange={e => onScenarioTypeChange(e.target.value as ScenarioType)}
          className="h-8 rounded border border-border bg-background px-2 font-mono text-xs"
        >
          {SCENARIO_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {/* Content group — starting a new scenario or reusing existing content */}
      <div className="flex items-center gap-1 pl-2 border-l border-border">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setAiWizardOpen(true)}
          title="AI-wizard — genereer een startpunt op basis van klantcontext"
          className="gap-1 text-primary hover:text-primary"
        >
          <Sparkles className="size-3.5" /> AI-wizard
        </Button>
        <Button size="sm" variant="ghost" onClick={handleNew} title="Nieuw leeg canvas">Nieuw</Button>
        <Button size="sm" variant="ghost" onClick={() => setTemplatesOpen(true)} title="Kant-en-klare voorbeeldscenario's">Voorbeelden</Button>
        <Button size="sm" variant="ghost" onClick={openLoad} title="Laad opgeslagen scenario">Laden</Button>
        <Button size="sm" variant="ghost" onClick={() => setRolesOpen(true)} title="Bewerk per-rol opening briefings en playbook-gaps">Rollen</Button>
        <Button size="sm" variant="ghost" onClick={() => setLibraryOpen(true)} title="Beheer ad-hoc ruis-injects die de facilitator tijdens de discussie kan afvuren">Ruis-bibliotheek</Button>
      </div>

      {/* Actions group — validate / preview / persist */}
      <div className="flex items-center gap-1 pl-2 border-l border-border">
        <Button size="sm" variant="ghost" onClick={handleValidate} title="Controleer graph op fouten">Validate</Button>
        <Button size="sm" variant="ghost" onClick={() => setPreviewOpen(true)} title="Bekijk hoe deelnemers dit zien">Preview</Button>
        <Button size="sm" variant="ghost" onClick={() => setDryRunOpen(true)} title="Simuleer scenario en score de uitkomst">Dry-run</Button>
        <Button size="sm" variant="ghost" asChild title="Print rolkaarten voor deze scenario">
          <a href={`/admin/role-cards?graph=${graph.id}`} target="_blank" rel="noopener noreferrer">Rolkaarten</a>
        </Button>
        <Button size="sm" variant="outline" onClick={onSave} disabled={saving} title="Sla wijzigingen op">
          {saving ? <Loader2 className="size-3.5 animate-spin" /> : null}
          Save
        </Button>
        <Button size="sm" onClick={handlePublish} disabled={publishing} title="Publiceer naar admin dashboard">
          {publishing ? <Loader2 className="size-3.5 animate-spin" /> : null}
          Publish
        </Button>
      </div>

      <Dialog open={loadOpen} onOpenChange={setLoadOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Load scenario graph</DialogTitle></DialogHeader>
          <div className="flex max-h-[400px] flex-col gap-2 overflow-y-auto">
            {loadable === null && <p className="text-xs text-muted-foreground">Loading…</p>}
            {loadable && loadable.length === 0 && <p className="text-xs text-muted-foreground">No saved graphs yet.</p>}
            {loadable?.map(g => (
              <button
                key={g.id}
                type="button"
                onClick={() => { onLoad(g); setLoadOpen(false) }}
                className="flex flex-col rounded-lg border border-border bg-background px-3 py-2 text-left transition-colors hover:border-primary/40"
              >
                <span className="font-mono text-sm">{g.name}</span>
                <span className="text-[10px] text-muted-foreground">
                  {g.scenarioType} · {g.nodes.length} nodes · updated {new Date(g.updatedAt).toLocaleString()}
                </span>
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setLoadOpen(false)}>Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PreviewDialog open={previewOpen} onOpenChange={setPreviewOpen} graph={graph} />
      <DryRunDialog open={dryRunOpen} onOpenChange={setDryRunOpen} graph={graph} />
      <AiWizardDialog open={aiWizardOpen} onOpenChange={setAiWizardOpen} onGenerated={onLoad} />
      {onRoleBriefingsChange && (
        <RoleBriefingsPanel
          open={rolesOpen}
          onOpenChange={setRolesOpen}
          briefings={graph.roleBriefings ?? {}}
          onChange={onRoleBriefingsChange}
        />
      )}
      {onInjectLibraryChange && (
        <InjectLibraryPanel
          open={libraryOpen}
          onOpenChange={setLibraryOpen}
          library={graph.injectLibrary ?? []}
          onChange={onInjectLibraryChange}
        />
      )}

      <Dialog open={templatesOpen} onOpenChange={setTemplatesOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Load example template</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-2">
            {EXAMPLES.map(ex => (
              <button
                key={ex.key}
                type="button"
                onClick={() => {
                  if (!confirm(`Replace current graph with "${ex.label}"?`)) return
                  onLoad(ex.build())
                  setTemplatesOpen(false)
                }}
                className="flex flex-col rounded-lg border border-border bg-background px-3 py-2 text-left transition-colors hover:border-primary/40"
              >
                <span className="font-mono text-sm">{ex.label}</span>
                <span className="text-[11px] text-muted-foreground">{ex.description}</span>
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setTemplatesOpen(false)}>Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={issues !== null} onOpenChange={o => !o && setIssues(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Validation</DialogTitle></DialogHeader>
          <div className="flex max-h-[400px] flex-col gap-2 overflow-y-auto">
            {issues && issues.length === 0 && (
              <p className="text-sm text-emerald-600 dark:text-emerald-400">No issues found.</p>
            )}
            {issues?.map((issue, i) => (
              <div
                key={i}
                className={`rounded border px-3 py-2 text-xs ${
                  issue.severity === "error"
                    ? "border-destructive/50 bg-destructive/10 text-destructive"
                    : "border-yellow-500/40 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400"
                }`}
              >
                <span className="font-mono uppercase tracking-wider">{issue.severity}</span> — {issue.message}
                {issue.nodeId && <span className="ml-1 font-mono text-[10px] text-muted-foreground">node:{issue.nodeId.slice(0, 8)}</span>}
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setIssues(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
