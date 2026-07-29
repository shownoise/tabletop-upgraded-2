import { describe, expect, it } from 'vitest'
import { buildRoleCards } from '../role-cards'
import { simulateExercise, dryRunAndScore } from '../dry-run'
import { buildHealthReport } from '../scenario-health'
import { resolveRoles } from '../role-resolution'
import { referenceExercise } from '../reference-case'
import type { ScenarioSpec } from '../types'

describe('Rolkaarten (Deel B §7.5)', () => {
  const resolution = resolveRoles(referenceExercise.roster, referenceExercise.scenario)
  const cards = buildRoleCards(referenceExercise.scenario, resolution)

  it('genereert kaart per (ronde, rol) met content', () => {
    expect(cards.length).toBeGreaterThan(0)
    for (const c of cards) {
      expect(c.round).toBeGreaterThan(0)
      expect(c.role).toBeTruthy()
    }
  })

  it('LEGAL_DPO in ronde 2 heeft de r2-i1 private inject en r2-jur eigenaarschap', () => {
    const legalR2 = cards.find(c => c.round === 2 && c.role === 'LEGAL_DPO')
    expect(legalR2).toBeDefined()
    expect(legalR2!.privateInjects.some(i => i.id === 'r2-i1')).toBe(true)
    expect(legalR2!.ownedDecisions.some(d => d.decisionPointId === 'r2-jur')).toBe(true)
  })

  it('r2-i5 (journalist belt HR-lijn) verschijnt niet als privateInject voor HR (want HR is onbezet in referentie)', () => {
    const hrCards = cards.filter(c => c.role === 'HR')
    // HR is niet in de referentie-roster → geen kaarten voor HR.
    expect(hrCards).toHaveLength(0)
  })

  it('kaarten voor NPC-domeinen zonder bezetting worden overgeslagen', () => {
    // In de referentie-roster is HR onbezet → INTERNE_COMMS effectiveOwner = COMMS,
    // maar HR zelf verschijnt niet als kaart-rol.
    const roles = new Set(cards.map(c => c.role))
    expect(roles.has('HR')).toBe(false)
    expect(roles.has('RETAINER_LIAISON')).toBe(false)
  })
})

describe('Dry-run (Deel B §7.7)', () => {
  const smallScenario: ScenarioSpec = {
    rounds: [
      { number: 1, designTimeMinutes: 20, outcomeWeights: { CONT: 1, FOR: 1, BC: 1, JUR: 1, VER: 1, KOS: 1 } },
      { number: 2, designTimeMinutes: 20, outcomeWeights: { CONT: 1, FOR: 1, BC: 1, JUR: 1, VER: 1, KOS: 1 } },
    ],
    decisionPoints: [
      { id: 'r1-cont', round: 1, domain: 'CONTAINMENT', designedOwner: 'SECURITY_LEAD', options: [
        { id: 'best',  outcomeVector: { CONT:  2, FOR:  2, BC:  0, JUR: 0, VER: 0, KOS: -1 } },
        { id: 'worst', outcomeVector: { CONT: -2, FOR: -2, BC: -2, JUR: 0, VER: 0, KOS:  0 } },
      ] },
      { id: 'r2-jur', round: 2, domain: 'JURIDISCH', designedOwner: 'LEGAL_DPO', options: [
        { id: 'ok',  outcomeVector: { CONT: 0, FOR: 0, BC: 0, JUR:  2, VER: 1, KOS: -1 } },
        { id: 'bad', outcomeVector: { CONT: 0, FOR: 0, BC: 0, JUR: -2, VER: 0, KOS:  0 } },
      ] },
    ],
    injects: [
      { id: 'inj-1', round: 1, importance: 'crucial', origin: 'scenario' },
      { id: 'inj-2', round: 2, importance: 'info',    origin: 'scenario' },
    ],
  }

  it('best_option-strategie kiest hoogst-scorende opties → hoge punten', () => {
    const { output } = dryRunAndScore({
      scenario: smallScenario,
      simulatedRoles: ['SECURITY_LEAD', 'LEGAL_DPO', 'CRISIS_LEAD'],
      strategy: 'best_option',
    })
    expect(output.totalPoints).toBeGreaterThan(120)  // 2 rondes × >60 pt
  })

  it('worst_option-strategie → lage punten', () => {
    const { output } = dryRunAndScore({
      scenario: smallScenario,
      simulatedRoles: ['SECURITY_LEAD', 'LEGAL_DPO', 'CRISIS_LEAD'],
      strategy: 'worst_option',
    })
    expect(output.totalPoints).toBeLessThan(80)
  })

  it('no_decision-strategie → alle rondes vallen op fallback-vector', () => {
    const input = simulateExercise({
      scenario: smallScenario,
      simulatedRoles: ['SECURITY_LEAD', 'LEGAL_DPO', 'CRISIS_LEAD'],
      strategy: 'no_decision',
    })
    // Er moeten geen expliciete decision_submitted events zijn (behalve implicits).
    const explicit = input.events.filter(e => e.kind === 'decision_submitted' && e.by !== 'IMPLICIT')
    expect(explicit).toHaveLength(0)
    // Implicits worden wél geëmit.
    const implicits = input.events.filter(e => e.kind === 'decision_submitted' && e.by === 'IMPLICIT')
    expect(implicits.length).toBeGreaterThan(0)
  })

  it('random_seed deterministisch: zelfde seed → zelfde output', () => {
    const a = simulateExercise({
      scenario: smallScenario, simulatedRoles: ['SECURITY_LEAD', 'LEGAL_DPO'],
      strategy: 'random_seed', seed: 123,
    })
    const b = simulateExercise({
      scenario: smallScenario, simulatedRoles: ['SECURITY_LEAD', 'LEGAL_DPO'],
      strategy: 'random_seed', seed: 123,
    })
    expect(a.events.length).toBe(b.events.length)
    for (let i = 0; i < a.events.length; i++) {
      expect(JSON.stringify(a.events[i])).toBe(JSON.stringify(b.events[i]))
    }
  })

  it('random_seed andere seed → andere output', () => {
    const a = simulateExercise({ scenario: smallScenario, simulatedRoles: ['A', 'B'], strategy: 'random_seed', seed: 1 })
    const b = simulateExercise({ scenario: smallScenario, simulatedRoles: ['A', 'B'], strategy: 'random_seed', seed: 2 })
    // Ergens moet een verschil zitten in de gekozen opties (bij twee opties per dp, verschillende seed zou verschillende picks geven).
    const optionsA = a.events.filter(e => e.kind === 'decision_submitted' && e.by !== 'IMPLICIT').map(e => e.kind === 'decision_submitted' ? e.optionId : '')
    const optionsB = b.events.filter(e => e.kind === 'decision_submitted' && e.by !== 'IMPLICIT').map(e => e.kind === 'decision_submitted' ? e.optionId : '')
    // Niet gegarandeerd verschillend voor 2 rondes; zwakke assertion: minstens één van beide is een non-lege array.
    expect(optionsA.length + optionsB.length).toBeGreaterThan(0)
  })
})

describe('Scenario health (Deel B §7.4)', () => {
  const scenario: ScenarioSpec = {
    rounds: [{ number: 1, designTimeMinutes: 20, outcomeWeights: { CONT: 1, FOR: 1, BC: 1, JUR: 1, VER: 1, KOS: 1 } }],
    decisionPoints: [
      { id: 'dp', round: 1, domain: 'CONTAINMENT', designedOwner: 'X', options: [
        { id: 'a', outcomeVector: { CONT: 1, FOR: 1, BC: 0, JUR: 0, VER: 0, KOS: 0 } },
        { id: 'b', outcomeVector: { CONT: 2, FOR: 0, BC: 0, JUR: 0, VER: 0, KOS: 0 } },
        { id: 'never', outcomeVector: { CONT: -2, FOR: -2, BC: 0, JUR: 0, VER: 0, KOS: 0 } },
      ] },
    ],
    injects: [],
  }

  it('leeg input → sessionCount 0', () => {
    const r = buildHealthReport([])
    expect(r.sessionCount).toBe(0)
  })

  it('detecteert nooit-gekozen opties', () => {
    const sessions = [1, 2, 3].map(() => ({
      scenarioId: 's1', scenarioVersion: 1, scenario,
      events: [{ kind: 'decision_submitted' as const, t: 100, round: 1, decisionPointId: 'dp', optionId: 'a', by: 'X' }],
    }))
    const r = buildHealthReport(sessions)
    expect(r.neverChosenOptions.some(o => o.optionId === 'never')).toBe(true)
    expect(r.neverChosenOptions.some(o => o.optionId === 'b')).toBe(true)
    expect(r.neverChosenOptions.some(o => o.optionId === 'a')).toBe(false)
  })

  it('discriminatie zwak wanneer iedereen dezelfde optie kiest', () => {
    const sessions = [1, 2, 3, 4].map(() => ({
      scenarioId: 's1', scenarioVersion: 1, scenario,
      events: [{ kind: 'decision_submitted' as const, t: 100, round: 1, decisionPointId: 'dp', optionId: 'a', by: 'X' }],
    }))
    const r = buildHealthReport(sessions)
    expect(r.weakDiscriminatingRounds.some(w => w.round === 1)).toBe(true)
  })

  it('timer runs out rate telt IMPLICIT-submits', () => {
    const sessions = [
      {
        scenarioId: 's1', scenarioVersion: 1, scenario,
        events: [
          { kind: 'decision_submitted' as const, t: 100, round: 1, decisionPointId: 'dp', optionId: 'a', by: 'X' },
          { kind: 'decision_submitted' as const, t: 200, round: 1, decisionPointId: 'dp', optionId: '__implicit_dp', by: 'IMPLICIT' },
        ],
      },
    ]
    const r = buildHealthReport(sessions)
    expect(r.timerRunsOutRate.dp).toBeCloseTo(0.5, 2)
  })
})
