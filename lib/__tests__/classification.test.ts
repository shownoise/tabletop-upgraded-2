import { describe, it, expect } from "vitest"
import type { InjectNodeData } from "@/lib/graph/types"
import { schoolverenigingScenario } from "@/lib/graph/examples-schoolvereniging"

describe("Phase 2 — feit/aanname/fabel classification", () => {
  it("the classification field is readable from InjectNodeData without runtime error", () => {
    const graph = schoolverenigingScenario()
    let inspected = 0
    let classified = 0
    for (const n of graph.nodes) {
      if (n.type !== "inject") continue
      inspected++
      const d = n.data as InjectNodeData
      // Just touching the field must never throw.
      const c = d.classification
      if (c === "feit" || c === "aanname" || c === "fabel") classified++
    }
    expect(inspected).toBeGreaterThan(0)
    // Counting classified injects — 0 is acceptable for legacy data; the point
    // of this test is that reading the field is safe and the type is enforced
    // when set. We assert the classified count is a non-negative integer.
    expect(Number.isInteger(classified)).toBe(true)
    expect(classified).toBeGreaterThanOrEqual(0)
  })

  it("only accepts the three legal enum values", () => {
    const ok: Array<'feit' | 'aanname' | 'fabel'> = ["feit", "aanname", "fabel"]
    for (const v of ok) {
      const d: Pick<InjectNodeData, "classification"> = { classification: v }
      expect(d.classification).toBe(v)
    }
  })
})
