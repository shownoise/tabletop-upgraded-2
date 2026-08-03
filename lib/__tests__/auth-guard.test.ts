import { describe, it, expect, vi, beforeEach } from "vitest"

const authMock = vi.fn()

vi.mock("@/auth", () => ({
  auth: (...args: unknown[]) => authMock(...args),
}))

describe("auth-guard", () => {
  beforeEach(() => { authMock.mockReset() })

  it("requireFacilitator returns 401 when unauthenticated", async () => {
    authMock.mockResolvedValueOnce(null)
    const { requireFacilitator } = await import("../auth-guard")
    const res = await requireFacilitator()
    expect(res.ok).toBe(false)
    if (!res.ok) {
      expect(res.response.status).toBe(401)
    }
  })

  it("requireFacilitator rejects wrong role", async () => {
    authMock.mockResolvedValueOnce({ user: { id: "u", role: "guest" } })
    const { requireFacilitator } = await import("../auth-guard")
    const res = await requireFacilitator()
    expect(res.ok).toBe(false)
  })

  it("requireFacilitator accepts admin and facilitator", async () => {
    authMock.mockResolvedValueOnce({ user: { id: "u", role: "admin" } })
    const { requireFacilitator } = await import("../auth-guard")
    const res = await requireFacilitator()
    expect(res.ok).toBe(true)

    authMock.mockResolvedValueOnce({ user: { id: "u", role: "facilitator" } })
    const res2 = await requireFacilitator()
    expect(res2.ok).toBe(true)
  })

  it("requireAdmin rejects facilitator", async () => {
    authMock.mockResolvedValueOnce({ user: { id: "u", role: "facilitator" } })
    const { requireAdmin } = await import("../auth-guard")
    const res = await requireAdmin()
    expect(res.ok).toBe(false)
  })

  it("requireAdmin accepts admin", async () => {
    authMock.mockResolvedValueOnce({ user: { id: "u", role: "admin" } })
    const { requireAdmin } = await import("../auth-guard")
    const res = await requireAdmin()
    expect(res.ok).toBe(true)
  })
})
