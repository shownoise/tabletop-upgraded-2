import { describe, expect, it } from 'vitest'
import type { ScenarioGraph } from '@/lib/graph/types'
import type { SessionState, SubmittedDecision } from '@/lib/types'
import { sessionToScoringInput } from '../graph-adapter'
import { scoreExercise, scoreExerciseByGroup } from '../score-exercise'

const zero = { CONT: 0, FOR: 0, BC: 0, JUR: 0, VER: 0, KOS: 0 }
const graph: ScenarioGraph = {
  id: 'teams', name: 'Teams', version: 1, scenarioType: 'ransomware_double_extortion', createdAt: 0, updatedAt: 0,
  nodes: [
    { id: 'start', type: 'start', position: { x: 0, y: 0 }, data: { kind: 'start' } },
    { id: 'round', type: 'round', position: { x: 100, y: 0 }, data: { kind: 'round', title: 'Ronde', situation_update: '', roleActions: [
      { id: 'old', label: 'Verborgen oude keuze', description: '', allowedRoles: ['ceo'], irPlanAligned: true },
    ] } },
    { id: 'decision', type: 'decision', position: { x: 200, y: 0 }, data: {
      kind: 'decision', prompt: 'Wat doen jullie?', measuredBy: 'participant_choice', perRole: true,
      options: [
        { id: 'ceo-good', label: 'CEO goed', allowedRole: 'ceo', outcomeVector: { ...zero, CONT: 2 } },
        { id: 'ceo-bad', label: 'CEO slecht', allowedRole: 'ceo', outcomeVector: { ...zero, CONT: -2 } },
        { id: 'ciso-good', label: 'CISO goed', allowedRole: 'ciso', outcomeVector: { ...zero, BC: 2 } },
        { id: 'ciso-bad', label: 'CISO slecht', allowedRole: 'ciso', outcomeVector: { ...zero, BC: -2 } },
        { id: 'implicit', label: 'Geen besluit', implicit: true, outcomeVector: zero },
      ],
    } },
  ],
  edges: [{ id: 'e1', source: 'start', target: 'round', type: 'sequence' }, { id: 'e2', source: 'round', target: 'decision', type: 'sequence' }],
}

function submission(groupId: string, role: 'ceo' | 'ciso', actionId: string): SubmittedDecision {
  return {
    participantId: groupId, participantName: groupId, groupId, role, roundIndex: 0,
    actionId, actionLabel: actionId, reasoning: '', submittedAt: new Date(1_000).toISOString(),
    isWrongRole: false, isIrDeviation: false,
  }
}

describe('Partner Event scoring per role and group', () => {
  it('counts every role choice, keeps teams separate, and averages the host view', () => {
    const session = {
      graph, mode: 'event', createdAt: 1, startedAt: 1, timeline: [],
      participants: [
        { id: 'g1', name: 'Team 1', groupId: 'g1', joinedAt: 1 },
        { id: 'g2', name: 'Team 2', groupId: 'g2', joinedAt: 1 },
      ],
      groups: [{ id: 'g1', name: 'Team 1', createdAt: 1 }, { id: 'g2', name: 'Team 2', createdAt: 1 }],
      submittedDecisions: [
        submission('g1', 'ceo', 'ceo-good'), submission('g1', 'ciso', 'ciso-bad'),
        submission('g2', 'ceo', 'ceo-bad'), submission('g2', 'ciso', 'ciso-good'),
      ],
    } as unknown as SessionState
    const input = sessionToScoringInput(session)!
    expect(input.scenario.decisionPoints).toHaveLength(2)
    const byGroup = scoreExerciseByGroup(input)
    expect(byGroup.g1.outcomes[0].perDimension.CONT).toBe(1)
    expect(byGroup.g1.outcomes[0].perDimension.BC).toBe(-1)
    expect(byGroup.g2.outcomes[0].perDimension.CONT).toBe(-1)
    expect(byGroup.g2.outcomes[0].perDimension.BC).toBe(1)
    expect(scoreExercise(input).outcomes[0].perDimension.CONT).toBe(0)
    expect(scoreExercise(input).outcomes[0].perDimension.BC).toBe(0)
    expect(scoreExercise({ ...input, events: [{ kind: 'session_start', t: 1 }] }).totalPoints).toBe(0)
  })
})
