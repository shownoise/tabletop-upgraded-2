import { describe, expect, it } from 'vitest'
import type { DecisionNodeData, ScenarioGraph } from '../types'
import { validateDecisionScoring } from '../validate'

const base: ScenarioGraph = {
  id: 'scores', name: 'Scores', version: 1, scenarioType: 'ransomware_double_extortion', createdAt: 0, updatedAt: 0,
  nodes: [{ id: 'd1', type: 'decision', position: { x: 0, y: 0 }, data: {
    kind: 'decision', prompt: 'Keuze', measuredBy: 'participant_choice', perRole: true,
    options: [{ id: 'a', label: 'Actie', allowedRole: 'ceo' }],
  } }],
  edges: [],
}

describe('decision scoring gate', () => {
  it('requires an explicit score vector for every playable option', () => {
    expect(validateDecisionScoring(base)).toEqual(expect.arrayContaining([
      expect.objectContaining({ severity: 'error', nodeId: 'd1' }),
    ]))
  })

  it('accepts a deliberate all-zero vector as no effect on any dimension', () => {
    const graph = structuredClone(base)
    const decision = graph.nodes[0]
    if (decision.type !== 'decision') throw new Error('Expected decision')
    ;(decision.data as DecisionNodeData).options[0].outcomeVector = { CONT: 0, FOR: 0, BC: 0, JUR: 0, VER: 0, KOS: 0 }
    expect(validateDecisionScoring(graph)).toEqual([])
  })

  it('requires a score for authored implicit choices too', () => {
    const graph = structuredClone(base)
    const decision = graph.nodes[0]
    if (decision.type !== 'decision') throw new Error('Expected decision')
    const data = decision.data as DecisionNodeData
    data.options[0].outcomeVector = { CONT: 0, FOR: 0, BC: 0, JUR: 0, VER: 0, KOS: 0 }
    data.options.push({ id: 'implicit', label: 'Geen besluit', implicit: true })
    expect(validateDecisionScoring(graph)).toHaveLength(1)
  })
})
