"use client"

import { Handle, Position, type NodeProps } from "@xyflow/react"
import { Timer, Zap, Users } from "lucide-react"
import { NodeShell } from "../node-shell"
import { NODE_THEME } from "../node-theme"
import type { RoundNodeData } from "@/lib/graph/types"

interface Actions {
  onDuplicate?: (id: string) => void
  onDelete?: (id: string) => void
  onAddNext?: (id: string) => void
  _injectCount?: number
}

export function RoundNode({ id, data, selected }: NodeProps) {
  const d = data as unknown as RoundNodeData & Actions
  const excerpt = (d.situation_update ?? "").slice(0, 160)
  const roleCount = d.roleActions?.length ?? 0
  const injectCount = d._injectCount ?? 0
  const timer = d.timerMinutes ?? 15

  return (
    <NodeShell
      type="round"
      selected={selected}
      title={d.title || "Untitled round"}
      width={300}
      meta={<span className="flex items-center gap-1"><Timer className="size-2.5" />{timer}m</span>}
      onDuplicate={d.onDuplicate ? () => d.onDuplicate?.(id) : undefined}
      onDelete={d.onDelete ? () => d.onDelete?.(id) : undefined}
      onAddNext={d.onAddNext ? () => d.onAddNext?.(id) : undefined}
    >
      <Handle type="target" position={Position.Left} className={`${NODE_THEME.round.handleColor} !size-3 !border-2 !border-background`} />
      {excerpt ? (
        <p className="text-[11px] text-foreground/80 line-clamp-3 leading-snug">{excerpt}</p>
      ) : (
        <p className="text-[11px] italic text-muted-foreground">⌘ klik om te bewerken</p>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center gap-1 rounded-full bg-background/70 px-1.5 py-0.5 text-[10px] font-mono text-sky-600 dark:text-sky-400">
          <Timer className="size-2.5" />{timer}m
        </span>
        {injectCount > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-background/70 px-1.5 py-0.5 text-[10px] font-mono text-amber-600 dark:text-amber-400">
            <Zap className="size-2.5" />{injectCount}
          </span>
        )}
        {roleCount > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-background/70 px-1.5 py-0.5 text-[10px] font-mono text-slate-600 dark:text-slate-300">
            <Users className="size-2.5" />{roleCount}
          </span>
        )}
      </div>
      <Handle type="source" position={Position.Right} className={`${NODE_THEME.round.handleColor} !size-3 !border-2 !border-background`} />
      <Handle
        id="injects"
        type="source"
        position={Position.Bottom}
        className={`${NODE_THEME.inject.handleColor} !size-3 !border-2 !border-background`}
      />
    </NodeShell>
  )
}
