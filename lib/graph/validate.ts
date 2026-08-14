import type { DecisionNodeData, GraphNode, InjectNodeData, RoundNodeData, ScenarioGraph } from "./types"
import type { Role } from "@/lib/types"
import { ROLE_META } from "@/lib/types"
import { computeCoverage } from "@/lib/engine/supervision"
import { collectSetupInjectsForDecision, buildRoundIndexMap } from "./setup-injects"
import { ERROR_MESSAGES } from "@/lib/config/texts"

export interface GraphIssue {
  severity: "error" | "warning"
  nodeId?: string
  edgeId?: string
  message: string
}

export function validateGraph(graph: ScenarioGraph): GraphIssue[] {
  const issues: GraphIssue[] = []
  const nodesById = new Map<string, GraphNode>(graph.nodes.map(n => [n.id, n]))

  const starts = graph.nodes.filter(n => n.type === "start")
  if (starts.length === 0) {
    issues.push({ severity: "error", message: "Graph must have exactly one start node (found 0)." })
  } else if (starts.length > 1) {
    for (const s of starts) {
      issues.push({ severity: "error", nodeId: s.id, message: "Graph must have exactly one start node." })
    }
  }

  for (const edge of graph.edges) {
    if (!nodesById.has(edge.source)) {
      issues.push({ severity: "error", edgeId: edge.id, message: `Edge source "${edge.source}" does not exist.` })
    }
    if (!nodesById.has(edge.target)) {
      issues.push({ severity: "error", edgeId: edge.id, message: `Edge target "${edge.target}" does not exist.` })
    }
  }

  const outgoing = new Map<string, number>()
  for (const edge of graph.edges) {
    outgoing.set(edge.source, (outgoing.get(edge.source) ?? 0) + 1)
  }
  for (const node of graph.nodes) {
    if (node.type === "outcome" || node.type === "inject") continue
    if ((outgoing.get(node.id) ?? 0) === 0) {
      issues.push({
        severity: "error",
        nodeId: node.id,
        message: `${node.type} node has no outgoing edge.`,
      })
    }
  }

  if (starts.length === 1) {
    const reachable = new Set<string>()
    const stack: string[] = [starts[0].id]
    while (stack.length) {
      const id = stack.pop()!
      if (reachable.has(id)) continue
      reachable.add(id)
      for (const edge of graph.edges) {
        if (edge.source === id && !reachable.has(edge.target)) stack.push(edge.target)
      }
    }
    for (const node of graph.nodes) {
      if (!reachable.has(node.id)) {
        const hint = node.type === "outcome"
          ? "Connect it with a sequence or branch edge from a Round, Decision, or Special so participants can reach it."
          : node.type === "inject"
            ? "Connect it to a Round via an 'inject' edge (drag from the round's bottom handle)."
            : "Connect an incoming edge from another node so this can be reached from Start."
        issues.push({
          severity: "error",
          nodeId: node.id,
          message: `${labelFor(node.type)} node is unreachable from start. ${hint}`,
        })
      }
    }
  }

  const roundNodes = graph.nodes.filter(n => n.type === "round")
  if (roundNodes.length > 12) {
    issues.push({ severity: "warning", message: `Graph has ${roundNodes.length} rounds — this feels unwieldy.` })
  }
  for (const round of roundNodes) {
    const hasInjectChild = graph.edges.some(e => e.source === round.id && e.type === "inject")
    if (!hasInjectChild) {
      issues.push({
        severity: "warning",
        nodeId: round.id,
        message: "Round has no injects. Participants will only see the situation update, no messages. Drag Inject nodes onto the canvas and connect them from this round.",
      })
    }
  }

  for (const node of graph.nodes) {
    if (node.type !== "decision") continue
    const dd = node.data as DecisionNodeData
    const outgoing = graph.edges.filter(e => e.source === node.id)
    // Soft decisions (advancesGraph=false) only score — geen branch. Ze hoeven
    // maar één sequence-edge naar de volgende ronde te hebben. Skip alle
    // per-option edge checks voor dit soort decisions.
    if (dd.advancesGraph === false) {
      if (outgoing.length === 0) {
        issues.push({ severity: "error", nodeId: node.id, message: "Soft decision heeft geen uitgaande sequence-edge naar de volgende ronde." })
      }
      // Nog wél: als er randomly een handle-edge is die verwijst naar een verwijderde optie, dat is een echt bug.
      for (const edge of outgoing) {
        if (!edge.sourceHandle) continue
        if (!dd.options.some(o => o.id === edge.sourceHandle)) {
          issues.push({ severity: "error", nodeId: node.id, edgeId: edge.id, message: "Edge verwijst naar een verwijderde decision-optie." })
        }
      }
      continue
    }
    if (outgoing.length < 2) {
      issues.push({ severity: "error", nodeId: node.id, message: "Decision node must have at least 2 outgoing edges." })
    }
    for (const opt of dd.options) {
      const matched = graph.edges.find(e => e.source === node.id && e.sourceHandle === opt.id)
      if (!matched) {
        issues.push({ severity: "error", nodeId: node.id, message: `Decision option "${opt.label}" has no outgoing edge.` })
      }
    }
    for (const edge of outgoing) {
      if (!edge.sourceHandle) continue
      if (!dd.options.some(o => o.id === edge.sourceHandle)) {
        issues.push({ severity: "error", nodeId: node.id, edgeId: edge.id, message: "Edge references a removed decision option." })
      }
    }
  }

  if (hasCycle(graph)) {
    issues.push({ severity: "error", message: "Graph contains a cycle — only DAGs are supported." })
  }

  // Content checks — surfaced pre-publish
  for (const round of roundNodes) {
    const rd = round.data as RoundNodeData
    if (!rd.title?.trim()) {
      issues.push({ severity: "error", nodeId: round.id, message: "Round has no title." })
    }
    if (!rd.situation_update?.trim()) {
      issues.push({ severity: "warning", nodeId: round.id, message: "Round has no situation update — participants will see a blank briefing." })
    }
  }

  const injectNodes = graph.nodes.filter(n => n.type === "inject")
  for (const inj of injectNodes) {
    const d = inj.data as InjectNodeData
    if (!d.title?.trim()) {
      issues.push({ severity: "warning", nodeId: inj.id, message: "Inject has no title." })
    }
    if (!d.content?.trim()) {
      issues.push({ severity: "warning", nodeId: inj.id, message: "Inject has no content." })
    }
    // Phase 2 — classification is data-only maar wordt verwacht op elke inject.
    if (!d.classification) {
      issues.push({
        severity: "warning",
        nodeId: inj.id,
        message: ERROR_MESSAGES.missingClassification(d.title ?? inj.id.slice(0, 8)),
      })
    }
  }

  if (roundNodes.length === 0) {
    issues.push({ severity: "error", message: "Scenario has no rounds." })
  }

  // Coverage warnings
  const coverage = computeCoverage(graph)
  const uncovered = coverage.filter(c => c.coverageLevel === 'none')
  if (uncovered.length > 0) {
    issues.push({
      severity: "warning",
      message: `Coverage: ${uncovered.length} testgebieden onbedekt (${uncovered.map(c => c.meta.numberLabel).join(", ")}).`,
    })
  }

  // Regulatory-notification trigger: warn if no inject in the graph carries
  // triggersRegulatoryNotification. Without one, the meldplicht path never
  // opens during play.
  const anyTrigger = graph.nodes.some(n => {
    if (n.type !== 'inject' && n.type !== 'chaser') return false
    const injData = n.type === 'inject'
      ? (n.data as { triggersRegulatoryNotification?: boolean })
      : ((n.data as { inject?: { triggersRegulatoryNotification?: boolean } }).inject ?? {})
    return injData.triggersRegulatoryNotification === true
  })
  if (!anyTrigger) {
    issues.push({ severity: "warning", message: ERROR_MESSAGES.missingRegulatoryTrigger })
  }

  const outcomeNodes = graph.nodes.filter(n => n.type === "outcome")
  for (const o of outcomeNodes) {
    const incoming = graph.edges.filter(e => e.target === o.id)
    if (incoming.length === 0) {
      issues.push({ severity: "warning", nodeId: o.id, message: "Outcome heeft geen inkomende decision-paden — onbereikbaar bij spel." })
    }
    const od = o.data as { scoreRange?: { min?: number; max?: number } }
    if (!od.scoreRange || (od.scoreRange.min === undefined && od.scoreRange.max === undefined)) {
      issues.push({ severity: "warning", nodeId: o.id, message: "Outcome heeft geen scoreRange — de engine kan niet automatisch tussen outcomes kiezen op basis van cumulatieve score." })
    }
  }

  // ── Role × round coverage (Phase C) ──────────────────────────
  // For every authored role appearing anywhere in the graph, every round must
  // offer at least one option that role can choose. Missing cells are a hard
  // publish blocker — they cause silent "nothing to decide" for that seat.
  const authoredRoles = new Set<Role>()
  for (const round of roundNodes) {
    const rd = round.data as RoundNodeData
    for (const a of rd.roleActions ?? []) for (const r of a.allowedRoles) authoredRoles.add(r)
  }
  for (const n of graph.nodes) {
    if (n.type !== "decision") continue
    const dd = n.data as DecisionNodeData
    for (const o of dd.options) if (o.allowedRole) authoredRoles.add(o.allowedRole)
  }
  // For each authored role, check every round has at least one option for them.
  const decisionsByRoundNode = new Map<string, DecisionNodeData[]>()
  for (const edge of graph.edges) {
    if (edge.type !== "sequence") continue
    const target = nodesById.get(edge.target)
    if (target?.type === "decision") {
      const list = decisionsByRoundNode.get(edge.source) ?? []
      list.push(target.data as DecisionNodeData)
      decisionsByRoundNode.set(edge.source, list)
    }
  }
  for (const round of roundNodes) {
    const rd = round.data as RoundNodeData
    const roundHasOptionFor = new Set<Role>()
    for (const a of rd.roleActions ?? []) for (const r of a.allowedRoles) roundHasOptionFor.add(r)
    for (const dd of decisionsByRoundNode.get(round.id) ?? []) {
      for (const o of dd.options) if (o.allowedRole) roundHasOptionFor.add(o.allowedRole)
    }
    for (const role of authoredRoles) {
      if (!roundHasOptionFor.has(role)) {
        issues.push({
          severity: "error",
          nodeId: round.id,
          message: `Rol "${ROLE_META[role]?.label ?? role}" heeft geen beslisoptie in ronde "${rd.title || round.id.slice(0, 8)}". Elke rol die ergens in het scenario voorkomt moet in elke ronde iets te beslissen hebben.`,
        })
      }
    }
  }

  // ── Decision options must carry outcomeVector (Phase E scoring) ──
  for (const n of graph.nodes) {
    if (n.type !== "decision") continue
    const dd = n.data as DecisionNodeData
    for (const o of dd.options) {
      if (o.implicit) continue  // "geen besluit" — implicit vector handled by engine
      if (!o.outcomeVector) {
        issues.push({
          severity: "warning",
          nodeId: n.id,
          message: `Optie "${o.label}" heeft geen outcomeVector — zonder trade-off op de 6 dimensies vervalt de scoring naar de qualityRank-fallback.`,
        })
      } else {
        // Sanity check on values.
        const dims: Array<'CONT' | 'FOR' | 'BC' | 'JUR' | 'VER' | 'KOS'> = ['CONT', 'FOR', 'BC', 'JUR', 'VER', 'KOS']
        for (const d of dims) {
          const v = o.outcomeVector[d]
          if (typeof v !== "number") {
            issues.push({ severity: "error", nodeId: n.id, message: `Optie "${o.label}" mist een numerieke waarde op dimensie ${d}.` })
          } else if (v < -3 || v > 3) {
            issues.push({ severity: "warning", nodeId: n.id, message: `Optie "${o.label}" — waarde ${v} op ${d} valt buiten de aanbevolen −2..+2 range.` })
          }
        }
      }
    }
  }

  // ── Setup-inject → decision link (Phase 1) ──────────────────
  // Every DecisionNode should have at least one inject with
  // setsUpDecisionNodeId === decisionId in the same or immediately preceding
  // round. Missing = warning (auteur mag toch publiceren; het is een gap in de
  // storyline, geen technisch defect).
  const roundMap = buildRoundIndexMap(graph)
  for (const n of graph.nodes) {
    if (n.type !== "decision") continue
    const setups = collectSetupInjectsForDecision(graph, n.id, roundMap)
    if (setups.length === 0) {
      const dd = n.data as DecisionNodeData
      const prompt = dd.prompt?.trim() || n.id.slice(0, 8)
      issues.push({
        severity: "warning",
        nodeId: n.id,
        message: `Beslissing "${prompt}" heeft geen setup-inject in dezelfde of vorige ronde — deelnemers kunnen deze keuze niet aan zien komen.`,
      })
    }
  }

  // ── Melding-moment integrity (Phase D) ──────────────────────
  for (const round of roundNodes) {
    const rd = round.data as RoundNodeData
    for (const moment of rd.meldingMoments ?? []) {
      if (moment.types.length === 0) {
        issues.push({ severity: "error", nodeId: round.id, message: `Melding-moment "${moment.id}" heeft geen types.` })
      }
      for (const t of moment.types) {
        if (t.triggersInjectId) {
          const injectExists = graph.nodes.some(n => n.id === t.triggersInjectId && n.type === "inject")
          if (!injectExists) {
            issues.push({
              severity: "error",
              nodeId: round.id,
              message: `Melding-type "${t.label}" verwijst naar inject "${t.triggersInjectId}" die niet bestaat.`,
            })
          }
        }
      }
    }
  }

  for (const n of graph.nodes) {
    if (n.type !== 'special') continue
    const sd = n.data as { type?: string }
    if (sd.type === 'ir_retainer_activation') {
      if (!graph.irRetainerProfile) {
        issues.push({ severity: "warning", nodeId: n.id, message: "IR-retainer activation node zonder retainer profile op de graph." })
      }
    }
  }

  // Phase 3 — playbook-gap warnings. A gap the author claimed the role has
  // should be referenced somewhere in the exercise (inject content, decision
  // option lessonLearned, or round situation update). Case-insensitive
  // substring match on the shortest content-bearing word (>=4 chars) in the
  // gap phrase. If nothing matches, warn — the author claimed a gap without
  // exercising it.
  const briefings = graph.roleBriefings
  if (briefings) {
    const haystack = collectExerciseCorpus(graph).toLowerCase()
    for (const [role, briefing] of Object.entries(briefings)) {
      if (!briefing) continue
      for (const gap of briefing.playbookGaps ?? []) {
        if (!gap.trim()) continue
        const gapLower = gap.toLowerCase()
        // Use every content word ≥4 chars as an OR-match set. If none appears
        // in the corpus, we consider the gap unreferenced.
        const words = gapLower.split(/[^a-zàáäâèéëêìíïîòóöôùúüû0-9]+/i).filter(w => w.length >= 4)
        if (words.length === 0) continue
        const anyMatch = words.some(w => haystack.includes(w))
        if (!anyMatch) {
          const roleLabel = ROLE_META[role as Role]?.label ?? role
          issues.push({
            severity: "warning",
            message: `Playbook-gap voor rol "${roleLabel}" ("${gap}") komt nergens terug in injects, lessen of situatie-updates. Ofwel de scenariocontent oefent deze gap niet, ofwel de gap moet anders geformuleerd.`,
          })
        }
      }
    }
  }

  return issues
}

function collectExerciseCorpus(graph: ScenarioGraph): string {
  const parts: string[] = []
  for (const n of graph.nodes) {
    if (n.type === "inject") {
      const d = n.data as InjectNodeData
      if (d.title) parts.push(d.title)
      if (d.content) parts.push(d.content)
    } else if (n.type === "round") {
      const d = n.data as RoundNodeData
      if (d.situation_update) parts.push(d.situation_update)
      if (d.facilitatorNotes) {
        parts.push(d.facilitatorNotes.discussionGoal ?? "")
        parts.push(...(d.facilitatorNotes.keyQuestions ?? []))
        parts.push(...(d.facilitatorNotes.hints ?? []))
        parts.push(...(d.facilitatorNotes.expectedDecisions ?? []))
        parts.push(...(d.facilitatorNotes.redFlags ?? []))
      }
    } else if (n.type === "decision") {
      const d = n.data as DecisionNodeData
      for (const o of d.options) {
        if (o.label) parts.push(o.label)
        if (o.lessonLearned) parts.push(o.lessonLearned)
        if (o.facilitatorCommentary) parts.push(o.facilitatorCommentary)
      }
    }
  }
  return parts.join(" \n ")
}

function labelFor(type: string): string {
  return type.charAt(0).toUpperCase() + type.slice(1)
}

function hasCycle(graph: ScenarioGraph): boolean {
  const adjacency = new Map<string, string[]>()
  for (const edge of graph.edges) {
    const list = adjacency.get(edge.source) ?? []
    list.push(edge.target)
    adjacency.set(edge.source, list)
  }
  const WHITE = 0, GRAY = 1, BLACK = 2
  const color = new Map<string, number>()
  for (const node of graph.nodes) color.set(node.id, WHITE)

  function visit(id: string): boolean {
    color.set(id, GRAY)
    for (const next of adjacency.get(id) ?? []) {
      const c = color.get(next) ?? WHITE
      if (c === GRAY) return true
      if (c === WHITE && visit(next)) return true
    }
    color.set(id, BLACK)
    return false
  }

  for (const node of graph.nodes) {
    if ((color.get(node.id) ?? WHITE) === WHITE) {
      if (visit(node.id)) return true
    }
  }
  return false
}
