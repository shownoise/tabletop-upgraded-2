import { describe, expect, it } from 'vitest'
import { buildReveal, buildEndReveal } from '../reveal'
import type { ExerciseEvent, ScenarioSpec } from '../types'

const scenario: ScenarioSpec = {
  rounds: [
    { number: 1, designTimeMinutes: 20, outcomeWeights: { CONT: 3, FOR: 3, BC: 2, JUR: 1, VER: 1, KOS: 1 } },
    { number: 2, designTimeMinutes: 20, outcomeWeights: { CONT: 1, FOR: 1, BC: 1, JUR: 3, VER: 2, KOS: 1 } },
  ],
  decisionPoints: [
    { id: 'r1-cont', round: 1, domain: 'CONTAINMENT', designedOwner: 'SEC', options: [
      { id: 'best',   outcomeVector: { CONT:  2, FOR:  2, BC:  0, JUR: 0, VER: 0, KOS: -1 }, debriefNote: 'Snelheid + bewijsbehoud' },
      { id: 'bad',    outcomeVector: { CONT: -2, FOR: -2, BC:  0, JUR: 0, VER: 0, KOS:  0 } },
      { id: 'medium', outcomeVector: { CONT:  1, FOR:  0, BC:  0, JUR: 0, VER: 0, KOS:  0 } },
    ] },
    { id: 'r2-jur', round: 2, domain: 'JURIDISCH', designedOwner: 'LEGAL_DPO', options: [
      { id: 'ok',   outcomeVector: { CONT: 0, FOR: 0, BC: 0, JUR:  2, VER: 1, KOS: -1 } },
      { id: 'bad',  outcomeVector: { CONT: 0, FOR: 0, BC: 0, JUR: -2, VER: 0, KOS:  0 } },
    ] },
  ],
  injects: [],
}

const groups = [
  { id: 'g1', participantIds: ['p1'] },
  { id: 'g2', participantIds: ['p2'] },
  { id: 'g3', participantIds: ['p3'] },
]

describe('reveal (Deel B §5.2)', () => {
  it('per-ronde reveal toont keuzeverdeling per beslispunt', () => {
    const events: ExerciseEvent[] = [
      { kind: 'decision_submitted', t: 100, round: 1, decisionPointId: 'r1-cont', optionId: 'best',   by: 'p1' },
      { kind: 'decision_submitted', t: 100, round: 1, decisionPointId: 'r1-cont', optionId: 'best',   by: 'p2' },
      { kind: 'decision_submitted', t: 100, round: 1, decisionPointId: 'r1-cont', optionId: 'bad',    by: 'p3' },
    ]
    const reveal = buildReveal({ scenario, events, round: 1, groups })
    expect(reveal.decisionReveals).toHaveLength(1)
    // Verdeling: 2 groepen 'best', 1 groep 'bad'
    expect(reveal.decisionReveals[0].optionDistribution).toEqual({ best: 2, bad: 1 })
  })

  it('elke optie krijgt zijn vector + debriefNote in de reveal', () => {
    const reveal = buildReveal({ scenario, events: [], round: 1, groups })
    const cont = reveal.decisionReveals[0]
    expect(cont.optionVectors).toHaveLength(3)
    const bestVec = cont.optionVectors.find(o => o.optionId === 'best')!
    expect(bestVec.debriefNote).toBe('Snelheid + bewijsbehoud')
    expect(bestVec.outcomeVector.CONT).toBe(2)
  })

  it('divergentie 0 bij unanieme keuze, log2(2) bij 50/50', () => {
    const unanimous: ExerciseEvent[] = groups.map<ExerciseEvent>(g => ({
      kind: 'decision_submitted', t: 100, round: 1, decisionPointId: 'r1-cont', optionId: 'best', by: g.participantIds[0],
    }))
    const r1 = buildReveal({ scenario, events: unanimous, round: 1, groups: groups.slice(0, 2) })
    expect(r1.decisionReveals[0].divergence).toBe(0)

    const split: ExerciseEvent[] = [
      { kind: 'decision_submitted', t: 100, round: 1, decisionPointId: 'r1-cont', optionId: 'best', by: 'p1' },
      { kind: 'decision_submitted', t: 100, round: 1, decisionPointId: 'r1-cont', optionId: 'bad',  by: 'p2' },
    ]
    const r2 = buildReveal({ scenario, events: split, round: 1, groups: groups.slice(0, 2) })
    expect(r2.decisionReveals[0].divergence).toBeCloseTo(Math.log2(2), 4)  // = 1.0
  })

  it('standings zijn per groep en gesorteerd op punten aflopend', () => {
    const events: ExerciseEvent[] = [
      { kind: 'decision_submitted', t: 100, round: 1, decisionPointId: 'r1-cont', optionId: 'best',   by: 'p1' },
      { kind: 'decision_submitted', t: 100, round: 1, decisionPointId: 'r1-cont', optionId: 'medium', by: 'p2' },
      { kind: 'decision_submitted', t: 100, round: 1, decisionPointId: 'r1-cont', optionId: 'bad',    by: 'p3' },
    ]
    const reveal = buildReveal({ scenario, events, round: 1, groups })
    expect(reveal.standings).toHaveLength(3)
    expect(reveal.standings[0].groupId).toBe('g1')  // best
    expect(reveal.standings[2].groupId).toBe('g3')  // bad
    expect(reveal.standings[0].totalPoints).toBeGreaterThan(reveal.standings[1].totalPoints)
    expect(reveal.standings[1].totalPoints).toBeGreaterThan(reveal.standings[2].totalPoints)
  })

  it('endreveal: causale keten — groepen die R1 met negatief FOR eindigden, wat kozen ze in R2?', () => {
    const events: ExerciseEvent[] = [
      // g1: goede R1 (positieve FOR)
      { kind: 'decision_submitted', t: 100, round: 1, decisionPointId: 'r1-cont', optionId: 'best', by: 'p1' },
      // g2: slechte R1 (FOR = -2)
      { kind: 'decision_submitted', t: 100, round: 1, decisionPointId: 'r1-cont', optionId: 'bad',  by: 'p2' },
      // g3: slechte R1 én slechte R2
      { kind: 'decision_submitted', t: 100, round: 1, decisionPointId: 'r1-cont', optionId: 'bad',  by: 'p3' },
      // R2: g2 en g3 kozen 'bad'
      { kind: 'decision_submitted', t: 200, round: 2, decisionPointId: 'r2-jur',  optionId: 'bad',  by: 'p2' },
      { kind: 'decision_submitted', t: 200, round: 2, decisionPointId: 'r2-jur',  optionId: 'bad',  by: 'p3' },
    ]
    const end = buildEndReveal({ scenario, events, groups })
    const forChain = end.causalChains.find(c => c.dimension === 'FOR')
    expect(forChain).toBeDefined()
    expect(forChain!.groupsBelow).toContain('g2')
    expect(forChain!.groupsBelow).toContain('g3')
    expect(forChain!.consequenceOptions.some(o => o.startsWith('r2-jur:'))).toBe(true)
  })

  it('endreveal: finale stand bevat alle groepen', () => {
    const events: ExerciseEvent[] = groups.map<ExerciseEvent>((g, i) => ({
      kind: 'decision_submitted', t: 100 + i, round: 1, decisionPointId: 'r1-cont',
      optionId: i === 0 ? 'best' : i === 1 ? 'medium' : 'bad', by: g.participantIds[0],
    }))
    const end = buildEndReveal({ scenario, events, groups })
    expect(end.finalStandings).toHaveLength(3)
    expect(end.perGroupOutcomes.g1).toHaveLength(2)  // 2 rondes
    expect(end.perGroupOutcomes.g2).toHaveLength(2)
    expect(end.perGroupOutcomes.g3).toHaveLength(2)
  })

  it('per-ronde reveal-payload bevat decisionReveals en standings (geen weights meer sinds 2026-08-14)', () => {
    const reveal = buildReveal({ scenario, events: [], round: 1, groups })
    expect(reveal).toHaveProperty('decisionReveals')
    expect(reveal).toHaveProperty('standings')
    expect(reveal).not.toHaveProperty('weights')
  })
})
