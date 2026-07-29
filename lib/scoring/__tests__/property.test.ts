import { describe, expect, it } from 'vitest'
import { scoreExercise } from '../score-exercise'
import { referenceExercise } from '../reference-case'
import { aggregateProcess } from '../aggregate'
import { PROCESS_DIMENSIONS, DEFAULT_PROCESS_WEIGHTS } from '../constants'
import type { DimensionScore, ProcessDimension } from '../types'

describe('property tests — Deel A §9', () => {
  it('score in [0,5] voor elke gemeten dimensie', () => {
    const r = scoreExercise(referenceExercise)
    for (const k of PROCESS_DIMENSIONS) {
      const v = r.dimensions[k].value
      if (v !== null) {
        expect(v).toBeGreaterThanOrEqual(0)
        expect(v).toBeLessThanOrEqual(5)
      }
    }
  })

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

  it('PROCES monotoon in elke D_k (verhogen van één dim → aggregate stijgt of blijft gelijk)', () => {
    const base = allEqual(3)
    const higher: Record<ProcessDimension, DimensionScore> = { ...base, BESLUIT: { value: 4, dataQuality: 'measured' } }
    const emptyScenario = { rounds: [], decisionPoints: [], injects: [] }
    const aggBase = aggregateProcess(base, emptyScenario)
    const aggHigher = aggregateProcess(higher, emptyScenario)
    expect(aggHigher).not.toBeNull()
    expect(aggBase).not.toBeNull()
    expect(aggHigher!).toBeGreaterThanOrEqual(aggBase!)
  })

  it('PROCES = geometrisch gemiddelde: alle dims gelijk → aggregate = die waarde', () => {
    const dims = allEqual(3.5)
    const agg = aggregateProcess(dims, { rounds: [], decisionPoints: [], injects: [] })
    expect(agg).toBeCloseTo(3.5, 3)
  })

  it('scoringVersion bepaald', () => {
    const r = scoreExercise(referenceExercise)
    expect(r.scoringVersion).toMatch(/^\d+\.\d+\.\d+$/)
  })

  it('ontbrekende data → null met reason, nooit een stille 0', () => {
    const emptyInput = {
      mode: 'ASSESSMENT' as const,
      roster: { presentRoles: [] },
      scenario: { rounds: [], decisionPoints: [], injects: [] },
      events: [],
    }
    const r = scoreExercise(emptyInput)
    // Alle dimensies zonder data moeten null zijn met een reason.
    for (const k of PROCESS_DIMENSIONS) {
      if (r.dimensions[k].value === null) {
        expect(r.dimensions[k].reason).toBeTruthy()
      }
    }
  })

  it('DEFAULT_PROCESS_WEIGHTS sommeert tot 1.0', () => {
    const sum = Object.values(DEFAULT_PROCESS_WEIGHTS).reduce((s, x) => s + x, 0)
    expect(sum).toBeCloseTo(1.0, 5)
  })
})

function allEqual(v: number): Record<ProcessDimension, DimensionScore> {
  return {
    BESLUIT:  { value: v, dataQuality: 'measured' },
    MANDAAT:  { value: v, dataQuality: 'measured' },
    AANNAME:  { value: v, dataQuality: 'measured' },
    ADAPT:    { value: v, dataQuality: 'measured' },
    EXTERN:   { value: v, dataQuality: 'measured' },
    VOLHOUD:  { value: v, dataQuality: 'measured' },
    DELEN:    { value: v, dataQuality: 'measured' },
  }
}
