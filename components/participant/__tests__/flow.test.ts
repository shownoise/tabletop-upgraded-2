// De stapflow: de facilitator bepaalt de fase, de deelnemer volgt.
// Terugbladeren binnen wat al geweest is mag, vooruitlopen niet.

import { describe, expect, it } from 'vitest'
import {
  ONBOARDING_CARDS,
  STEP_ORDER,
  TOTAL_STEPS,
  clampStep,
  highestOpenStep,
  landingStep,
  onboardingWordCount,
  phaseKey,
  shortLead,
  stepLabel,
  type FlowInput,
} from '@/components/participant/steps/flow'

const withRole: FlowInput = { status: 'active', roundPhase: 'inject', currentRound: 0, hasRole: true }

describe('stapflow', () => {
  it('heeft zeven stappen en nummert ze voor de voortgangsregel', () => {
    expect(TOTAL_STEPS).toBe(7)
    expect(STEP_ORDER).toHaveLength(7)
    expect(stepLabel('keuze')).toBe('Stap 5 van 7')
    expect(stepLabel('afronding')).toBe('Stap 7 van 7')
  })

  it('houdt een deelnemer zonder rol op stap 1', () => {
    expect(highestOpenStep({ ...withRole, hasRole: false })).toBe('welkom')
    expect(landingStep({ ...withRole, hasRole: false })).toBe('welkom')
  })

  it('opent de stap die bij de fase van de facilitator hoort', () => {
    expect(highestOpenStep({ ...withRole, roundPhase: 'discussion' })).toBe('overleg')
    expect(highestOpenStep({ ...withRole, roundPhase: 'decision' })).toBe('keuze')
    expect(highestOpenStep({ ...withRole, roundPhase: 'review' })).toBe('review')
    expect(highestOpenStep({ ...withRole, status: 'ended' })).toBe('afronding')
  })

  it('landt bij een nieuwe ronde op de ronde-intro en niet op de berichten', () => {
    expect(landingStep(withRole)).toBe('ronde')
    expect(landingStep({ ...withRole, roundPhase: undefined })).toBe('ronde')
  })

  it('laat terugbladeren toe en vooruitlopen niet', () => {
    expect(clampStep('ronde', 'keuze')).toBe('ronde')
    expect(clampStep('review', 'overleg')).toBe('overleg')
    expect(clampStep('keuze', 'keuze')).toBe('keuze')
  })

  it('verandert de fasesleutel zodra de facilitator iets verzet', () => {
    const a = phaseKey(withRole)
    expect(phaseKey({ ...withRole, roundPhase: 'decision' })).not.toBe(a)
    expect(phaseKey({ ...withRole, currentRound: 1 })).not.toBe(a)
    expect(phaseKey({ ...withRole, hasRole: false })).not.toBe(a)
  })
})

describe('rondeheader', () => {
  it('knipt een lange situatieschets af en houdt de rest apart', () => {
    const text = `${'Eerste zin over de storing. '.repeat(12)}Laatste zin.`
    const { lead, rest } = shortLead(text, 200)
    expect(lead.length).toBeLessThanOrEqual(200)
    expect(rest.length).toBeGreaterThan(0)
    expect(`${lead} ${rest}`.replace(/\s+/g, ' ').trim()).toBe(text.replace(/\s+/g, ' ').trim())
  })

  it('laat een korte schets ongemoeid', () => {
    expect(shortLead('Kort.', 200)).toEqual({ lead: 'Kort.', rest: '' })
  })
})

describe('onboarding', () => {
  it('is vijf kaarten en blijft onder de 150 woorden', () => {
    expect(ONBOARDING_CARDS).toHaveLength(5)
    expect(onboardingWordCount()).toBeLessThan(150)
  })

  it('noemt geen raamwerk', () => {
    const all = ONBOARDING_CARDS.map(c => `${c.title} ${c.body}`).join(' ').toLowerCase()
    for (const word of ['bob', 'ooda', 'beeldvorming', 'oordeelsvorming', 'besluitvorming', 'aanname']) {
      expect(all).not.toContain(word)
    }
  })
})
