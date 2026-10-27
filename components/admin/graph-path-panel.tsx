"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { IrreversibleNote, useConfirmOnce } from "@/components/admin/facilitator/irreversible"
import type { DecisionNodeData } from "@/lib/graph/types"
import type { SessionState } from "@/lib/types"

interface Props {
  session: SessionState
}

export function GraphPathPanel({ session }: Props) {
  const graph = session.graph
  const state = session.graphState
  if (!graph || !state) return null

  const nodeById = new Map(graph.nodes.map(n => [n.id, n]))
  const currentNode = nodeById.get(state.currentNodeId)
  const isFacilitatorDecision =
    currentNode?.type === "decision" &&
    (currentNode.data as DecisionNodeData).measuredBy === "facilitator_trigger"

  return (
    <div className="rounded-xl border border-border bg-card px-4 py-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-wider text-primary">Graph path</span>
        <span className="font-mono text-[9px] text-muted-foreground">{state.pathHistory.length} node(s)</span>
      </div>

      <ol className="flex flex-wrap items-center gap-1 text-[10px]">
        {state.pathHistory.map((id, i) => {
          const node = nodeById.get(id)
          const label = describeNode(node?.type, node?.data)
          const isCurrent = id === state.currentNodeId
          return (
            <li key={`${id}-${i}`} className="flex items-center gap-1">
              <span className={`rounded px-1.5 py-0.5 font-mono ${isCurrent ? "bg-primary/15 text-primary" : "bg-background text-muted-foreground border border-border"}`}>
                {label}
              </span>
              {i < state.pathHistory.length - 1 && <span className="text-muted-foreground">›</span>}
            </li>
          )
        })}
      </ol>

      {state.finalOutcome && (
        <div className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2">
          <span className="font-mono text-[10px] uppercase tracking-wider text-primary">Outcome</span>
          <p className="mt-1 text-xs font-medium">{state.finalOutcome.label}</p>
          {state.finalOutcome.narrative && (
            <p className="mt-1 text-[11px] text-muted-foreground leading-snug">{state.finalOutcome.narrative}</p>
          )}
        </div>
      )}

      {isFacilitatorDecision && currentNode && (
        <FacilitatorDecisionPicker
          nodeId={currentNode.id}
          data={currentNode.data as DecisionNodeData}
        />
      )}
    </div>
  )
}

function describeNode(type: string | undefined, data: unknown): string {
  if (!type) return "?"
  const d = data as { title?: string; label?: string; type?: string; prompt?: string }
  if (type === "round") return `Round · ${d.title ?? ""}`.trim()
  if (type === "decision") return `Decision · ${d.prompt?.slice(0, 20) ?? ""}`.trim()
  if (type === "special") return `Special · ${d.type ?? ""}`
  if (type === "outcome") return `Outcome · ${d.label ?? ""}`.trim()
  return type
}

function FacilitatorDecisionPicker({ nodeId, data }: { nodeId: string; data: DecisionNodeData }) {
  const [busy, setBusy] = useState(false)
  // `facilitatorPickGraphOption()` zet de engine door en schrijft de keuze in
  // `branchLog`; er is geen route die dat terugdraait. Eerste klik bewapent.
  const confirm = useConfirmOnce()

  async function pick(optionId: string) {
    if (busy) return
    setBusy(true)
    try {
      await fetch("/api/session/graph-decision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nodeId, optionId }),
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-md border border-yellow-500/30 bg-yellow-500/5 px-3 py-2 flex flex-col gap-2">
      <span className="font-mono text-[10px] uppercase tracking-wider text-yellow-700 dark:text-yellow-400">
        Facilitator decision required
      </span>
      <p className="text-xs">{data.prompt}</p>
      <IrreversibleNote>
        Deze keuze bepaalt het vervolg van het scenario en kan niet worden
        teruggedraaid. Klik twee keer om te bevestigen.
      </IrreversibleNote>
      <div className="flex flex-wrap gap-2">
        {data.options.map(opt => {
          const armed = confirm.isPending(opt.id)
          return (
            <Button
              key={opt.id}
              size="sm"
              variant="outline"
              disabled={busy}
              className={armed ? "border-amber-500/60 bg-amber-500/10" : ""}
              title={armed ? "Nog één klik — deze keuze is definitief." : undefined}
              onClick={() => confirm.request(opt.id, () => { void pick(opt.id) })}
            >
              {armed ? `${opt.label} — nog één klik, definitief` : opt.label}
            </Button>
          )
        })}
      </div>
    </div>
  )
}
