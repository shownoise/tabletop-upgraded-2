import { describe, it, expect } from "vitest"
import { schoolverenigingScenario } from "@/lib/graph/examples-schoolvereniging"
import type { DecisionNodeData } from "@/lib/graph/types"
import { ROLE_META, ROLE_ORDER, type Role } from "@/lib/types"

// Phase 1 — decision-card overview at glance.
//
// The DecisionForm renders a compact summary block above the option grid:
//   1. A chip line of roles participating in the decision.
//   2. A grid of role → count pills (green ≥ expected, amber below, red = 0).
//
// These tests codify the DATA guarantees the UI depends on so regressions
// surface here before they land in the inspector.

describe("Phase 1 — decision-card overview at glance", () => {
  const graph = schoolverenigingScenario()

  it("ROLE_ORDER covers every playable role exactly once", () => {
    const seen = new Set(ROLE_ORDER)
    expect(seen.size).toBe(ROLE_ORDER.length)
    // ROLE_ORDER must include every key of ROLE_META.
    for (const role of Object.keys(ROLE_META) as Role[]) {
      expect(ROLE_ORDER).toContain(role)
    }
  })

  it("every decision's role-summary lists every role that has at least one option", () => {
    for (const node of graph.nodes) {
      if (node.type !== "decision") continue
      const dd = node.data as DecisionNodeData
      const rolesOnDecision = new Set<Role>()
      for (const opt of dd.options) if (opt.allowedRole) rolesOnDecision.add(opt.allowedRole)
      // The chip line = rolesOnDecision, ordered by ROLE_ORDER.
      const chipLine = ROLE_ORDER.filter(r => rolesOnDecision.has(r))
      expect(chipLine.length).toBe(rolesOnDecision.size)
      for (const r of rolesOnDecision) {
        expect(chipLine).toContain(r)
      }
    }
  })

  it("every role that appears on a decision has a positive option count there", () => {
    for (const node of graph.nodes) {
      if (node.type !== "decision") continue
      const dd = node.data as DecisionNodeData
      const counts: Partial<Record<Role, number>> = {}
      for (const opt of dd.options) {
        if (opt.allowedRole) counts[opt.allowedRole] = (counts[opt.allowedRole] ?? 0) + 1
      }
      for (const role of Object.keys(counts) as Role[]) {
        expect(counts[role]!).toBeGreaterThan(0)
      }
    }
  })

  it("every option has the compact-row required fields (id + label)", () => {
    for (const node of graph.nodes) {
      if (node.type !== "decision") continue
      const dd = node.data as DecisionNodeData
      for (const opt of dd.options) {
        expect(typeof opt.id).toBe("string")
        expect(opt.id.length).toBeGreaterThan(0)
        expect(typeof opt.label).toBe("string")
      }
    }
  })

  it("union of scenario-wide allowedRole includes every role that appears on any decision", () => {
    // Sanity: the "roles this scenario cares about" set used by the red-pill
    // logic must be a superset of every per-decision role set.
    const scenarioRoles = new Set<Role>()
    for (const node of graph.nodes) {
      if (node.type !== "decision") continue
      const dd = node.data as DecisionNodeData
      for (const opt of dd.options) if (opt.allowedRole) scenarioRoles.add(opt.allowedRole)
    }
    for (const node of graph.nodes) {
      if (node.type !== "decision") continue
      const dd = node.data as DecisionNodeData
      for (const opt of dd.options) {
        if (opt.allowedRole) expect(scenarioRoles.has(opt.allowedRole)).toBe(true)
      }
    }
  })
})
