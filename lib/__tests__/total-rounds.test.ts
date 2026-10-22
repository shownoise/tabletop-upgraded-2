import { describe, expect, it } from 'vitest'
import { toParticipantState } from '../session-store'
import { schoolverenigingScenario } from '@/lib/graph/examples-schoolvereniging'
import type { Scenario, SessionState } from '../types'

// Graph rounds materialise lazily: applyEngineStep appends each round as it is
// reached and sets currentRound = rounds.length - 1. So scenario.rounds is
// "rounds played so far" and currentRound + 1 === scenario.rounds.length always
// holds — dividing by it renders "RONDE 1/1" in a six-round exercise.
// toParticipantState blanks graph.nodes, so a participant cannot count the round
// nodes themselves and depends entirely on the totalRounds scalar.

function roundsPlayed(count: number): Scenario {
  return {
    scenario_title: 'test',
    escalation_level: 'low',
    rounds: Array.from({ length: count }, (_, i) => ({
      round_number: i + 1,
      title: `Ronde ${i + 1}`,
      situation_update: '',
      injects: [],
      timerMinutes: 20,
    })),
  } as unknown as Scenario
}

function baseSession(overrides: Partial<SessionState> = {}): SessionState {
  return {
    id: 't',
    joinCode: 'X',
    status: 'active',
    mode: 'training',
    createdAt: 0,
    startedAt: 0,
    participants: [{ id: 'p1', name: 'Anna', role: 'ceo', joinedAt: 0 }],
    scenario: roundsPlayed(1),
    currentRound: 0,
    roundPhase: 'inject',
    graph: schoolverenigingScenario(),
    pushedInjects: [],
    timeline: [],
    submittedDecisions: [],
    config: {} as SessionState['config'],
    ...overrides,
  } as SessionState
}

describe('totalRounds on the participant projection', () => {
  it('resolves to the number of round nodes in the graph, not the rounds played', () => {
    const session = baseSession()
    const projected = toParticipantState(session, 'p1')

    expect(projected.totalRounds).toBe(6)
    expect(session.scenario.rounds.length).toBe(1)
  })

  it('stays at the graph total while rounds materialise one by one', () => {
    for (const played of [1, 2, 3, 4, 5, 6]) {
      const session = baseSession({
        scenario: roundsPlayed(played),
        currentRound: played - 1,
      })
      expect(toParticipantState(session, 'p1').totalRounds).toBe(6)
    }
  })

  it('still blanks the graph, so the scalar is the participant’s only source', () => {
    const projected = toParticipantState(baseSession(), 'p1')

    expect(projected.graph?.nodes).toEqual([])
    expect(projected.graph?.edges).toEqual([])
  })

  it('falls back to scenario.rounds for a legacy session without a graph', () => {
    const session = baseSession({ scenario: roundsPlayed(4), graph: undefined, currentRound: 3 })

    expect(toParticipantState(session, 'p1').totalRounds).toBe(4)
  })
})
