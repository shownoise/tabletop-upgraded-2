import { describe, expect, it } from 'vitest'
import { situationInjectOverlap } from '@/lib/wizard/framework'

// rule13_situation_no_spoiler — pint de twee drempels vast waarop de regel
// afgaat. Deze regel is een heuristiek, dus de drempels moeten expliciet in een
// test staan: verschuift er één, dan moet dat een bewuste wijziging zijn.

const INJECTS = [
  {
    title: 'Lerares meldt: klassenplanner werkt niet',
    content:
      'Beste administratie, ik heb net mijn eerste les moeten beginnen zonder klassenlijst. Magister laadt niet en mijn map op de gedeelde schijf geeft raar gedrag.',
  },
  {
    title: 'WestNet MSP-dashboard — ongebruikelijke schrijfactiviteit FS-01',
    content:
      'Bron: WestNet monitoring op fileserver FS-01. Signaal: 4200 bestandsmodificaties in 7 minuten. Severity automatisch op laag gezet omdat het patroon lijkt op geplande archivering. Magister is niet in beeld.',
  },
]

describe('situationInjectOverlap', () => {
  it('ziet geen probleem in een korte algemene introductie', () => {
    const situation =
      'Maandag 09:15, de eerste schooldag na de herfstvakantie. Sinds het eerste lesuur komen er van verschillende locaties losse meldingen binnen. Niets is hard en niemand heeft het hele plaatje. Jullie hebben een kwartier om te bepalen of dit ruis is of een incident.'
    expect(situationInjectOverlap(situation, INJECTS)).toEqual([])
  })

  it('markeert een letterlijk fragment van vijf woorden', () => {
    const situation =
      'Maandag 09:15. Het beeld is nog onduidelijk. Signaal: 4200 bestandsmodificaties in 7 minuten op een fileserver. Jullie bepalen deze ronde of dit ruis is.'
    const findings = situationInjectOverlap(situation, INJECTS)
    expect(findings).toHaveLength(1)
    expect(findings[0].injectTitle).toContain('WestNet')
    expect(findings[0].verbatim[0]).toContain('bestandsmodificaties')
  })

  it('markeert vier of meer inject-eigen woorden uit dezelfde inject', () => {
    const situation =
      'Maandag 09:15. Een lerares kan haar klassenplanner niet openen, de klassenlijst ontbreekt en haar map op de gedeelde schijf doet raar. Jullie bepalen deze ronde of dit ruis is.'
    const findings = situationInjectOverlap(situation, INJECTS)
    expect(findings).toHaveLength(1)
    expect(findings[0].injectTitle).toContain('Lerares')
    expect(findings[0].sharedTerms.length).toBeGreaterThanOrEqual(4)
  })

  it('laat drie gedeelde woorden nog door — namen van de klant mogen in de header', () => {
    const situation =
      'Maandag 09:15. Een lerares meldt dat haar klassenplanner leeg is en dat de klassenlijst ontbreekt. Verder is er nog niets hard. Jullie bepalen deze ronde of dit ruis is.'
    const findings = situationInjectOverlap(situation, INJECTS)
    expect(findings).toEqual([])
  })

  it('negeert woorden die in meerdere injects van dezelfde ronde staan', () => {
    // "magister" staat in beide injects en is dus de gedeelde taal van de
    // ronde, geen inject-eigen woord.
    const situation =
      'Maandag 09:15. Magister reageert traag en dat raakt meerdere locaties. Verder is er nog niets hard. Jullie bepalen deze ronde of dit ruis is.'
    expect(situationInjectOverlap(situation, INJECTS)).toEqual([])
  })

  it('geeft niets terug zonder injects of zonder schets', () => {
    expect(situationInjectOverlap('', INJECTS)).toEqual([])
    expect(situationInjectOverlap('Maandag 09:15, nog niets hard.', [])).toEqual([])
  })
})
