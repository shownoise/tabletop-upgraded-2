"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"
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
import type { ScenarioGraph } from "@/lib/graph/types"
import type { GraphIssue } from "@/lib/graph/validate"
import type { ScenarioType } from "@/lib/types"
import { EXAMPLES } from "@/lib/graph/examples"
import { PreviewDialog } from "./preview-dialog"
import { WizardDialog } from "./wizard-dialog"

interface Props {
  graph: ScenarioGraph
  onNameChange: (name: string) => void
  onScenarioTypeChange: (t: ScenarioType) => void
  onIrRetainerChange: (name: string | undefined) => void
  onPlaybookChange: (playbook: string | undefined) => void
  onSave: () => Promise<void>
  onLoad: (g: ScenarioGraph) => void
  onNew: () => void
  onValidate: () => GraphIssue[]
  onPublish: () => Promise<void>
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
  onIrRetainerChange,
  onPlaybookChange,
  onSave,
  onLoad,
  onNew,
  onValidate,
  onPublish,
  saving,
}: Props) {
  const [loadOpen, setLoadOpen] = useState(false)
  const [templatesOpen, setTemplatesOpen] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [wizardOpen, setWizardOpen] = useState(false)
  const [playbookOpen, setPlaybookOpen] = useState(false)
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
      <div className="flex flex-1 items-center gap-3">
        <Label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Name</Label>
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
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" onClick={handleNew}>New</Button>
        <Button size="sm" variant="outline" onClick={() => setWizardOpen(true)}>AI wizard</Button>
        <Button size="sm" variant="outline" onClick={() => setTemplatesOpen(true)}>Templates</Button>
        <Button size="sm" variant="outline" onClick={openLoad}>Load</Button>
        <Button size="sm" variant="outline" onClick={() => setPlaybookOpen(true)}>Playbook / IR</Button>
        <Button size="sm" variant="outline" onClick={handleValidate}>Validate</Button>
        <Button size="sm" variant="outline" onClick={() => setPreviewOpen(true)}>Preview</Button>
        <Button size="sm" variant="outline" onClick={onSave} disabled={saving}>
          {saving ? <Loader2 className="size-3.5 animate-spin" /> : null}
          Save
        </Button>
        <Button size="sm" onClick={handlePublish} disabled={publishing}>
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
      <WizardDialog open={wizardOpen} onOpenChange={setWizardOpen} onGraphGenerated={onLoad} />

      <Dialog open={playbookOpen} onOpenChange={setPlaybookOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Crisis Playbook / IR-plan</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <Label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">IR retainer naam</Label>
              <Input
                value={graph.irRetainerName ?? ""}
                onChange={e => onIrRetainerChange(e.target.value || undefined)}
                placeholder="Bijv. Cronos Digital Forensics"
              />
              <p className="font-mono text-[10px] text-muted-foreground">
                Verschijnt bovenin de participant-view als 'Facilitated by...'.
              </p>
            </div>
            <div className="flex flex-col gap-1">
              <Label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">IR / Crisis Playbook (Markdown)</Label>
              <Textarea
                rows={12}
                value={graph.irPlaybook ?? ""}
                onChange={e => onPlaybookChange(e.target.value || undefined)}
                placeholder={`## Ransomware — beleid\n- Betaling: maximaal 5 BTC toegestaan (approval CFO+CEO)\n- Onderhandelingskanaal: uitsluitend via IR-partner\n\n## AVG-melding\n- 72u vanaf ontdekking...\n\n[Tip: mix bruikbare procedure met opzet-misleidende zinnen om BOB te trainen]`}
                className="font-mono text-xs resize-none"
              />
              <p className="font-mono text-[10px] text-muted-foreground">
                Zichtbaar rechts bij elke participant. Bevat bewust zowel juiste procedure als valkuilen (participants moeten leren onderscheiden).
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPlaybookOpen(false)}>Sluiten</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
