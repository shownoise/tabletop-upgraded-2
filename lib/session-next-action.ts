import type { DecisionNodeData, GraphNode } from "./graph/types"
import type { Role, RoundPhase, SessionState } from "./types"
import { ROLE_META } from "./types"
import { effectiveRolesForParticipant } from "./engine/distribute-roles"
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
  const nextLabels: Record<RoundPhase, string> = {
    inject: 'Volgende fase: Discussie',
    discussion: 'Volgende fase: Beslissing',
    decision: 'Volgende fase: Review',
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

export function missingEventDecisionAssignments(session: SessionState): Array<{ groupId?: string; role: Role }> {
  const decisionNode = currentDecisionNode(session)
  if (!decisionNode) return []
  const dd = decisionNode.data as DecisionNodeData
  if (dd.perRole !== true) return []
  const roles = [...new Set(dd.options
    .filter(option => !option.implicit && (!option.requiresCapability || session.flags?.[option.requiresCapability]))
    .map(option => option.allowedRole)
    .filter((role): role is Role => !!role))]
  const implicitIds = new Set(dd.options.filter(option => option.implicit).map(option => option.id))
  const units = session.groups?.length ? session.groups.map(group => group.id) : [undefined]
  const missing: Array<{ groupId?: string; role: Role }> = []
  for (const groupId of units) {
    for (const role of roles) {
      const optionIds = new Set(dd.options.filter(option => option.allowedRole === role).map(option => option.id))
      const submitted = (session.submittedDecisions ?? []).some(decision =>
        decision.roundIndex === session.currentRound && decision.role === role &&
        (optionIds.has(decision.actionId) || implicitIds.has(decision.actionId)) && decision.groupId === groupId,
      )
      if (!submitted) missing.push({ groupId, role })
    }
  }
  return missing
}

export function missingDecisionRoles(session: SessionState): Role[] {
  const decisionNode = currentDecisionNode(session)
  if (!decisionNode) return []
  const dd = decisionNode.data as DecisionNodeData
  if (dd.perRole !== true) return []

  if (session.mode === 'event') {
    return missingEventDecisionAssignments(session).map(assignment => assignment.role)
  }

  const dist = session.roleDistribution
  if (!dist) return []
  const overrides = session.roleAssignmentOverrides ?? {}
  const rolesRequired = new Set<Role>()
  const optionIds = new Set<string>()
  for (const opt of dd.options) {
    if (opt.allowedRole) rolesRequired.add(opt.allowedRole)
    optionIds.add(opt.id)
  }
  const missing: Role[] = []
  for (const entry of dist.entries) {
    const roles = effectiveRolesForParticipant(entry, overrides[entry.participantId])
    for (const r of roles) {
      if (!rolesRequired.has(r)) continue
      const submittedForRole = (session.submittedDecisions ?? []).some(d =>
        d.participantId === entry.participantId
        && d.roundIndex === session.currentRound
        && d.role === r
        && optionIds.has(d.actionId),
      )
      if (!submittedForRole) missing.push(r)
    }
  }
  return [...new Set(missing)]
}
