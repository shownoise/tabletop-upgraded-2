// Klant-store. Records worden bewaard als één blob "admin:clients" zodat de
// developer-migratie naar een echte database een simpele tabel-vertaling is.
// Waar die blob heen gaat bepaalt de opslagnaad (lib/store/backend.ts).

import type { Role } from "@/lib/types"
import { withStore } from "@/lib/db"

export interface AdminClient {
  id: string
  name: string
  sector: string
  employees: number
  itArrangement: string
  crownJewels: string
  crisisTeamRoles: Role[]
  regimeId: string
  isTestClient: boolean
  createdAt: number
  updatedAt: number
  // Optioneel: extra vrije notities.
  notes?: string
}

const KEY = "admin:clients"

// Alles loopt via withStore uit lib/db.ts: één plek die bepaalt of de opslag
// leeft. Deze module had zijn eigen client die alleen de import afschermde —
// viel de store weg, dan gooide elke read en werd het een 500. De eigen
// geheugen-fallback is ook weg; die rol heeft de geheugen-achterkant nu.
export async function listClients(): Promise<AdminClient[]> {
  const obj = await withStore("klanten lezen", async s =>
    (await s.get<Record<string, AdminClient>>(KEY)) ?? {})
  return Object.values(obj).sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function getClient(id: string): Promise<AdminClient | null> {
  const list = await listClients()
  return list.find(c => c.id === id) ?? null
}

export async function saveClient(client: AdminClient): Promise<void> {
  await withStore("klant schrijven", async s => {
    const current = (await s.get<Record<string, AdminClient>>(KEY)) ?? {}
    await s.set(KEY, { ...current, [client.id]: { ...client, updatedAt: Date.now() } })
  })
}

export async function deleteClient(id: string): Promise<void> {
  await withStore("klant verwijderen", async s => {
    const next = { ...((await s.get<Record<string, AdminClient>>(KEY)) ?? {}) }
    delete next[id]
    await s.set(KEY, next)
  })
}

// Bulk-seed voor migratie / testdata. Overslaat bestaande IDs.
export async function seedClients(clients: AdminClient[]): Promise<{ added: number; existing: number }> {
  return await withStore("klanten seeden", async s => {
    const next = { ...((await s.get<Record<string, AdminClient>>(KEY)) ?? {}) }
    let added = 0
    let existing = 0
    for (const c of clients) {
      if (next[c.id]) { existing++; continue }
      next[c.id] = c
      added++
    }
    await s.set(KEY, next)
    return { added, existing }
  })
}

// newClientId staat in ids.ts: het klantformulier is een client component en
// mag de opslag (en daarmee pg) niet mee de browserbundel in trekken.
