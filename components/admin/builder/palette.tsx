"use client"
import type { DragEvent } from "react"
import { NODE_THEME } from "./node-theme"
import type { GraphNodeType } from "@/lib/graph/types"

interface Chip { type: GraphNodeType; label: string; hint: string }
const CHIPS: Chip[] = [
  { type: "round",    label: "Ronde",    hint: "Ronde met titel + situatie + tijd" },
  { type: "inject",   label: "Inject",   hint: "Bericht dat het team ziet (email, alert, telefoon)" },
  { type: "decision", label: "Decision", hint: "Keuzepunt met 2 of meer opties" },
  { type: "outcome",  label: "Uitkomst", hint: "Einde van een verhaallijn" },
]

export function Palette() {
  function onDragStart(e: DragEvent<HTMLDivElement>, type: string) {
    e.dataTransfer.setData("application/scenario-node-type", type)
    e.dataTransfer.effectAllowed = "move"
  }

  return (
    <div className="flex flex-col gap-2 p-3">
      <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Sleep naar canvas</span>
      {CHIPS.map(chip => {
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
  )
}
