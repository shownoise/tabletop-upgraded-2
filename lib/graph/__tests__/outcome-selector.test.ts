import { describe, expect, it } from 'vitest'
import { schoolverenigingScenario } from '../examples-schoolvereniging'
import { scoreByDimension, scoreCoverage } from '../outcome-selector'
import type { DecisionNodeData } from '../types'

describe('graph outcome scoring', () => {
  const graph = schoolverenigingScenario()
  const decision = graph.nodes.find(node => node.type === 'decision')
  if (!decision) throw new Error('Fixture has no decision node')
  const option = (decision.data as DecisionNodeData).options.find(item => item.outcomeVector)
  if (!option?.outcomeVector) throw new Error('Fixture has no scored option')

  it('matches a submitted graph option by its own id', () => {
    const submissions = [{ actionId: option.id }]
    expect(scoreCoverage(graph, submissions)).toEqual({ scored: 1, submitted: 1 })
    expect(scoreByDimension(graph, submissions)).toEqual(option.outcomeVector)
  })

  it('does not treat an unrelated role action as a zero-point decision', () => {
    const submissions = [{ actionId: 'unlinked-role-action' }]
    expect(scoreCoverage(graph, submissions)).toEqual({ scored: 0, submitted: 1 })
    expect(scoreByDimension(graph, submissions)).toEqual({ CONT: 0, FOR: 0, BC: 0, JUR: 0, VER: 0, KOS: 0 })
  })
})
