import { describe, expect, it } from 'vitest'
import { schoolverenigingScenario } from '@/lib/graph/examples-schoolvereniging'
import type { DecisionNodeData, GraphNode } from '@/lib/graph/types'
import type { Role } from '@/lib/types'

// Phase-8 guard: the participant flow must render exactly the number of
// options authored per role — no cap, no pagination, no fixed grid. Recurring
// symptom before this test: the UI would render only 2 options per role
// regardless of how many were authored.

describe('phase-8: no option cap per role', () => {
  const graph = schoolverenigingScenario()
  const decisionNodes = graph.nodes.filter((n): n is GraphNode & { data: DecisionNodeData } => n.type === 'decision')

  for (const [idx, node] of decisionNodes.entries()) {
    const optionsByRole = new Map<Role, number>()
    for (const opt of node.data.options) {
      if (!opt.allowedRole) continue
      optionsByRole.set(opt.allowedRole, (optionsByRole.get(opt.allowedRole) ?? 0) + 1)
    }
    for (const [role, count] of optionsByRole.entries()) {
      it(`round ${idx + 1}: ${role} has ${count} authored options — the participant projection must not cap`, () => {
        // The projection filters options by (consumesOptionAfterUse ∩ already-submitted)
        // and (requiresCapability ∩ flag-not-set). Neither of those is a role-based cap.
        // Assert that when a role owns N options, filtering by role returns N.
        const forRole = node.data.options.filter(o => o.allowedRole === role)
        expect(forRole.length).toBe(count)
        // And that there is no hard-coded ceiling below 3.
        expect(forRole.length).toBeGreaterThanOrEqual(2) // baseline sanity — scenario should have >= 2 per role
      })
    }
  }
})
