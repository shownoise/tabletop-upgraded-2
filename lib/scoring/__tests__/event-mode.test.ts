import { describe, expect, it } from 'vitest'
import {
  isValidTransition,
  canForceLock,
  computeImplicitSubmissionsAtLock,
  scenarioWithFallbackImplicits,
  isSubmissionAllowed,
} from '../event-mode'
import { computeRoundOutcome } from '../outcome-round'
import { NO_DECISION_FALLBACK_VECTOR } from '../constants'
import type { ExerciseEvent, ScenarioSpec } from '../types'

const scenario: ScenarioSpec = {
  rounds: [{ number: 1, designTimeMinutes: 20, outcomeWeights: { CONT: 1, FOR: 1, BC: 1, JUR: 1, VER: 1, KOS: 1 } }],
  decisionPoints: [
    { id: 'dp-jur', round: 1, domain: 'JURIDISCH', designedOwner: 'LEGAL_DPO', options: [
      { id: 'a', outcomeVector: { CONT: 0, FOR: 0, BC: 0, JUR:  2, VER: 0, KOS: -1 } },
      { id: 'b', outcomeVector: { CONT: 0, FOR: 0, BC: 0, JUR: -2, VER: 0, KOS:  0 } },
    ] },
    { id: 'dp-cont', round: 1, domain: 'CONTAINMENT', designedOwner: 'SECURITY_LEAD', options: [
      { id: 'a', outcomeVector: { CONT:  2, FOR:  2, BC:  0, JUR: 0, VER: 0, KOS: -1 } },
      { id: 'b', outcomeVector: { CONT: -2, FOR: -2, BC:  0, JUR: 0, VER: 0, KOS:  0 } },
      // Auteur heeft expliciete "geen besluit"-optie gedefinieerd.
      { id: 'skip', outcomeVector: { CONT: -1, FOR: -1, BC: -1, JUR: 0, VER: 0, KOS: 0 }, implicit: true, label: 'Geen besluit' },
    ] },
  ],
  injects: [],
}

describe('Event Mode statemachine (Deel B §4)', () => {

  describe('phase transitions', () => {
    it('BRIEFING → OVERLEG → KEUZE → LOCK → REVIEW is valid', () => {
      expect(isValidTransition('briefing', 'overleg')).toBe(true)
      expect(isValidTransition('overleg', 'keuze')).toBe(true)
      expect(isValidTransition('keuze', 'lock')).toBe(true)
      expect(isValidTransition('lock', 'review')).toBe(true)
    })

    it('KEUZE → REVIEW (skip LOCK) is invalid in EVENT-mode', () => {
      expect(isValidTransition('keuze', 'review')).toBe(false)
    })

    it('OVERLEG → LOCK (skip KEUZE) is invalid', () => {
      expect(isValidTransition('overleg', 'lock')).toBe(false)
    })

    it('LOCK → OVERLEG (terugstappen) is invalid', () => {
      expect(isValidTransition('lock', 'overleg')).toBe(false)
    })

    it('canForceLock: alleen vanaf KEUZE', () => {
      expect(canForceLock('keuze')).toBe(true)
      expect(canForceLock('overleg')).toBe(false)
      expect(canForceLock('lock')).toBe(false)
    })
  })

  describe('implicit submissions at LOCK', () => {
    it('geen groepen, geen submissions → één implicit per beslispunt', () => {
      const implicits = computeImplicitSubmissionsAtLock({
        scenario, events: [], lockTime: 60_000, round: 1, groups: null,
      })
      expect(implicits).toHaveLength(2)
      // dp-cont heeft explicit implicit-optie 'skip'
      const contImp = implicits.find(i => i.kind === 'decision_submitted' && i.decisionPointId === 'dp-cont')
      expect(contImp && contImp.kind === 'decision_submitted' && contImp.optionId).toBe('skip')
      // dp-jur heeft géén implicit-optie → fallback-id
      const jurImp = implicits.find(i => i.kind === 'decision_submitted' && i.decisionPointId === 'dp-jur')
      expect(jurImp && jurImp.kind === 'decision_submitted' && jurImp.optionId).toBe('__implicit_dp-jur')
    })

    it('één beslispunt al ingezonden → alleen de ontbrekende krijgt implicit', () => {
      const events: ExerciseEvent[] = [
        { kind: 'decision_submitted', t: 100, round: 1, decisionPointId: 'dp-jur', optionId: 'a', by: 'LEGAL_DPO' },
      ]
      const implicits = computeImplicitSubmissionsAtLock({ scenario, events, lockTime: 60_000, round: 1, groups: null })
      expect(implicits).toHaveLength(1)
      const only = implicits[0]
      expect(only.kind).toBe('decision_submitted')
      expect(only.kind === 'decision_submitted' && only.decisionPointId).toBe('dp-cont')
    })

    it('drie groepen, twee missen deadline → twee implicits (voor dp-jur en dp-cont van de twee missers)', () => {
      const groups = [
        { id: 'g1', participantIds: ['p1'] },
        { id: 'g2', participantIds: ['p2'] },
        { id: 'g3', participantIds: ['p3'] },
      ]
      // g1 heeft beide ingezonden, g2 en g3 niets.
      const events: ExerciseEvent[] = [
        { kind: 'decision_submitted', t: 100, round: 1, decisionPointId: 'dp-jur',  optionId: 'a', by: 'p1' },
        { kind: 'decision_submitted', t: 100, round: 1, decisionPointId: 'dp-cont', optionId: 'a', by: 'p1' },
      ]
      const implicits = computeImplicitSubmissionsAtLock({ scenario, events, lockTime: 200, round: 1, groups })
      // g2 mist beide (2), g3 mist beide (2) → 4 implicits.
      expect(implicits).toHaveLength(4)
    })

    it('idempotent: opnieuw uitvoeren met implicit-events in de log levert niets', () => {
      const events: ExerciseEvent[] = [
        { kind: 'decision_submitted', t: 100, round: 1, decisionPointId: 'dp-jur',  optionId: '__implicit_dp-jur', by: 'IMPLICIT' },
        { kind: 'decision_submitted', t: 100, round: 1, decisionPointId: 'dp-cont', optionId: 'skip',              by: 'IMPLICIT' },
      ]
      const implicits = computeImplicitSubmissionsAtLock({ scenario, events, lockTime: 200, round: 1, groups: null })
      expect(implicits).toHaveLength(0)
    })

    it('LOCK zonder beslispunten in de ronde → geen implicits', () => {
      const emptyScenario: ScenarioSpec = { rounds: scenario.rounds, decisionPoints: [], injects: [] }
      const implicits = computeImplicitSubmissionsAtLock({ scenario: emptyScenario, events: [], lockTime: 100, round: 1, groups: null })
      expect(implicits).toHaveLength(0)
    })
  })

  describe('scenarioWithFallbackImplicits', () => {
    it('dp zonder implicit krijgt fallback-optie toegevoegd', () => {
      const augmented = scenarioWithFallbackImplicits(scenario)
      const jur = augmented.decisionPoints.find(d => d.id === 'dp-jur')!
      expect(jur.options.some(o => o.implicit === true)).toBe(true)
      const implicit = jur.options.find(o => o.implicit)!
      expect(implicit.outcomeVector).toEqual(NO_DECISION_FALLBACK_VECTOR)
    })

    it('dp met bestaande implicit blijft ongewijzigd', () => {
      const augmented = scenarioWithFallbackImplicits(scenario)
      const cont = augmented.decisionPoints.find(d => d.id === 'dp-cont')!
      const implicits = cont.options.filter(o => o.implicit)
      expect(implicits).toHaveLength(1)
      expect(implicits[0].id).toBe('skip')  // bestaand behouden, geen fallback erbij
    })

    it('originele scenario niet gemuteerd', () => {
      scenarioWithFallbackImplicits(scenario)
      const originalJur = scenario.decisionPoints.find(d => d.id === 'dp-jur')!
      expect(originalJur.options.some(o => o.implicit)).toBe(false)
    })

    it('integratie: computeRoundOutcome met augmented + implicit events → gebruikt fallback-vector', () => {
      const augmented = scenarioWithFallbackImplicits(scenario)
      const events: ExerciseEvent[] = [
        // Simuleer één implicit voor dp-jur.
        { kind: 'decision_submitted', t: 100, round: 1, decisionPointId: 'dp-jur', optionId: '__implicit_dp-jur', by: 'IMPLICIT' },
        // dp-cont: geen submission → dat werkt via outcome-round's ingebouwde fallback ook.
      ]
      const o = computeRoundOutcome(augmented, events, 1)
      // Vector van dp-jur implicit = NO_DECISION_FALLBACK_VECTOR;
      // dp-cont zonder submission valt naar implicit optie 'skip' (auteur-gedefinieerd).
      // Gemiddelde over 2 dps × gelijke weights → moet negatief zijn.
      expect(o.normalized).toBeLessThan(0)
    })
  })

  describe('isSubmissionAllowed', () => {
    it('EVENT + KEUZE + geen eerdere submit → allowed', () => {
      const r = isSubmissionAllowed({
        events: [], round: 1, decisionPointId: 'dp-jur', groupId: 'g1',
        currentPhase: 'keuze', mode: 'EVENT',
      })
      expect(r.allowed).toBe(true)
    })

    it('LOCK-fase → niet toegestaan', () => {
      const r = isSubmissionAllowed({
        events: [], round: 1, decisionPointId: 'dp-jur', groupId: 'g1',
        currentPhase: 'lock', mode: 'EVENT',
      })
      expect(r.allowed).toBe(false)
      expect(r.reason).toContain('lock')
    })

    it('REVIEW-fase → niet toegestaan', () => {
      const r = isSubmissionAllowed({
        events: [], round: 1, decisionPointId: 'dp-jur', groupId: 'g1',
        currentPhase: 'review', mode: 'EVENT',
      })
      expect(r.allowed).toBe(false)
    })

    it('BRIEFING-fase → niet toegestaan', () => {
      const r = isSubmissionAllowed({
        events: [], round: 1, decisionPointId: 'dp-jur', groupId: 'g1',
        currentPhase: 'briefing', mode: 'EVENT',
      })
      expect(r.allowed).toBe(false)
    })

    it('EVENT + KEUZE + al ingezonden voor deze (group, dp) → niet toegestaan', () => {
      const events: ExerciseEvent[] = [
        { kind: 'decision_submitted', t: 100, round: 1, decisionPointId: 'dp-jur', optionId: 'a', by: 'p1' },
      ]
      const r = isSubmissionAllowed({
        events, round: 1, decisionPointId: 'dp-jur', groupId: 'single',  // participant-id in by, geen group
        currentPhase: 'keuze', mode: 'EVENT',
      })
      // Deze test verifieert idempotency alleen als groupIdOf matcht — in dit
      // testcase is groupId=null en al ingezonden count → toegestaan.
      expect(r.allowed).toBe(false)
    })

    it('ASSESSMENT + al ingezonden → mag herzien (overschrijven)', () => {
      const events: ExerciseEvent[] = [
        { kind: 'decision_submitted', t: 100, round: 1, decisionPointId: 'dp-jur', optionId: 'a', by: 'p1' },
      ]
      const r = isSubmissionAllowed({
        events, round: 1, decisionPointId: 'dp-jur', groupId: null,
        currentPhase: 'keuze', mode: 'ASSESSMENT',
      })
      expect(r.allowed).toBe(true)
    })
  })
})
