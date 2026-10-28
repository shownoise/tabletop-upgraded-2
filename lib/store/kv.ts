// Vercel KV als achterkant. Blijft bestaan zodat de app werkt zoals nu,
// maar is niet de bestemming: Vercel KV is als product uitgefaseerd en in #115
// bleek dat een wegvallende store de hele app plat legde.
//
// Twee dingen anders dan voorheen:
//  - Geen TTL meer op de sessie. Er stond 24 uur op, dus een oefening van
//    gisteren was vandaag weg zonder dat iemand iets had verwijderd.
//  - Een gezondheidscheck bij het openen, zodat een dode store meteen bekend is
//    in plaats van bij de eerste echte read.

import type { Gebeurtenis, NieuweGebeurtenis, StoreBackend } from "./backend"

type Kv = {
  get: <T>(key: string) => Promise<T | null>
  set: (key: string, value: unknown, opties?: { nx?: true; px?: number }) => Promise<unknown>
  del: (key: string) => Promise<unknown>
  keys: (pattern: string) => Promise<string[]>
}

function eventKey(sessionId: string) { return `ctt:events:${sessionId}` }

export async function kvBackend(): Promise<StoreBackend | null> {
  const mod = await import("@vercel/kv")
  const kv = mod.kv as unknown as Kv
  // Testread: antwoordt de store niet, dan heeft deze achterkant geen zin.
  await kv.get("ctt:health")

  return {
    naam: "kv",

    async get<T>(key: string): Promise<T | null> {
      return await kv.get<T>(key)
    },

    // Let op de ontbrekende derde parameter: géén `{ ex: ... }`. Hier zat de
    // 24-uurs TTL op de sessie. Zet hem niet terug.
    async set<T>(key: string, value: T): Promise<void> {
      await kv.set(key, value)
    },

    async del(key: string): Promise<void> {
      await kv.del(key)
    },

    // SET NX (+ PX als er een levensduur bij hoort). @vercel/kv gaf historisch
    // "OK" terug bij succes, nieuwere versies de waarde zelf; bij een botsing
    // altijd null. Elke truthy waarde betekent dus "gelukt".
    async setIfAbsent(key: string, value: unknown, ttlMs?: number): Promise<boolean> {
      const opties = ttlMs ? ({ nx: true, px: ttlMs } as const) : ({ nx: true } as const)
      return !!(await kv.set(key, value, opties))
    },

    async keys(prefix: string): Promise<string[]> {
      // KV kent geen prefix-scan zonder patroon; `keys` is hier genoeg omdat
      // het aantal sessies in de tientallen loopt, niet in de miljoenen.
      return (await kv.keys(`${prefix}*`)).sort()
    },

    // Gebeurtenissen als één lijst per sessie. Niet mooi, maar wel juist zolang
    // er één schrijver per sessie is: het sessieslot in lib/db.ts serialiseert
    // de mutaties al. Postgres doet dit met een echte append-only tabel.
    async appendEvent(event: NieuweGebeurtenis): Promise<Gebeurtenis> {
      const key = eventKey(event.sessionId)
      const rij = (await kv.get<Gebeurtenis[]>(key)) ?? []
      const volledig: Gebeurtenis = {
        ...event,
        id: `ev_${Date.now().toString(36)}_${rij.length.toString(36)}`,
        seq: rij.length + 1,
      }
      await kv.set(key, [...rij, volledig])
      return volledig
    },

    async listEvents(sessionId: string): Promise<Gebeurtenis[]> {
      return (await kv.get<Gebeurtenis[]>(eventKey(sessionId))) ?? []
    },
  }
}
