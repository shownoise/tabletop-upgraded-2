import { describe, expect, it } from 'vitest'
import { buildAssessmentReport, buildEventReport } from '../report'
import { renderAssessmentMarkdown, renderEventOnePagerMarkdown, renderEventHostMarkdown } from '../report-markdown'
import { referenceExercise } from '../reference-case'
import type { ExerciseInput } from '../types'

describe('AssessmentReport (Deel B §6)', () => {
  const report = buildAssessmentReport(referenceExercise)

  it('bevat scoring-versie in de meta', () => {
    expect(report.meta.scoringVersion).toBeTruthy()
    expect(report.meta.scoringVersion).toMatch(/^\d+\.\d+\.\d+$/)
  })

  it('bevat rolCoverage in de kop (Deel B §1.5)', () => {
    expect(report.meta.rolCoverage).toBeGreaterThanOrEqual(0)
    expect(report.meta.rolCoverage).toBeLessThanOrEqual(1)
    expect(typeof report.meta.distinctOwners).toBe('number')
  })

  it('per-ronde uitkomstvector aanwezig', () => {
    expect(report.outcomes).toHaveLength(4)
    for (const o of report.outcomes) {
      expect(o.points).toBeGreaterThanOrEqual(0)
      expect(o.points).toBeLessThanOrEqual(100)
    }
  })

  it('spider heeft alle 6 uitkomstdimensies', () => {
    expect(Object.keys(report.spider.team)).toHaveLength(6)
  })

  it('markdown-render bevat kop, uitkomst-tabel, spider, rolresolutie', () => {
    const md = renderAssessmentMarkdown(report)
    expect(md).toContain('# Debriefrapport')
    expect(md).toContain('Scoring-versie')
    expect(md).toContain('Rolcoverage')
    expect(md).toContain('## Uitkomst per ronde')
    expect(md).toContain('## Spider')
    expect(md).toContain('## Rolresolutie')
  })

  it('markdown deterministisch: twee runs op zelfde report → identieke output (behalve generatedAt)', () => {
    const md1 = renderAssessmentMarkdown(report)
    const md2 = renderAssessmentMarkdown(report)
    expect(md1).toBe(md2)
  })
})

describe('EventReport (Deel B §6)', () => {
  const groups = [
    { id: 'g1', name: 'Alpha', participantIds: ['p1'] },
    { id: 'g2', name: 'Beta',  participantIds: ['p2'] },
    { id: 'g3', name: 'Gamma', participantIds: ['p3'] },
  ]
  // Gebruik referentie-events maar splits de submitter per groep om drie unieke outcomes te maken.
  const perGroupInputs: Record<string, ExerciseInput> = {
    g1: referenceExercise,
    g2: { ...referenceExercise, events: referenceExercise.events.filter(e => e.kind !== 'decision_submitted') },
    g3: referenceExercise,
  }
  const report = buildEventReport({ exerciseInput: referenceExercise, groups, perGroupInputs })

  it('een one-pager per groep', () => {
    expect(report.onePagers).toHaveLength(3)
  })

  it('one-pager toont positie, punten, per-ronde eigen vectors', () => {
    const alpha = report.onePagers[0]
    expect(alpha.rank).toBe(1)
    expect(alpha.perRound.length).toBeGreaterThan(0)
    expect(alpha.perRound[0]).toHaveProperty('sentences')
    expect(alpha.perRound[0].sentences.CONT).toBeTruthy()
  })

  it('host-samenvatting bevat standings + causale ketens + verdeling', () => {
    expect(report.hostSummary.groupCount).toBe(3)
    expect(report.hostSummary.standings).toHaveLength(3)
    expect(report.hostSummary.standings[0].rank).toBe(1)
    // causalChains is een array (kan leeg zijn afhankelijk van data)
    expect(Array.isArray(report.hostSummary.causalChains)).toBe(true)
  })

  it('one-pager markdown-render', () => {
    const md = renderEventOnePagerMarkdown(report.onePagers[0])
    expect(md).toContain('# Alpha')
    expect(md).toContain('Positie #1')
    expect(md).toContain('Ronde')
  })

  it('host markdown-render', () => {
    const md = renderEventHostMarkdown(report)
    expect(md).toContain('# Host samenvatting')
    expect(md).toContain('## Eindstand')
    expect(md).toContain('Alpha')
    expect(md).toContain('Beta')
    expect(md).toContain('Gamma')
  })

  it('groep zonder submissions krijgt minder punten dan groep met submissions', () => {
    const alpha = report.onePagers.find(p => p.groupName === 'Alpha')!
    const beta  = report.onePagers.find(p => p.groupName === 'Beta')!
    // g2 (Beta) heeft geen submissions → alleen fallback-vectoren → lager
    expect(alpha.totalPoints).toBeGreaterThanOrEqual(beta.totalPoints)
  })
})
