import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

// Wat hier vastgepind wordt, en waarom het nodig was:
//
//  - De 24-uurs TTL op de sessie is eruit. Oude code schreef
//    `kv.set("ctt:session", sessie, { ex: 60 * 60 * 24 })`, dus een oefening
//    van gisteren was vandaag weg zonder dat iemand iets had verwijderd. De
//    opties-assertie hieronder faalde op die code.
//  - Elke sessie staat onder zijn eigen sleutel `ctt:session:<id>`, met
//    `ctt:session` als verwijzing naar de actieve. `dbGetSessionById` en
//    `dbListSessionIds` bestonden niet, dus die tests faalden op de import.
//  - Oude data op `ctt:session` blijft leesbaar. Dit is geen reparatie maar een
//    wachtpost: de eerste deploy na de sleutelwijziging mag geen wisser zijn.
//  - Zonder TTL ruimt niets zich meer van zichzelf op, dus de reset moet dat
//    expliciet doen.
//  - `dbStorageStatus()` bestond niet.

const ENV_SLEUTELS = ["KV_REST_API_URL", "KV_URL", "DATABASE_URL", "POSTGRES_URL"] as const
type EnvSleutel = (typeof ENV_SLEUTELS)[number]

function zetEnv(waarden: Partial<Record<EnvSleutel, string>>) {
  for (const k of ENV_SLEUTELS) {
    const v = waarden[k]
    if (v === undefined) delete process.env[k]
    else process.env[k] = v
  }
}

interface SetAanroep { key: string; value: unknown; opties: unknown }

// Een KV die wél antwoordt, en die vastlegt met welke opties er geschreven is.
// Dat laatste is de hele reden dat deze mock bestaat: de TTV-regressie is
// alleen zichtbaar aan de derde parameter van kv.set.
function nepKv() {
  const waarden = new Map<string, unknown>()
  const sets: SetAanroep[] = []
  const kv = {
    get: vi.fn(async (key: string) => (waarden.has(key) ? waarden.get(key) : null)),
    set: vi.fn(async (key: string, value: unknown, opties?: unknown) => {
      sets.push({ key, value, opties })
      const nx = !!opties && typeof opties === "object" && "nx" in opties
      if (nx && waarden.has(key)) return null
      waarden.set(key, value)
      return "OK"
    }),
    del: vi.fn(async (key: string) => (waarden.delete(key) ? 1 : 0)),
    keys: vi.fn(async (patroon: string) => {
      const prefix = patroon.endsWith("*") ? patroon.slice(0, -1) : patroon
      return [...waarden.keys()].filter(k => k.startsWith(prefix))
    }),
  }
  return { kv, sets, waarden }
}

async function metKv(nep: ReturnType<typeof nepKv>) {
  zetEnv({ KV_REST_API_URL: "https://werkende-store.example" })
  vi.resetModules()
  vi.doMock("@vercel/kv", () => ({ kv: nep.kv }))
  return await import("../db")
}

async function metGeheugen() {
  zetEnv({})
  vi.resetModules()
  const { _leegGeheugen } = await import("../store/geheugen")
  _leegGeheugen()
  return await import("../db")
}

const SESSIE = { id: "s1", joinCode: "ABC123" } as never

describe("opslag van sessies", () => {
  let bewaard: Partial<Record<EnvSleutel, string | undefined>> = {}

  beforeEach(() => {
    bewaard = {}
    for (const k of ENV_SLEUTELS) bewaard[k] = process.env[k]
  })

  afterEach(() => {
    for (const k of ENV_SLEUTELS) {
      const v = bewaard[k]
      if (v === undefined) delete process.env[k]
      else process.env[k] = v
    }
    vi.doUnmock("@vercel/kv")
    vi.resetModules()
  })

  it("schrijft de sessie zonder vervaltijd en vindt hem bij een tweede read terug", async () => {
    const nep = nepKv()
    const db = await metKv(nep)

    await db.dbSetSession(SESSIE)
    await expect(db.dbGetSession()).resolves.toMatchObject({ id: "s1" })

    // Dit is de assertie die op de oude code faalde: daar ging
    // `{ ex: 60 * 60 * 24 }` mee als derde parameter.
    const sessieSets = nep.sets.filter(a => a.key.startsWith("ctt:session"))
    expect(sessieSets.length).toBeGreaterThan(0)
    for (const a of sessieSets) expect(a.opties).toBeUndefined()
  })

  it("bewaart de sessie onder een eigen sleutel en houdt ctt:session als verwijzing", async () => {
    const nep = nepKv()
    const db = await metKv(nep)

    await db.dbSetSession(SESSIE)

    expect([...nep.waarden.keys()]).toContain("ctt:session:s1")
    expect(nep.waarden.get("ctt:session")).toEqual({ actieveSessieId: "s1" })
    await expect(db.dbListSessionIds()).resolves.toEqual(["s1"])
  })

  it("vindt met dbGetSessionById een sessie die via dbSetSession is weggezet", async () => {
    const db = await metGeheugen()

    await db.dbSetSession({ id: "s7", joinCode: "ZZZ999" } as never)

    await expect(db.dbGetSessionById("s7")).resolves.toMatchObject({ id: "s7" })
    // Een id dat niet bestaat geeft null, geen exceptie.
    await expect(db.dbGetSessionById("bestaat-niet")).resolves.toBeNull()
  })

  it("geeft oude data terug: staat er alleen ctt:session, dan is dat de sessie", async () => {
    const nep = nepKv()
    // Zoals een live store eruitziet van vóór deze wijziging: de volledige
    // sessie op één sleutel, geen ctt:session:<id>.
    nep.waarden.set("ctt:session", { id: "oud1", joinCode: "OUD123" })
    const db = await metKv(nep)

    await expect(db.dbGetSession()).resolves.toMatchObject({ id: "oud1" })
    // Ook op id en in de opsomming, anders is de lopende oefening onvindbaar.
    await expect(db.dbGetSessionById("oud1")).resolves.toMatchObject({ id: "oud1" })
    await expect(db.dbListSessionIds()).resolves.toEqual(["oud1"])
  })

  it("ruimt bij een reset zowel de verwijzing als de sessie zelf op", async () => {
    const nep = nepKv()
    const db = await metKv(nep)

    await db.dbSetSession(SESSIE)
    await db.dbSetSession(null)

    // Zonder TTL verdwijnt er niets meer van zichzelf, dus de reset moet het
    // doen — anders groeit de store ongelimiteerd.
    expect([...nep.waarden.keys()]).not.toContain("ctt:session:s1")
    expect([...nep.waarden.keys()]).not.toContain("ctt:session")
    await expect(db.dbGetSession()).resolves.toBeNull()
    await expect(db.dbListSessionIds()).resolves.toEqual([])
  })

  it("nummert gebeurtenissen oplopend en geeft ze in volgorde terug", async () => {
    zetEnv({})
    vi.resetModules()
    const { _leegGeheugen } = await import("../store/geheugen")
    _leegGeheugen()
    const { store } = await import("../store/backend")

    const s = await store()
    expect(s.naam).toBe("geheugen")

    const eerste = await s.appendEvent({
      sessionId: "s1", at: 1, kind: "inject_pushed", actor: "facilitator", payload: { injectId: "i1" },
    })
    const tweede = await s.appendEvent({
      sessionId: "s1", at: 2, kind: "decision_submitted", actor: "p1", payload: { optionId: "o1" },
    })

    expect([eerste.seq, tweede.seq]).toEqual([1, 2])
    const lijst = await s.listEvents("s1")
    expect(lijst.map(e => e.kind)).toEqual(["inject_pushed", "decision_submitted"])
    expect(lijst.map(e => e.seq)).toEqual([1, 2])
    // Gebeurtenissen van twee sessies lopen niet door elkaar.
    await expect(s.listEvents("s2")).resolves.toEqual([])
  })

  it("zegt duurzaam: false zonder DATABASE_URL", async () => {
    const db = await metGeheugen()

    const status = await db.dbStorageStatus()
    expect(status).toMatchObject({ backend: "geheugen", duurzaam: false })
    expect(status.uitleg).toMatch(/herstart/)
  })

  it("zegt ook op KV duurzaam: false, want dat product is uitgefaseerd", async () => {
    const nep = nepKv()
    const db = await metKv(nep)

    expect(await db.dbStorageStatus()).toMatchObject({ backend: "kv", duurzaam: false })
  })
})
