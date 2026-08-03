import { describe, it, expect } from "vitest"
import { rateLimit } from "../rate-limit"

describe("rateLimit (in-memory)", () => {
  it("allows up to the limit, then rejects", async () => {
    const key = `test-basic-${Math.random()}`
    for (let i = 0; i < 3; i++) {
      const r = await rateLimit(key, 3, 60)
      expect(r.ok).toBe(true)
    }
    const r = await rateLimit(key, 3, 60)
    expect(r.ok).toBe(false)
    expect(r.remaining).toBe(0)
    expect(r.resetSeconds).toBeGreaterThan(0)
  })

  it("keys are independent", async () => {
    const a = `a-${Math.random()}`
    const b = `b-${Math.random()}`
    await rateLimit(a, 1, 60)
    const rA = await rateLimit(a, 1, 60)
    const rB = await rateLimit(b, 1, 60)
    expect(rA.ok).toBe(false)
    expect(rB.ok).toBe(true)
  })

  it("returns remaining count", async () => {
    const key = `test-remaining-${Math.random()}`
    const r1 = await rateLimit(key, 5, 60)
    expect(r1.remaining).toBe(4)
    const r2 = await rateLimit(key, 5, 60)
    expect(r2.remaining).toBe(3)
  })
})
