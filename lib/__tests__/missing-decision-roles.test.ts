import { describe, expect, it } from 'vitest'
import { missingDecisionRoles } from '../session-next-action'
import type { SessionState, SubmittedDecision } from '../types'

// The facilitator leaves the decision phase only once missingDecisionRoles() is
// empty: it gates the dashboard's "Next", the phase timer and goToNextRound.
// finalizeDecision ("Beslissing afsluiten") fills unanswered roles with rows
// carrying participantId 'IMPLICIT'. Those rows have to satisfy this function,
// otherwise finalising succeeds and the round still cannot be left.

const DECISION_NODE = {
  id: 'dec1',
  type: 'decision' as const,
  position: { x: 0, y: 0 },
  data: {
    kind: 'decision',
    prompt: 'Wat doen we?',
    perRole: true,
    options: [
      { id: 'opt_ceo', label: 'CEO handelt', allowedRole: 'ceo' },
      { id: 'opt_ciso', label: 'CISO handelt', allowedRole: 'ciso' },
      { id: 'opt_none', label: 'Geen besluit', implicit: true },
    ],
  },
}

function session(submittedDecisions: SubmittedDecision[]): SessionState {
  return {
    id: 't',
    joinCode: 'X',
    status: 'active',
    mode: 'training',
    createdAt: 0,
    participants: [{ id: 'p1', name: 'Anna', role: 'ceo', joinedAt: 0 }],
    scenario: { scenario_title: 't', escalation_level: 'low', rounds: [] },
    currentRound: 0,
    roundPhase: 'decision',
    graph: { id: 'g', name: 'g', version: 1, nodes: [DECISION_NODE], edges: [] },
    graphState: { currentNodeId: 'dec1' },
    roleDistribution: {
      entries: [{ participantId: 'p1', primaryRole: 'ceo', inheritedRoles: ['ciso'] }],
      computedAt: 0,
    },
    timeline: [],
    submittedDecisions,
    config: {} as SessionState['config'],
  } as unknown as SessionState
}

function row(over: Partial<SubmittedDecision>): SubmittedDecision {
  return {
    participantId: 'p1',
    participantName: 'Anna',
    role: 'ceo',
    roundIndex: 0,
    actionId: 'opt_ceo',
    actionLabel: 'CEO handelt',
    reasoning: '',
    submittedAt: new Date(0).toISOString(),
    isWrongRole: false,
    ...over,
  } as SubmittedDecision
}

describe('missingDecisionRoles — training mode', () => {
  it('reports both owned roles when nothing is submitted', () => {
    expect(missingDecisionRoles(session([])).sort()).toEqual(['ciso', 'ceo'].sort())
  })

  it('clears a role the participant answered themselves', () => {
    expect(missingDecisionRoles(session([row({})]))).toEqual(['ciso'])
  })

  it('clears a role settled by an IMPLICIT row from finalizeDecision', () => {
    const rows = [
      row({}),
      row({ participantId: 'IMPLICIT', role: 'ciso', actionId: 'opt_none', actionLabel: 'Geen besluit' }),
    ]
    expect(missingDecisionRoles(session(rows))).toEqual([])
  })

  it('ignores submissions from an earlier round', () => {
    expect(missingDecisionRoles(session([row({ roundIndex: 1 })])).sort()).toEqual(['ciso', 'ceo'].sort())
  })
})

describe('missingDecisionRoles — roles nobody could ever clear', () => {
  it('does not require a role whose only option is implicit', () => {
    const s = session([])
    const data = (s.graph!.nodes[0].data as { options: Array<{ allowedRole?: string; implicit?: boolean }> })
    data.options = [
      { allowedRole: 'ceo' },
      { allowedRole: 'ciso', implicit: true },
    ].map((o, i) => ({ id: `o${i}`, label: `o${i}`, ...o })) as typeof data.options
    expect(missingDecisionRoles(s)).toEqual(['ceo'])
  })
})
