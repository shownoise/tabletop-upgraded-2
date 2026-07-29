import { describe, expect, it } from 'vitest'
import { referenceExercise, REFERENCE_EXPECTED } from '../reference-case'
import { scoreExercise } from '../score-exercise'
import { DOMAINS } from '../constants'

// Deel A §9 — referentiecase. Als een van deze assertions faalt na een formule-
// wijziging, hoort dat in de changelog.
describe('reference-case — Deel A §9', () => {
  const result = scoreExercise(referenceExercise)

  it('scoringVersion is aanwezig', () => {
    expect(result.scoringVersion).toBeTruthy()
  })

  it('rolResolutie dekt alle 10 domeinen', () => {
    for (const d of DOMAINS) expect(result.roleResolution.effectiveOwners[d]).toBeTruthy()
  })

  it('totalPoints binnen verwachte bandbreedte', () => {
    expect(result.totalPoints).toBeGreaterThanOrEqual(REFERENCE_EXPECTED.minTotalPoints)
    expect(result.totalPoints).toBeLessThanOrEqual(REFERENCE_EXPECTED.maxTotalPoints)
  })

  it('processAggregate binnen verwachte bandbreedte', () => {
    expect(result.processAggregate).not.toBeNull()
    expect(result.processAggregate!).toBeGreaterThanOrEqual(REFERENCE_EXPECTED.minProcess)
    expect(result.processAggregate!).toBeLessThanOrEqual(REFERENCE_EXPECTED.maxProcess)
  })

  it('BESLUIT, ADAPT, EXTERN zijn measured (data aanwezig)', () => {
    for (const dim of REFERENCE_EXPECTED.expectDimensionsMeasured) {
      expect(result.dimensions[dim].value).not.toBeNull()
    }
  })

  it('calibration is berekend (confidence-data aanwezig in referentie-events)', () => {
    expect(result.calibration).not.toBeNull()
  })

  it('4 outcomes met unieke rondenummers', () => {
    expect(result.outcomes).toHaveLength(4)
    expect(new Set(result.outcomes.map(o => o.round)).size).toBe(4)
  })

  it('mode = ASSESSMENT — MANDAAT is meetbaar en wordt gerapporteerd', () => {
    // Referentie-team heeft 6+ rollen → distinctOwners ≥ 3 → MANDAAT niet-null.
    expect(result.dimensions.MANDAAT.value).not.toBeNull()
  })
})
