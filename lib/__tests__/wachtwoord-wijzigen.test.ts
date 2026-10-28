import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

// Wachtwoord wijzigen bestond niet: er was alleen gebruiker-aanmaken, dus een
// wachtwoord was alleen te veranderen door rechtstreeks in de opslag te
// schrijven. Deze route vult dat gat, en omdat er toegang aan hangt staan de
// regels hier vast in plaats van alleen in de route.

const ADMIN = { id: "u-admin", email: "bas@example.com", name: "Bas", role: "admin" as const, createdAt: 1 }
const FACI = { id: "u-faci", email: "jan@example.com", name: "Jan", role: "facilitator" as const, createdAt: 2 }

async function route(wie: typeof ADMIN | typeof FACI | null, opgeslagen: { user?: unknown }) {
  const { hash } = await import("bcryptjs")
  const gebruikers = [
    { ...ADMIN, passwordHash: await hash("oud-wachtwoord-admin", 10) },
    { ...FACI, passwordHash: await hash("oud-wachtwoord-faci", 10) },
  ]
  vi.resetModules()
  vi.doMock("@/auth", () => ({
    auth: async () => (wie ? { user: { id: wie.id, email: wie.email, role: wie.role } } : null),
  }))
  vi.doMock("@/lib/db", () => ({
    dbGetUsers: async () => gebruikers,
    dbSaveUser: async (u: unknown) => { opgeslagen.user = u },
  }))
  vi.doMock("@/lib/rate-limit", () => ({ rateLimit: async () => ({ ok: true, remaining: 4, resetSeconds: 60 }) }))
  const mod = await import("@/app/api/users/password/route")
  return { POST: mod.POST, gebruikers }
}

function req(body: unknown) {
  return new Request("http://t/api/users/password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

describe("wachtwoord wijzigen", () => {
  beforeEach(() => { vi.resetModules() })
  afterEach(() => {
    vi.doUnmock("@/auth")
    vi.doUnmock("@/lib/db")
    vi.doUnmock("@/lib/rate-limit")
    vi.resetModules()
  })

  it("weigert iemand die niet ingelogd is", async () => {
    const opgeslagen = {}
    const { POST } = await route(null, opgeslagen)
    const res = await POST(req({ newPassword: "een-lang-wachtwoord" }))
    expect(res.status).toBe(401)
    expect(opgeslagen).toEqual({})
  })

  it("laat je je eigen wachtwoord wijzigen met het huidige erbij", async () => {
    const opgeslagen: { user?: { id: string; passwordHash: string } } = {}
    const { POST } = await route(ADMIN, opgeslagen)
    const res = await POST(req({ currentPassword: "oud-wachtwoord-admin", newPassword: "Internet1!" }))
    expect(res.status).toBe(200)
    expect(opgeslagen.user?.id).toBe(ADMIN.id)

    const { compare } = await import("bcryptjs")
    await expect(compare("Internet1!", opgeslagen.user!.passwordHash)).resolves.toBe(true)
  })

  it("weigert je eigen wijziging zonder het juiste huidige wachtwoord", async () => {
    const opgeslagen = {}
    const { POST } = await route(ADMIN, opgeslagen)
    // Dit is wat voorkomt dat een overgenomen sessie het account afpakt.
    const res = await POST(req({ currentPassword: "fout", newPassword: "een-lang-wachtwoord" }))
    expect(res.status).toBe(403)
    expect(opgeslagen).toEqual({})
  })

  it("laat een admin dat van iemand anders resetten zonder het oude", async () => {
    const opgeslagen: { user?: { id: string } } = {}
    const { POST } = await route(ADMIN, opgeslagen)
    const res = await POST(req({ userId: FACI.id, newPassword: "nieuw-voor-jan-01" }))
    expect(res.status).toBe(200)
    expect(opgeslagen.user?.id).toBe(FACI.id)
  })

  it("laat een facilitator dat van iemand anders niet resetten", async () => {
    const opgeslagen = {}
    const { POST } = await route(FACI, opgeslagen)
    const res = await POST(req({ userId: ADMIN.id, newPassword: "overnamepoging-01" }))
    expect(res.status).toBe(403)
    expect(opgeslagen).toEqual({})
  })

  it("houdt een te kort wachtwoord tegen", async () => {
    const opgeslagen = {}
    const { POST } = await route(ADMIN, opgeslagen)
    const res = await POST(req({ currentPassword: "oud-wachtwoord-admin", newPassword: "kort" }))
    expect(res.status).toBe(400)
    expect(opgeslagen).toEqual({})
  })

  it("weigert hetzelfde wachtwoord opnieuw zetten", async () => {
    const opgeslagen = {}
    const { POST } = await route(ADMIN, opgeslagen)
    const res = await POST(req({ currentPassword: "oud-wachtwoord-admin", newPassword: "oud-wachtwoord-admin" }))
    expect(res.status).toBe(400)
    expect(opgeslagen).toEqual({})
  })

  it("geeft 404 op een onbekende gebruiker in plaats van stil niets te doen", async () => {
    const opgeslagen = {}
    const { POST } = await route(ADMIN, opgeslagen)
    const res = await POST(req({ userId: "bestaat-niet", newPassword: "een-lang-wachtwoord" }))
    expect(res.status).toBe(404)
    expect(opgeslagen).toEqual({})
  })
})
