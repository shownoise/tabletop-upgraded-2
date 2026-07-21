"use client"
import { Handle, Position, type NodeProps } from "@xyflow/react"
import { NodeShell } from "../node-shell"
import { NODE_THEME } from "../node-theme"

interface Actions {
  onDuplicate?: (id: string) => void
  onDelete?: (id: string) => void
  onAddNext?: (id: string) => void
}

export function StartNode({ id, data, selected }: NodeProps) {
  const a = (data ?? {}) as unknown as Actions
  return (
    <NodeShell
      type="start"
      selected={selected}
      title="Scenario start"
      width={180}
      onDelete={a.onDelete ? () => a.onDelete?.(id) : undefined}
      onAddNext={a.onAddNext ? () => a.onAddNext?.(id) : undefined}
    >
      <span className="text-[10px] text-muted-foreground">Facilitator drukt op play</span>
      <Handle type="source" position={Position.Right} className={`${NODE_THEME.start.handleColor} !size-3 !border-2 !border-background`} />
    </NodeShell>
  )
}
