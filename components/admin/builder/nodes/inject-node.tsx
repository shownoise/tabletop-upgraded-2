"use client"

import { Handle, Position, type NodeProps } from "@xyflow/react"
import { FileText, Sparkles } from "lucide-react"
import { NodeShell } from "../node-shell"
import { NODE_THEME } from "../node-theme"
import { CHANNEL_ICON } from "../channel-icons"
import { ASPECT_BADGE } from "../evaluation-aspects"
import type { InjectNodeData } from "@/lib/graph/types"

interface Actions {
  onDuplicate?: (id: string) => void
  onDelete?: (id: string) => void
}

const CHANNEL_LABEL: Record<string, string> = {
  whatsapp: "WhatsApp",
  slack: "Slack",
  email: "Email",
  sms: "SMS",
  phone: "Telefoon",
  teams: "Teams",
  siem: "SIEM",
  siem_alert: "SIEM",
  edr: "EDR",
  news: "Nieuws",
  news_ticker: "Nieuws",
  memo: "Memo",
  ransom_note: "Ransom",
  system_alert: "Systeem",
  raw: "Raw",
  internal: "Intern",
}

const URGENCY_DOT: Record<string, string> = {
  high: "bg-red-500",
  medium: "bg-amber-500",
  low: "bg-slate-400",
}

export function InjectNode({ id, data, selected }: NodeProps) {
  const d = data as unknown as InjectNodeData & Actions
  const channelKey = d.channel ?? d.type
  const Icon = (channelKey && CHANNEL_ICON[channelKey]) || FileText
  const channelLabel = channelKey ? (CHANNEL_LABEL[channelKey] ?? channelKey) : d.type
  const dot = URGENCY_DOT[d.urgency ?? "medium"] ?? URGENCY_DOT.medium

  return (
    <NodeShell
      type="inject"
      selected={selected}
      title={d.title || "Inject"}
      width={240}
      meta={<span className={`inline-block size-1.5 rounded-full ${dot}`} aria-label={d.urgency} />}
      onDuplicate={d.onDuplicate ? () => d.onDuplicate?.(id) : undefined}
      onDelete={d.onDelete ? () => d.onDelete?.(id) : undefined}
    >
      <Handle type="target" position={Position.Top} className={`${NODE_THEME.inject.handleColor} !size-3 !border-2 !border-background`} />
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center gap-1 rounded-md bg-background/70 px-1.5 py-0.5 text-[10px] font-mono text-amber-700 dark:text-amber-300">
          <Icon className="size-2.5" />
          {channelLabel}
        </span>
        <AspectBadges aspects={d.evaluationAspects} />
        {d.dynamic?.enabled && (
          <span className="inline-flex items-center gap-1 rounded-md bg-background/70 px-1.5 py-0.5 text-[10px] font-mono text-amber-600" title="Dynamisch bij sessie-start">
            <Sparkles className="size-2.5" />DYN
          </span>
        )}
      </div>
      {d.content ? (
        <p className="mt-1.5 text-[11px] text-foreground/80 line-clamp-2 leading-snug">{d.content}</p>
      ) : (
        <p className="mt-1.5 text-[11px] italic text-muted-foreground">⌘ klik om te bewerken</p>
      )}
    </NodeShell>
  )
}

function AspectBadges({ aspects }: { aspects: InjectNodeData["evaluationAspects"] }) {
  if (!aspects || aspects.length === 0) return null
  const shown = aspects.slice(0, 3)
  const extra = aspects.length - shown.length
  return (
    <>
      {shown.map(a => (
        <span key={a} className="inline-flex items-center rounded-md bg-primary/10 px-1.5 py-0.5 text-[9px] font-mono text-primary">
          {ASPECT_BADGE[a]}
        </span>
      ))}
      {extra > 0 && (
        <span className="inline-flex items-center rounded-md bg-primary/5 px-1 py-0.5 text-[9px] font-mono text-primary/70">
          +{extra}
        </span>
      )}
    </>
  )
}
