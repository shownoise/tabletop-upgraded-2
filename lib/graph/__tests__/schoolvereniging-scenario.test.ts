import { describe, expect, it } from 'vitest'
import { schoolverenigingScenario } from '@/lib/graph/examples-schoolvereniging'
import { validateGraph } from '@/lib/graph/validate'
import type { DecisionNodeData, InjectNodeData, RoundNodeData } from '@/lib/graph/types'
import type { Role } from '@/lib/types'

// Guardrail suite for the school-association starter scenario. These tests
// codify the structural promises the brief made — no test is bound to the
// exact Dutch prose so authors can tweak wording without breaking the suite.

describe('examples-schoolvereniging — structural invariants', () => {
  const graph = schoolverenigingScenario()

  it('has exactly 6 round nodes', () => {
    const rounds = graph.nodes.filter(n => n.type === 'round')
    expect(rounds.length).toBe(6)
  })

  it('every decision option has a valid outcomeVector on all 6 axes', () => {
    const dims = ['CONT', 'FOR', 'BC', 'JUR', 'VER', 'KOS'] as const
    for (const node of graph.nodes) {
      if (node.type !== 'decision') continue
      const dd = node.data as DecisionNodeData
      for (const opt of dd.options) {
        expect(opt.outcomeVector, `option "${opt.label}" missing outcomeVector`).toBeDefined()
        for (const d of dims) {
          expect(typeof opt.outcomeVector![d], `option "${opt.label}" dim ${d} not number`).toBe('number')
        }
      }
    }
  })

  it('every role appears as allowedRole on at least 3 decision options across the scenario', () => {
    const roleCounts: Record<Role, number> = {
      ceo: 0, ciso: 0, cfo: 0, legal: 0, head_of_comms: 0,
      hr_lead: 0, ops_manager: 0, it_manager: 0,
    }
    for (const node of graph.nodes) {
      if (node.type !== 'decision') continue
      const dd = node.data as DecisionNodeData
      for (const opt of dd.options) {
        if (opt.allowedRole) roleCounts[opt.allowedRole]++
      }
    }
    for (const role of Object.keys(roleCounts) as Role[]) {
      expect(roleCounts[role], `role ${role} has < 3 decision options`).toBeGreaterThanOrEqual(3)
    }
  })

  it('at least one inject carries triggersRegulatoryNotification: true', () => {
    const withTrigger = graph.nodes.filter(n => {
      if (n.type !== 'inject') return false
      const d = n.data as InjectNodeData
      return d.triggersRegulatoryNotification === true
    })
    expect(withTrigger.length).toBeGreaterThanOrEqual(1)
  })

  it('at least 12 cross-role coupling moments exist (capabilityFlag OR requiresCapability)', () => {
    let coupling = 0
    for (const node of graph.nodes) {
      if (node.type === 'decision') {
        const dd = node.data as DecisionNodeData
        for (const opt of dd.options) {
          if (opt.capabilityFlag) coupling++
          if (opt.requiresCapability) coupling++
        }
      }
      if (node.type === 'inject') {
        const d = node.data as InjectNodeData
        if (d.requiresCapability) coupling++
      }
    }
    expect(coupling, 'need at least 12 coupling moments across the scenario').toBeGreaterThanOrEqual(12)
  })

  it('scenario passes validateGraph() with no errors', () => {
    const issues = validateGraph(graph)
    const errors = issues.filter(i => i.severity === 'error')
    if (errors.length > 0) {
      console.error('Validation errors:', JSON.stringify(errors, null, 2))
    }
    expect(errors).toEqual([])
  })

  it('every round has at least 3 injects', () => {
    const rounds = graph.nodes.filter(n => n.type === 'round')
    for (const round of rounds) {
      const injectEdges = graph.edges.filter(e => e.source === round.id && e.type === 'inject')
      const rd = round.data as RoundNodeData
      expect(injectEdges.length, `round "${rd.title}" has < 3 injects`).toBeGreaterThanOrEqual(3)
    }
  })

  it('every round has reviewPrompts authored', () => {
    const rounds = graph.nodes.filter(n => n.type === 'round')
    for (const round of rounds) {
      const rd = round.data as RoundNodeData
      expect(rd.reviewPrompts, `round "${rd.title}" missing reviewPrompts`).toBeDefined()
      expect(rd.reviewPrompts!.length).toBeGreaterThanOrEqual(2)
    }
  })
})
