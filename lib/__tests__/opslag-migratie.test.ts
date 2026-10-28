import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

// Waarom deze test bestaat: de naad kiest Postgres zodra DATABASE_URL er is, en
// een nieuwe database begint leeg. Zonder migratie is alles in KV na één deploy
// onvindbaar — de lopende sessie, de klanten, het archief, de grafen. Dat is
// geen crash maar stilte, en stilte merk je pas als je het nodig hebt.
//
// De echte Postgres-achterkant is hier niet te gebruiken, dus de bestemming is
// het geheugen met een eigen naam. Wat getest wordt is de migratielogica:
// welke sleutels mee, wat met vluchtige sleutels, wat bij een tweede ronde, en
// dat gebeurtenissen niet als blob maar als losse rijen overgaan.

const ENV_SLEUTELS = ["KV_REST_API_URL", "KV_URL", "DATABASE_URL", "POSTGRES_URL"] as const

function nepKv(inhoud: Record<string, unknown>) {
  const waarden = new Map<string, unknown>(Object.entries(inhoud))
  return {
    kv: {
      get: vi.fn(async (key: string) => (waarden.has(key) ? waarden.get(key) : null)),
      set: vi.fn(async (key: string, value: unknown) => { waarden.set(key, value); return "OK" }),
      del: vi.fn(async (key: string) => (waarden.delete(key) ? 1 : 0)),
      keys: vi.fn(async (patroon: string) => {
        const prefix = patroon.endsWith("*") ? patroon.slice(0, -1) : patroon
        return [...waarden.keys()].filter(k => k.startsWith(prefix))
      }),
    },
    waarden,
  }
}

// De bestemming: het geheugen, maar met de naam van een duurzame achterkant,
// want migreerVanKv weigert terecht naar het geheugen te kopiëren.
async function alsBestemming() {
  const { geheugenBackend, _leegGeheugen } = await import("../store/geheugen")
  _leegGeheugen()
  const echt = geheugenBackend()
  return { ...echt, naam: "postgres" as const }
}

const KV_INHOUD = {
  "ctt:session": { actieveSessieId: "s1" },
  "ctt:session:s1": { id: "s1", joinCode: "ABC123" },
  "ctt:templates": [{ id: "t1" }],
  "ctt:users": [{ email: "bas@example.com" }],
  "ctt:lock:session": "een slot van toen",
  "ctt:health": null,
  "admin:clients": { c1: { id: "c1", name: "Onderwijsvereniging" } },
  "admin:sessions-archive": { s0: { startedAt: 1 } },
  "admin:overrides": { texts: {} },
  "scenario-graph-index": ["g1"],
  "scenario-graph:g1": { id: "g1", nodes: [] },
  "ctt:events:s1": [
    { id: "ev_1", sessionId: "s1", seq: 1, at: 10, kind: "inject_pushed", actor: "facilitator", payload: { injectId: "i1" } },
    { id: "ev_2", sessionId: "s1", seq: 2, at: 20, kind: "decision_submitted", actor: "p1", payload: { optionId: "o1" }, undoes: "ev_1" },
  ],
}

describe("migratie van KV naar de nieuwe opslag", () => {
  let bewaard: Partial<Record<(typeof ENV_SLEUTELS)[number], string | undefined>> = {}

  beforeEach(() => {
    bewaard = {}
    for (const k of ENV_SLEUTELS) bewaard[k] = process.env[k]
    process.env.KV_REST_API_URL = "https://oude-store.example"
    delete process.env.DATABASE_URL
    delete process.env.POSTGRES_URL
    vi.resetModules()
  })

  afterEach(() => {
    for (const k of ENV_SLEUTELS) {
      const v = bewaard[k]
      if (v === undefined) delete process.env[k]
      else process.env[k] = v
    }
    vi.doUnmock("@vercel/kv")
    vi.doUnmock("../store/backend")
    vi.resetModules()
  })

  async function migreerMet(inhoud: Record<string, unknown>, opties?: { overschrijven?: boolean }) {
    const nep = nepKv(inhoud)
    vi.doMock("@vercel/kv", () => ({ kv: nep.kv }))
    const bestemming = await alsBestemming()
    const echt = await import("../store/backend")
    vi.doMock("../store/backend", () => ({ ...echt, store: async () => bestemming }))
    const { migreerVanKv } = await import("../store/migratie")
    return { uitslag: await migreerVanKv(opties ?? {}), bestemming, nep }
  }

  it("zet elke sleutel van de app over en laat KV staan", async () => {
    const { uitslag, bestemming, nep } = await migreerMet(KV_INHOUD)

    expect(uitslag.nietsTeDoen).toBeUndefined()
    expect(uitslag.gekopieerd).toContain("ctt:session")
    expect(uitslag.gekopieerd).toContain("ctt:session:s1")
    expect(uitslag.gekopieerd).toContain("admin:clients")
    expect(uitslag.gekopieerd).toContain("admin:sessions-archive")
    expect(uitslag.gekopieerd).toContain("scenario-graph-index")
    expect(uitslag.gekopieerd).toContain("scenario-graph:g1")
    expect(uitslag.mislukt).toEqual([])

    await expect(bestemming.get("ctt:session:s1")).resolves.toMatchObject({ id: "s1" })
    await expect(bestemming.get("admin:clients")).resolves.toMatchObject({ c1: { id: "c1" } })

    // Kopie, geen verhuizing: de oude store blijft volledig intact.
    expect(nep.waarden.has("ctt:session:s1")).toBe(true)
    expect(nep.kv.del).not.toHaveBeenCalled()
  })

  it("laat het sessieslot en de gezondheidscheck achter", async () => {
    const { uitslag, bestemming } = await migreerMet(KV_INHOUD)

    // Een slot uit de oude store zou de nieuwe opslag meteen op slot zetten.
    expect(uitslag.gekopieerd).not.toContain("ctt:lock:session")
    expect(uitslag.gekopieerd).not.toContain("ctt:health")
    await expect(bestemming.get("ctt:lock:session")).resolves.toBeNull()
  })

  it("zet gebeurtenissen als losse rijen over, niet als blob", async () => {
    const { uitslag, bestemming } = await migreerMet(KV_INHOUD)

    // Een blob-kopie zou in Postgres in de verkeerde tabel landen en dus
    // onzichtbaar blijven voor listEvents.
    expect(uitslag.gekopieerd).not.toContain("ctt:events:s1")
    expect(uitslag.gebeurtenissen).toBe(2)

    const rij = await bestemming.listEvents("s1")
    expect(rij.map(e => e.kind)).toEqual(["inject_pushed", "decision_submitted"])
    expect(rij.map(e => e.seq)).toEqual([1, 2])
    expect(rij[1].undoes).toBe("ev_1")
  })

  it("slaat bij een tweede ronde over wat er al staat", async () => {
    const nep = nepKv(KV_INHOUD)
    vi.doMock("@vercel/kv", () => ({ kv: nep.kv }))
    const bestemming = await alsBestemming()
    const echt = await import("../store/backend")
    vi.doMock("../store/backend", () => ({ ...echt, store: async () => bestemming }))
    const { migreerVanKv } = await import("../store/migratie")

    await migreerVanKv({})
    // Iemand heeft inmiddels in de nieuwe opslag gewerkt; dat mag de tweede
    // ronde niet overschrijven.
    await bestemming.set("ctt:session:s1", { id: "s1", joinCode: "NIEUW1" })

    const tweede = await migreerVanKv({})
    expect(tweede.gekopieerd).toEqual([])
    expect(tweede.overgeslagen).toContain("ctt:session:s1")
    await expect(bestemming.get("ctt:session:s1")).resolves.toMatchObject({ joinCode: "NIEUW1" })

    const derde = await migreerVanKv({ overschrijven: true })
    expect(derde.gekopieerd).toContain("ctt:session:s1")
    await expect(bestemming.get("ctt:session:s1")).resolves.toMatchObject({ joinCode: "ABC123" })
  })

  it("doet niets en zegt waarom als de app zelf nog op KV draait", async () => {
    const nep = nepKv(KV_INHOUD)
    vi.doMock("@vercel/kv", () => ({ kv: nep.kv }))
    const { migreerVanKv } = await import("../store/migratie")

    const uitslag = await migreerVanKv({})
    expect(uitslag.gekopieerd).toEqual([])
    expect(uitslag.nietsTeDoen).toMatch(/KV/)
  })

  it("doet niets als er geen KV-envvars staan", async () => {
    delete process.env.KV_REST_API_URL
    const bestemming = await alsBestemming()
    const echt = await import("../store/backend")
    vi.doMock("../store/backend", () => ({ ...echt, store: async () => bestemming }))
    const { migreerVanKv } = await import("../store/migratie")

    const uitslag = await migreerVanKv({})
    expect(uitslag.gekopieerd).toEqual([])
    expect(uitslag.nietsTeDoen).toMatch(/envvars/)
  })

  it("weigert naar het geheugen te kopiëren, want dat is na een herstart weg", async () => {
    const nep = nepKv(KV_INHOUD)
    vi.doMock("@vercel/kv", () => ({ kv: nep.kv }))
    const { geheugenBackend, _leegGeheugen } = await import("../store/geheugen")
    _leegGeheugen()
    const echt = await import("../store/backend")
    vi.doMock("../store/backend", () => ({ ...echt, store: async () => geheugenBackend() }))
    const { migreerVanKv } = await import("../store/migratie")

    const uitslag = await migreerVanKv({})
    expect(uitslag.gekopieerd).toEqual([])
    expect(uitslag.nietsTeDoen).toMatch(/geheugen/)
  })
})
