import { describe, expect, it } from 'vitest'
import { buildAssessmentReport } from '../report'
import { denominatorFromReport, scoreDenominator, NOTHING_TO_SCORE_NL } from '../denominator'
import { scoreExercise } from '../score-exercise'
import type { ExerciseInput, ScenarioSpec } from '../types'

// De live reproductie uit issue #105: een scenario van zes rondes, de sessie
// stond in ronde 1 en er was nog niets ingediend. Het rapport meldde toen
// "0 van 600 punten (0%)" — zes keer honderd, over vijf rondes die het team
// nooit heeft gezien.

const SIX_ROUND_SCENARIO: ScenarioSpec = {
  rounds: Array.from({ length: 6 }, (_, i) => ({ number: i + 1, designTimeMinutes: 20 })),
  decisionPoints: Array.from({ length: 6 }, (_, i) => ({
    id: `dp${i + 1}`,
    round: i + 1,
    domain: 'CONTAINMENT' as const,
    designedOwner: 'CRISIS_LEAD',
    options: [
      { id: `act${i + 1}`, outcomeVector: { CONT: 2, FOR: 0, BC: 0, JUR: 0, VER: 0, KOS: 0 } },
      { id: `wait${i + 1}`, implicit: true, outcomeVector: { CONT: -1, FOR: 0, BC: 0, JUR: 0, VER: 0, KOS: 0 } },
    ],
  })),
  injects: [],
}

// Eén gespeelde ronde, nul inzendingen.
const ONE_ROUND_PLAYED: ExerciseInput = {
  mode: 'ASSESSMENT',
  scenario: SIX_ROUND_SCENARIO,
  roster: { presentRoles: ['CRISIS_LEAD'] },
  events: [{ kind: 'session_start', t: 0 }],
  playedRounds: [1],
}

describe('noemer bij één gespeelde ronde zonder inzendingen (issue #105)', () => {
  const scoring = scoreExercise(ONE_ROUND_PLAYED)

  it('scoort alleen de gespeelde ronde — niet alle zes', () => {
    // Faalde op de oude code: outcomes had lengte 6, want scoreExercise liep
    // over scenario.rounds in plaats van over de gespeelde rondes.
    expect(scoring.outcomes).toHaveLength(1)
    expect(scoring.outcomes[0].round).toBe(1)
    expect(scoring.outcomes[0].hasSubmissions).toBe(false)
  })

  it('de noemer is 100, niet 600', () => {
    // Dit is de assertion die de live-bug vastpint: `outcomes.length * 100`
    // gaf 600 en dus "0 van 600 punten (0%)".
    expect(scoring.maxPoints).not.toBe(600)
    expect(scoring.maxPoints).toBe(100)
    expect(scoring.scorableRounds).toEqual([1])
    expect(scoring.totalPoints).toBe(0)
  })

  it('zonder enige inzending toont de weergave geen percentage', () => {
    const denom = scoreDenominator(SIX_ROUND_SCENARIO, scoring.outcomes, scoring.totalPoints)
    expect(denom.measuredRounds).toEqual([])
    expect(denom.nothingToScore).toBe(true)
    expect(denom.percentage).toBeNull()
    expect(NOTHING_TO_SCORE_NL).toContain('niets te scoren')
  })

  it('het assessment-rapport draagt dezelfde noemer mee als de scoring', () => {
    const report = buildAssessmentReport(ONE_ROUND_PLAYED)
    expect(report.outcomes).toHaveLength(1)
    expect(report.maxPoints).toBe(100)
    expect(report.scorableRounds).toEqual([1])

    const denom = denominatorFromReport(report)
    expect(denom.maxPoints).toBe(100)
    expect(denom.nothingToScore).toBe(true)
    expect(denom.percentage).toBeNull()
  })
})

describe('noemer bij deels gespeelde oefening', () => {
  const played: ExerciseInput = {
    ...ONE_ROUND_PLAYED,
    playedRounds: [1, 2],
    events: [
      { kind: 'session_start', t: 0 },
      { kind: 'decision_submitted', t: 1, round: 1, decisionPointId: 'dp1', optionId: 'act1', by: 'CRISIS_LEAD' },
    ],
  }
  const scoring = scoreExercise(played)

  it('een gespeelde ronde zonder inzending telt wél mee als nul punten', () => {
    expect(scoring.scorableRounds).toEqual([1, 2])
    expect(scoring.maxPoints).toBe(200)
    const denom = denominatorFromReport(scoring)
    expect(denom.measuredRounds).toEqual([1])
    expect(denom.nothingToScore).toBe(false)
    expect(denom.percentage).toBe(Math.round((scoring.totalPoints / 200) * 100))
  })
})

describe('noemer negeert rondes zonder beslismoment', () => {
  it('een gespeelde ronde zonder beslispunt valt buiten de noemer', () => {
    const scenario: ScenarioSpec = {
      ...SIX_ROUND_SCENARIO,
      decisionPoints: SIX_ROUND_SCENARIO.decisionPoints.filter(dp => dp.round === 1),
    }
    const scoring = scoreExercise({
      ...ONE_ROUND_PLAYED,
      scenario,
      playedRounds: [1, 2, 3],
    })
    expect(scoring.outcomes).toHaveLength(3)
    expect(scoring.scorableRounds).toEqual([1])
    expect(scoring.maxPoints).toBe(100)
  })
})

describe('denominatorFromReport negeert rijen buiten de noemer', () => {
  it('een extra outcome-rij (meldplicht-verzuim) rekt de noemer niet op', () => {
    const report = buildAssessmentReport(ONE_ROUND_PLAYED)
    // Dit is wat applyRegulatoryAdjustment doet voor een verzuim in een ronde
    // zonder berekende uitkomst: een rij bijzetten.
    const withExtraRow = {
      ...report,
      outcomes: [
        ...report.outcomes,
        {
          round: 5,
          normalized: 0,
          perDimension: { CONT: 0, FOR: 0, BC: 0, JUR: -2, VER: -1, KOS: 0 },
          points: 50,
          hasSubmissions: false,
        },
      ],
    }
    const denom = denominatorFromReport(withExtraRow)
    expect(denom.maxPoints).toBe(100)
    expect(denom.rounds).toEqual([1])
  })
})
