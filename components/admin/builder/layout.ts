import type { Edge, Node } from "@xyflow/react"

// Column width fits a 300px round card + ~40px gap.
const COL_WIDTH = 360
const SPINE_ROW = 220   // vertical center of the spine
const INJECT_ROW_STEP = 180
const DECISION_ROW_STEP = 420  // decisions sit below injects in the same column as their round
const CHASER_ROW = SPINE_ROW - 200  // chasers above the spine so they read as "fires from"
const PAD_X = 80
const PAD_Y = 40
const INJECT_STAGGER = 200

// Nodes that form the main left-to-right story spine.
// Decisions used to be spine-columns of their own; they now stack UNDER their
// preceding round (see collapseDecisionsIntoRounds below) so a round visually
// contains its situation, injects, and decision.
const SPINE_TYPES = new Set(["start", "round", "decision", "special", "outcome"])
const RANKABLE_SPINE_TYPES = new Set(["start", "round", "special", "outcome"])
// Edge kinds that count towards the spine ordering.
const SPINE_EDGE_KINDS = new Set(["sequence", "branch", "outcome"])

interface RFNode extends Node { type?: string }

interface EdgeKindOnly { source: string; target: string; sourceHandle?: string | null; data?: { kind?: string } | null }

function edgeKind(e: EdgeKindOnly): string {
  const k = (e.data as { kind?: string } | undefined)?.kind
  if (k) return k
  return e.sourceHandle === "injects" ? "inject" : "sequence"
}

// Longest-path rank for RANKABLE spine nodes (everything except decisions).
// Decisions inherit their preceding round's rank so they stack in the same
// column visually — the round "contains" its decision.
function computeSpineRanks(nodes: RFNode[], edges: EdgeKindOnly[]): Map<string, number> {
  const rank = new Map<string, number>()
  const decisionSet = new Set(nodes.filter(n => n.type === "decision").map(n => n.id))
  const rankable = nodes.filter(n => RANKABLE_SPINE_TYPES.has(n.type ?? ""))
  for (const n of rankable) rank.set(n.id, 0)

  const allSpineEdges = edges.filter(e => SPINE_EDGE_KINDS.has(edgeKind(e)))

  // Build a "logical" edge set that skips over decisions. If round R → decision D → next-node N,
  // we treat this as R → N for ranking purposes. That way N ends up in R's next column,
  // not two columns away.
  const logicalEdges: EdgeKindOnly[] = []
  for (const e of allSpineEdges) {
    if (decisionSet.has(e.source)) continue  // handled via bypass below
    if (decisionSet.has(e.target)) {
      // Find outgoing edges from this decision that lead to a non-decision.
      const decisionOut = allSpineEdges.filter(x => x.source === e.target && !decisionSet.has(x.target))
      for (const dOut of decisionOut) {
        logicalEdges.push({ source: e.source, target: dOut.target, sourceHandle: null, data: null })
      }
    } else {
      logicalEdges.push(e)
    }
  }

  let changed = true
  let guard = 0
  while (changed && guard++ < nodes.length + 2) {
    changed = false
    for (const e of logicalEdges) {
      if (!rank.has(e.source) || !rank.has(e.target)) continue
      const next = (rank.get(e.source) ?? 0) + 1
      if (next > (rank.get(e.target) ?? 0)) {
        rank.set(e.target, next)
        changed = true
      }
    }
  }

  // Assign each decision the rank of its preceding round (via sequence edge).
  // If no sequence-parent found, drop it into rank 0 as an orphan.
  for (const decId of decisionSet) {
    const parent = allSpineEdges.find(e => e.target === decId && rank.has(e.source))
    rank.set(decId, parent ? (rank.get(parent.source) ?? 0) : 0)
  }
  return rank
}

// Position the spine into columns; within a column, sort by existing y so the
// author's hand-drawn ordering is preserved as a tie-breaker. Decisions in a
// column are stacked below the spine center (below any injects) so a round
// visually contains its downstream decision.
function layoutSpine(nodes: RFNode[], rank: Map<string, number>): Map<string, { x: number; y: number }> {
  const cols: Record<number, RFNode[]> = {}
  for (const n of nodes) {
    if (!rank.has(n.id)) continue
    const r = rank.get(n.id)!
    ;(cols[r] ??= []).push(n)
  }
  const positions = new Map<string, { x: number; y: number }>()
  for (const [rStr, arr] of Object.entries(cols)) {
    const r = Number(rStr)
    const decisions = arr.filter(n => n.type === "decision")
    const spineOthers = arr.filter(n => n.type !== "decision")
    const sorted = [...spineOthers].sort((a, b) => a.position.y - b.position.y)
    const totalHeight = (sorted.length - 1) * 200
    const startY = SPINE_ROW - totalHeight / 2
    sorted.forEach((n, i) => {
      positions.set(n.id, { x: PAD_X + r * COL_WIDTH, y: PAD_Y + startY + i * 200 })
    })
    // Decisions stack below the spine, anchored to the first round in this column.
    const anchor = sorted[0]
      ? positions.get(sorted[0].id)!
      : { x: PAD_X + r * COL_WIDTH, y: PAD_Y + SPINE_ROW }
    decisions.forEach((n, i) => {
      positions.set(n.id, { x: anchor.x, y: anchor.y + DECISION_ROW_STEP + i * 200 })
    })
  }
  return positions
}

// Attach injects under their source-round (via the inject-typed edge).
// Multiple injects on the same round fan out horizontally.
function layoutInjects(
  nodes: RFNode[],
  edges: EdgeKindOnly[],
  positions: Map<string, { x: number; y: number }>,
) {
  const byRound: Record<string, string[]> = {}
  for (const e of edges) {
    if (edgeKind(e) !== "inject") continue
    (byRound[e.source] ??= []).push(e.target)
  }
  for (const [roundId, injectIds] of Object.entries(byRound)) {
    const anchor = positions.get(roundId)
    if (!anchor) continue
    const totalWidth = (injectIds.length - 1) * INJECT_STAGGER
    injectIds.forEach((injId, i) => {
      const injNode = nodes.find(n => n.id === injId)
      if (!injNode || injNode.type !== "inject") return
      positions.set(injId, {
        x: anchor.x - totalWidth / 2 + i * INJECT_STAGGER,
        y: anchor.y + INJECT_ROW_STEP,
      })
    })
  }
}

// Chasers are usually not wired via edges. Pin them above the ronde whose
// index matches `condition.afterRoundNumber` (rounds are ranked left-to-right
// so we can derive the round's rank by counting round-typed nodes in spine
// rank order). If no match, drop them in an overflow lane on the far right.
function layoutChasers(
  nodes: RFNode[],
  rank: Map<string, number>,
  positions: Map<string, { x: number; y: number }>,
) {
  const rounds = nodes
    .filter(n => n.type === "round" && rank.has(n.id))
    .sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0))
  const roundByIndex = new Map<number, string>()
  rounds.forEach((r, i) => roundByIndex.set(i + 1, r.id))

  const chasers = nodes.filter(n => n.type === "chaser")
  let overflowCol = Math.max(0, ...Array.from(rank.values())) + 1
  let overflowRow = 0
  const chaserSlotByRound = new Map<string, number>()

  for (const c of chasers) {
    const data = c.data as { condition?: { afterRoundNumber?: number } } | undefined
    const roundIdx = data?.condition?.afterRoundNumber
    const roundId = typeof roundIdx === "number" ? roundByIndex.get(roundIdx) : undefined
    const anchor = roundId ? positions.get(roundId) : undefined
    if (anchor) {
      const slot = (chaserSlotByRound.get(roundId!) ?? 0)
      chaserSlotByRound.set(roundId!, slot + 1)
      positions.set(c.id, { x: anchor.x + slot * INJECT_STAGGER, y: anchor.y + CHASER_ROW })
    } else {
      positions.set(c.id, { x: PAD_X + overflowCol * COL_WIDTH, y: PAD_Y + overflowRow * 200 })
      overflowRow++
    }
  }
}

// Fallback: any node the ranking never touched (orphans) gets dropped into a
// grid on the far right so the author can find and re-wire it.
function layoutOrphans(nodes: RFNode[], positions: Map<string, { x: number; y: number }>) {
  const maxX = Math.max(PAD_X, ...Array.from(positions.values()).map(p => p.x))
  let row = 0
  for (const n of nodes) {
    if (positions.has(n.id)) continue
    positions.set(n.id, { x: maxX + COL_WIDTH, y: PAD_Y + row * 200 })
    row++
  }
}

// Public: recompute positions for every node in the flow.
// Preserves all data/edges; only `position` is rewritten.
export function autoLayout(nodes: RFNode[], edges: Edge[]): RFNode[] {
  if (nodes.length === 0) return nodes
  const edgeInput: EdgeKindOnly[] = edges.map(e => ({ source: e.source, target: e.target, sourceHandle: e.sourceHandle, data: e.data as { kind?: string } | null }))
  const rank = computeSpineRanks(nodes, edgeInput)
  const positions = layoutSpine(nodes, rank)
  layoutInjects(nodes, edgeInput, positions)
  layoutChasers(nodes, rank, positions)
  layoutOrphans(nodes, positions)
  return nodes.map(n => {
    const p = positions.get(n.id)
    return p ? { ...n, position: p } : n
  })
}
