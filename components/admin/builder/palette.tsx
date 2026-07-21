"use client"
import type { DragEvent } from "react"
import { NODE_THEME } from "./node-theme"
import type { GraphNodeType } from "@/lib/graph/types"

interface Chip { type: GraphNodeType; label: string; hint: string; group: "structure" | "interaction" }
const CHIPS: Chip[] = [
  { type: "round",    label: "Round",    hint: "Scenario ronde met timer",              group: "structure" },
  { type: "outcome",  label: "Outcome",  hint: "Terminal einde met score",              group: "structure" },
  { type: "inject",   label: "Inject",   hint: "Bericht dat naar het team wordt gepusht", group: "interaction" },
  { type: "decision", label: "Decision", hint: "Vertakking op keuze of trigger",         group: "interaction" },
  { type: "special",  label: "Special",  hint: "Interactief event met thresholds",       group: "interaction" },
]

export function Palette() {
  function onDragStart(e: DragEvent<HTMLDivElement>, type: string) {
    e.dataTransfer.setData("application/scenario-node-type", type)
    e.dataTransfer.effectAllowed = "move"
  }

  const groups: Record<Chip["group"], Chip[]> = { structure: [], interaction: [] }
  for (const c of CHIPS) groups[c.group].push(c)

  return (
    <div className="flex flex-col gap-4 p-3">
      {(["structure", "interaction"] as const).map(g => (
        <div key={g} className="flex flex-col gap-2">
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{g}</span>
          {groups[g].map(chip => {
            const t = NODE_THEME[chip.type]
            const Icon = t.icon
            return (
              <div
                key={chip.type}
                draggable
                onDragStart={e => onDragStart(e, chip.type)}
                className="flex cursor-grab items-start gap-2.5 rounded-xl border border-border bg-background p-2 pr-3 shadow-sm transition-all hover:shadow-md hover:-translate-y-[1px] active:scale-95 active:cursor-grabbing"
              >
                <div className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${t.headerBg} ${t.headerFg}`}>
                  <Icon className="size-4" />
                </div>
                <div className="flex flex-col leading-tight">
                  <span className="font-mono text-xs font-medium">{chip.label}</span>
                  <span className="text-[10px] text-muted-foreground">{chip.hint}</span>
                </div>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}
