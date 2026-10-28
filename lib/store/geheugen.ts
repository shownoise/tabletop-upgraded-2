// Geheugen-achterkant. Altijd beschikbaar, nooit duurzaam.
//
// Op `globalThis` omdat Next in dev elke module opnieuw kan laden: zonder dat
// verdwijnt de sessie bij de eerste hot reload.

import type { Gebeurtenis, NieuweGebeurtenis, StoreBackend } from "./backend"

interface Opslag {
  waarden: Map<string, unknown>
  gebeurtenissen: Map<string, Gebeurtenis[]>
}

const g = globalThis as unknown as { __ctt_store_geheugen__?: Opslag }
if (!g.__ctt_store_geheugen__) {
  g.__ctt_store_geheugen__ = { waarden: new Map(), gebeurtenissen: new Map() }
}
const opslag = g.__ctt_store_geheugen__

let teller = 0

export function geheugenBackend(): StoreBackend {
  return {
    naam: "geheugen",

    async get<T>(key: string): Promise<T | null> {
      return (opslag.waarden.get(key) as T | undefined) ?? null
    },

    async set<T>(key: string, value: T): Promise<void> {
      opslag.waarden.set(key, value)
    },

    async del(key: string): Promise<void> {
      opslag.waarden.delete(key)
    },

    async keys(prefix: string): Promise<string[]> {
      return [...opslag.waarden.keys()].filter(k => k.startsWith(prefix)).sort()
    },

    async appendEvent(event: NieuweGebeurtenis): Promise<Gebeurtenis> {
      const rij = opslag.gebeurtenissen.get(event.sessionId) ?? []
      const volledig: Gebeurtenis = {
        ...event,
        id: `ev_${Date.now().toString(36)}_${(teller++).toString(36)}`,
        seq: rij.length + 1,
      }
      rij.push(volledig)
      opslag.gebeurtenissen.set(event.sessionId, rij)
      return volledig
    },

    async listEvents(sessionId: string): Promise<Gebeurtenis[]> {
      return [...(opslag.gebeurtenissen.get(sessionId) ?? [])]
    },
  }
}

// Alleen voor tests.
export function _leegGeheugen(): void {
  opslag.waarden.clear()
  opslag.gebeurtenissen.clear()
  teller = 0
}
