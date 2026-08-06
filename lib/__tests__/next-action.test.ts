import { describe, expect, it } from 'vitest'
import { describeNextAction } from '../session-next-action'
import { schoolverenigingScenario } from '@/lib/graph/examples-schoolvereniging'
import type { SessionState } from '../types'

// Phase-0 acceptance: from the last phase of round N where N < total,
// the computed next action is "next_round", NOT "end_session". The state
// machine may never offer end_session as the only action while unplayed
// rounds remain. This has been reported three times.

function baseSession(overrides: Partial<SessionState> = {}): SessionState {
  const graph = schoolverenigingScenario()
  const rounds = Array.from({ length: 6 }, (_, i) => ({
    round_number: i + 1,
    title: `Ronde ${i + 1}`,
    situation_update: '',
    injects: [],
    timerMinutes: 20,
  }))
  return {
    id: 't',
    joinCode: 'X',
    status: 'active',
    mode: 'assessment',
    createdAt: 0,
    startedAt: 0,
    participants: [],
    scenario: { scenario_title: 'test', escalation_level: 'low', rounds },
    currentRound: 0,
    roundPhase: 'inject',
    graph,
    timeline: [],
    submittedDecisions: [],
    config: {} as SessionState['config'],
    ...overrides,
  } as SessionState
}

describe('phase-0: describeNextAction never offers end_session while unplayed rounds remain', () => {
  for (const roundIdx of [0, 1, 2, 3, 4]) {
    for (const phase of ['inject', 'discussion', 'decision', 'review'] as const) {
      it(`round ${roundIdx + 1}/6, phase ${phase} — end_session is not the only action`, () => {
        const s = baseSession({ currentRound: roundIdx, roundPhase: phase })
        const na = describeNextAction(s)
        expect(na.action).not.toBe('end_session')
      })
    }
  }

  it('final round REVIEW — end_session IS the correct action', () => {
    const s = baseSession({ currentRound: 5, roundPhase: 'review' })
    const na = describeNextAction(s)
    expect(na.action).toBe('end_session')
  })

  it('non-final round REVIEW — advances to next round, labelled Start ronde N+1', () => {
    const s = baseSession({ currentRound: 2, roundPhase: 'review' })
    const na = describeNextAction(s)
    expect(na.action).toBe('next_round')
    expect(na.labelNL).toContain('4')
  })
})
