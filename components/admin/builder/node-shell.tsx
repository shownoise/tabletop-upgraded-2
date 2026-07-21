"use client"

import { useEffect, useState, type ReactNode } from "react"
import { Copy, Trash2, Plus } from "lucide-react"
import { NODE_THEME } from "./node-theme"
import type { GraphNodeType } from "@/lib/graph/types"
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from "@/components/ui/context-menu"

interface Props {
  type: GraphNodeType
  selected?: boolean
  title: string
  meta?: ReactNode
  width?: number
  variantBorder?: string
  onDuplicate?: () => void
  onDelete?: () => void
  onAddNext?: () => void
  children?: ReactNode
}

export function NodeShell(props: Props) {
  const theme = NODE_THEME[props.type]
  const Icon = theme.icon
  const width = props.width ?? 280
  const [enter, setEnter] = useState(true)
  useEffect(() => {
    const t = setTimeout(() => setEnter(false), 220)
    return () => clearTimeout(t)
  }, [])
  const hasMenu = Boolean(props.onDuplicate || props.onDelete || props.onAddNext)
  const inner = (
    <div
      style={{ width }}
      className={`group relative rounded-xl border bg-card shadow-md transition-all duration-150 hover:-translate-y-[1px] hover:shadow-lg ${
        props.variantBorder ?? theme.border
      } ${props.selected ? `ring-2 ${theme.ring} ring-offset-1 ring-offset-background` : ""} ${
        enter ? "rf-node-enter" : ""
      }`}
    >
      <div className={`flex items-center gap-2 rounded-t-xl px-3 py-2 ${theme.headerBg} ${theme.headerFg}`}>
        <div className="flex size-6 items-center justify-center rounded-md bg-white/20">
          <Icon className="size-3.5" />
        </div>
        <span className="font-mono text-[10px] uppercase tracking-wider opacity-80">{theme.shortLabel}</span>
        <span className="flex-1 truncate font-mono text-xs font-medium">{props.title}</span>
        {props.meta && <span className="font-mono text-[10px] opacity-80">{props.meta}</span>}
      </div>

      <div className={`rounded-b-xl px-3 py-2.5 ${theme.softBg}`}>{props.children}</div>

      <div className="absolute -top-3 right-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        {props.onDuplicate && (
          <button
            type="button"
            onClick={e => { e.stopPropagation(); props.onDuplicate?.() }}
            className="flex size-6 items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-sm hover:text-foreground"
            aria-label="Duplicate"
          >
            <Copy className="size-3" />
          </button>
        )}
        {props.onDelete && (
          <button
            type="button"
            onClick={e => { e.stopPropagation(); props.onDelete?.() }}
            className="flex size-6 items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-sm hover:text-destructive"
            aria-label="Delete"
          >
            <Trash2 className="size-3" />
          </button>
        )}
      </div>

      {props.onAddNext && (
        <button
          type="button"
          onClick={e => { e.stopPropagation(); props.onAddNext?.() }}
          className={`absolute right-[-14px] top-1/2 -translate-y-1/2 flex size-6 items-center justify-center rounded-full border-2 bg-background text-muted-foreground opacity-0 shadow-md transition-all duration-150 group-hover:opacity-100 hover:scale-110 hover:text-foreground ${theme.border}`}
          aria-label="Add next"
        >
          <Plus className="size-3" />
        </button>
      )}
    </div>
  )

  if (!hasMenu) return inner
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{inner}</ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        {props.onDuplicate && (
          <ContextMenuItem onSelect={() => props.onDuplicate?.()}>
            <Copy className="size-3.5" />
            <span>Duplicate</span>
          </ContextMenuItem>
        )}
        {props.onAddNext && (
          <ContextMenuItem onSelect={() => props.onAddNext?.()}>
            <Plus className="size-3.5" />
            <span>Add next</span>
          </ContextMenuItem>
        )}
        {(props.onDuplicate || props.onAddNext) && props.onDelete && <ContextMenuSeparator />}
        {props.onDelete && (
          <ContextMenuItem variant="destructive" onSelect={() => props.onDelete?.()}>
            <Trash2 className="size-3.5" />
            <span>Delete</span>
          </ContextMenuItem>
        )}
      </ContextMenuContent>
    </ContextMenu>
  )
}
