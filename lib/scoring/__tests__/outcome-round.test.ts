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

  it('golden 4: gelijke weging over 6 dimensies (best-option R1) → positieve outcome', () => {
    const o = computeRoundOutcome(baseScenario, eventsWith('best'), 1)
    // Vector 'best': CONT+2, FOR+2, BC 0, JUR 0, VER 0, KOS-1
    // Som = 3, dim-count = 6, normalized = 3 / (6*2) = 0.25
    expect(o.normalized).toBeCloseTo(3 / 12, 4)
    expect(o.points).toBe(63)
  })

  it('golden 5: geen inzending → hasSubmissions=false, normalized=0 (bug-fix)', () => {
    // Zonder submissions worden onbeantwoorde decisions niet meer als negatieve
    // fallback meegeteld — dat is de "alles negatief na één antwoord"-bug.
    // Impliciete "geen besluit" komt pas na finalizeDecision (LOCK).
    const o = computeRoundOutcome(baseScenario, [{ kind: 'session_start', t: 0 }], 1)
    expect(o.hasSubmissions).toBe(false)
    expect(o.normalized).toBe(0)
    expect(o.points).toBe(50)
  })

  it('bug regressie: partial submissions tellen alleen ingediende decisions', () => {
    // Twee decisions in dezelfde ronde, één ingediend met 'best' → score reflecteert
    // alléén die ene, niet -1 voor de onbeantwoorde.
    const s: ScenarioSpec = {
      rounds: [{ number: 1, designTimeMinutes: 20 }],
      decisionPoints: [
        { id: 'dp1', round: 1, domain: 'CONTAINMENT', designedOwner: 'X', options: [
          { id: 'good', outcomeVector: { CONT: 2, FOR: 1, BC: 0, JUR: 0, VER: 0, KOS: 0 } },
        ] },
        { id: 'dp2', round: 1, domain: 'JURIDISCH', designedOwner: 'Y', options: [
          { id: 'good', outcomeVector: { CONT: 0, FOR: 0, BC: 0, JUR: 2, VER: 1, KOS: 0 } },
        ] },
      ],
      injects: [],
    }
    const events: ExerciseEvent[] = [
      { kind: 'session_start', t: 0 },
      { kind: 'decision_submitted', t: 1000, round: 1, decisionPointId: 'dp1', optionId: 'good', by: 'X' },
      // dp2 blijft onbeantwoord
    ]
    const o = computeRoundOutcome(s, events, 1)
    // Alleen dp1 telt → perDim gelijk aan die vector, normalized = 3/12 = 0.25
    expect(o.perDimension.CONT).toBe(2)
    expect(o.perDimension.JUR).toBe(0)  // niet negatief!
    expect(o.normalized).toBeCloseTo(3 / 12, 4)
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
