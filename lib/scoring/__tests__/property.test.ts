import { describe, expect, it } from 'vitest'
import { scoreExercise } from '../score-exercise'
import { referenceExercise } from '../reference-case'

describe('property tests — Deel A §9', () => {
  it('herberekening idempotent — twee runs op identieke input geven identieke output', () => {
    const a = scoreExercise(referenceExercise)
    const b = scoreExercise(referenceExercise)
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })

  it('roundOutcome.points in [0,100]', () => {
    const r = scoreExercise(referenceExercise)
    for (const o of r.outcomes) {
      expect(o.points).toBeGreaterThanOrEqual(0)
      expect(o.points).toBeLessThanOrEqual(100)
    }
  })

  it('scoringVersion bepaald', () => {
    const r = scoreExercise(referenceExercise)
    expect(r.scoringVersion).toMatch(/^\d+\.\d+\.\d+$/)
  })

  it('lege input → geen crash, outcomes leeg', () => {
    const emptyInput = {
      mode: 'ASSESSMENT' as const,
      roster: { presentRoles: [] },
      scenario: { rounds: [], decisionPoints: [], injects: [] },
      events: [],
    }
    const r = scoreExercise(emptyInput)
    expect(r.outcomes).toHaveLength(0)
    expect(r.totalPoints).toBe(0)
  })
})
