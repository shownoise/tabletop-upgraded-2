import { describe, it, expect } from "vitest"
import { z } from "zod"
import { safeJson } from "../api-validation"

function makeReq(body: unknown, malformed = false): Request {
  const raw = malformed ? "{not json" : JSON.stringify(body)
  return new Request("http://x", { method: "POST", body: raw, headers: { "Content-Type": "application/json" } })
}

const Schema = z.object({ name: z.string().min(1).max(10) })

describe("safeJson", () => {
  it("accepts a valid body", async () => {
    const req = makeReq({ name: "Alice" })
    const result = await safeJson(req, Schema)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data.name).toBe("Alice")
  })

  it("returns 400 on invalid JSON", async () => {
    const req = makeReq(null, true)
    const result = await safeJson(req, Schema)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.response.status).toBe(400)
  })

  it("returns 422 on schema mismatch", async () => {
    const req = makeReq({ name: "" })
    const result = await safeJson(req, Schema)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.response.status).toBe(422)
  })

  it("returns 422 when a required field is missing", async () => {
    const req = makeReq({ other: "value" })
    const result = await safeJson(req, Schema)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.response.status).toBe(422)
  })
})
