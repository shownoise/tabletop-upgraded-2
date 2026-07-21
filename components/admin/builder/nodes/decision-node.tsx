"use client"

import { Handle, Position, type NodeProps } from "@xyflow/react"
import { NodeShell } from "../node-shell"
import { NODE_THEME } from "../node-theme"
import type { DecisionNodeData } from "@/lib/graph/types"

interface Actions {
  onDuplicate?: (id: string) => void
  onDelete?: (id: string) => void
}

export function DecisionNode({ id, data, selected }: NodeProps) {
  const d = data as unknown as DecisionNodeData & Actions
  const options = d.options ?? []
  const measuredLabel = d.measuredBy === "facilitator_trigger" ? "facilitator" : "participant"
  return (
    <NodeShell
      type="decision"
      selected={selected}
      title={d.prompt || "Decision"}
      width={280}
      meta={<span className="lowercase">{measuredLabel}</span>}
      onDuplicate={d.onDuplicate ? () => d.onDuplicate?.(id) : undefined}
      onDelete={d.onDelete ? () => d.onDelete?.(id) : undefined}
    >
      <Handle type="target" position={Position.Left} className={`${NODE_THEME.decision.handleColor} !size-3 !border-2 !border-background`} />
      <div className="flex flex-col gap-1.5">
        {options.length === 0 && (
          <span className="text-[10px] italic text-muted-foreground">Nog geen opties — voeg toe via inspector</span>
        )}
        {options.map((opt, idx) => (
          <div
            key={opt.id}
            className="relative flex items-center rounded-md border border-l-[3px] border-border border-l-violet-400 bg-background px-2 py-1.5 pr-4 text-[11px] font-mono text-foreground"
          >
            <span className="truncate">{opt.label || `Optie ${idx + 1}`}</span>
            <Handle
              type="source"
              position={Position.Right}
              id={opt.id}
              className={`${NODE_THEME.decision.handleColor} !size-3 !border-2 !border-background`}
            />
          </div>
        ))}
      </div>
      {(d.triggerRole || d.measuredBy) && (
        <div className="mt-2 flex items-center gap-1.5 border-t border-border/40 pt-1.5 text-[10px] text-muted-foreground">
          <span className="rounded-sm bg-background/70 px-1 py-0.5 font-mono">{measuredLabel}</span>
          {d.triggerRole && (
            <span className="rounded-sm bg-background/70 px-1 py-0.5 font-mono">{d.triggerRole}</span>
          )}
        </div>
      )}
    </NodeShell>
  )
}
