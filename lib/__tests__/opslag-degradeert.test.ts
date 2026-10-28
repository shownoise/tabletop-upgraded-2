import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

// Toen de KV-store wegviel gaf /api/session/state een 500. Dat is de endpoint
// die elke deelnemer en het facilitatordashboard elke paar seconden opvragen,
// dus de hele app lag eruit op een lege sessie.
//
// Oorzaak: getKV() schermde alleen de *import* van @vercel/kv af. Elke echte
// kv.get/kv.set stond onbeschermd, en de route ving alleen settleAndGetState()
// op — niet de getState() in zijn eigen catch.
//
// Deze tests houden beide gaten dicht. Ze draaien met een @vercel/kv-mock die
// gooit, want een echte dode store is niet te simuleren.

const KV_ENV = "KV_REST_API_URL"

function kapotteKv() {
  return {
    kv: {
      get: vi.fn(async () => { throw new Error("store bestaat niet meer") }),
      set: vi.fn(async () => { throw new Error("store bestaat niet meer") }),
      del: vi.fn(async () => { throw new Error("store bestaat niet meer") }),
    },
  }
}

describe("opslag die omvalt", () => {
  let oudeEnv: string | undefined

  beforeEach(() => {
    oudeEnv = process.env[KV_ENV]
    process.env[KV_ENV] = "https://store-die-niet-meer-bestaat.example"
    vi.resetModules()
    vi.doMock("@vercel/kv", () => kapotteKv())
  })

  afterEach(() => {
    if (oudeEnv === undefined) delete process.env[KV_ENV]
    else process.env[KV_ENV] = oudeEnv
    vi.doUnmock("@vercel/kv")
    vi.resetModules()
  })

  it("laat een sessie lezen niet klappen maar valt terug op het geheugen", async () => {
    const db = await import("../db")
    // Gooide hiervoor; moet nu null teruggeven in plaats van te throwen.
    await expect(db.dbGetSession()).resolves.toBeNull()
    expect(db.storageDegraded()).toBe(true)
  })

  it("laat een sessie schrijven niet klappen en houdt hem in het geheugen vast", async () => {
    const db = await import("../db")
    const sessie = { id: "s1", joinCode: "ABC123" } as never
    await expect(db.dbSetSession(sessie)).resolves.toBeUndefined()
    // De lopende oefening mag niet halverwege stilvallen: wat niet naar de
    // store kon moet alsnog leesbaar zijn.
    await expect(db.dbGetSession()).resolves.toMatchObject({ id: "s1" })
  })

  it("draait een mutatie door zonder slot in plaats van te weigeren", async () => {
    const db = await import("../db")
    // Eerst degraderen, zodat withSessionLock de kapotte store al kent.
    await db.dbGetSession()
    await expect(db.withSessionLock(async () => "klaar")).resolves.toBe("klaar")
  })

  it("laat de klant-store en het sessie-archief niet klappen", async () => {
    const clients = await import("../admin/clients")
    const archive = await import("../admin/sessions-archive")
    // Beide hadden hun eigen getKv die alleen de import afschermde.
    await expect(clients.listClients()).resolves.toEqual([])
    await expect(archive.listSnapshots()).resolves.toEqual([])
  })
})
