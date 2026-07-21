"use client"

import { Handle, Position, type NodeProps } from "@xyflow/react"
import { NodeShell } from "../node-shell"
import { NODE_THEME } from "../node-theme"
import type { SpecialNodeData } from "@/lib/graph/types"

interface Actions {
  onDuplicate?: (id: string) => void
  onDelete?: (id: string) => void
}

const TYPE_LABEL: Record<string, string> = {
  ransomware_negotiation: "Ransomware chat",
  ap_notification: "AP notificatie",
  journalist_qa: "Journalist Q&A",
}

export function SpecialNode({ id, data, selected }: NodeProps) {
  const d = data as unknown as SpecialNodeData & Actions
  const thresholds = d.thresholds ?? []
  const label = TYPE_LABEL[d.type] ?? d.type

  return (
    <NodeShell
      type="special"
      selected={selected}
      title={label}
      width={260}
      onDuplicate={d.onDuplicate ? () => d.onDuplicate?.(id) : undefined}
      onDelete={d.onDelete ? () => d.onDelete?.(id) : undefined}
    >
      <Handle type="target" position={Position.Left} className={`${NODE_THEME.special.handleColor} !size-3 !border-2 !border-background`} />
      <div className="flex items-center justify-between">
        <span className="text-sm font-mono font-medium text-foreground">{label}</span>
        <span className="rounded-full bg-fuchsia-500/10 px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider text-fuchsia-600 dark:text-fuchsia-400">interactive</span>
      </div>
      {d.assignedRole && (
        <div className="mt-1">
          <span className="rounded-md bg-background/70 px-1.5 py-0.5 text-[10px] font-mono text-fuchsia-700 dark:text-fuchsia-300">{d.assignedRole}</span>
        </div>
      )}
      <div className="mt-2 flex flex-col gap-1.5">
        {thresholds.length === 0 && (
          <span className="text-[10px] italic text-muted-foreground">Nog geen thresholds — voeg toe via inspector</span>
        )}
        {thresholds.map((t) => (
          <div
            key={t.id}
            className="relative flex items-center rounded-md border border-l-[3px] border-border border-l-fuchsia-400 bg-background px-2 py-1.5 pr-4 text-[11px] font-mono text-foreground"
          >
            <span className="truncate">
              {t.label || `${t.predicate.op} ${t.predicate.value}`}
            </span>
            <Handle
              type="source"
              position={Position.Right}
              id={t.id}
              className={`${NODE_THEME.special.handleColor} !size-3 !border-2 !border-background`}
            />
          </div>
        ))}
      </div>
    </NodeShell>
  )
}
