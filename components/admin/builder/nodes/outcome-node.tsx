"use client"

import { Handle, Position, type NodeProps } from "@xyflow/react"
import { NodeShell } from "../node-shell"
import { NODE_THEME } from "../node-theme"
import type { OutcomeNodeData } from "@/lib/graph/types"

interface Actions {
  onDuplicate?: (id: string) => void
  onDelete?: (id: string) => void
}

export function OutcomeNode({ id, data, selected }: NodeProps) {
  const d = data as unknown as OutcomeNodeData & Actions
  const scoreRange = d.scoreRange
  const variantBorder = scoreRange && typeof scoreRange.min === "number"
    ? scoreRange.min >= 0
      ? "border-emerald-300 dark:border-emerald-800"
      : "border-red-300 dark:border-red-900"
    : undefined

  return (
    <NodeShell
      type="outcome"
      selected={selected}
      title={d.label || "Outcome"}
      width={240}
      variantBorder={variantBorder}
      onDuplicate={d.onDuplicate ? () => d.onDuplicate?.(id) : undefined}
      onDelete={d.onDelete ? () => d.onDelete?.(id) : undefined}
    >
      <Handle type="target" position={Position.Left} className={`${NODE_THEME.outcome.handleColor} !size-3 !border-2 !border-background`} />
      {d.scoreRange && (
        <div className="mb-1 inline-flex items-center rounded-md bg-emerald-500/15 px-1.5 py-0.5 font-mono text-[10px] text-emerald-700 dark:text-emerald-300">
          score {d.scoreRange.min ?? "-∞"} … {d.scoreRange.max ?? "∞"}
        </div>
      )}
      {d.narrative ? (
        <p className="text-[11px] text-foreground/80 line-clamp-3 leading-snug">{d.narrative.slice(0, 120)}</p>
      ) : (
        <p className="text-[11px] italic text-muted-foreground">⌘ klik om te bewerken</p>
      )}
    </NodeShell>
  )
}
