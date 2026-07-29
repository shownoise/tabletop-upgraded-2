import { describe, expect, it } from 'vitest'
import { scoreAdapt } from '../dimensions/adapt'
import { scoreAanname } from '../dimensions/aanname'
import { scoreExtern } from '../dimensions/extern'
import { scoreVolhoud } from '../dimensions/volhoud'
import { scoreDelen } from '../dimensions/delen'
import { scoreMandaat } from '../dimensions/mandaat'
import { resolveRoles } from '../role-resolution'
import type { ExerciseEvent, ScenarioSpec } from '../types'

const emptyRounds: ScenarioSpec['rounds'] = [
  { number: 1, designTimeMinutes: 20, outcomeWeights: { CONT: 1, FOR: 1, BC: 1, JUR: 1, VER: 1, KOS: 1 } },
]

describe('ADAPT (§7.4)', () => {
  it('golden 1: alle materiële events juist herzien, alle ruis vastgehouden → J=1 → ADAPT=5', () => {
    const s: ScenarioSpec = {
      rounds: emptyRounds,
      decisionPoints: [],
      injects: [
        { id: 'c1', round: 1, importance: 'crucial', origin: 'scenario' },
        { id: 'c2', round: 1, importance: 'crucial', origin: 'scenario' },
        { id: 'i1', round: 1, importance: 'info',    origin: 'scenario' },
        { id: 'i2', round: 1, importance: 'info',    origin: 'scenario' },
      ],
    }
    const events: ExerciseEvent[] = [
      { kind: 'inject_received', t: 100, round: 1, injectId: 'c1', recipient: 'X' },
      { kind: 'inject_received', t: 200, round: 1, injectId: 'c2', recipient: 'X' },
      { kind: 'inject_received', t: 300, round: 1, injectId: 'i1', recipient: 'X' },
      { kind: 'inject_received', t: 400, round: 1, injectId: 'i2', recipient: 'X' },
      { kind: 'decision_revised', t: 1000, round: 1, decisionPointId: 'dp', optionId: 'o', by: 'X', triggeredByInjectId: 'c1' },
      { kind: 'decision_revised', t: 1500, round: 1, decisionPointId: 'dp', optionId: 'o', by: 'X', triggeredByInjectId: 'c2' },
    ]
    const s2 = scoreAdapt(s, events)
    expect(s2.value).toBeGreaterThan(4)
  })

  it('golden 2: alle ruis leidt tot herziening → Sp=0 → J<0 → ADAPT=0', () => {
    const s: ScenarioSpec = {
      rounds: emptyRounds,
      decisionPoints: [],
      injects: [
        { id: 'i1', round: 1, importance: 'info', origin: 'scenario' },
        { id: 'i2', round: 1, importance: 'info', origin: 'scenario' },
      ],
    }
    const events: ExerciseEvent[] = [
      { kind: 'inject_received', t: 100, round: 1, injectId: 'i1', recipient: 'X' },
      { kind: 'inject_received', t: 200, round: 1, injectId: 'i2', recipient: 'X' },
      { kind: 'decision_revised', t: 1000, round: 1, decisionPointId: 'dp', optionId: 'o', by: 'X', triggeredByInjectId: 'i1' },
      { kind: 'decision_revised', t: 2000, round: 1, decisionPointId: 'dp', optionId: 'o', by: 'X', triggeredByInjectId: 'i2' },
    ]
    const r = scoreAdapt(s, events)
    expect(r.value).toBe(0)
  })

  it('golden 3: geen crucial én geen info → null', () => {
    const r = scoreAdapt({ rounds: emptyRounds, decisionPoints: [], injects: [] }, [])
    expect(r.value).toBe(null)
  })

  it('golden 4: half-half → ADAPT = 5 · (0.5 + 0.5 − 1) = 0', () => {
    const s: ScenarioSpec = {
      rounds: emptyRounds, decisionPoints: [],
      injects: [
        { id: 'c1', round: 1, importance: 'crucial', origin: 'scenario' },
        { id: 'c2', round: 1, importance: 'crucial', origin: 'scenario' },
        { id: 'i1', round: 1, importance: 'info',    origin: 'scenario' },
        { id: 'i2', round: 1, importance: 'info',    origin: 'scenario' },
      ],
    }
    const events: ExerciseEvent[] = [
      { kind: 'inject_received', t: 100, round: 1, injectId: 'c1', recipient: 'X' },
      { kind: 'inject_received', t: 200, round: 1, injectId: 'c2', recipient: 'X' },
      { kind: 'inject_received', t: 300, round: 1, injectId: 'i1', recipient: 'X' },
      { kind: 'inject_received', t: 400, round: 1, injectId: 'i2', recipient: 'X' },
      { kind: 'decision_revised', t: 1000, round: 1, decisionPointId: 'dp', optionId: 'o', by: 'X', triggeredByInjectId: 'c1' },
      { kind: 'decision_revised', t: 2000, round: 1, decisionPointId: 'dp', optionId: 'o', by: 'X', triggeredByInjectId: 'i1' },
    ]
    // Se = 1/2, Sp = 1/2 → J = 0 → ADAPT = 0
    const r = scoreAdapt(s, events)
    expect(r.value).toBe(0)
  })

  it('property: score in [0,5]', () => {
    const s: ScenarioSpec = {
      rounds: emptyRounds, decisionPoints: [],
      injects: [{ id: 'c1', round: 1, importance: 'crucial', origin: 'scenario' }],
    }
    for (let i = 0; i < 20; i++) {
      const events: ExerciseEvent[] = i % 2
        ? [{ kind: 'inject_received', t: 100, round: 1, injectId: 'c1', recipient: 'X' }, { kind: 'decision_revised', t: 200 + i * 100, round: 1, decisionPointId: 'dp', optionId: 'o', by: 'X', triggeredByInjectId: 'c1' }]
        : [{ kind: 'inject_received', t: 100, round: 1, injectId: 'c1', recipient: 'X' }]
      const r = scoreAdapt(s, events)
      if (r.value !== null) {
        expect(r.value).toBeGreaterThanOrEqual(0)
        expect(r.value).toBeLessThanOrEqual(5)
      }
    }
  })
})

describe('AANNAME (§7.3)', () => {
  it('golden 1: geen premissen → null', () => {
    const r = scoreAanname([])
    expect(r.value).toBe(null)
  })

  it('golden 2: alles feit, geen aanname → V=0, F=1 → 5·(0 + 0 + 0) = 0', () => {
    const events: ExerciseEvent[] = [
      { kind: 'decision_submitted', t: 100, round: 1, decisionPointId: 'dp', optionId: 'o', by: 'X',
        premises: [{ text: 'x', kind: 'fact' }, { text: 'y', kind: 'fact' }] },
    ]
    const r = scoreAanname(events)
    expect(r.value).toBe(0)
  })

  it('golden 3: alles aanname met falsificatietrigger → H=1, F=0, V=1 → 5·(0.45+0.25+0.30) = 5', () => {
    const events: ExerciseEvent[] = [
      { kind: 'decision_submitted', t: 100, round: 1, decisionPointId: 'dp', optionId: 'o', by: 'X',
        premises: [
          { text: 'x', kind: 'assumption', falsificationTrigger: 'als y' },
          { text: 'y', kind: 'assumption', falsificationTrigger: 'als z' },
        ] },
    ]
    const r = scoreAanname(events)
    expect(r.value).toBe(5)
  })

  it('golden 4: 1 fact + 1 aanname zonder trigger → H=0.5, F=0.5, V=0 → 5·(0.225+0.125+0) = 1.75', () => {
    const events: ExerciseEvent[] = [
      { kind: 'decision_submitted', t: 100, round: 1, decisionPointId: 'dp', optionId: 'o', by: 'X',
        premises: [{ text: 'x', kind: 'fact' }, { text: 'y', kind: 'assumption' }] },
    ]
    const r = scoreAanname(events)
    expect(r.value).toBeCloseTo(1.75, 3)
  })

  it('golden 5: legacy `assumptions` veld werkt naast `premises`', () => {
    const events: ExerciseEvent[] = [
      { kind: 'decision_submitted', t: 100, round: 1, decisionPointId: 'dp', optionId: 'o', by: 'X',
        assumptions: [{ text: 'x', kind: 'assumption', falsificationTrigger: 'als y' }] },
    ]
    const r = scoreAanname(events)
    expect(r.value).toBe(5)
  })
})

describe('EXTERN (§7.5)', () => {
  it('golden 1: geen partijen → null', () => {
    const s: ScenarioSpec = { rounds: emptyRounds, decisionPoints: [], injects: [] }
    expect(scoreExtern(s, []).value).toBe(null)
  })

  it('golden 2: alle partijen op tijd en actionable → 5', () => {
    const s: ScenarioSpec = {
      rounds: emptyRounds, decisionPoints: [], injects: [],
      externalParties: [
        { id: 'a', label: 'A', weight: 1, toleranceHours: 2, window: { openHours: 0, closeHours: 24 } },
        { id: 'b', label: 'B', weight: 2, toleranceHours: 4, window: { openHours: 0, closeHours: 72 } },
      ],
    }
    const events: ExerciseEvent[] = [
      { kind: 'session_start', t: 0 },
      { kind: 'external_party_activated', t: 3600_000, partyId: 'a', actionable: 1 },
      { kind: 'external_party_activated', t: 7200_000, partyId: 'b', actionable: 1 },
    ]
    expect(scoreExtern(s, events).value).toBe(5)
  })

  it('golden 3: partij nooit geactiveerd (τ=0, q=0) → 0', () => {
    const s: ScenarioSpec = {
      rounds: emptyRounds, decisionPoints: [], injects: [],
      externalParties: [{ id: 'a', label: 'A', weight: 1, toleranceHours: 2 }],
    }
    const events: ExerciseEvent[] = [{ kind: 'session_start', t: 0 }]
    expect(scoreExtern(s, events).value).toBe(0)
  })

  it('golden 4: te laat maar binnen tolerantie (2u overshoot, κ=2 → exp(−1))', () => {
    const s: ScenarioSpec = {
      rounds: emptyRounds, decisionPoints: [], injects: [],
      externalParties: [{ id: 'a', label: 'A', weight: 1, toleranceHours: 2, window: { openHours: 0, closeHours: 24 } }],
    }
    const events: ExerciseEvent[] = [
      { kind: 'session_start', t: 0 },
      { kind: 'external_party_activated', t: 26 * 3600_000, partyId: 'a', actionable: 1 },
    ]
    const r = scoreExtern(s, events)
    // τ = exp(-2/2) ≈ 0.368, q=1 → 0.6·0.368 + 0.4·1 = 0.6208 → 5·0.6208 ≈ 3.1
    expect(r.value).toBeCloseTo(3.1, 1)
  })

  it('golden 5: facilitator q_j override wint van event-actionable', () => {
    const s: ScenarioSpec = {
      rounds: emptyRounds, decisionPoints: [], injects: [],
      externalParties: [{ id: 'a', label: 'A', weight: 1, toleranceHours: 2 }],
    }
    const events: ExerciseEvent[] = [
      { kind: 'session_start', t: 0 },
      { kind: 'external_party_activated', t: 100, partyId: 'a', actionable: 1 },
      { kind: 'facilitator_q_j', t: 1000, partyId: 'a', value: 0 },
    ]
    // τ=1 (want geactiveerd, geen venster), q=0 → 5 · 0.6 = 3
    expect(scoreExtern(s, events).value).toBe(3)
  })
})

describe('VOLHOUD (§7.6)', () => {
  it('golden 1: geen snapshot → null', () => {
    expect(scoreVolhoud([]).value).toBe(null)
  })

  it('golden 2: rooster op tijd, gelijk verdeeld, geen overwerk, O=1 → 5', () => {
    const events: ExerciseEvent[] = [
      { kind: 'roster_snapshot', t: 0, hoursWorkedByRole: { A: 6, B: 6, C: 6 }, taskShareByRole: { A: 1, B: 1, C: 1 },
        hasRoster: true, rosterCreatedBeforeHour: 4 },
      { kind: 'facilitator_handoff_quality', t: 1, value: 1 },
    ]
    expect(scoreVolhoud(events).value).toBe(5)
  })

  it('golden 3: één persoon houdt 60% van taken → N_eff ≈ 2.4 in team van 5 → U=0.48', () => {
    const events: ExerciseEvent[] = [
      { kind: 'roster_snapshot', t: 0,
        hoursWorkedByRole: { A: 6, B: 6, C: 6, D: 6, E: 6 },
        taskShareByRole: { A: 6, B: 1, C: 1, D: 1, E: 1 }, // A=60% (6/10)
        hasRoster: true, rosterCreatedBeforeHour: 4 },
      { kind: 'facilitator_handoff_quality', t: 1, value: 1 },
    ]
    const r = scoreVolhoud(events)
    // N_eff = 1/(0.36+0.01·4) = 1/0.40 = 2.5 in team van 5 → U=0.5
    expect(r.detail?.U).toBeGreaterThan(0.4)
    expect(r.detail?.U).toBeLessThan(0.6)
  })

  it('golden 4: 20u werktijd → F = max(0, 1 − 8/12) = 0.333', () => {
    const events: ExerciseEvent[] = [
      { kind: 'roster_snapshot', t: 0, hoursWorkedByRole: { A: 20 }, taskShareByRole: { A: 1 },
        hasRoster: true, rosterCreatedBeforeHour: 4 },
      { kind: 'facilitator_handoff_quality', t: 1, value: 1 },
    ]
    const r = scoreVolhoud(events)
    expect(r.detail?.F).toBeCloseTo(1/3, 2)
  })

  it('golden 5: geen overdracht-input → dataQuality=observation, term valt uit weging', () => {
    const events: ExerciseEvent[] = [
      { kind: 'roster_snapshot', t: 0, hoursWorkedByRole: { A: 6 }, taskShareByRole: { A: 1 },
        hasRoster: true, rosterCreatedBeforeHour: 4 },
    ]
    const r = scoreVolhoud(events)
    expect(r.dataQuality).toBe('observation')
    expect(r.value).not.toBe(null)
  })
})

describe('DELEN (§7.7)', () => {
  const scenario: ScenarioSpec = {
    rounds: emptyRounds, decisionPoints: [],
    injects: [
      { id: 'a', round: 1, importance: 'crucial', origin: 'scenario', visibleTo: ['LEGAL_DPO'] },
      { id: 'b', round: 1, importance: 'crucial', origin: 'scenario', visibleTo: ['FINANCE_PROC'] },
    ],
  }
  const fullTeam = { presentRoles: ['LEGAL_DPO', 'FINANCE_PROC', 'IT_LEAD', 'SECURITY_LEAD', 'COMMS', 'CRISIS_LEAD'] }

  it('golden 1: geen visibleTo-injects → null', () => {
    const s: ScenarioSpec = { rounds: emptyRounds, decisionPoints: [], injects: [] }
    const res = resolveRoles(fullTeam, s)
    expect(scoreDelen(s, [], res).value).toBe(null)
  })

  it('golden 2: rolCoverage < 0.4 → null met reden', () => {
    const roster = { presentRoles: ['CRISIS_LEAD'] }
    const res = resolveRoles(roster, scenario)
    const r = scoreDelen(scenario, [], res)
    expect(r.value).toBe(null)
    expect(r.reason).toContain('rolCoverage')
  })

  it('golden 3: allemaal onmiddellijk gedeeld (0 min) → 5', () => {
    const res = resolveRoles(fullTeam, scenario)
    const events: ExerciseEvent[] = [
      { kind: 'inject_received', t: 100, round: 1, injectId: 'a', recipient: 'LEGAL_DPO' },
      { kind: 'inject_shared',   t: 100, round: 1, injectId: 'a', sharedBy: 'LEGAL_DPO' },
      { kind: 'inject_received', t: 200, round: 1, injectId: 'b', recipient: 'FINANCE_PROC' },
      { kind: 'inject_shared',   t: 200, round: 1, injectId: 'b', sharedBy: 'FINANCE_PROC' },
    ]
    expect(scoreDelen(scenario, events, res).value).toBe(5)
  })

  it('golden 4: 10 min vertraging → 5·exp(-1) ≈ 1.84', () => {
    const res = resolveRoles(fullTeam, scenario)
    const events: ExerciseEvent[] = [
      { kind: 'inject_received', t: 0,       round: 1, injectId: 'a', recipient: 'LEGAL_DPO' },
      { kind: 'inject_shared',   t: 600_000, round: 1, injectId: 'a', sharedBy: 'LEGAL_DPO' },
      { kind: 'inject_received', t: 0,       round: 1, injectId: 'b', recipient: 'FINANCE_PROC' },
      { kind: 'inject_shared',   t: 600_000, round: 1, injectId: 'b', sharedBy: 'FINANCE_PROC' },
    ]
    expect(scoreDelen(scenario, events, res).value).toBeCloseTo(5 * Math.exp(-1), 3)
  })

  it('golden 5: nooit gedeeld → 0', () => {
    const res = resolveRoles(fullTeam, scenario)
    const events: ExerciseEvent[] = [
      { kind: 'inject_received', t: 100, round: 1, injectId: 'a', recipient: 'LEGAL_DPO' },
    ]
    expect(scoreDelen(scenario, events, res).value).toBe(0)
  })
})

describe('MANDAAT (§7.2)', () => {
  const bigTeam = { presentRoles: ['LEGAL_DPO', 'FINANCE_PROC', 'IT_LEAD', 'SECURITY_LEAD', 'COMMS', 'CRISIS_LEAD'] }

  it('golden 1: distinctOwners < 3 → null', () => {
    const roster = { presentRoles: ['CRISIS_LEAD'] }
    const scenario: ScenarioSpec = { rounds: emptyRounds, decisionPoints: [], injects: [] }
    const res = resolveRoles(roster, scenario)
    const r = scoreMandaat(scenario, [], res)
    expect(r.value).toBe(null)
    expect(r.reason).toContain('distinctOwners')
  })

  it('golden 2: alle beslissingen door correcte owner → gemM=1', () => {
    const scenario: ScenarioSpec = {
      rounds: emptyRounds,
      decisionPoints: [
        { id: 'r1-jur',  round: 1, domain: 'JURIDISCH',   designedOwner: 'LEGAL_DPO',    options: [{ id: 'o', outcomeVector: zeroVec() }] },
        { id: 'r1-geld', round: 1, domain: 'GELD',         designedOwner: 'FINANCE_PROC', options: [{ id: 'o', outcomeVector: zeroVec() }] },
        { id: 'r1-cont', round: 1, domain: 'CONTAINMENT',  designedOwner: 'SECURITY_LEAD',options: [{ id: 'o', outcomeVector: zeroVec() }] },
      ],
      injects: [],
    }
    const res = resolveRoles(bigTeam, scenario)
    const events: ExerciseEvent[] = [
      { kind: 'decision_submitted', t: 100, round: 1, decisionPointId: 'r1-jur',  optionId: 'o', by: 'LEGAL_DPO' },
      { kind: 'decision_submitted', t: 200, round: 1, decisionPointId: 'r1-geld', optionId: 'o', by: 'FINANCE_PROC' },
      { kind: 'decision_submitted', t: 300, round: 1, decisionPointId: 'r1-cont', optionId: 'o', by: 'SECURITY_LEAD' },
    ]
    const r = scoreMandaat(scenario, events, res)
    expect(r.detail?.gemM).toBe(1)
    expect(r.value).toBeGreaterThan(3)  // 0.4·1 + andere termen = 2.0+, mogelijk hoger
  })

  it('golden 3: alle beslissingen door de verkeerde rol → gemM=0', () => {
    const scenario: ScenarioSpec = {
      rounds: emptyRounds,
      decisionPoints: [
        { id: 'r1-jur', round: 1, domain: 'JURIDISCH', designedOwner: 'LEGAL_DPO', options: [{ id: 'o', outcomeVector: zeroVec() }] },
        { id: 'r1-geld', round: 1, domain: 'GELD',     designedOwner: 'FINANCE_PROC', options: [{ id: 'o', outcomeVector: zeroVec() }] },
        { id: 'r1-cont', round: 1, domain: 'CONTAINMENT', designedOwner: 'SECURITY_LEAD', options: [{ id: 'o', outcomeVector: zeroVec() }] },
      ], injects: [],
    }
    const res = resolveRoles(bigTeam, scenario)
    const events: ExerciseEvent[] = [
      { kind: 'decision_submitted', t: 100, round: 1, decisionPointId: 'r1-jur',  optionId: 'o', by: 'IT_LEAD' },
      { kind: 'decision_submitted', t: 200, round: 1, decisionPointId: 'r1-geld', optionId: 'o', by: 'IT_LEAD' },
      { kind: 'decision_submitted', t: 300, round: 1, decisionPointId: 'r1-cont', optionId: 'o', by: 'IT_LEAD' },
    ]
    const r = scoreMandaat(scenario, events, res)
    expect(r.detail?.gemM).toBe(0)
  })

  it('golden 4: co-sign schending → m=0 voor dat besluit', () => {
    const scenario: ScenarioSpec = {
      rounds: emptyRounds,
      decisionPoints: [
        { id: 'r1-jur',  round: 1, domain: 'JURIDISCH',  designedOwner: 'LEGAL_DPO',  options: [{ id: 'o', outcomeVector: zeroVec(), requiresCosign: ['CRISIS_LEAD'] }] },
        { id: 'r1-geld', round: 1, domain: 'GELD',       designedOwner: 'FINANCE_PROC', options: [{ id: 'o', outcomeVector: zeroVec() }] },
        { id: 'r1-cont', round: 1, domain: 'CONTAINMENT',designedOwner: 'SECURITY_LEAD',options: [{ id: 'o', outcomeVector: zeroVec() }] },
      ], injects: [],
    }
    const res = resolveRoles(bigTeam, scenario)
    const events: ExerciseEvent[] = [
      // LEGAL_DPO tekent alleen — co-sign door CRISIS_LEAD ontbreekt
      { kind: 'decision_submitted', t: 100, round: 1, decisionPointId: 'r1-jur',  optionId: 'o', by: 'LEGAL_DPO' },
      { kind: 'decision_submitted', t: 200, round: 1, decisionPointId: 'r1-geld', optionId: 'o', by: 'FINANCE_PROC' },
      { kind: 'decision_submitted', t: 300, round: 1, decisionPointId: 'r1-cont', optionId: 'o', by: 'SECURITY_LEAD' },
    ]
    const r = scoreMandaat(scenario, events, res)
    // 1 besluit m=0, 2 besluiten m=1 → gemM = 2/3
    expect(r.detail?.gemM).toBeCloseTo(2/3, 3)
  })

  it('golden 5: co-sign vervalt als rol onbezet is (Deel B §1.3)', () => {
    // BUSINESS_OWNER onbezet: requiresCosign daarnaar vervalt.
    const rosterMissingBO = { presentRoles: ['LEGAL_DPO', 'FINANCE_PROC', 'IT_LEAD', 'SECURITY_LEAD', 'CRISIS_LEAD'] }
    const scenario: ScenarioSpec = {
      rounds: emptyRounds,
      decisionPoints: [
        { id: 'r1-jur',  round: 1, domain: 'JURIDISCH',   designedOwner: 'LEGAL_DPO',   options: [{ id: 'o', outcomeVector: zeroVec(), requiresCosign: ['BUSINESS_OWNER'] }] },
        { id: 'r1-cont', round: 1, domain: 'CONTAINMENT', designedOwner: 'SECURITY_LEAD',options: [{ id: 'o', outcomeVector: zeroVec() }] },
        { id: 'r1-geld', round: 1, domain: 'GELD',        designedOwner: 'FINANCE_PROC', options: [{ id: 'o', outcomeVector: zeroVec() }] },
      ], injects: [],
    }
    const res = resolveRoles(rosterMissingBO, scenario)
    const events: ExerciseEvent[] = [
      { kind: 'decision_submitted', t: 100, round: 1, decisionPointId: 'r1-jur', optionId: 'o', by: 'LEGAL_DPO' },
      { kind: 'decision_submitted', t: 200, round: 1, decisionPointId: 'r1-geld', optionId: 'o', by: 'FINANCE_PROC' },
      { kind: 'decision_submitted', t: 300, round: 1, decisionPointId: 'r1-cont', optionId: 'o', by: 'SECURITY_LEAD' },
    ]
    const r = scoreMandaat(scenario, events, res)
    // Co-sign zou anders m=0 forceren; met vervalling m=1 → gemM=1
    expect(r.detail?.gemM).toBe(1)
  })
})

function zeroVec(): Record<'CONT' | 'FOR' | 'BC' | 'JUR' | 'VER' | 'KOS', number> {
  return { CONT: 0, FOR: 0, BC: 0, JUR: 0, VER: 0, KOS: 0 }
}
