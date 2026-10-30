import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

// `POST /api/session/set-phase` nam `force` aan maar gebruikte hem alleen voor
// de sprong-check (niet van 'inject' naar 'review' springen). De force-optie
// van `setPhase()` zelf — de beslisfase verlaten terwijl er nog rollen open
// staan — werd nooit gezet.
//
// Gevolg: een aanroep met `force: true` kreeg alsnog "Nog wachten op 2
// beslissingen" terug, met een melding die naar een knop verwijst die iets
// anders doet (force-lock). Deze test faalt op die oude code.

const SESSIE = { id: "s1", roundPhase: "decision" } as never

function routeMet(opgevangen: { opts?: unknown; phase?: string }) {
  vi.resetModules()
  vi.doMock("@/lib/auth-guard", () => ({
    requireFacilitator: async () => ({ ok: true, session: { user: { role: "admin" } }, role: "admin" }),
  }))
  vi.doMock("@/lib/session-store", () => ({
    getSession: async () => SESSIE,
    setPhase: async (phase: string, opts?: unknown) => {
      opgevangen.phase = phase
      opgevangen.opts = opts
      return { ok: true }
    },
  }))
  return import("@/app/api/session/set-phase/route")
}

function req(body: unknown) {
  return new Request("http://t/api/session/set-phase", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

describe("fase zetten met force", () => {
  beforeEach(() => { vi.resetModules() })
  afterEach(() => {
    vi.doUnmock("@/lib/auth-guard")
    vi.doUnmock("@/lib/session-store")
    vi.resetModules()
  })

  it("geeft force door aan setPhase in plaats van hem te laten vallen", async () => {
    const opgevangen: { opts?: unknown; phase?: string } = {}
    const { POST } = await routeMet(opgevangen)
    const res = await POST(req({ phase: "review", force: true, reason: "tijd om" }))
    expect(res.status).toBe(200)
    expect(opgevangen.phase).toBe("review")
    expect(opgevangen.opts).toMatchObject({ force: true, reason: "tijd om" })
  })

  it("laat force weg als er niet om gevraagd is", async () => {
    const opgevangen: { opts?: unknown } = {}
    const { POST } = await routeMet(opgevangen)
    await POST(req({ phase: "review" }))
    expect(opgevangen.opts).toMatchObject({ force: undefined })
  })

  it("weigert een onbekende fase", async () => {
    const opgevangen: { phase?: string } = {}
    const { POST } = await routeMet(opgevangen)
    const res = await POST(req({ phase: "kletspraat", force: true }))
    expect(res.status).toBe(400)
    expect(opgevangen.phase).toBeUndefined()
  })
})
