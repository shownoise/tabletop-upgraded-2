import { describe, expect, it } from 'vitest'
import { schoolverenigingScenario } from '@/lib/graph/examples-schoolvereniging'
import { buildRoundIndexMap } from '@/lib/graph/setup-injects'
import { roundsRevealingInjects, situationInjectOverlap } from '@/lib/wizard/framework'
import type { DecisionNodeData, InjectNodeData, RoundNodeData } from '@/lib/graph/types'

// Issue #105 §3 — de rondeheader verklapte alle injects van diezelfde ronde.
// Die header is het enige dat alle rollen tegelijk lezen; staat daar al in wat
// de injects straks brengen, dan is de onderzoeksvraag weg. Deze suite pint
// vast dat de zes headers algemeen blijven en dat elke ronde een expliciete
// beslisvraag heeft.

const graph = schoolverenigingScenario()
const roundMap = buildRoundIndexMap(graph)

function roundsInOrder() {
  return graph.nodes
    .filter(n => n.type === 'round')
    .map(n => ({ node: n, roundNumber: roundMap.roundNumberById.get(n.id) ?? 0 }))
    .filter(r => r.roundNumber > 0)
    .sort((a, b) => a.roundNumber - b.roundNumber)
}

function injectsOf(roundNumber: number) {
  return graph.nodes
    .filter(n => n.type === 'inject' && roundMap.byNode.get(n.id) === roundNumber)
    .map(n => n.data as InjectNodeData)
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

describe('rondeheaders — geen inject-spoilers (issue #105)', () => {
  it('geen enkele ronde deelt een letterlijk fragment met haar eigen injects', () => {
    for (const { node, roundNumber } of roundsInOrder()) {
      const data = node.data as RoundNodeData
      const findings = situationInjectOverlap(data.situation_update ?? '', injectsOf(roundNumber))
      const verbatim = findings.filter(f => f.verbatim.length > 0)
      expect(
        verbatim,
        `ronde ${roundNumber} schrijft injects letterlijk over: ${verbatim
          .map(f => `"${f.injectTitle}" → "${f.verbatim[0]}"`)
          .join('; ')}`,
      ).toEqual([])
    }
  })

  it('geen enkele ronde deelt te veel inject-eigen woorden met haar eigen injects', () => {
    const reports = roundsRevealingInjects(graph)
    expect(
      reports.map(r => `ronde ${r.roundNumber}: ${r.findings.map(f => `${f.injectTitle} [${f.sharedTerms.join(', ')}]`).join(' | ')}`),
      'situatieschets vertelt injects vooruit',
    ).toEqual([])
  })

  it('elke situatieschets blijft een korte algemene introductie', () => {
    for (const { node, roundNumber } of roundsInOrder()) {
      const data = node.data as RoundNodeData
      const situation = data.situation_update ?? ''
      const words = wordCount(situation)
      // Drie à vier zinnen algemene stand van zaken past ruim binnen 90 woorden.
      // De oude headers zaten op 95-160 woorden en dat was precies het probleem.
      expect(words, `ronde ${roundNumber} situatieschets is ${words} woorden`).toBeLessThanOrEqual(90)
      expect(words, `ronde ${roundNumber} situatieschets is leeg of te dun`).toBeGreaterThan(15)
    }
  })

  it('elke ronde sluit af met een expliciete beslisvraag in de decision-prompt', () => {
    for (const { roundNumber } of roundsInOrder()) {
      const decisions = graph.nodes.filter(
        n => n.type === 'decision' && roundMap.byNode.get(n.id) === roundNumber,
      )
      expect(decisions.length, `ronde ${roundNumber} heeft geen keuzemoment`).toBe(1)
      const prompt = (decisions[0].data as DecisionNodeData).prompt ?? ''
      expect(prompt, `ronde ${roundNumber} prompt mist een vraagteken`).toContain('?')
      expect(
        wordCount(prompt),
        `ronde ${roundNumber} beslisvraag is te lang om in één oogopslag te lezen`,
      ).toBeLessThanOrEqual(30)
    }
  })
})
