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
  const score = d.scoreImpact
  const scoreLabel = typeof score === "number"
    ? score > 0 ? `+${score}` : score === 0 ? "±0" : `${score}`
    : null
  const scoreClass = typeof score !== "number"
    ? "text-white/80"
    : score > 0
      ? "text-emerald-100"
      : score < 0
        ? "text-red-100"
        : "text-white/80"

  const variantBorder = typeof score === "number"
    ? score >= 0
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
      meta={scoreLabel ? <span className={`rounded-md bg-white/20 px-1.5 py-0.5 font-mono text-[10px] font-bold ${scoreClass}`}>{scoreLabel}</span> : undefined}
      onDuplicate={d.onDuplicate ? () => d.onDuplicate?.(id) : undefined}
      onDelete={d.onDelete ? () => d.onDelete?.(id) : undefined}
    >
      <Handle type="target" position={Position.Left} className={`${NODE_THEME.outcome.handleColor} !size-3 !border-2 !border-background`} />
      {d.narrative ? (
        <p className="text-[11px] text-foreground/80 line-clamp-3 leading-snug">{d.narrative.slice(0, 120)}</p>
      ) : (
        <p className="text-[11px] italic text-muted-foreground">⌘ klik om te bewerken</p>
      )}
    </NodeShell>
  )
}
