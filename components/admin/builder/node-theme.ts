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

export const NODE_THEME: Record<GraphNodeType, NodeCategoryTheme> = {
  start:   { label: "Start",    shortLabel: "STA", icon: Play,      headerBg: "bg-slate-700",   headerFg: "text-white", ring: "ring-slate-400/40",   border: "border-slate-300 dark:border-slate-700", softBg: "bg-slate-50/40 dark:bg-slate-950/20", accentText: "text-slate-600 dark:text-slate-300", handleColor: "!bg-slate-700 !border-slate-700" },
  round:   { label: "Round",    shortLabel: "RND", icon: Circle,    headerBg: "bg-sky-500",     headerFg: "text-white", ring: "ring-sky-400/40",     border: "border-sky-200 dark:border-sky-900",     softBg: "bg-sky-50/40 dark:bg-sky-950/20",     accentText: "text-sky-600 dark:text-sky-400",     handleColor: "!bg-sky-500 !border-sky-500" },
  inject:  { label: "Inject",   shortLabel: "INJ", icon: Zap,       headerBg: "bg-amber-500",   headerFg: "text-white", ring: "ring-amber-400/40",   border: "border-amber-200 dark:border-amber-900", softBg: "bg-amber-50/40 dark:bg-amber-950/20", accentText: "text-amber-600 dark:text-amber-400", handleColor: "!bg-amber-500 !border-amber-500" },
  decision:{ label: "Decision", shortLabel: "DEC", icon: GitBranch, headerBg: "bg-violet-500",  headerFg: "text-white", ring: "ring-violet-400/40",  border: "border-violet-200 dark:border-violet-900", softBg: "bg-violet-50/40 dark:bg-violet-950/20", accentText: "text-violet-600 dark:text-violet-400", handleColor: "!bg-violet-500 !border-violet-500" },
  special: { label: "Special",  shortLabel: "SPC", icon: Sparkles,  headerBg: "bg-fuchsia-500", headerFg: "text-white", ring: "ring-fuchsia-400/40", border: "border-fuchsia-200 dark:border-fuchsia-900", softBg: "bg-fuchsia-50/40 dark:bg-fuchsia-950/20", accentText: "text-fuchsia-600 dark:text-fuchsia-400", handleColor: "!bg-fuchsia-500 !border-fuchsia-500" },
  outcome: { label: "Outcome",  shortLabel: "OUT", icon: Flag,      headerBg: "bg-emerald-500", headerFg: "text-white", ring: "ring-emerald-400/40", border: "border-emerald-200 dark:border-emerald-900", softBg: "bg-emerald-50/40 dark:bg-emerald-950/20", accentText: "text-emerald-600 dark:text-emerald-400", handleColor: "!bg-emerald-500 !border-emerald-500" },
  chaser:  { label: "Chaser",   shortLabel: "CHS", icon: Bell,      headerBg: "bg-rose-500",    headerFg: "text-white", ring: "ring-rose-400/40",    border: "border-rose-200 dark:border-rose-900",   softBg: "bg-rose-50/40 dark:bg-rose-950/20",   accentText: "text-rose-600 dark:text-rose-400",   handleColor: "!bg-rose-500 !border-rose-500" },
}
