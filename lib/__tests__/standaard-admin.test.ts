import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

// De grens voor het standaard-wachtwoord is de opslag, niet NODE_ENV.
//
// Oude controle: `NODE_ENV === 'production'`. Die klopte zolang een laptop in
// het geheugen draaide. Sinds DATABASE_URL in .env.local komt te staan draait
// een laptop op dezelfde database als productie, en dan zette `pnpm dev`
// 'changeme123' als admin in die database — met NODE_ENV=development, dus de
// oude controle liet het door. Deze test faalt op die oude code.

// NODE_ENV staat er bewust niet bij: die is read-only in de Next-types, dus
// die zetten we met vi.stubEnv.
const ENV_SLEUTELS = ["KV_REST_API_URL", "KV_URL", "DATABASE_URL", "POSTGRES_URL", "ADMIN_PASSWORD", "ADMIN_EMAIL"] as const
type EnvSleutel = (typeof ENV_SLEUTELS)[number]

function nepKv() {
  const waarden = new Map<string, unknown>()
  return {
    get: vi.fn(async (key: string) => (waarden.has(key) ? waarden.get(key) : null)),
    set: vi.fn(async (key: string, value: unknown) => { waarden.set(key, value); return "OK" }),
    del: vi.fn(async (key: string) => (waarden.delete(key) ? 1 : 0)),
    keys: vi.fn(async (patroon: string) => {
      const prefix = patroon.endsWith("*") ? patroon.slice(0, -1) : patroon
      return [...waarden.keys()].filter(k => k.startsWith(prefix))
    }),
  }
}

describe("standaard-admin aanmaken", () => {
  let bewaard: Partial<Record<EnvSleutel, string | undefined>> = {}

  beforeEach(() => {
    bewaard = {}
    for (const k of ENV_SLEUTELS) bewaard[k] = process.env[k]
    for (const k of ENV_SLEUTELS) delete process.env[k]
    vi.resetModules()
  })

  afterEach(() => {
    for (const k of ENV_SLEUTELS) {
      const v = bewaard[k]
      if (v === undefined) delete process.env[k]
      else process.env[k] = v
    }
    vi.unstubAllEnvs()
    vi.doUnmock("@vercel/kv")
    vi.resetModules()
  })

  async function metGedeeldeOpslag() {
    process.env.KV_REST_API_URL = "https://gedeelde-store.example"
    vi.resetModules()
    vi.doMock("@vercel/kv", () => ({ kv: nepKv() }))
    return await import("../db")
  }

  it("weigert changeme123 in gedeelde opslag, ook met NODE_ENV=development", async () => {
    // Precies de situatie op een laptop met DATABASE_URL in .env.local: de
    // oude controle keek naar NODE_ENV en liet dit dus door.
    vi.stubEnv("NODE_ENV", "development")
    const db = await metGedeeldeOpslag()

    await expect(db.dbEnsureAdminUser()).rejects.toThrow(/shared storage/i)
    await expect(db.dbGetUsers()).resolves.toEqual([])
  })

  it("maakt hem wél aan in gedeelde opslag als ADMIN_PASSWORD gezet is", async () => {
    process.env.ADMIN_PASSWORD = "een-eigen-wachtwoord"
    process.env.ADMIN_EMAIL = "bas@example.com"
    const db = await metGedeeldeOpslag()

    await db.dbEnsureAdminUser()
    const gebruikers = await db.dbGetUsers()
    expect(gebruikers.map(g => g.email)).toEqual(["bas@example.com"])
  })

  it("laat het standaard-wachtwoord toe in het geheugen, want dat is vluchtig", async () => {
    vi.resetModules()
    const { _leegGeheugen } = await import("../store/geheugen")
    _leegGeheugen()
    const db = await import("../db")

    await db.dbEnsureAdminUser()
    const gebruikers = await db.dbGetUsers()
    expect(gebruikers).toHaveLength(1)

    const { compare } = await import("bcryptjs")
    await expect(compare("changeme123", gebruikers[0].passwordHash)).resolves.toBe(true)
  })

  it("doet niets als er al een gebruiker staat", async () => {
    process.env.ADMIN_PASSWORD = "een-eigen-wachtwoord"
    const db = await metGedeeldeOpslag()

    await db.dbEnsureAdminUser()
    // Tweede keer mag niets veranderen en niet gooien.
    await expect(db.dbEnsureAdminUser()).resolves.toBeUndefined()
    await expect(db.dbGetUsers()).resolves.toHaveLength(1)
  })
})
