import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { MIN_WACHTWOORD_LENGTE, wachtwoordFout } from "../wachtwoord"

// Er waren drie verschillende regels: het aanmaakformulier zei minstens 8, de
// wijzigroute eiste 10, en de aanmaakroute controleerde niets — die nam elk
// wachtwoord aan, ook van één teken. Je kon dus via de API een account maken
// met een wachtwoord dat je daarna niet meer mocht instellen. Live liep dat
// mis: er stond een account waarvan het wachtwoord niet was wat gedacht werd.

describe("de wachtwoordregel", () => {
  it("weigert te kort en laat lang genoeg door", () => {
    expect(wachtwoordFout("")).toMatch(/vul een wachtwoord/i)
    expect(wachtwoordFout("x".repeat(MIN_WACHTWOORD_LENGTE - 1))).toMatch(new RegExp(`${MIN_WACHTWOORD_LENGTE}`))
    expect(wachtwoordFout("x".repeat(MIN_WACHTWOORD_LENGTE))).toBeNull()
  })

  it("weigert iets dat geen tekst is", () => {
    expect(wachtwoordFout(undefined)).not.toBeNull()
    expect(wachtwoordFout(12345678901)).not.toBeNull()
  })
})

describe("gebruiker aanmaken dwingt dezelfde regel af", () => {
  const opgeslagen: { user?: unknown } = {}

  beforeEach(() => {
    opgeslagen.user = undefined
    vi.resetModules()
    vi.doMock("@/lib/auth-guard", () => ({
      requireAdmin: async () => ({ ok: true, session: { user: { id: "u1", email: "a@b.nl", role: "admin" } }, role: "admin" }),
    }))
    vi.doMock("@/lib/db", () => ({
      dbGetUsers: async () => [],
      dbCreateUserIfEmailFree: async (u: unknown) => { opgeslagen.user = u; return { ok: true } },
    }))
  })

  afterEach(() => {
    vi.doUnmock("@/lib/auth-guard")
    vi.doUnmock("@/lib/db")
    vi.resetModules()
  })

  function req(body: unknown) {
    return new Request("http://t/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  }

  it("weigert een te kort wachtwoord in plaats van het stil te accepteren", async () => {
    const { POST } = await import("@/app/api/users/route")
    const res = await POST(req({ name: "Jan", email: "jan@eye.security", password: "kort" }))
    // Dit is de assertie die op de oude code faalde: daar werd het een 200.
    expect(res.status).toBe(400)
    expect(opgeslagen.user).toBeUndefined()
  })

  it("maakt hem wel aan met een wachtwoord dat lang genoeg is", async () => {
    const { POST } = await import("@/app/api/users/route")
    const res = await POST(req({ name: "Jan", email: "jan@eye.security", password: "x".repeat(MIN_WACHTWOORD_LENGTE) }))
    expect(res.status).toBe(200)
    expect(opgeslagen.user).toBeDefined()
  })
})
