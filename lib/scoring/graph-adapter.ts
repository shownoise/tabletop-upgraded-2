import type {
  ChaserNodeData, DecisionNodeData, GraphNode, InjectNodeData,
  RoundNodeData, ScenarioGraph,
} from '@/lib/graph/types'
import { toSpecRole, domainsFor, APP_ROLE_TO_SPEC } from '@/lib/graph/role-adapter'
import type {
  RoleAction, Role, SessionState, SubmittedDecision,
  Inject as AppInject, TimelineEvent,
} from '@/lib/types'
import { NO_DECISION_FALLBACK_VECTOR, OUTCOME_DIMENSIONS, type Domain, type OutcomeDimension } from './constants'
import type {
  DecisionPointSpec, ExerciseEvent, ExerciseInput, InjectSpec,
  Mode, OptionSpec, RoundSpec, ScenarioSpec,
} from './types'

// Bridge tussen de app-datastructuren (ScenarioGraph + SessionState) en de
// scoring-package input-shapes (ScenarioSpec + ExerciseEvent[]). Puur; geen
// I/O. Waar velden ontbreken (gap 1–20 uit ALIGNMENT.md) inferren we op basis
// van de dichtstbijzijnde bestaande data. Onderaan staat een lijst met
// beslissingen die deze bridge maakt — herzien zodra de gaps gesloten zijn.

// ── Publiek API ────────────────────────────────────────────────────────

export interface GraphToScoringOptions {
  mode?: Mode
  // Als undefined proberen we designTimeMinutes uit RoundNodeData.timerMinutes te lezen
  // en anders default 20 min.
  defaultDesignTimeMinutes?: number
  // Als undefined gebruikt de bridge gelijk gewicht per dimensie.
  defaultOutcomeWeights?: Record<OutcomeDimension, number>
}

export function graphToScenarioSpec(graph: ScenarioGraph, opts: GraphToScoringOptions = {}): ScenarioSpec {
  const defaultDesign = opts.defaultDesignTimeMinutes ?? 20
  const defaultWeights: Record<OutcomeDimension, number> = opts.defaultOutcomeWeights ?? {
    CONT: 1, FOR: 1, BC: 1, JUR: 1, VER: 1, KOS: 1,
  }

  const roundNodes = graph.nodes.filter(n => n.type === 'round')
  const injectNodes = graph.nodes.filter(n => n.type === 'inject')
  const decisionNodes = graph.nodes.filter(n => n.type === 'decision')
  const chaserNodes = graph.nodes.filter(n => n.type === 'chaser')

  // Rond-nummering afleiden uit de sequence-volgorde vanaf de start-node.
  const roundNumberByNodeId = numberRoundsFromStart(graph)

  const rounds: RoundSpec[] = roundNodes.map(n => {
    const rd = n.data as RoundNodeData
    return {
      number: roundNumberByNodeId.get(n.id) ?? 1,
      designTimeMinutes: rd.scoring?.designTimeMinutes ?? rd.timerMinutes ?? defaultDesign,
      outcomeWeights: rd.scoring?.outcomeWeights ?? defaultWeights,
    }
  }).sort((a, b) => a.number - b.number)

  // Injects: één InjectSpec per inject-node + één per chaser-inject.
  const injects: InjectSpec[] = []
  for (const n of injectNodes) {
    const d = n.data as InjectNodeData
    const parentRound = findParentRoundNumber(graph, n.id, roundNumberByNodeId)
    injects.push(injectFromNode(n.id, d, parentRound, 'scenario'))
  }
  for (const n of chaserNodes) {
    const d = n.data as ChaserNodeData
    const parentRound = findParentRoundNumber(graph, n.id, roundNumberByNodeId) ?? 1
    injects.push(injectFromNode(n.id, d.inject, parentRound, 'facilitator'))
  }

  // Beslispunten: DecisionNode + RoleAction-per-ronde als virtuele beslispunten.
  const decisionPoints: DecisionPointSpec[] = []
  for (const n of decisionNodes) {
    const dd = n.data as DecisionNodeData
    const parentRound = findParentRoundNumber(graph, n.id, roundNumberByNodeId) ?? 1
    decisionPoints.push({
      id: n.id,
      round: parentRound,
      domain: dd.scoringDomain ?? inferDomainFromDecision(dd),
      designedOwner: dd.scoringOwner ? toSpecRole(dd.scoringOwner)
        : dd.triggerRole ? toSpecRole(dd.triggerRole)
        : inferOwnerFromOptions(dd),
      consulted: (dd.scoringConsulted ?? []).map(r => toSpecRole(r)),
      required: dd.advancesGraph !== false,
      options: dd.options.map(o => optionFromDecision(o)),
    })
  }
  for (const n of roundNodes) {
    const rd = n.data as RoundNodeData
    const parentRound = roundNumberByNodeId.get(n.id) ?? 1
    for (const action of rd.roleActions ?? []) {
      decisionPoints.push(decisionPointFromRoleAction(action, parentRound))
    }
  }

  return {
    rounds,
    decisionPoints,
    injects,
    // Geen externalParties uit de graph — geen shape, valt via facilitator-slider.
    // domainOwnership blijft undefined → scoring gebruikt defaults uit spec §1.1.
  }
}

// SessionState → ExerciseEvent[]. Voegt timeline + assessment-events samen tot
// één append-only stream. Server-side timestamps zijn altijd getrouwd (Deel B §4.3).
export function sessionToEvents(session: SessionState): ExerciseEvent[] {
  const events: ExerciseEvent[] = []

  const start = session.startedAt ?? session.createdAt
  events.push({ kind: 'session_start', t: start })

  // Round phase transitions vanuit timeline.
  for (const te of session.timeline) {
    const mapped = mapTimelineToEvent(te)
    if (mapped) events.push(mapped)
  }

  // Submitted decisions.
  for (const d of session.submittedDecisions ?? []) {
    events.push(submittedDecisionToEvent(d, session))
  }

  // Notifications als external-party activations.
  for (const n of session.notifications ?? []) {
    if (!n.submittedAt) continue
    events.push({
      kind: 'external_party_activated',
      t: n.submittedAt,
      partyId: n.type,
      actionable: 1,  // ingezonden = actionable; facilitator kan later corrigeren via facilitator_q_j
    })
  }

  // Retainer-activatie ook als external party.
  if (session.retainerState?.dialedAt) {
    events.push({
      kind: 'external_party_activated',
      t: session.retainerState.dialedAt,
      partyId: 'retainer',
      actionable: session.retainerState.chosenActivatorAuthorized ? 1 : 0.5,
    })
  }

  return events.sort((a, b) => a.t - b.t)
}

export function sessionToScoringInput(session: SessionState, opts: GraphToScoringOptions = {}): ExerciseInput | null {
  const graph = session.graph
  if (!graph) return null
  const scenario = graphToScenarioSpec(graph, opts)
  const specPresent = session.participants
    .map(p => (p.role ? toSpecRole(p.role) : undefined))
    .filter((s): s is string => !!s)
  // Deel B §4 — Roster.groups voor per-groep scoring. Elke Group wordt vertaald
  // met zijn participantIds; reveal.ts + outcome-berekening leest 'groupId' als
  // primaire scoring-eenheid wanneer aanwezig.
  const groups = (session.groups ?? []).map(g => ({
    id: g.id,
    name: g.name,
    participantIds: session.participants.filter(p => p.groupId === g.id).map(p => p.id),
  }))
  return {
    mode: opts.mode ?? 'ASSESSMENT',
    scenario,
    roster: { presentRoles: specPresent, groups: groups.length > 0 ? groups : undefined },
    events: sessionToEvents(session),
  }
}

// ── Helpers: inferentie waar velden nog ontbreken ─────────────────────

function numberRoundsFromStart(graph: ScenarioGraph): Map<string, number> {
  const map = new Map<string, number>()
  const start = graph.nodes.find(n => n.type === 'start')
  if (!start) return map
  const seq = new Map<string, string>()
  for (const e of graph.edges) if (e.type === 'sequence') seq.set(e.source, e.target)
  let cursor: string | undefined = start.id
  let num = 0
  const visited = new Set<string>()
  while (cursor && !visited.has(cursor)) {
    visited.add(cursor)
    const node = graph.nodes.find(n => n.id === cursor)
    if (!node) break
    if (node.type === 'round') { num++; map.set(node.id, num) }
    cursor = seq.get(cursor)
  }
  return map
}

function findParentRoundNumber(
  graph: ScenarioGraph,
  nodeId: string,
  roundNumberByNodeId: Map<string, number>,
): number {
  // Zoek een edge die vanuit een round-node naar deze inject/decision wijst.
  for (const e of graph.edges) {
    if (e.target !== nodeId) continue
    const src = graph.nodes.find(n => n.id === e.source)
    if (!src) continue
    if (src.type === 'round') return roundNumberByNodeId.get(src.id) ?? 1
    // Recursief éénpaal terug — decision-branches zijn kort.
    const parent = roundNumberByNodeId.get(e.source)
    if (parent) return parent
  }
  return 1
}

function injectFromNode(id: string, d: InjectNodeData | Omit<AppInject, 'id'>, round: number, origin: 'scenario' | 'facilitator'): InjectSpec {
  const asInjectNode = d as InjectNodeData
  // Alleen als visibility='exclusive' ís de inject asymmetrisch (DELEN-relevant).
  // Bij 'shared' (default) laten we visibleTo leeg — dan gedraagt scoring het als
  // gedeelde inject, geen deel-actie nodig.
  const isExclusive = asInjectNode.visibility === 'exclusive'
  return {
    id,
    round,
    importance: asInjectNode.importance ?? inferImportance(d),
    visibleTo: isExclusive ? (d.targetRoles ?? []).map(r => toSpecRole(r as Role)) : undefined,
    correctRoute: asInjectNode.correctRoute ? toSpecRole(asInjectNode.correctRoute) : undefined,
    origin,
  }
}

// Gap 3 workaround — 'crucial' als nis2Relevant of urgency=critical/high; anders 'info'.
function inferImportance(d: { nis2Relevant?: boolean; urgency?: string }): 'crucial' | 'info' {
  if (d.nis2Relevant) return 'crucial'
  if (d.urgency === 'critical' || d.urgency === 'high') return 'crucial'
  return 'info'
}

// Gap 8 workaround — leid domein af uit supervisionAreas of uit een van de opties.
function inferDomainFromDecision(dd: DecisionNodeData): Domain {
  const areas = dd.supervisionAreas ?? []
  if (areas.includes('technical_response')) return 'CONTAINMENT'
  if (areas.includes('logging_evidence')) return 'FORENSIEK'
  if (areas.includes('recovery')) return 'HERSTEL'
  if (areas.includes('notification_duty')) return 'JURIDISCH'
  if (areas.includes('crisis_communication')) return 'EXTERNE_COMMS'
  if (areas.includes('emergency_communication')) return 'INTERNE_COMMS'
  if (areas.includes('business_continuity')) return 'BEDRIJFSPROCES'
  if (areas.includes('suppliers_chain')) return 'EXTERNE_PARTIJEN'
  if (areas.includes('ir_retainer')) return 'EXTERNE_PARTIJEN'
  // Fallback: leid domein af uit de eerste optie's allowedRole.
  for (const opt of dd.options) {
    if (opt.allowedRole) {
      const doms = domainsFor(opt.allowedRole)
      if (doms.length > 0) return doms[0]
    }
  }
  return 'EXTERNE_PARTIJEN'
}

function inferOwnerFromOptions(dd: DecisionNodeData): string {
  // Kies de eerste allowedRole in de optielijst als "designedOwner".
  for (const opt of dd.options) {
    if (opt.allowedRole) return toSpecRole(opt.allowedRole)
  }
  return 'CRISIS_LEAD'
}

// Options must carry an explicit outcomeVector on the 6 axes. If missing, the
// scoring engine treats the option as a no-op — falling back to qualityRank
// via qualityRankToVector below.
function optionFromDecision(o: DecisionNodeData['options'][number]): OptionSpec {
  return {
    id: o.id,
    label: o.label,
    outcomeVector: o.outcomeVector ?? qualityRankToVector(o.qualityRank),
    debriefNote: o.lessonLearned ?? o.facilitatorCommentary,
    implicit: o.implicit,
  }
}

function decisionPointFromRoleAction(a: RoleAction, round: number): DecisionPointSpec {
  const designedOwner = a.allowedRoles.length > 0 ? toSpecRole(a.allowedRoles[0]) : 'CRISIS_LEAD'
  return {
    id: a.id,
    round,
    domain: inferDomainFromRoleAction(a),
    designedOwner,
    required: true,
    options: [{
      id: a.id,
      label: a.label,
      outcomeVector: qualityRankToVector(a.qualityRank),
      debriefNote: a.lessonLearned ?? a.facilitatorCommentary,
    }],
  }
}

// If an author didn't provide an explicit outcomeVector, derive a flat sign
// across all 6 axes from qualityRank as a last resort. Authors should prefer
// setting outcomeVector directly — this is a shim, not a design.
function qualityRankToVector(qualityRank?: string): Record<OutcomeDimension, number> {
  const out: Record<OutcomeDimension, number> = { CONT: 0, FOR: 0, BC: 0, JUR: 0, VER: 0, KOS: 0 }
  const sign = qualityRank === 'best' ? 2 : qualityRank === 'good' ? 1
           : qualityRank === 'poor' ? -1 : qualityRank === 'wrong' ? -2 : 0
  for (const d of OUTCOME_DIMENSIONS) out[d] = sign
  return out
}

function inferDomainFromRoleAction(a: RoleAction): Domain {
  const areas = a.supervisionAreas ?? []
  if (areas.includes('technical_response')) return 'CONTAINMENT'
  if (areas.includes('logging_evidence')) return 'FORENSIEK'
  if (areas.includes('recovery')) return 'HERSTEL'
  if (areas.includes('notification_duty')) return 'JURIDISCH'
  if (areas.includes('crisis_communication')) return 'EXTERNE_COMMS'
  if (areas.includes('emergency_communication')) return 'INTERNE_COMMS'
  if (areas.includes('business_continuity')) return 'BEDRIJFSPROCES'
  if (areas.includes('suppliers_chain')) return 'EXTERNE_PARTIJEN'
  if (areas.includes('ir_retainer')) return 'EXTERNE_PARTIJEN'
  if (a.allowedRoles.length > 0) {
    const doms = domainsFor(a.allowedRoles[0])
    if (doms.length > 0) return doms[0]
  }
  return 'EXTERNE_PARTIJEN'
}


function mapTimelineToEvent(te: TimelineEvent): ExerciseEvent | null {
  const t = te.timestamp
  switch (te.type) {
    case 'round_changed': {
      const roundIndex = (te.data.roundIndex as number | undefined) ?? 0
      return { kind: 'round_phase_changed', t, round: roundIndex + 1, toPhase: 'briefing' }
    }
    case 'phase_changed': {
      const to = te.data.to as string | undefined
      if (to === 'decision') return { kind: 'round_phase_changed', t, round: 0, toPhase: 'keuze' }
      if (to === 'review') return { kind: 'round_phase_changed', t, round: 0, toPhase: 'review' }
      return null
    }
    default:
      return null
  }
}

function submittedDecisionToEvent(d: SubmittedDecision, session: SessionState): ExerciseEvent {
  const specRole = d.role ? APP_ROLE_TO_SPEC[d.role] : 'CRISIS_LEAD'
  return {
    kind: 'decision_submitted',
    t: Date.parse(d.submittedAt) || session.startedAt || session.createdAt,
    round: d.roundIndex + 1,
    decisionPointId: d.actionId,
    optionId: d.actionId,
    by: specRole,
    groupId: d.groupId,
    confidence: d.confidence,
  }
}

// Silence unused-symbol warnings while the AppInject and NO_DECISION_FALLBACK_VECTOR
// types remain in scope for future reintroduction. Removing them from imports would
// require broader signature changes.
export const __unused = { AppInject: null as unknown as AppInject | null, NO_DECISION_FALLBACK_VECTOR }
