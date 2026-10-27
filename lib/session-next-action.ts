import type { DecisionNodeData, GraphNode } from "./graph/types"
import type { Role, RoundPhase, SessionState } from "./types"
import { ROLE_META } from "./types"
import { coveredRoles, roleCoverage, roleCoverageInUse } from "./session-roles"
import { nextPhase } from "./engine/round-phases"

// Client-safe, pure. No DB, no crypto, no fs imports — safe to bundle into
// the facilitator dashboard so the "Next" button reads the state-machine's
// decision directly instead of duplicating its logic.

export interface NextActionDescriptor {
  action: 'advance_phase' | 'next_round' | 'end_session' | 'blocked'
  labelNL: string
  blockedReason?: string
}

export function describeNextAction(session: SessionState): NextActionDescriptor {
  const currentPhase = session.roundPhase ?? 'inject'
  const isLastRound = session.graph && session.graphState
    ? !hasFutureRound(session)
    : session.currentRound >= session.scenario.rounds.length - 1

  if (currentPhase === 'review') {
    if (isLastRound) return { action: 'end_session', labelNL: 'Sessie afronden' }
    return { action: 'next_round', labelNL: `Start ronde ${session.currentRound + 2}` }
  }
  if (currentPhase === 'decision') {
    const missing = missingDecisionRoles(session)
    if (missing.length > 0) {
      const roleLabels = missing.map(r => ROLE_META[r]?.label ?? r).join(', ')
      return {
        action: 'blocked',
        labelNL: `Nog wachten op ${missing.length} beslissing${missing.length === 1 ? '' : 'en'}`,
        blockedReason: `Nog geen inzending van: ${roleLabels}`,
      }
    }
  }
  const next = nextPhase(currentPhase)
  if (next === 'next_round') {
    return isLastRound
      ? { action: 'end_session', labelNL: 'Sessie afronden' }
      : { action: 'next_round', labelNL: `Start ronde ${session.currentRound + 2}` }
  }
  // De knop zegt wat er voor de deelnemers verandert, niet hoe de fase heet.
  // "Volgende fase: Beslissing" liet de facilitator zoeken naar een manier om
  // de keuzes open te zetten, terwijl dit die manier is.
  const nextLabels: Record<RoundPhase, string> = {
    inject: 'Overleg vrijgeven',
    discussion: 'Keuze openzetten',
    decision: 'Naar de scorebespreking',
    review: 'Start volgende ronde',
  }
  return { action: 'advance_phase', labelNL: nextLabels[currentPhase] }
}

function hasFutureRound(session: SessionState): boolean {
  if (!session.graph || !session.graphState) return false
  const visited = new Set<string>()
  const played = new Set(session.graphState.pathHistory)
  const nodes = new Map(session.graph.nodes.map(node => [node.id, node]))
  const queue = [session.graphState.currentNodeId]
  while (queue.length > 0) {
    const id = queue.shift()!
    if (visited.has(id)) continue
    visited.add(id)
    const node = nodes.get(id)
    if (node?.type === 'round' && !played.has(id)) return true
    for (const edge of session.graph.edges) {
      if (edge.source === id && edge.type !== 'inject') queue.push(edge.target)
    }
  }
  return false
}

export function currentDecisionNode(session: SessionState): GraphNode | undefined {
  if (!session.graph || !session.graphState) return undefined
  const nodeById = new Map(session.graph.nodes.map(n => [n.id, n]))
  const current = nodeById.get(session.graphState.currentNodeId)
  if (!current) return undefined
  return current.type === 'decision'
    ? current
    : session.graph.edges
        .filter(e => e.source === current.id && e.type === 'sequence')
        .map(e => nodeById.get(e.target))
        .find(n => n?.type === 'decision')
}

// Waarom een rol geen besluit heeft. Draagt het verschil dat de review moet
// kunnen tonen: niemand speelde de rol, versus wel gespeeld en niet ingediend.
export type UnsubmittedReason = 'onbezet' | 'niet_ingediend'

export interface UnsubmittedAssignment {
  groupId?: string
  role: Role
  reason: UnsubmittedReason
}

// Alle (team, rol)-paren op het actuele beslispunt zonder inzending, mét reden.
// Één afleiding voor beide modi, zodat de "nog wachten op"-teller van de
// facilitator en de impliciete afronding niet uit elkaar kunnen lopen.
export function unsubmittedDecisionAssignments(session: SessionState): UnsubmittedAssignment[] {
  const decisionNode = currentDecisionNode(session)
  if (!decisionNode) return []
  const dd = decisionNode.data as DecisionNodeData
  if (dd.perRole !== true) return []

  const owning = [...new Set(dd.options
    // Een impliciete of nog niet vrijgespeelde optie is niet kiesbaar, dus een
    // rol die alléén zo'n optie bezit is nooit iets verschuldigd — niemand zou
    // hem ooit kunnen afronden.
    .filter(option => !option.implicit && (!option.requiresCapability || session.flags?.[option.requiresCapability]))
    .map(option => option.allowedRole)
    .filter((role): role is Role => !!role))]
  if (owning.length === 0) return []

  // Event-modus met een teamdevice: één tablet per team, niemand claimt een rol
  // en dat device dient namens álle rollen in. Dekking is daar een eigenschap
  // van het team, niet van een persoon — anders was er nooit iets verschuldigd.
  // Zodra er in dat team wél iemand een rol claimt, geldt de echte dekking.
  const teamConsole = session.mode === 'event' && !roleCoverageInUse(session)
  const covered = teamConsole ? new Set(owning) : coveredRoles(session)
  const ownerOf = new Map(roleCoverage(session).map(c => [c.role, c.participantId]))
  const allOptionIds = new Set(dd.options.map(option => option.id))
  const implicitIds = new Set(dd.options.filter(option => option.implicit).map(option => option.id))
  const units = session.mode === 'event' && session.groups?.length
    ? session.groups.map(group => group.id)
    : [undefined]

  const out: UnsubmittedAssignment[] = []
  for (const groupId of units) {
    for (const role of owning) {
      const roleOptionIds = new Set(dd.options.filter(option => option.allowedRole === role).map(option => option.id))
      const submitted = (session.submittedDecisions ?? []).some(decision => {
        if (decision.roundIndex !== session.currentRound) return false
        if (decision.role !== role) return false
        if (session.mode === 'event') {
          return decision.groupId === groupId
            && (roleOptionIds.has(decision.actionId) || implicitIds.has(decision.actionId))
        }
        if (!allOptionIds.has(decision.actionId)) return false
        // finalizeDecision legt een onbeantwoorde rol vast als participantId
        // 'IMPLICIT'. Dat sluit de rol af voor wie hem ook bezat, dus het moet
        // hier meetellen, anders is de ronde nooit te verlaten.
        return decision.participantId === 'IMPLICIT' || decision.participantId === ownerOf.get(role)
      })
      if (submitted) continue
      out.push({ groupId, role, reason: covered.has(role) ? 'niet_ingediend' : 'onbezet' })
    }
  }
  return out
}

// Alleen de paren die de ronde écht tegenhouden. Een rol die niemand dekt staat
// hier niet in: die kan niet indienen en blokkeert dus niets (#105 §2).
export function missingEventDecisionAssignments(session: SessionState): Array<{ groupId?: string; role: Role }> {
  return unsubmittedDecisionAssignments(session)
    .filter(assignment => assignment.reason === 'niet_ingediend')
    .map(({ groupId, role }) => ({ groupId, role }))
}

export function missingDecisionRoles(session: SessionState): Role[] {
  return [...new Set(missingEventDecisionAssignments(session).map(assignment => assignment.role))]
}
