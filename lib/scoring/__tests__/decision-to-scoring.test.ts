import { describe, expect, it } from 'vitest'
import { sessionToScoringInput } from '../graph-adapter'
import { scoreExercise } from '../score-exercise'
import { schoolverenigingScenario as simpleStoryExample } from '@/lib/graph/examples-schoolvereniging'
import { NO_DECISION_FALLBACK_VECTOR, OUTCOME_DIMENSIONS } from '../constants'
import type { DecisionNodeData } from '@/lib/graph/types'
import type { SessionState, SubmittedDecision } from '@/lib/types'

// Phase-1 acceptance: prior refactor claimed to reconnect the scoring pipeline
// but DecisionNode submissions never reached the engine because
// SubmittedDecision.actionId is an option id while the engine keyed decision
// points by node id. Fix landed in graph-adapter.ts::resolveDecisionPointId.
// These tests are the guard.

function buildSessionWithSubmission(roundIndex: number, optionSelector: (options: DecisionNodeData['options']) => DecisionNodeData['options'][number]): {
  session: SessionState
  chosenOptionId: string
  chosenVector: Record<string, number>
} {
  const graph = simpleStoryExample()
  const decisionNodes = graph.nodes.filter(n => n.type === 'decision')
  const targetDecision = decisionNodes[roundIndex]
  const dd = targetDecision.data as DecisionNodeData
  const opt = optionSelector(dd.options)
  const chosenVector = opt.outcomeVector as Record<string, number>

  const session: Partial<SessionState> = {
    graph,
    startedAt: 1_000_000,
    createdAt: 0,
    timeline: [],
    participants: [
      { id: 'p1', name: 'Alice', role: opt.allowedRole ?? 'legal', joinedAt: 0 },
      { id: 'p2', name: 'Bob',   role: 'ceo',   joinedAt: 0 },
      { id: 'p3', name: 'Carol', role: 'ciso',  joinedAt: 0 },
    ],
    submittedDecisions: [{
      participantId: 'p1',
      participantName: 'Alice',
      role: opt.allowedRole ?? 'legal',
      roundIndex,
      actionId: opt.id,
      actionLabel: opt.label,
      reasoning: 'test',
      submittedAt: new Date(1_000_500).toISOString(),
      isWrongRole: false,
      isIrDeviation: false,
    } satisfies SubmittedDecision],
  }

  return { session: session as SessionState, chosenOptionId: opt.id, chosenVector }
}

describe('phase-1: submitted decisions reach the scoring engine', () => {
  it('a decision submitted in round 3 moves round 3 off the fallback vector', () => {
    const { session, chosenVector } = buildSessionWithSubmission(2, opts => opts[0])
    const input = sessionToScoringInput(session)
    expect(input).not.toBeNull()
    const out = scoreExercise(input!)

    const round3 = out.outcomes.find(o => o.round === 3)
    expect(round3).toBeDefined()
    expect(round3!.hasSubmissions).toBe(true)

    // The per-dim vector should reflect the chosen option (averaged over the
    // round's decision points — the round may host multiple, so the average
    // dilutes but must never equal the pure fallback vector).
    let matchesFallback = true
    for (const dim of OUTCOME_DIMENSIONS) {
      if (round3!.perDimension[dim] !== NO_DECISION_FALLBACK_VECTOR[dim]) {
        matchesFallback = false
        break
      }
    }
    // Even if the chosen option happens to equal the fallback for some axes,
    // it should not equal the fallback on ALL axes for a real, non-trivial
    // authored option.
    expect(matchesFallback).toBe(false)

    // For each dimension the chosen option pulls the average toward its own
    // authored value — verify direction rather than exact equality (rounds host
    // multiple decision points; unsubmitted ones use the fallback).
    for (const dim of OUTCOME_DIMENSIONS) {
      const chosen = chosenVector[dim] ?? 0
      const fallback = NO_DECISION_FALLBACK_VECTOR[dim]
      const actual = round3!.perDimension[dim]
      if (chosen > fallback) {
        expect(actual, `${dim}: expected actual ${actual} > fallback ${fallback} because chosen ${chosen} > fallback`).toBeGreaterThan(fallback)
      } else if (chosen < fallback) {
        expect(actual, `${dim}: expected actual ${actual} < fallback ${fallback} because chosen ${chosen} < fallback`).toBeLessThan(fallback)
      }
    }
  })

  it('rounds without submissions carry hasSubmissions=false and their fallback vector is not shown as real data', () => {
    const { session } = buildSessionWithSubmission(2, opts => opts[0])
    const out = scoreExercise(sessionToScoringInput(session)!)

    for (const outcome of out.outcomes) {
      if (outcome.round === 3) continue  // the one we submitted for
      expect(outcome.hasSubmissions).toBe(false)
    }
  })

  it('N rounds produce exactly N distinct sequential round records', () => {
    const { session } = buildSessionWithSubmission(2, opts => opts[0])
    const input = sessionToScoringInput(session)!
    const N = input.scenario.rounds.length
    const out = scoreExercise(input)

    expect(out.outcomes).toHaveLength(N)
    const numbers = out.outcomes.map(o => o.round).sort((a, b) => a - b)
    expect(numbers).toEqual(Array.from({ length: N }, (_, i) => i + 1))
    // No duplicates (the "5 rows all round 1" symptom this suite is meant to prevent).
    expect(new Set(numbers).size).toBe(N)
  })

  it('two different options in round 3 produce two different outcomes', () => {
    const a = buildSessionWithSubmission(2, opts => opts[0])
    const b = buildSessionWithSubmission(2, opts => opts[opts.length - 1])
    // Only compare if the two options really are distinct vectors.
    const outA = scoreExercise(sessionToScoringInput(a.session)!)
    const outB = scoreExercise(sessionToScoringInput(b.session)!)
    const rA = outA.outcomes.find(o => o.round === 3)!
    const rB = outB.outcomes.find(o => o.round === 3)!

    let anyDifference = false
    for (const dim of OUTCOME_DIMENSIONS) {
      if (Math.abs(rA.perDimension[dim] - rB.perDimension[dim]) > 1e-9) {
        anyDifference = true
        break
      }
    }
    expect(anyDifference).toBe(true)
  })
})
