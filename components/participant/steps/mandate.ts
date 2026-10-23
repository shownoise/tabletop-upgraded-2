// Brug tussen de deelnemer-projectie van een beslismoment en lib/session-roles.
//
// Waarom een brug en geen eigen afleiding: `decisionMandate()` en
// `roleCoverage()` zijn de bron van waarheid voor wie wat mag indienen. De
// deelnemer krijgt alleen een uitgeklede `activeDecision` plus een graph zonder
// nodes, dus die twee functies moeten een sessie-vorm krijgen waarin de rollen
// van dit beslismoment wél voorkomen. Anders staat een overgenomen rol als
// "onbezet" op het scherm terwijl de deelnemer hem juist draagt.

import type { DecisionNodeData } from '@/lib/graph/types'
import type { ActiveDecisionState, Role, Round, SessionState } from '@/lib/types'
import {
  decisionMandate,
  roleCoverage,
  rolesForParticipant,
  type DecisionMandate,
  type ParticipantRoles,
  type RoleCoverage,
} from '@/lib/session-roles'

export function decisionDataFromProjection(ad: ActiveDecisionState): DecisionNodeData {
  return {
    kind: 'decision',
    prompt: ad.prompt,
    measuredBy: 'participant_choice',
    perRole: ad.perRole,
    options: ad.options.map(o => ({
      id: o.optionId,
      label: o.optionLabel,
      allowedRole: o.allowedRole,
    })),
  }
}

export interface MandateView {
  decision: DecisionNodeData
  mandate: DecisionMandate
  coverage: RoleCoverage[]
  mine: ParticipantRoles | null
}

// De gestripte graph (`nodes: []`) zou het rollen-universum leegmaken, dus we
// laten `authoredRolesForSession` het scenariopad lopen en voegen een
// synthetische ronde toe die precies de rollen van dit beslismoment bevat.
function universeFor(session: SessionState, optionRoles: Role[]) {
  const mandateRound: Round = {
    round_number: -1,
    title: '',
    situation_update: '',
    injects: [],
    roleActions: optionRoles.map((role, i) => ({
      id: `mandate-${i}`,
      label: '',
      description: '',
      allowedRoles: [role],
      irPlanAligned: false,
    })),
  }
  return {
    participants: session.participants,
    roleDistribution: session.roleDistribution,
    roleAssignmentOverrides: session.roleAssignmentOverrides,
    graph: undefined,
    scenario: { ...session.scenario, rounds: [...session.scenario.rounds, mandateRound] },
    flags: session.flags,
  }
}

export function mandateView(
  session: SessionState,
  participantId: string | null | undefined,
): MandateView | null {
  const ad = session.activeDecision
  if (!ad || !ad.perRole) return null
  const decision = decisionDataFromProjection(ad)
  const optionRoles = [
    ...new Set(decision.options.map(o => o.allowedRole).filter((r): r is Role => !!r)),
  ]
  const universe = universeFor(session, optionRoles)
  return {
    decision,
    mandate: decisionMandate(universe, decision, participantId),
    coverage: roleCoverage(universe),
    mine: rolesForParticipant(session, participantId),
  }
}

// "CISO en CEO en Legal en IT-manager" leest als een opsomming die vergeten is
// af te maken. Nederlands zet komma's tot het laatste lid.
export function joinNL(items: string[]): string {
  if (items.length === 0) return ""
  if (items.length === 1) return items[0]
  return `${items.slice(0, -1).join(", ")} en ${items[items.length - 1]}`
}
