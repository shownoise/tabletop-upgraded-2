"use client"

import { Handle, Position, type NodeProps } from "@xyflow/react"
import { NodeShell } from "../node-shell"
import { NODE_THEME } from "../node-theme"
import type { DecisionNodeData } from "@/lib/graph/types"
import { ROLE_META, ROLE_ORDER, type Role } from "@/lib/types"

interface Actions {
  onDuplicate?: (id: string) => void
  onDelete?: (id: string) => void
}

export function DecisionNode({ id, data, selected }: NodeProps) {
  const d = data as unknown as DecisionNodeData & Actions
  const options = d.options ?? []
  const measuredLabel = d.measuredBy === "facilitator_trigger" ? "facilitator" : "participant"

  // Group options by allowedRole, keeping canonical role order. Options without
  // allowedRole fall under a synthetic "any" bucket at the bottom.
  const buckets = new Map<Role | "__any__", DecisionNodeData["options"]>()
  for (const opt of options) {
    const key = (opt.allowedRole ?? "__any__") as Role | "__any__"
    const arr = buckets.get(key) ?? []
    arr.push(opt)
    buckets.set(key, arr)
  }
  const orderedRoles: Array<Role | "__any__"> = [
    ...ROLE_ORDER.filter(r => buckets.has(r)),
    ...(buckets.has("__any__") ? (["__any__"] as const) : []),
  ]

  return (
    <NodeShell
      type="decision"
      selected={selected}
      title={d.prompt || "Decision"}
      width={300}
      meta={<span className="lowercase">{measuredLabel}</span>}
      onDuplicate={d.onDuplicate ? () => d.onDuplicate?.(id) : undefined}
      onDelete={d.onDelete ? () => d.onDelete?.(id) : undefined}
    >
      <Handle type="target" position={Position.Left} className={`${NODE_THEME.decision.handleColor} !size-3 !border-2 !border-background`} />
      <div className="flex flex-col gap-2">
        {options.length === 0 && (
          <span className="text-[10px] italic text-muted-foreground">Nog geen opties — voeg toe via inspector</span>
        )}
        {orderedRoles.map(roleKey => {
          const bucket = buckets.get(roleKey) ?? []
          const roleLabel = roleKey === "__any__" ? "Alle rollen" : ROLE_META[roleKey].label
          return (
            <div key={roleKey} className="rounded-md border border-border bg-background/40 p-1.5">
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">{roleLabel}</span>
                <span className="font-mono text-[9px] text-muted-foreground">
                  {bucket.length}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                {bucket.map((opt, idx) => (
                  <div
                    key={opt.id}
                    className="relative flex items-center rounded border border-l-[3px] border-border border-l-violet-400 bg-background px-2 py-1 pr-4 text-[10px] font-mono text-foreground"
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
            </div>
          )
        })}
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
