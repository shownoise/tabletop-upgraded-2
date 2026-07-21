# PROMPT — Scenario Builder (drag-and-drop node graph)

Feed this whole file to Claude Code inside `/Users/pieterbaspluijmaekers/tabletop-upgraded-2`. Implement the phases in order. Do not skip ahead; each phase compiles and runs before starting the next.

## Goal

Add a visual, drag-and-drop **scenario builder** at `/admin/builder` where the facilitator authors a scenario as a node graph (rounds, injects, decisions, specials, outcomes) with edges between them. Decision and Special nodes produce **branches** — the scenario can go multiple ways based on participant choices or facilitator triggers. Existing linear scenarios remain fully functional (backwards compatible).

Reference design document: `/Users/pieterbaspluijmaekers/Documents/Obsidian Vault/Tabletop App/Scenario Builder - Ontwerp.md`. Use it as spec if this file is silent on a detail.

## Library

Use **@xyflow/react** (the current, actively-maintained package — successor of `react-flow-renderer`). Install:

```
pnpm add @xyflow/react
```

Do not add any other node-graph, drag-drop, or state library. Use React Flow's built-in state (`useNodesState`, `useEdgesState`) plus a `useReducer` in the builder page.

## Phase 1 — Linear MVP (start here)

Deliver a working builder that produces a linear scenario (no branching yet), saves/loads, and can be published to run a session.

### 1.1 Types

Create `lib/graph/types.ts` with:

```ts
import type { Inject, RoleAction, LearningObjective, FacilitatorNotes, SpecialType, Role, ScenarioType } from "@/lib/types"

export type GraphNodeType = 'start' | 'round' | 'inject' | 'decision' | 'special' | 'outcome'
export type GraphEdgeType = 'sequence' | 'branch' | 'outcome' | 'inject'

export interface StartNodeData { kind: 'start' }

export interface RoundNodeData {
  kind: 'round'
  title: string
  situation_update: string
  timerMinutes?: number
  roleActions?: RoleAction[]
  learningObjectives?: LearningObjective[]
  facilitatorNotes?: FacilitatorNotes
}

export interface InjectNodeData extends Omit<Inject, 'id'> {
  kind: 'inject'
}

export interface DecisionNodeData {
  kind: 'decision'
  prompt: string
  measuredBy: 'participant_choice' | 'facilitator_trigger'
  triggerRole?: Role
  options: Array<{
    id: string           // stable — used as edge sourceHandle
    label: string
    roleActionId?: string
  }>
}

export interface SpecialNodeData {
  kind: 'special'
  type: SpecialType
  assignedRole?: Role
  thresholds: Array<{
    id: string           // stable — used as edge sourceHandle
    label: string
    predicate: { op: '<' | '<=' | '>' | '>=' | '==', value: number }
  }>
}

export interface OutcomeNodeData {
  kind: 'outcome'
  key: string
  label: string
  narrative: string
  scoreImpact?: number
}

export type GraphNodeData =
  | StartNodeData | RoundNodeData | InjectNodeData
  | DecisionNodeData | SpecialNodeData | OutcomeNodeData

export interface GraphNode {
  id: string
  type: GraphNodeType
  position: { x: number; y: number }
  data: GraphNodeData
}

export interface GraphEdge {
  id: string
  source: string
  target: string
  sourceHandle?: string
  targetHandle?: string
  type: GraphEdgeType
  label?: string
}

export interface ScenarioGraph {
  id: string
  name: string
  version: number
  scenarioType: ScenarioType
  nodes: GraphNode[]
  edges: GraphEdge[]
  createdAt: number
  updatedAt: number
}
```

Do NOT modify `lib/types.ts`. Import the shared types (`Inject`, `RoleAction`, `LearningObjective`, etc.) from there.

### 1.2 Compile graph → Scenario

Create `lib/graph/compile.ts` exporting:

```ts
import type { Scenario, Round } from "@/lib/types"
import type { ScenarioGraph } from "./types"

export function compileLinearGraph(graph: ScenarioGraph): Scenario
```

Behavior for Phase 1 (linear-only):
- Find the single `start` node; if 0 or >1 → throw `Error('Graph must have exactly one start node')`.
- Walk `sequence` edges from start; every `round` node becomes a `Round` in output order (`round_number = 1..N`).
- `inject` nodes hanging off a round (via `inject` edge) become that round's `injects[]`. Assign stable ids `${roundNodeId}-inj-${index}`.
- Ignore `decision`, `special`, `outcome` nodes in Phase 1 (log a console warning via existing timeline system if any are present — do NOT use `console.log`; use `console.warn` for developer-facing warnings only).
- `scenario_title` = graph name uppercased with `OPERATIE` prefix if not already. `scenario_summary` = first round's `situation_update` (or empty if none).

### 1.3 Storage

Add functions to `lib/session-store.ts`:

```ts
export async function saveScenarioGraph(graph: ScenarioGraph): Promise<void>
export async function loadScenarioGraph(id: string): Promise<ScenarioGraph | null>
export async function listScenarioGraphs(ownerId?: string): Promise<ScenarioGraph[]>
export async function deleteScenarioGraph(id: string): Promise<void>
```

KV keys:
- `scenario-graph:<id>` for the graph
- `scenario-graph-index` — Set<string> of all graph ids (for `listScenarioGraphs`)

### 1.4 API routes

Create `app/api/scenario-graph/route.ts`:

- `GET /api/scenario-graph` → `{ ok: true, graphs: ScenarioGraph[] }`
- `POST /api/scenario-graph` — body `ScenarioGraph` → validate with zod, save via `saveScenarioGraph`, return `{ ok:true, id }`
- `DELETE /api/scenario-graph?id=...` → delete

Standard headers: `dynamic = "force-dynamic"`, `runtime = "nodejs"`. Facilitator auth required.

### 1.5 Builder page

Create `app/admin/builder/page.tsx` — client component (`'use client'` at top). Do a dynamic import if React Flow complains about SSR:

```tsx
import dynamic from "next/dynamic"
const BuilderCanvas = dynamic(() => import("@/components/admin/builder/canvas"), { ssr: false })
```

### 1.6 Builder components

Create `components/admin/builder/`:

```
canvas.tsx              — main React Flow canvas with palette + inspector
palette.tsx             — draggable node chips (Round / Inject / Outcome for Phase 1)
inspector.tsx           — right sidebar; form for the selected node's data
toolbar.tsx             — top bar: Save, Load, New, Validate, Publish
nodes/
  start-node.tsx        — visual for Start
  round-node.tsx        — visual for Round
  inject-node.tsx       — visual for Inject
  outcome-node.tsx      — visual for Outcome
```

Styling:
- Follow the existing Tailwind + shadcn conventions: `bg-background`, `text-foreground`, `border-border`.
- Round nodes: 280px wide card with title, situation excerpt, inject count.
- Inject node: 220px wide, channel icon + first 60 chars of content.
- Outcome node: 220px wide, colored border by `scoreImpact` sign (green ≥0, red <0, gray = undef).
- Start node: small pill.

Palette drag:
- Chip has `onDragStart` setting `event.dataTransfer.setData('application/scenario-node-type', nodeType)`.
- Canvas `onDrop` reads that mime type, translates client coords to flow coords with `useReactFlow().screenToFlowPosition`, and inserts a new node with default `data` per type.

Inspector:
- Uses `react-hook-form` + `zod` (already installed).
- On node selection → load its `data` into the form. On form submit → dispatch update via `setNodes`.
- Include an "Add inject" quick action inside a Round node's inspector that inserts an Inject node next to it and auto-connects an `inject` edge.

Toolbar:
- **Save** → POST current graph (or PATCH if id already set) to `/api/scenario-graph`.
- **Load** → dialog listing graphs from GET.
- **New** → confirm-clear, then reset canvas to `{ nodes: [startNode], edges: [] }`.
- **Validate** → run `validateGraph(graph)` (see 1.8) and show issues in a toast/dialog.
- **Publish** → validate → compile via `compileLinearGraph` → open the existing setup form pre-filled at `/admin?graphId=<id>` (the create route will detect `graphId` and skip AI generation, using the compiled Scenario directly).

### 1.7 Setup form integration

Modify `components/admin/setup-form.tsx`:
- If URL has `?graphId=<id>`, show a banner "Using scenario graph: {graph.name}" and hide AI-intensity selector (force `aiIntensity=off`).
- On submit, include `graphId` in the POST body.

Modify `app/api/session/create/route.ts`:
- If `body.graphId`, load the graph via `loadScenarioGraph`, compile via `compileLinearGraph`, use that as the `scenario` instead of calling the AI/static generator. Store `config.graphId` in the session config for later reference.
- If graph load fails → 400 with `error: "Scenario graph not found"`. No silent fallback.

Add `graphId?: string` to `ExerciseConfig` in `lib/types.ts`.

### 1.8 Validation

Create `lib/graph/validate.ts` exporting:

```ts
export interface GraphIssue { severity: 'error'|'warning'; nodeId?: string; edgeId?: string; message: string }
export function validateGraph(graph: ScenarioGraph): GraphIssue[]
```

Phase 1 rules (all errors):
- Exactly one `start` node.
- Every non-outcome, non-inject node must have ≥1 outgoing edge.
- No orphan nodes (unreachable from Start).
- All edge `source`/`target` ids exist in nodes.

Warnings:
- Round with 0 inject children.
- More than 12 rounds (feels unwieldy).

### 1.9 Definition of done for Phase 1

- `pnpm exec tsc --noEmit` passes (aside from any pre-existing errors).
- User can: open `/admin/builder`, drag a Round + 2 Injects, connect them, save, reload the page, load the graph, click Publish, go through setup form, start a session, see rounds and injects render correctly in the participant view.
- Existing sessions without `graphId` still work exactly as before.

---

## Phase 2 — Branching (do after Phase 1 ships)

### 2.1 Enable Decision nodes

- Add `decision-node.tsx` to `components/admin/builder/nodes/`.
- Decision node renders 1..N output handles (one per `data.options[i]`) — use React Flow's `Handle` with `id={option.id}` on the right side.
- Inspector for Decision: form to edit prompt, add/remove options (`{ id, label, roleActionId? }`), pick `measuredBy` and `triggerRole`.
- Adding an option must create a new handle immediately (managed via re-render).

### 2.2 Runtime graph state

Add to `SessionState` in `lib/types.ts`:

```ts
graph?: ScenarioGraph
graphState?: {
  currentNodeId: string
  pathHistory: string[]
  branchLog: Array<{
    nodeId: string
    choseHandle: string
    trigger: 'participant_decision' | 'facilitator_manual' | 'special_score'
    triggeredAt: number
  }>
}
```

### 2.3 Traversal engine

Create `lib/graph/engine.ts`:

```ts
export interface StepResult {
  nextNodeId: string | null       // null = ended
  outputs: Array<
    | { kind: 'push_inject'; inject: Inject }
    | { kind: 'start_round'; round: Round }
    | { kind: 'trigger_special'; type: SpecialType; assignedRole?: Role }
    | { kind: 'set_outcome'; outcome: OutcomeNodeData }
  >
}

export function stepFromNode(
  graph: ScenarioGraph,
  currentNodeId: string,
  trigger: { kind: 'auto' } | { kind: 'facilitator_next' } | { kind: 'decision_made'; handle: string } | { kind: 'special_completed'; score: number }
): StepResult
```

Rules:
- From `start` on `auto` → follow sequence edge.
- From `round` on `facilitator_next` → follow sequence edge; if multiple, throw (Phase 2 does not allow multi-out from Round without a Decision — Decision must be its own node).
- From `decision` on `decision_made` → follow edge with matching `sourceHandle`.
- From `special` on `special_completed` → evaluate `thresholds` in order, return edge matching first true predicate.
- `inject` nodes are followed automatically (emit `push_inject` + move on).
- `outcome` → emit `set_outcome`, `nextNodeId = null` (session ends).

### 2.4 Wire engine into session-store

- On `start_session` → `graphState = { currentNodeId: startId, pathHistory: [startId], branchLog: [] }`, immediately step and apply outputs (e.g. first round starts).
- On `next_round` action → step with `facilitator_next`.
- On `submit_decision` → if current node is a `decision` and the submitted `actionId` matches an option's `roleActionId`, step with `decision_made`. Otherwise treat as normal decision within a Round.
- On special completion → step with `special_completed`.
- Applying outputs mutates session (add round to `scenario.rounds[]` as it appears, or maintain a separate `visibleRounds` view — see 2.5).

### 2.5 Participant view

Participants keep seeing a linear `Scenario`, but rounds appear one at a time as the graph reveals them:
- Keep `scenario.rounds[]` growing as new Round nodes are entered.
- `currentRound = scenario.rounds.length - 1` (last revealed).
- `toParticipantState` continues to strip facilitator-only fields.

### 2.6 Branch UI in dashboard

`components/admin/control-dashboard.tsx` — add a small "Graph path" panel showing the trace so far and the current node. When a Decision node is reached and `measuredBy='facilitator_trigger'`, show buttons to pick a branch manually.

### 2.7 Validation additions

Extend `validateGraph`:
- Decision node must have ≥2 outgoing edges, one per `option`.
- Every option must have a corresponding edge with `sourceHandle=option.id`; and vice versa.
- No cycles for Phase 2 (DAG only). Optional cycle support is out of scope.

---

## Phase 3 — Specials + outcomes

### 3.1 Special node

- Add `special-node.tsx` with output handles per `data.thresholds[i]`.
- Inspector: pick `SpecialType`, `assignedRole`, define thresholds (`label`, `predicate`).

### 3.2 Outcome node

- Add `outcome-node.tsx`.
- Inspector: `key`, `label`, `narrative` (textarea), `scoreImpact`.
- When engine hits an outcome: session `status = 'ended'`, `session.report` includes `outcome.narrative`.

### 3.3 Rapport

`components/admin/report-view.tsx`:
- Show taken path (list of node titles).
- Show final outcome prominently.
- Show branches taken with `branchLog` details.

---

## Phase 4 — AI polish

### 4.1 AI-fill

Add button on empty Round nodes: "AI-fill". Calls a new `POST /api/scenario-graph/ai-fill` route with `{ graphId, nodeId, context }`. Server uses existing prompt pipeline from `lib/scenario/prompts.ts`, returns updated node data.

### 4.2 AI-suggest branches

Button on Decision node "Suggest options": returns 2-3 plausible options given the current round context.

### 4.3 Validators

Run existing `lib/validators/*` on the compiled Scenario before Publish. Show issues in the toolbar's Validate dialog.

---

## File map (what you'll add)

```
lib/graph/
  types.ts              — Phase 1
  compile.ts            — Phase 1 (linear compiler)
  validate.ts           — Phase 1
  engine.ts             — Phase 2 (traversal)

app/admin/builder/
  page.tsx              — Phase 1

app/api/scenario-graph/
  route.ts              — Phase 1 (GET/POST/DELETE)
  ai-fill/route.ts      — Phase 4

components/admin/builder/
  canvas.tsx            — Phase 1
  palette.tsx           — Phase 1
  inspector.tsx         — Phase 1
  toolbar.tsx           — Phase 1
  nodes/
    start-node.tsx      — Phase 1
    round-node.tsx      — Phase 1
    inject-node.tsx     — Phase 1
    outcome-node.tsx    — Phase 1 (visual only, engine ignores in P1)
    decision-node.tsx   — Phase 2
    special-node.tsx    — Phase 3
```

## Files you WILL edit (small surgical changes)

- `lib/types.ts` — add `graphId?: string` to `ExerciseConfig`; add `graph?` and `graphState?` to `SessionState` (Phase 2).
- `lib/session-store.ts` — add graph CRUD functions (Phase 1); wire engine into mutations (Phase 2).
- `app/api/session/create/route.ts` — accept `graphId`, load+compile instead of generating (Phase 1).
- `components/admin/setup-form.tsx` — detect `?graphId=`, banner + force `aiIntensity=off` (Phase 1).
- `components/admin/control-dashboard.tsx` — add branch panel (Phase 2).
- `components/admin/report-view.tsx` — add path + outcome (Phase 3).
- `package.json` — add `@xyflow/react` (Phase 1).

## Constraints

- **Do not** create a design doc, README, or CHANGELOG for this feature. Design lives in the Obsidian vault; this file IS the plan.
- **Do not** add extra dependencies beyond `@xyflow/react`.
- **Do not** rewrite `control-dashboard.tsx` — it's 800+ lines; edit surgically.
- **Do not** break backwards compat: sessions without `graphId` must behave exactly as before.
- **Do not** touch the AI pipeline in Phase 1 — Publish uses the compiled Scenario directly, not the AI.
- **No comments** in new files except non-obvious WHY (per project convention).
- **No console.log** — use the timeline event system if you need runtime tracing.
- **Every phase ends with** `pnpm exec tsc --noEmit` clean (aside from pre-existing errors) and manual smoke test in the browser.
- **Use pnpm** (`packageManager: pnpm@10.0.0`).

## Execution order (checklist)

Phase 1:
1. `pnpm add @xyflow/react`
2. `lib/graph/types.ts`
3. `lib/graph/validate.ts`
4. `lib/graph/compile.ts`
5. Graph CRUD in `lib/session-store.ts`
6. `app/api/scenario-graph/route.ts`
7. Builder components (palette → nodes → inspector → toolbar → canvas)
8. `app/admin/builder/page.tsx`
9. Wire `graphId` into `ExerciseConfig`, setup-form, create route
10. Type-check + manual smoke test
11. Ship Phase 1

Then Phase 2, 3, 4 as separate sessions. Don't lump them.
