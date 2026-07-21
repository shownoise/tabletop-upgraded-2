# PROMPT — Scenario Builder V2 (Homey-Flow style visual upgrade)

Feed this whole file to Claude Code inside `/Users/pieterbaspluijmaekers/tabletop-upgraded-2`. Do the phases in order. Each phase must compile cleanly (`pnpm exec tsc --noEmit`) and be manually smoke-tested in the browser at `/admin/builder` before starting the next.

## Goal

The scenario builder at `/admin/builder` works, but the cards feel flat and monochrome. Upgrade the **look & feel**, **capabilities**, and **interactions** to feel like Athom's Homey Flow editor: colorful category cards with big icons, clear input/output sockets, hover affordances, quick-add buttons, and delightful micro-interactions.

Reference (Homey Flow visual language):
- Every card has a **prominent colored header** identifying its category (WHEN / AND / THEN in Homey; Start / Round / Inject / Decision / Special / Outcome for us).
- **Big icon** on the left of the header, category color as background.
- Rounded 12–16px corners, subtle drop shadow, breathing room inside the body.
- Handles ("sockets") are visible and clearly clickable, not the tiny default React Flow dots.
- Hovering a card reveals **quick actions**: duplicate, delete, and an **add-next "+"** button that inserts and auto-connects the most likely next node.
- Curved bezier edges, subtly colored by edge kind, animated dashes when carrying an active inject.
- Selected state: colored ring + tiny lift (`translate-y-[-1px]`).
- Palette on the left is grouped by category with icons; searchable if there are more than ~5 types.

**Backwards compatibility (hard):** graph JSON schema (`ScenarioGraph`, `GraphNodeData`) stays identical. Do NOT change `lib/graph/types.ts` structure. Compile/engine/validate must not change. This is a **presentation + interaction** pass, not a data model change.

---

## Phase 1 — Design tokens & node category system

### 1.1 Create `components/admin/builder/node-theme.ts`

Central lookup of category → color/icon/label used by every node card and by the palette. Do NOT hardcode colors in individual node files after this — pull from here.

```ts
import type { LucideIcon } from "lucide-react"
import { Play, Circle, Zap, GitBranch, Sparkles, Flag } from "lucide-react"
import type { GraphNodeType } from "@/lib/graph/types"

export interface NodeCategoryTheme {
  label: string           // "Round", "Inject", ...
  shortLabel: string      // "RND", "INJ" — used in header pill
  icon: LucideIcon
  // Tailwind class fragments. Keep as strings so Tailwind's JIT picks them up
  // (do NOT build them at runtime with template concatenation).
  headerBg: string        // e.g. "bg-sky-500"
  headerFg: string        // e.g. "text-white"
  ring: string            // selected ring color, e.g. "ring-sky-400/40"
  border: string          // idle border, e.g. "border-sky-200 dark:border-sky-900"
  softBg: string          // subtle body tint, e.g. "bg-sky-50/40 dark:bg-sky-950/20"
  accentText: string      // e.g. "text-sky-600 dark:text-sky-400"
  handleColor: string     // e.g. "!bg-sky-500 !border-sky-500"
}

export const NODE_THEME: Record<GraphNodeType, NodeCategoryTheme> = {
  start:   { label: "Start",    shortLabel: "STA", icon: Play,      headerBg: "bg-slate-700",   headerFg: "text-white", ring: "ring-slate-400/40",   border: "border-slate-300 dark:border-slate-700", softBg: "bg-slate-50/40 dark:bg-slate-950/20", accentText: "text-slate-600 dark:text-slate-300", handleColor: "!bg-slate-700 !border-slate-700" },
  round:   { label: "Round",    shortLabel: "RND", icon: Circle,    headerBg: "bg-sky-500",     headerFg: "text-white", ring: "ring-sky-400/40",     border: "border-sky-200 dark:border-sky-900",     softBg: "bg-sky-50/40 dark:bg-sky-950/20",     accentText: "text-sky-600 dark:text-sky-400",     handleColor: "!bg-sky-500 !border-sky-500" },
  inject:  { label: "Inject",   shortLabel: "INJ", icon: Zap,       headerBg: "bg-amber-500",   headerFg: "text-white", ring: "ring-amber-400/40",   border: "border-amber-200 dark:border-amber-900", softBg: "bg-amber-50/40 dark:bg-amber-950/20", accentText: "text-amber-600 dark:text-amber-400", handleColor: "!bg-amber-500 !border-amber-500" },
  decision:{ label: "Decision", shortLabel: "DEC", icon: GitBranch, headerBg: "bg-violet-500",  headerFg: "text-white", ring: "ring-violet-400/40",  border: "border-violet-200 dark:border-violet-900", softBg: "bg-violet-50/40 dark:bg-violet-950/20", accentText: "text-violet-600 dark:text-violet-400", handleColor: "!bg-violet-500 !border-violet-500" },
  special: { label: "Special",  shortLabel: "SPC", icon: Sparkles,  headerBg: "bg-fuchsia-500", headerFg: "text-white", ring: "ring-fuchsia-400/40", border: "border-fuchsia-200 dark:border-fuchsia-900", softBg: "bg-fuchsia-50/40 dark:bg-fuchsia-950/20", accentText: "text-fuchsia-600 dark:text-fuchsia-400", handleColor: "!bg-fuchsia-500 !border-fuchsia-500" },
  outcome: { label: "Outcome",  shortLabel: "OUT", icon: Flag,      headerBg: "bg-emerald-500", headerFg: "text-white", ring: "ring-emerald-400/40", border: "border-emerald-200 dark:border-emerald-900", softBg: "bg-emerald-50/40 dark:bg-emerald-950/20", accentText: "text-emerald-600 dark:text-emerald-400", handleColor: "!bg-emerald-500 !border-emerald-500" },
}
```

### 1.2 Create `components/admin/builder/node-shell.tsx`

Shared shell component that every node uses. This is the single source of truth for card chrome — headers, hover actions, selected ring, drop shadow. Individual node components only supply the body.

```tsx
"use client"

import type { ReactNode } from "react"
import { Copy, Trash2, Plus } from "lucide-react"
import { NODE_THEME } from "./node-theme"
import type { GraphNodeType } from "@/lib/graph/types"

interface Props {
  type: GraphNodeType
  selected?: boolean
  title: string           // header title (e.g. "Round 2" or "Ransomware chat")
  meta?: ReactNode        // small right-aligned metadata (e.g. "15m", "auto")
  width?: number          // px, default per type (see below)
  variantBorder?: string  // optional override, e.g. Outcome negative → destructive
  onDuplicate?: () => void
  onDelete?: () => void
  onAddNext?: () => void  // renders "+" affordance on hover, right side
  children: ReactNode     // node body content
}

export function NodeShell(props: Props) {
  const theme = NODE_THEME[props.type]
  const Icon = theme.icon
  const width = props.width ?? 280
  return (
    <div
      style={{ width }}
      className={`group relative rounded-xl border bg-card shadow-md transition-all duration-150 hover:-translate-y-[1px] hover:shadow-lg ${
        props.variantBorder ?? theme.border
      } ${props.selected ? `ring-2 ${theme.ring} ring-offset-1 ring-offset-background` : ""}`}
    >
      {/* Header */}
      <div className={`flex items-center gap-2 rounded-t-xl px-3 py-2 ${theme.headerBg} ${theme.headerFg}`}>
        <div className="flex size-6 items-center justify-center rounded-md bg-white/20">
          <Icon className="size-3.5" />
        </div>
        <span className="font-mono text-[10px] uppercase tracking-wider opacity-80">{theme.shortLabel}</span>
        <span className="flex-1 truncate font-mono text-xs font-medium">{props.title}</span>
        {props.meta && <span className="font-mono text-[10px] opacity-80">{props.meta}</span>}
      </div>

      {/* Body */}
      <div className={`rounded-b-xl px-3 py-2.5 ${theme.softBg}`}>{props.children}</div>

      {/* Hover quick actions (top-right, outside card) */}
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

      {/* Add-next "+" affordance (right side, appears on hover) */}
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
}
```

### 1.3 Definition of done for Phase 1

- `node-theme.ts` and `node-shell.tsx` compile.
- No visual change yet (nothing consumes them). Just infrastructure.

---

## Phase 2 — Refactor every node card to use `NodeShell`

Rewrite the six node components in `components/admin/builder/nodes/` on top of `NodeShell`. Keep them lean — the shell does chrome, they do body.

### 2.1 `start-node.tsx`

Small pill-like card (width 160) with the shell but body-less. Only one right handle.

```tsx
"use client"
import { Handle, Position, type NodeProps } from "@xyflow/react"
import { NodeShell } from "../node-shell"
import { NODE_THEME } from "../node-theme"

export function StartNode({ selected }: NodeProps) {
  return (
    <NodeShell type="start" selected={selected} title="Scenario start" width={160}>
      <span className="text-[10px] text-muted-foreground">Facilitator drukt op play</span>
      <Handle type="source" position={Position.Right} className={`${NODE_THEME.start.handleColor} !size-3 !border-2 !border-background`} />
    </NodeShell>
  )
}
```

### 2.2 `round-node.tsx`

Width 300. Body shows situation excerpt (3 lines) plus a small **stat row** (timer, inject count, role count if any). Hover → add-next inserts a new empty Round and auto-connects a `sequence` edge. Duplicate copies data. Delete removes with confirmation dialog handled by canvas.

Body must expose:
- Timer chip (e.g. `⏱ 15m`)
- Inject count chip if children exist (e.g. `⚡ 3`)
- Role count chip if `roleActions?.length`

Handles: left target (sequence), right source (sequence), bottom source (id="injects").

### 2.3 `inject-node.tsx`

Width 240. Body shows:
- Channel badge (WhatsApp/Slack/etc.) rendered with a per-channel icon (see 2.7).
- Urgency dot: red (`bg-red-500`) high, amber medium, slate low.
- First 2 lines of content, `line-clamp-2`.

Handles: top target only. Injects are leaves.

### 2.4 `decision-node.tsx`

Width 280. Body lists the options as pill-buttons with the handle attached to the right of each pill (visually clearer than the current cramped list). Each option pill has a colored left border matching the theme accent.

Add-next affordance is disabled on Decision (users should draw branches manually from option handles).

Show a small footer row: `measuredBy` badge + `triggerRole` if set.

### 2.5 `special-node.tsx`

Width 260. Body:
- Special type as a big label (larger than current) with a small "interactive" tag.
- Assigned role as a badge below.
- Thresholds list uses the same pill-with-handle pattern as Decision options.

### 2.6 `outcome-node.tsx`

Width 240. Body:
- Big score chip in the header meta slot: `+2`, `-1`, `±0` — colored (green / red / slate).
- Narrative excerpt (first 100 chars, 3 lines).
- `variantBorder` on the shell: emerald for score ≥ 0, destructive for negative, default otherwise.

Outcome has no output handles (terminal).

### 2.7 Channel icons for inject

Create `components/admin/builder/channel-icons.ts`:

```ts
import { MessageSquare, Mail, Phone, Radio, Bell, FileText, AlertTriangle, Newspaper } from "lucide-react"
import type { LucideIcon } from "lucide-react"

export const CHANNEL_ICON: Record<string, LucideIcon> = {
  whatsapp: MessageSquare,
  slack: MessageSquare,
  teams: MessageSquare,
  email: Mail,
  sms: MessageSquare,
  phone: Phone,
  siem: Radio,
  siem_alert: Radio,
  edr: Radio,
  news: Newspaper,
  news_ticker: Newspaper,
  memo: FileText,
  ransom_note: AlertTriangle,
  system_alert: Bell,
  raw: FileText,
  internal: FileText,
}
```

Fall back to `FileText` when unknown.

### 2.8 Handle styling globally

React Flow default handles are 6px circles. Style all custom handles as **10px squircles with a 2px background-color ring**:

```
!size-3 !border-2 !border-background
```

Combined with the per-theme `handleColor` class from `NODE_THEME`, this gives the "socket" look. Apply consistently across every node file.

### 2.9 Definition of done for Phase 2

- All 6 node types render using `NodeShell`.
- Colors visible in both light and dark mode (verify manually with `/theme-toggle`).
- Hover on any card shows duplicate + delete pills; on Round/Inject/Special/Start the add-next `+` also appears.
- No functional regressions — save/load/publish still works.
- `pnpm exec tsc --noEmit` clean.

---

## Phase 3 — Canvas interactions (hover-add, duplicate, keyboard, context menu)

### 3.1 Duplicate & add-next callbacks

`canvas.tsx` currently has `handleDelete` and `handleAddInject`. Add:

```ts
const handleDuplicate = useCallback((nodeId: string) => { ... })
const handleAddNext = useCallback((nodeId: string) => { ... })
```

**handleDuplicate:** copy the source node with a fresh id, offset position by `+40, +40`, deep-copy `data` (regenerate any nested option/threshold ids so no collisions). No edges copied. Select the new node.

**handleAddNext:** insert a sensible next node and auto-connect. Rules:
- Source is Start / Round → insert a new Round to the right, `sequence` edge.
- Source is Inject → insert a new Round (injects don't chain), sequence edge.
- Source is Decision → do nothing (branches must be drawn manually from option handles). Never call this for Decision.
- Source is Special → do nothing (same reasoning; use threshold handles).

Position calculation: `newNode.position = { x: source.position.x + 340, y: source.position.y }`.

Pass both callbacks down to every node via the `data` object (React Flow's canonical way to expose node callbacks). Extend `NodeProps` consumer types to read them.

### 3.2 Keyboard shortcuts

Register keyboard shortcuts on the `ReactFlow` wrapper (`onKeyDown`):
- `Delete` or `Backspace` → delete selected node (only when a node is selected and NOT inside an input).
- `Cmd/Ctrl+D` → duplicate selected node.
- `Escape` → deselect.

Prevent handling when `document.activeElement` is an `INPUT`, `TEXTAREA`, or `[contenteditable]`.

### 3.3 Right-click context menu

Use shadcn's `ContextMenu` primitive (`@/components/ui/context-menu` — install shadcn's context-menu block if not present). Wrap each node's `NodeShell` in a `ContextMenu` that offers: Duplicate, Delete, Add next (if applicable). Same actions as hover buttons, but discoverable via right-click.

### 3.4 Snap to grid + smoother drag

Add to the `ReactFlow` component in `canvas.tsx`:

```
snapToGrid
snapGrid={[16, 16]}
defaultEdgeOptions={{ type: "smoothstep", animated: false, style: { strokeWidth: 2 } }}
connectionLineStyle={{ strokeWidth: 2 }}
connectionRadius={40}
```

### 3.5 Custom edge styling

Create `components/admin/builder/edges/typed-edge.tsx` — a custom edge that colors itself by `data.kind`:
- `sequence` → `stroke-slate-500` (2px)
- `inject` → `stroke-amber-500` dashed animated (2px)
- `branch` → `stroke-violet-500` (2.5px, with a subtle glow)
- `outcome` → `stroke-emerald-500` (2px)

Register in canvas:

```ts
const EDGE_TYPES = { typed: TypedEdge }
// and set edge.type = "typed" everywhere edges are created
```

Update `toFlowEdges` / `onConnect` / `handleAddInject` / `handleAddNext` to set `type: "typed"` and pass the kind through `data.kind`.

### 3.6 Definition of done for Phase 3

- Hover a Round card → click `+` → new connected Round appears.
- Cmd+D duplicates the selected node.
- Del removes it.
- Right-click a node → menu with Duplicate / Delete / Add next.
- Edges are colored per kind and animate for injects.
- Snap-to-grid works (nodes align on 16px grid).

---

## Phase 4 — Palette upgrade

### 4.1 Rewrite `palette.tsx`

Redesign to match Homey's card-picker feel:

- Grouped visually: **Structure** (Start, Round, Outcome) and **Interaction** (Inject, Decision, Special).
- Each chip is a mini version of the real card: colored icon square on the left, label + hint on the right.
- Icon comes from `NODE_THEME[type].icon` and `NODE_THEME[type].headerBg`.
- Chips have `active:scale-95` and `hover:shadow-md`.
- Draggable exactly as before (mime type + `screenToFlowPosition` in canvas).

```tsx
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
```

### 4.2 Palette container tweaks in `canvas.tsx`

Change the aside from `w-56` to `w-64` and add a subtle top-border label. Keep the border-r.

### 4.3 Definition of done for Phase 4

- Palette shows Structure and Interaction groups.
- Each chip has its category color icon square.
- Drag from any chip still creates the correct node type.
- No functional regressions.

---

## Phase 5 — Empty-state guidance & mini-map polish

### 5.1 Empty canvas hint

When `nodes.length <= 1` (only the Start node), render an absolutely-positioned hint centered on the canvas:

```
"Sleep een kaart uit het paneel links →  of druk Cmd+K voor de wizard"
```

Style: `absolute inset-0 flex items-center justify-center pointer-events-none text-muted-foreground text-sm font-mono`.

Hide as soon as any other node is added.

### 5.2 Empty node bodies

Inside Round, Decision, and Special node bodies, when their key fields are empty, show a subtle "click to configure" placeholder (light italic muted-foreground). E.g. for Round with no `situation_update`: `"⌘ klik om te bewerken"`.

Do NOT block interaction — this is a visual hint only.

### 5.3 Minimap styling

In `canvas.tsx`, style the MiniMap to match:

```tsx
<MiniMap
  pannable
  zoomable
  nodeStrokeWidth={2}
  nodeColor={(n) => {
    const t = (n.type ?? "round") as GraphNodeType
    return ({
      start: "#334155",
      round: "#0ea5e9",
      inject: "#f59e0b",
      decision: "#8b5cf6",
      special: "#d946ef",
      outcome: "#10b981",
    })[t]
  }}
  className="!bg-card !border !border-border !rounded-lg"
/>
```

### 5.4 Definition of done for Phase 5

- Fresh `/admin/builder` shows the hint.
- Adding one node hides the hint.
- Minimap shows colored dots matching the categories.
- Cmd+K opens the wizard dialog (wire this in — currently `WizardDialog` state lives in canvas; add a keyboard listener to open it).

---

## Phase 6 — Motion & micro-interactions (small pass, biggest perceived quality bump)

### 6.1 Card mount animation

When a new node is inserted (via drop, add-next, duplicate, wizard), fade + slide in.

Approach without adding libraries: give the fresh node a `data._justAdded = true` flag; the shell reads `props.selected` and adds an `animate-in fade-in-0 slide-in-from-top-1 duration-200` class from `tailwindcss-animate` (already installed via shadcn) for one render. Clear the flag after mount (via `useEffect` inside `NodeShell` calling `onSettled`).

Simpler alternative: use CSS keyframes in `styles/globals.css`:

```css
@keyframes node-enter {
  from { opacity: 0; transform: translateY(-4px) scale(0.98); }
  to   { opacity: 1; transform: translateY(0)    scale(1); }
}
.rf-node-enter { animation: node-enter 180ms ease-out; }
```

Apply `rf-node-enter` on `NodeShell`'s outer div for the first 200ms after mount (track with `useState`). This is the preferred implementation.

### 6.2 Edge animation for the active inject flow

Already covered by animated dashes on `inject`-kind edges. Additionally, when a session is running (out of scope for this pass, but be forward-looking): make the current path glow. For now, ensure the animation is smooth (no jank).

### 6.3 Cursor states

- `cursor-grab` on nodes at rest, `cursor-grabbing` while dragging (React Flow already sets `grabbing` — verify).
- `cursor-crosshair` on the pane while `connecting` (default React Flow behavior — keep).

### 6.4 Definition of done for Phase 6

- Every newly inserted node animates in.
- No CLS or jank.
- Cursors feel right.

---

## Phase 7 — Selected-node inspector polish (light touch)

Do NOT rewrite `inspector.tsx`. Only:

1. At the top of the inspector body, render a category badge matching the selected node's `NODE_THEME` (same icon square + label as the palette chip). This grounds the user visually so they know what they're editing.
2. Add a small "Delete" and "Duplicate" button row directly under the badge, calling the same canvas callbacks.
3. Keep the existing form fields untouched.

If `inspector.tsx` currently receives `onDelete` but not `onDuplicate`, add `onDuplicate` to its props and thread it through from canvas.

### 7.1 Definition of done for Phase 7

- Selecting a node shows the colored badge at the top of the right sidebar.
- Duplicate/Delete buttons work.
- No form-field regressions.

---

## Files you will ADD

```
components/admin/builder/
  node-theme.ts                    (Phase 1)
  node-shell.tsx                   (Phase 1)
  channel-icons.ts                 (Phase 2)
  edges/
    typed-edge.tsx                 (Phase 3)
```

## Files you will EDIT

```
components/admin/builder/
  canvas.tsx                       (Phases 3, 4, 5, 6, 7)
  palette.tsx                      (Phase 4 — full rewrite, same public surface)
  inspector.tsx                    (Phase 7 — small additions only)
  nodes/start-node.tsx             (Phase 2)
  nodes/round-node.tsx             (Phase 2)
  nodes/inject-node.tsx            (Phase 2)
  nodes/decision-node.tsx          (Phase 2)
  nodes/special-node.tsx           (Phase 2)
  nodes/outcome-node.tsx           (Phase 2)
styles/globals.css                 (Phase 6 — add node-enter keyframes)
```

## Files you will NOT touch

- `lib/graph/types.ts` — schema is stable.
- `lib/graph/compile.ts`, `engine.ts`, `validate.ts`, `analyze.ts`, `preview.ts`, `examples.ts`, `examples-nis2.ts`, `wizard-plan.ts` — pure logic, no visual concerns.
- `app/api/scenario-graph/route.ts` — API stays identical.
- Any file outside `components/admin/builder/` unless explicitly listed above.

## Constraints

- **No new dependencies.** `lucide-react`, `tailwindcss-animate`, and shadcn's `context-menu` primitive are already available (verify via `pnpm list`; only run `pnpm dlx shadcn@latest add context-menu` if the primitive is genuinely missing).
- **Do not** change the graph JSON schema. `ScenarioGraph` stays byte-compatible.
- **Do not** rewrite `inspector.tsx` end-to-end — surgical edits only.
- **Do not** add `console.log`. Use the existing timeline event system if you need runtime tracing.
- **No comments** in new files except non-obvious WHY.
- **Both light and dark themes** must look good — verify each phase in both.
- **Every phase ends with** `pnpm exec tsc --noEmit` clean and a manual smoke test at `/admin/builder`:
  1. Fresh page: hint visible.
  2. Drag a Round: hint disappears, Round appears with animation.
  3. Hover the Round: `+`, duplicate, delete buttons appear.
  4. Click `+`: new Round appears connected via a sequence edge.
  5. Cmd+D: duplicates the selected node.
  6. Right-click a node: context menu appears.
  7. Save → refresh → Load: graph restores correctly with new visuals.
  8. Publish flow still lands on `/admin?graphId=...`.
- **Use pnpm.**
- **After edits**, call `graph_register_edit` with each changed file, using `file::symbol` notation where the change is symbol-scoped.

---

## Phase 8 — Fair inject distribution across present participants

### 8.1 The problem

Right now `Inject.targetRoles` is a hard filter: if the role isn't held by anyone in the session, the inject is invisible. `remapMissingRoles` in `lib/session-store.ts` remaps via `ROLE_FALLBACK`, but if none of the fallback roles are present either, the inject still lands nowhere.

We want: **every inject always reaches at least one present participant**, and when multiple present participants could reasonably receive it, distribute deterministically so the load is spread — not always CEO.

### 8.2 New helper: `lib/inject-routing.ts`

Create a single pure function that decides the actual delivery roles for one inject given the set of roles present in the session:

```ts
import type { Inject, Role } from "@/lib/types"
import { ROLE_FALLBACK } from "@/lib/types"

export interface RoutingInput {
  inject: Inject
  presentRoles: Role[]       // roles held by a participant right now
  teamRoles: Record<'crisis_management' | 'technical_it', Role[]>  // static membership map — build once from ROLE_META
}

// Returns the roles this inject should actually be shown to.
// Never returns an empty array unless presentRoles is empty.
export function resolveInjectRecipients(input: RoutingInput): Role[] {
  const { inject, presentRoles, teamRoles } = input
  if (presentRoles.length === 0) return []
  const present = new Set(presentRoles)

  // 1. targetRoles hit — done.
  if (inject.targetRoles?.length) {
    const direct = inject.targetRoles.filter(r => present.has(r))
    if (direct.length > 0) return direct

    // 2. fallback chain per targeted role (ROLE_FALLBACK is a chain of preferences)
    const viaFallback = new Set<Role>()
    for (const r of inject.targetRoles) {
      for (const cand of ROLE_FALLBACK[r] ?? []) {
        if (present.has(cand)) { viaFallback.add(cand); break }
      }
    }
    if (viaFallback.size > 0) return [...viaFallback]

    // 3. still nothing → drop to team-level below
  }

  // 4. targetTeam — filter team members to present participants.
  const team = inject.targetTeam
  if (team && team !== 'all') {
    const inTeam = (teamRoles[team] ?? []).filter(r => present.has(r))
    if (inTeam.length > 0) return inTeam
  }

  // 5. Broadcast fallback: deterministic single-recipient assignment so the
  //    inject actually lands on someone instead of being dropped. Hash the
  //    inject.id into a stable index across presentRoles — the same inject
  //    always routes to the same person, and the load spreads across injects.
  const idx = stableHash(inject.id) % presentRoles.length
  return [presentRoles[idx]]
}

function stableHash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}
```

Do NOT change `Inject.targetRoles` semantics in the type — only the *runtime resolution* is enhanced.

### 8.3 Build `teamRoles` from `ROLE_META`

`ROLE_META` in `lib/types.ts` already carries a `team` field per role. Add an exported helper in `lib/types.ts` (or a small `lib/team-roster.ts` if you want to keep types clean):

```ts
export function buildTeamRoles(): Record<'crisis_management' | 'technical_it', Role[]> {
  const acc: Record<'crisis_management' | 'technical_it', Role[]> = { crisis_management: [], technical_it: [] }
  for (const [roleId, meta] of Object.entries(ROLE_META) as [Role, typeof ROLE_META[Role]][]) {
    if (meta.team === 'crisis_management' || meta.team === 'technical_it') {
      acc[meta.team].push(roleId)
    }
  }
  return acc
}
```

If `ROLE_META` doesn't currently have a `team` field, do NOT add one. Instead, hardcode the roster once inside `lib/inject-routing.ts` derived from what the codebase already treats as each team (grep `crisis_management` and `technical_it` usage to confirm the two rosters, then encode them as literal arrays). Prefer discovery over invention.

### 8.4 Wire the router into `inject-feed.tsx`

Replace the current filter block (starts at `const filtered = pushed.filter((p) => {`) with:

```ts
import { resolveInjectRecipients } from "@/lib/inject-routing"
import { buildTeamRoles } from "@/lib/team-roster" // wherever you placed it

const teamRoles = useMemo(buildTeamRoles, [])
const presentRoles = useMemo(
  () => session.participants.map(p => p.role).filter((r): r is Role => !!r),
  [session.participants]
)

const filtered = pushed.filter(p => {
  if (p.pushedAt > now) return false
  if (myRoleLabel && isSelfReferential(p.inject.senderName, myRoleLabel)) return false
  if (!participantRole) return true  // observers see everything
  const recipients = resolveInjectRecipients({ inject: p.inject, presentRoles, teamRoles })
  return recipients.includes(participantRole)
})
```

Pass `session.participants` from `play-view.tsx` down into `inject-feed.tsx` — grep the current props first so you don't break signatures.

### 8.5 Do NOT mutate stored injects

Routing is a **view-time** decision. Do not overwrite `inject.targetRoles` in the session store. Two participants with different roles will independently compute the same routing result, so the answer is stable across clients.

### 8.6 Show the resolved recipient on the facilitator side

In `components/admin/inject-controls.tsx`, next to each planned inject's status, add a small chip showing which participants will actually receive it based on the current lobby. Use `resolveInjectRecipients` with `session.participants` roles. This makes it obvious *before* pushing where an inject will land.

### 8.7 Definition of done for Phase 8

- Start a session with only two participants (e.g. CEO + CISO) and a scenario whose injects target `[cfo, legal]`. Every such inject visibly lands on either CEO or CISO — never zero recipients.
- Inject panel in facilitator view shows the resolved recipient chip.
- Tests: add `lib/inject-routing.test.ts` with cases: (a) direct match, (b) fallback via `ROLE_FALLBACK`, (c) team fallback, (d) hash-broadcast when nothing matches. Use existing test runner (grep `package.json` for `test` script; if none is set up, skip and add a manual smoke test note in the PR).

---

## Phase 9 — Manual early push (override delivery timer)

### 9.1 The problem

Once a round starts, injects are auto-pushed into `session.pushedInjects` with `pushedAt = now + deliverySeconds*1000`. The client hides future-timed injects. `pushInject({ roundIndex, injectId })` in `session-store.ts` currently returns `"Already pushed"` for these, so the facilitator can't accelerate delivery.

### 9.2 Change `pushInject` to allow re-time

Modify `pushInject` in `lib/session-store.ts` around line 491:

```ts
export async function pushInject(input: { roundIndex: number; injectId: string }): Promise<{ ok: boolean; error?: string }> {
  const session = await dbGetSession()
  if (!session) return { ok: false, error: "No active session." }

  const round = session.scenario.rounds[input.roundIndex]
  if (!round) return { ok: false, error: "Invalid round." }
  const inject = round.injects.find(i => i.id === input.injectId)
  if (!inject) return { ok: false, error: "Invalid inject." }

  const existingIdx = session.pushedInjects.findIndex(p => p.inject.id === inject.id)
  const now = Date.now()

  let pushedInjects: typeof session.pushedInjects
  if (existingIdx >= 0) {
    const existing = session.pushedInjects[existingIdx]
    // Only allow "push earlier" — never rewind an already-visible inject.
    if (existing.pushedAt <= now) return { ok: false, error: "Already delivered." }
    pushedInjects = [...session.pushedInjects]
    pushedInjects[existingIdx] = { ...existing, pushedAt: now }
  } else {
    pushedInjects = [...session.pushedInjects, { inject, roundIndex: input.roundIndex, pushedAt: now }]
  }

  let updated: SessionState = { ...session, pushedInjects }
  updated = pushTimeline(updated, "inject_pushed", { roundIndex: input.roundIndex, inject })
  await dbSetSession(updated)
  broadcastState(updated)
  emit("push_inject", { inject, roundIndex: input.roundIndex })
  return { ok: true }
}
```

Semantics:
- If the inject hasn't been pushed at all → push now (existing behavior).
- If the inject was auto-scheduled for the future → **advance** its `pushedAt` to now (new behavior — the "push earlier" case the user asked for).
- If the inject has already been delivered → refuse. (Prevents accidental double-push.)

### 9.3 Update facilitator UI

In `components/admin/inject-controls.tsx`, the button currently only shows for injects not yet in `pushedIds`. Change to:

- Compute `deliveryState` per inject: `not_pushed` | `scheduled_future` | `delivered`.
- Button label:
  - `not_pushed` → "Push now" (existing).
  - `scheduled_future` → "Push earlier" with a small badge showing remaining delivery seconds.
  - `delivered` → disabled check icon + "Delivered".
- Both `not_pushed` and `scheduled_future` call the same `api.pushInject` endpoint — the server side handles the re-time.

### 9.4 Timeline logging

Ensure the timeline event `inject_pushed` fires again on re-time. Consumers (report view, dashboard timeline) show two events: original auto-schedule + manual advance. If that's noisy, add a distinct timeline event name `inject_advanced` when `existingIdx >= 0` and log that instead of a second `inject_pushed`.

### 9.5 Definition of done for Phase 9

- Start a round with an inject that has `deliverySeconds: 300`. Confirm it appears in the facilitator panel as "scheduled in 5:00".
- Click "Push earlier" → participants targeted by that inject see it appear immediately.
- Facilitator button flips to "Delivered".
- After delivery, "Push earlier" is no longer clickable.

---

## Phase 10 — Auto-advance discussion sub-phases

### 10.1 The problem

`activeDiscussionPhase.phaseStartedAt` + `phase.durationSeconds` already exist. But the session lead has to click "Volgende fase →" to move on. The user wants auto-progression across the available time budget.

### 10.2 Server-side ticker (deterministic, no `setInterval` on the server)

Do NOT introduce a background timer process. Instead:

- On every state read that goes through the SSE stream (`toParticipantState`, `broadcastState`, or a wrapper), check whether the active phase has elapsed. If so, advance it.
- Also perform the check whenever any mutating action runs (any call to `mutate(...)`).
- Wrap this in one helper:

```ts
// lib/session-store.ts — new internal helper
function tickPhases(session: SessionState): SessionState {
  if (!session.activeDiscussionPhase) return session
  const phases = session.config.decisionFramework === 'ooda' ? OODA_PHASES : BOB_PHASES
  const cur = session.activeDiscussionPhase
  const phase = phases[cur.phaseIndex]
  if (!phase) return session

  const elapsedMs = Date.now() - cur.phaseStartedAt
  const budgetMs = phase.durationSeconds * 1000
  if (elapsedMs < budgetMs) return session

  const nextIdx = cur.phaseIndex + 1
  if (nextIdx >= phases.length) {
    // Reached the last phase — do NOT auto-advance out of discussion; wait for facilitator/decision.
    return session
  }
  const nextPhase = phases[nextIdx]
  return {
    ...session,
    activeDiscussionPhase: {
      roundNumber: cur.roundNumber,
      phaseIndex: nextIdx,
      phaseStartedAt: cur.phaseStartedAt + budgetMs,   // seamless — no drift
      extended: false,
    },
    currentDiscussionPrompt: nextPhase.participantPrompt,
    currentDiscussionPhaseIndex: nextIdx,
  }
}
```

Then:
- In `mutate(...)` before persisting, run `session = tickPhases(session)`.
- In the SSE state route's per-request handler, if the elapsed time crossed a boundary since last read, call `tickPhases` via a small `POST /api/session/tick` route triggered by the participant's client every 10s (or just call it lazily inside the SSE `GET` handler once per interval).

Cleanest approach: call `tickPhases` inside `broadcastState` **before** it snapshots the session for listeners. This makes every SSE push naturally trigger the tick on the server side without needing a client-driven cron.

**Emit event when auto-advance happens:** if `tickPhases` returns a different session, call `emit('discussion_phase_changed', ...)` inside the helper (or return an "advanced" flag and let the caller emit). Keep the existing manual advance event flow untouched.

### 10.3 Budget-fitting mode (optional but requested)

The user said "die fases in control die moeten automatisch over de tijd die we hebben gaan". Interpretation: the round has an overall `timerMinutes`, and the sub-phases should proportionally fit inside it — not use their hardcoded `durationSeconds`.

Add a config knob on the round (or globally, in `ExerciseConfig`):

```ts
// lib/types.ts — extend ExerciseConfig
phaseAutoAdvance?: 'off' | 'fixed_durations' | 'fit_to_round'
```

Default: `'fit_to_round'` (matches what the user asked for).

When `fit_to_round`:
- `roundBudgetMs = (round.timerMinutes ?? 10) * 60 * 1000`
- Sum of `durationSeconds` across all phases = `totalPhaseSeconds`.
- Scale factor `k = roundBudgetMs / (totalPhaseSeconds * 1000)`.
- Effective duration of a phase = `phase.durationSeconds * k`.
- Use this scaled duration in `tickPhases` and in the participant timer (Phase 11).

When `fixed_durations`: use raw `phase.durationSeconds`.

When `off`: never auto-advance; require manual click (current behavior).

Expose this on the setup form (`components/admin/setup-form.tsx`) as a radio group under "Timing" — three options with a one-line hint each. Persist through `ExerciseConfig`.

### 10.4 Facilitator override preserved

- The existing `setDiscussionPhase(roundNumber, phaseIndex, 'set' | 'extend')` still works — facilitator can jump ahead or extend.
- Extending resets `phaseStartedAt` forward by 2m as today — auto-advance sees the new start time and waits.
- Add a "Pause auto-advance" button in the dashboard that flips a session-level flag `phaseAutoAdvancePaused: boolean` (in `SessionState`). When true, `tickPhases` skips its work.

### 10.5 Definition of done for Phase 10

- With `fit_to_round`, a 10-minute round with BOB phases (300/240/120 = 660s baseline) scales to 600s. Phases auto-advance at ~4:33, ~8:11, and stop at besluitvorming waiting for the facilitator.
- Manual "Volgende fase →" still works and resets the countdown.
- "Extend +2m" still adds two minutes.
- "Pause auto-advance" halts the ticker; unpausing resumes from where it was (do NOT skip the missed portion — reset `phaseStartedAt` on unpause to `Date.now() - alreadyElapsed`).

---

## Phase 11 — Participant phase timer & progress bar

### 11.1 New component `components/participant/phase-timer.tsx`

Client-only, purely presentational. Ticks locally with `setInterval(1s)` and reads `session.activeDiscussionPhase.phaseStartedAt` + effective phase duration (server tells us via a new derived field, see 11.3).

```tsx
"use client"
import { useEffect, useState } from "react"
import type { DiscussionPhase } from "@/lib/engine/types"

interface Props {
  phaseName: string
  phaseIndex: number
  totalPhases: number
  startedAt: number
  effectiveDurationSeconds: number
  paused?: boolean
}

export function PhaseTimer({ phaseName, phaseIndex, totalPhases, startedAt, effectiveDurationSeconds, paused }: Props) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (paused) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [paused])

  const elapsedMs = Math.max(0, now - startedAt)
  const totalMs = effectiveDurationSeconds * 1000
  const remainingMs = Math.max(0, totalMs - elapsedMs)
  const pct = totalMs > 0 ? Math.min(100, (elapsedMs / totalMs) * 100) : 0
  const min = Math.floor(remainingMs / 60000)
  const sec = Math.floor((remainingMs % 60000) / 1000).toString().padStart(2, "0")

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-widest">
        <span className="text-tt-accent">{phaseName}</span>
        <span className="text-tt-dim">Fase {phaseIndex + 1}/{totalPhases}</span>
        <span className={remainingMs < 30_000 ? "text-red-500" : "text-tt-bright"}>{min}:{sec}</span>
      </div>
      <div className="h-1 w-full overflow-hidden rounded-full bg-tt-border/40">
        <div
          className="h-full bg-tt-accent transition-[width] duration-1000 ease-linear"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
```

### 11.2 Also show total round progression across sub-phases

Under the phase bar, render a segmented indicator showing all sub-phases with the current one highlighted. Style:

```tsx
<div className="flex items-center gap-1">
  {phases.map((p, i) => (
    <div
      key={p.id}
      className={`h-0.5 flex-1 rounded-full ${
        i < phaseIndex ? "bg-tt-accent" :
        i === phaseIndex ? "bg-tt-accent/60" :
        "bg-tt-border/40"
      }`}
      title={p.name}
    />
  ))}
</div>
```

### 11.3 Server tells clients the effective duration

Extend the public state emitted by `toParticipantState` (and the facilitator equivalent) with:

```ts
currentDiscussionPhaseEffectiveSeconds?: number
currentDiscussionPhasePaused?: boolean
```

Computed once server-side using the same scaling formula as Phase 10.3. Clients render the timer from these fields — no client-side scaling logic.

### 11.4 Wire into `play-view.tsx`

Locate the block starting at "DISCUSSION PHASE — BOB/OODA phase prompt + stepper" (around line 990 based on current code). Just below the "Discussie — huidige fase" header row, mount `<PhaseTimer ... />` using the new state fields. Keep the existing prompt text; the timer sits on top or below the prompt (design choice — place it under the header, above the prompt).

Also render the segmented indicator (11.2) at the top of that block.

### 11.5 Definition of done for Phase 11

- Participants see the current phase name, remaining time (mm:ss), a progress bar that fills, and a segmented indicator showing all sub-phases with the current one highlighted.
- Countdown color changes to red under 30 seconds remaining.
- When auto-advance fires, the timer resets to the next phase seamlessly (no jump/blink).
- Facilitator's "Pause auto-advance" freezes the participant timer visually.
- Facilitator's "Extend +2m" adds two minutes to the participant countdown.

---

## Runtime-upgrade files summary (Phases 8–11)

### Files you ADD
```
lib/inject-routing.ts                          (Phase 8)
lib/team-roster.ts                              (Phase 8, if not colocated in inject-routing)
lib/inject-routing.test.ts                     (Phase 8, if test runner is configured)
components/participant/phase-timer.tsx         (Phase 11)
```

### Files you EDIT
```
lib/types.ts                                   (Phase 10 — ExerciseConfig.phaseAutoAdvance, SessionState.phaseAutoAdvancePaused, currentDiscussionPhaseEffectiveSeconds)
lib/session-store.ts                           (Phases 9, 10 — pushInject re-time, tickPhases, broadcastState wiring, toParticipantState fields)
components/participant/inject-feed.tsx         (Phase 8 — replace filter with router call)
components/participant/play-view.tsx           (Phases 8, 11 — pass participants prop, mount PhaseTimer + segmented indicator)
components/admin/inject-controls.tsx           (Phases 8, 9 — recipient chip, "Push earlier" state, "Delivered" state)
components/admin/control-dashboard.tsx         (Phase 10 — "Pause auto-advance" button — SMALL surgical edit; do not rewrite)
components/admin/setup-form.tsx                (Phase 10 — Timing radio group)
```

### Backwards compatibility (hard)
- Existing sessions without `phaseAutoAdvance` set default to `'fit_to_round'`. Verify no crash for older KV entries missing the field.
- Injects with existing `targetRoles` still route to those roles first — new fallback logic only kicks in when the direct hit is empty.
- Manual advance & extend still work.
- Graph-driven sessions (with `session.graph`) already skip the BOB/OODA overlay per existing code — `tickPhases` must respect that and no-op when `session.graph` is set.

## Execution order (full plan)

1. Phase 1 — `node-theme.ts`, `node-shell.tsx`. Type-check.
2. Phase 2 — refactor all six node files onto `NodeShell` + `channel-icons.ts`. Smoke test.
3. Phase 3 — canvas callbacks, keyboard, context menu, typed edges. Smoke test.
4. Phase 4 — palette rewrite. Smoke test.
5. Phase 5 — empty-state hint, minimap coloring, Cmd+K wizard. Smoke test.
6. Phase 6 — mount animation, cursor polish. Smoke test.
7. Phase 7 — inspector badge + action buttons. Smoke test.
8. Phase 8 — inject routing helper + wire into inject-feed + facilitator chip. Smoke test with 2-participant session.
9. Phase 9 — `pushInject` re-time + facilitator "Push earlier" UI. Smoke test.
10. Phase 10 — `tickPhases` + `phaseAutoAdvance` config + broadcast wiring + pause button. Smoke test full round.
11. Phase 11 — `PhaseTimer` component + participant view integration. Smoke test.
12. Final visual + functional pass in both light and dark mode. Ship.
