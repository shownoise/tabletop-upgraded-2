import type { LucideIcon } from "lucide-react"
import { Play, Circle, Zap, GitBranch, Sparkles, Flag, Bell } from "lucide-react"
import type { GraphNodeType } from "@/lib/graph/types"

export interface NodeCategoryTheme {
  label: string
  shortLabel: string
  icon: LucideIcon
  headerBg: string
  headerFg: string
  ring: string
  border: string
  softBg: string
  accentText: string
  handleColor: string
}

// WHY: Eye Security 2026 palette mapping — retires the previous sky/amber/violet
// terminal-style tints. Chaser uses the .chaser-stripes utility (diagonal orange).
export const NODE_THEME: Record<GraphNodeType, NodeCategoryTheme> = {
  start:    { label: "Start",    shortLabel: "STA", icon: Play,      headerBg: "bg-eye-indigo",   headerFg: "text-white",       ring: "ring-eye-indigo/40",   border: "border-eye-indigo/30",   softBg: "bg-[color:var(--eye-indigo)]/5",    accentText: "text-eye-indigo",   handleColor: "!bg-[color:var(--eye-indigo)] !border-[color:var(--eye-indigo)]" },
  round:    { label: "Round",    shortLabel: "RND", icon: Circle,    headerBg: "bg-eye-twilight", headerFg: "text-white",       ring: "ring-eye-twilight/40", border: "border-eye-twilight/30", softBg: "bg-[color:var(--eye-twilight)]/8", accentText: "text-eye-twilight", handleColor: "!bg-[color:var(--eye-twilight)] !border-[color:var(--eye-twilight)]" },
  inject:   { label: "Inject",   shortLabel: "INJ", icon: Zap,       headerBg: "bg-eye-orange",   headerFg: "text-white",       ring: "ring-eye-orange/40",   border: "border-eye-orange/40",   softBg: "bg-[color:var(--eye-orange)]/8",    accentText: "text-eye-orange",   handleColor: "!bg-[color:var(--eye-orange)] !border-[color:var(--eye-orange)]" },
  decision: { label: "Decision", shortLabel: "DEC", icon: GitBranch, headerBg: "bg-eye-grape",    headerFg: "text-white",       ring: "ring-eye-grape/40",    border: "border-eye-grape/30",    softBg: "bg-[color:var(--eye-grape)]/8",     accentText: "text-eye-grape",    handleColor: "!bg-[color:var(--eye-grape)] !border-[color:var(--eye-grape)]" },
  special:  { label: "Special",  shortLabel: "SPC", icon: Sparkles,  headerBg: "bg-eye-lemon",    headerFg: "text-eye-indigo",  ring: "ring-eye-lemon/40",    border: "border-eye-lemon/40",    softBg: "bg-[color:var(--eye-lemon)]/10",    accentText: "text-eye-indigo",   handleColor: "!bg-[color:var(--eye-lemon)] !border-[color:var(--eye-lemon)]" },
  outcome:  { label: "Outcome",  shortLabel: "OUT", icon: Flag,      headerBg: "bg-eye-lavender", headerFg: "text-eye-indigo",  ring: "ring-eye-lavender/40", border: "border-eye-lavender/40", softBg: "bg-[color:var(--eye-lavender)]/12", accentText: "text-eye-indigo",   handleColor: "!bg-[color:var(--eye-lavender)] !border-[color:var(--eye-lavender)]" },
  chaser:   { label: "Chaser",   shortLabel: "CHS", icon: Bell,      headerBg: "chaser-stripes",  headerFg: "text-white",       ring: "ring-eye-orange/50",   border: "border-eye-orange/40",   softBg: "bg-[color:var(--eye-orange)]/6",    accentText: "text-eye-orange",   handleColor: "!bg-[color:var(--eye-orange)] !border-[color:var(--eye-orange)]" },
}
