import { describe, expect, it } from 'vitest'
import { computeRoundOutcome, cumulativeOutcome } from '../outcome-round'
import type { ExerciseEvent, ScenarioSpec } from '../types'

const baseScenario: ScenarioSpec = {
  rounds: [
    { number: 1, designTimeMinutes: 20, outcomeWeights: { CONT: 3, FOR: 3, BC: 2, JUR: 1, VER: 1, KOS: 1 } },
    { number: 2, designTimeMinutes: 20, outcomeWeights: { CONT: 1, FOR: 1, BC: 1, JUR: 3, VER: 2, KOS: 1 } },
  ],
  decisionPoints: [
    { id: 'r1-dp', round: 1, domain: 'CONTAINMENT', designedOwner: 'SEC', options: [
      { id: 'best',   outcomeVector: { CONT:  2, FOR:  2, BC:  0, JUR:  0, VER: 0, KOS: -1 } },
      { id: 'medium', outcomeVector: { CONT:  1, FOR:  0, BC: -1, JUR:  0, VER: 0, KOS:  0 } },
      { id: 'worst',  outcomeVector: { CONT: -2, FOR: -2, BC: -2, JUR: -2, VER: -2, KOS: -2 } },
    ] },
  ],
  injects: [],
}

const eventsWith = (optionId: string, dpId: string = 'r1-dp'): ExerciseEvent[] => [
  { kind: 'session_start', t: 0 },
  { kind: 'decision_submitted', t: 1000, round: 1, decisionPointId: dpId, optionId, by: 'SEC' },
]

describe('RONDE_UITKOMST (§5)', () => {
  it('golden 1: alle vectoren +2 met gelijke weights → normalized = 1', () => {
    const s: ScenarioSpec = {
      rounds: [{ number: 1, designTimeMinutes: 20, outcomeWeights: { CONT: 1, FOR: 1, BC: 1, JUR: 1, VER: 1, KOS: 1 } }],
      decisionPoints: [{ id: 'dp', round: 1, domain: 'CONTAINMENT', designedOwner: 'X', options: [
        { id: 'perfect', outcomeVector: { CONT: 2, FOR: 2, BC: 2, JUR: 2, VER: 2, KOS: 2 } },
      ] }],
      injects: [],
    }
    const o = computeRoundOutcome(s, eventsWith('perfect', 'dp'), 1)
    expect(o.normalized).toBeCloseTo(1, 4)
    expect(o.points).toBe(100)
  })

  it('golden 2: alle vectoren −2 → normalized = −1, points = 0', () => {
    const s: ScenarioSpec = {
      rounds: [{ number: 1, designTimeMinutes: 20, outcomeWeights: { CONT: 1, FOR: 1, BC: 1, JUR: 1, VER: 1, KOS: 1 } }],
      decisionPoints: [{ id: 'dp', round: 1, domain: 'CONTAINMENT', designedOwner: 'X', options: [
        { id: 'terrible', outcomeVector: { CONT: -2, FOR: -2, BC: -2, JUR: -2, VER: -2, KOS: -2 } },
      ] }],
      injects: [],
    }
    const o = computeRoundOutcome(s, eventsWith('terrible', 'dp'), 1)
    expect(o.normalized).toBeCloseTo(-1, 4)
    expect(o.points).toBe(0)
  })

  it('golden 3: alle nul → normalized=0, points=50', () => {
    const s: ScenarioSpec = {
      rounds: [{ number: 1, designTimeMinutes: 20, outcomeWeights: { CONT: 1, FOR: 1, BC: 1, JUR: 1, VER: 1, KOS: 1 } }],
      decisionPoints: [{ id: 'dp', round: 1, domain: 'CONTAINMENT', designedOwner: 'X', options: [
        { id: 'neutral', outcomeVector: { CONT: 0, FOR: 0, BC: 0, JUR: 0, VER: 0, KOS: 0 } },
      ] }],
      injects: [],
    }
    const o = computeRoundOutcome(s, eventsWith('neutral', 'dp'), 1)
    expect(o.normalized).toBe(0)
    expect(o.points).toBe(50)
  })

  it('golden 4: weging accentueert CONT+FOR (ransomware R1) → positieve outcome', () => {
    const o = computeRoundOutcome(baseScenario, eventsWith('best'), 1)
    // vector: CONT+2 FOR+2 BC 0 JUR 0 VER 0 KOS−1; gewichten 3/3/2/1/1/1 → 6+6+0+0+0−1 = 11
    // noemer: (3+3+2+1+1+1)*2 = 22 → 0.5
    expect(o.normalized).toBeCloseTo(11 / 22, 4)
    expect(o.points).toBe(75)
  })

  it('golden 5: geen inzending → fallback-vector (Deel B §7.1)', () => {
    // Geen decision_submitted. Fallback vector: CONT:-1, FOR:0, BC:-1, JUR:-1, VER:0, KOS:0
    const o = computeRoundOutcome(baseScenario, [{ kind: 'session_start', t: 0 }], 1)
    // R1 weights: 3/3/2/1/1/1 → 3·(-1) + 3·0 + 2·(-1) + 1·(-1) + 1·0 + 1·0 = -3 -2 -1 = -6
    // noemer 22 → normalized = -6/22 ≈ -0.273
    expect(o.normalized).toBeCloseTo(-6 / 22, 4)
  })

  it('property: points = round(100 · (normalized+1) / 2), altijd 0..100', () => {
    for (const opt of ['best', 'medium', 'worst']) {
      const o = computeRoundOutcome(baseScenario, eventsWith(opt), 1)
      expect(o.points).toBeGreaterThanOrEqual(0)
      expect(o.points).toBeLessThanOrEqual(100)
      expect(o.points).toBe(Math.round(100 * (o.normalized + 1) / 2))
    }
  })

  it('cumulatief: som per dimensie over rondes', () => {
    const events: ExerciseEvent[] = [
      { kind: 'session_start', t: 0 },
      { kind: 'decision_submitted', t: 1000, round: 1, decisionPointId: 'r1-dp', optionId: 'best', by: 'SEC' },
    ]
    const cum = cumulativeOutcome(baseScenario, events, 1)
    expect(cum.CONT).toBeCloseTo(2, 4)
    expect(cum.FOR).toBeCloseTo(2, 4)
  })
})
