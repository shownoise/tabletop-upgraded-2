import { describe, expect, it } from 'vitest'
import { schoolverenigingScenario } from '@/lib/graph/examples-schoolvereniging'
import { buildRoundIndexMap, collectSetupInjectsForDecision } from '@/lib/graph/setup-injects'
import type { DecisionNodeData, InjectNodeData } from '@/lib/graph/types'

// Een beslissing moet niet alleen een gekoppelde setup-inject hebben — die
// inject moet de deelnemer ook werkelijk vertellen waar straks over besloten
// wordt. Een inject die enkel een signaal meldt ("4200 bestanden gewijzigd")
// laat de keuze alsnog uit de lucht vallen: je weet dat er iets aan de hand is,
// niet wat je er straks over moet vinden. `setsUpDecisionNodeId` alleen dekt
// dat niet af, dus meten we het hier aan de tekst.
//
// Criterium — deterministisch en met de hand na te rekenen. Minstens één
// setup-inject van de beslissing moet:
//   1. een vraagteken bevatten (de inject legt de vraag echt op tafel, in de
//      stem van de afzender — een mail, een dashboardmelding, een telefoontje),
//      EN
//   2. minstens één inhoudelijk kernwoord delen met de `prompt` van de
//      beslissing die hij opzet.
//
// Beide eisen samen, niet los: een vraagteken zonder raakvlak met de beslissing
// is een willekeurige vraag ("kan iemand hiernaar kijken?"), en een kernwoord
// zonder vraag is een mededeling.
//
// Kernwoord = een woord van 6 letters of meer uit de prompt dat niet in STOP
// staat. STOP bevat alleen Nederlandse functiewoorden en één tijdsaanduiding
// ("vandaag"), omdat die in vrijwel elke inject voorkomen en dus niets zeggen
// over de aansluiting op déze beslissing.
//
// Vergelijken gebeurt op de eerste 6 letters, zodat verbuigingen meelopen
// (melding/meldingen, besluit/besluiten) zonder dat een stemmer nodig is.
// "verand(ering)" en "verant(woording)" blijven daarmee netjes gescheiden.

const STOP = new Set([
  'jullie', 'welke', 'welk', 'namens', 'nemen', 'gaan', 'hebben', 'worden',
  'wordt', 'moeten', 'kunnen', 'waarop', 'binnen', 'tussen', 'zonder', 'vandaag',
])

const STEM_LENGTH = 6

function toWords(text: string): string[] {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
}

function stem(word: string): string {
  return word.length <= STEM_LENGTH ? word : word.slice(0, STEM_LENGTH)
}

function promptKeywords(prompt: string): string[] {
  return [...new Set(toWords(prompt).filter(w => w.length >= 6 && !STOP.has(w)).map(stem))]
}

describe('setup-injects kondigen de beslissing aan', () => {
  const graph = schoolverenigingScenario()
  const roundMap = buildRoundIndexMap(graph)

  const decisions = graph.nodes
    .filter(n => n.type === 'decision')
    .map(n => ({
      id: n.id,
      roundNumber: roundMap.byNode.get(n.id) ?? 0,
      data: n.data as DecisionNodeData,
    }))
    .sort((a, b) => a.roundNumber - b.roundNumber)

  it('het showcase-scenario heeft een beslissing per ronde', () => {
    expect(decisions.length).toBe(6)
    expect(decisions.map(d => d.roundNumber)).toEqual([1, 2, 3, 4, 5, 6])
  })

  it('elke beslissing heeft minstens één setup-inject', () => {
    for (const decision of decisions) {
      const setups = collectSetupInjectsForDecision(graph, decision.id, roundMap)
      expect(
        setups.length,
        `ronde ${decision.roundNumber} ("${decision.data.prompt}") heeft geen setup-inject`,
      ).toBeGreaterThanOrEqual(1)
    }
  })

  it('elke prompt levert minstens één kernwoord op om tegen te matchen', () => {
    // Zonder deze check zou een prompt die alleen uit functiewoorden bestaat de
    // volgende test gratis laten slagen.
    for (const decision of decisions) {
      const keywords = promptKeywords(decision.data.prompt)
      expect(
        keywords.length,
        `ronde ${decision.roundNumber} prompt levert geen kernwoord op: "${decision.data.prompt}"`,
      ).toBeGreaterThanOrEqual(1)
    }
  })

  it('elke beslissing wordt door een setup-inject aangekondigd (vraagteken + kernwoord)', () => {
    for (const decision of decisions) {
      const keywords = promptKeywords(decision.data.prompt)
      const setups = collectSetupInjectsForDecision(graph, decision.id, roundMap)

      const report = setups.map(setup => {
        const node = graph.nodes.find(n => n.id === setup.injectId)!
        const inject = node.data as InjectNodeData
        const text = `${inject.title ?? ''} ${inject.content ?? ''}`
        const hasQuestion = text.includes('?')
        const shared = [...new Set(toWords(text).map(stem))].filter(w => keywords.includes(w))
        return {
          title: inject.title ?? setup.injectId,
          hasQuestion,
          shared,
          announces: hasQuestion && shared.length > 0,
        }
      })

      expect(
        report.some(r => r.announces),
        `ronde ${decision.roundNumber} — geen setup-inject kondigt "${decision.data.prompt}" aan.\n` +
          `kernwoorden: [${keywords.join(', ')}]\n` +
          report
            .map(r => `  "${r.title}" → vraagteken=${r.hasQuestion} gedeelde kernwoorden=[${r.shared.join(', ')}]`)
            .join('\n'),
      ).toBe(true)
    }
  })
})
