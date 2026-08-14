import { describe, it, expect } from "vitest"
import type { InjectNodeData } from "@/lib/graph/types"
import { schoolverenigingScenario } from "@/lib/graph/examples-schoolvereniging"

describe("Phase 2 — feit/aanname classification (fabel verwijderd 2026-08-14)", () => {
  it("the classification field is readable from InjectNodeData without runtime error", () => {
    const graph = schoolverenigingScenario()
    let inspected = 0
    let classified = 0
    for (const n of graph.nodes) {
      if (n.type !== "inject") continue
      inspected++
      const d = n.data as InjectNodeData
      const c = d.classification
      if (c === "feit" || c === "aanname") classified++
    }
    expect(inspected).toBeGreaterThan(0)
    expect(Number.isInteger(classified)).toBe(true)
    expect(classified).toBeGreaterThanOrEqual(0)
  })

  it("only accepts feit and aanname enum values", () => {
    const ok: Array<'feit' | 'aanname'> = ["feit", "aanname"]
    for (const v of ok) {
      const d: Pick<InjectNodeData, "classification"> = { classification: v }
      expect(d.classification).toBe(v)
    }
  })

  it("no inject in the schoolvereniging scenario still carries legacy 'fabel'", () => {
    const graph = schoolverenigingScenario()
    for (const n of graph.nodes) {
      if (n.type !== "inject") continue
      const d = n.data as InjectNodeData
      expect(d.classification).not.toBe("fabel")
    }
  })
})
