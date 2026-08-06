import type { DecisionNodeData } from "./graph/types"
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
  const totalRounds = session.scenario.rounds.length
  const isLastRound = session.currentRound >= totalRounds - 1

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

export function missingDecisionRoles(session: SessionState): Role[] {
  if (!session.graph || !session.graphState) return []
  const nodeById = new Map(session.graph.nodes.map(n => [n.id, n]))
  const current = nodeById.get(session.graphState.currentNodeId)
  if (!current) return []
  const decisionNode = current.type === 'decision'
    ? current
    : session.graph.edges
        .filter(e => e.source === current.id && e.type === 'sequence')
        .map(e => nodeById.get(e.target))
        .find(n => n?.type === 'decision')
  if (!decisionNode) return []
  const dd = decisionNode.data as DecisionNodeData
  if (dd.perRole !== true) return []

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
