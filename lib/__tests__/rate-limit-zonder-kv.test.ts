import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

// Live gebeurd: de Upstash-store raakte zijn plan-limiet en antwoordde op élk
// commando met "ERR This database has reached current Fixed plan limits".
//
// rate-limit.ts had toen een eigen @vercel/kv-client zónder foutopvang, en
// deze functie zit op de login, op deelnemen, op sessie aanmaken en op de
// wizard. Een volle store legde daarmee de hele app plat — niet alleen de
// opslag, maar ook inloggen.
//
// Deze test faalt op die oude code: daar gooide rateLimit() door.

const KV_ENV = "KV_REST_API_URL"

describe("rateLimit met een KV-store die over zijn limiet is", () => {
  let oud: string | undefined

  beforeEach(() => {
    oud = process.env[KV_ENV]
    process.env[KV_ENV] = "https://volle-store.example"
    vi.resetModules()
    // Zoals Upstash zich gedraagt bij een volle Fixed-plan database: elk
    // commando gooit, ook een simpele read.
    vi.doMock("@vercel/kv", () => ({
      kv: {
        incr: vi.fn(async () => { throw new Error("ERR This database has reached current Fixed plan limits") }),
        expire: vi.fn(async () => { throw new Error("ERR This database has reached current Fixed plan limits") }),
        get: vi.fn(async () => { throw new Error("ERR This database has reached current Fixed plan limits") }),
        set: vi.fn(async () => { throw new Error("ERR This database has reached current Fixed plan limits") }),
      },
    }))
  })

  afterEach(() => {
    if (oud === undefined) delete process.env[KV_ENV]
    else process.env[KV_ENV] = oud
    vi.doUnmock("@vercel/kv")
    vi.resetModules()
  })

  it("gooit niet, maar blijft gewoon tellen", async () => {
    const { rateLimit } = await import("../rate-limit")
    const key = `vol-${Math.random()}`

    await expect(rateLimit(key, 2, 60)).resolves.toMatchObject({ ok: true })
    await expect(rateLimit(key, 2, 60)).resolves.toMatchObject({ ok: true })
    // En de rem werkt nog: de derde poging binnen het venster valt af.
    await expect(rateLimit(key, 2, 60)).resolves.toMatchObject({ ok: false })
  })

  it("raakt @vercel/kv helemaal niet meer aan", async () => {
    const mod = await import("@vercel/kv")
    const { rateLimit } = await import("../rate-limit")
    await rateLimit(`geen-kv-${Math.random()}`, 5, 60)
    // Dit is het punt: geen enkel commando naar een store die er niet voor is.
    expect(mod.kv.incr).not.toHaveBeenCalled()
    expect(mod.kv.get).not.toHaveBeenCalled()
  })

  it("laat de login doorgaan in plaats van te klappen", async () => {
    // auth.ts roept rateLimit() aan vóór alles. Gooide die, dan werd het een
    // 500 op /api/auth/callback/credentials en kon niemand meer inloggen.
    const { rateLimit } = await import("../rate-limit")
    const r = await rateLimit(`login:bas@example.com-${Math.random()}`, 5, 60)
    expect(r.ok).toBe(true)
  })
})
