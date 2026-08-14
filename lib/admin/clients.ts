// Klant-store. Records worden in KV bewaard als één blob "admin:clients"
// zodat de developer-migratie naar een echte database een simpele
// tabel-vertaling is.

import type { Role } from "@/lib/types"

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

const globalAny = globalThis as unknown as { __ctt_admin_clients__?: Record<string, AdminClient> }

async function getKv() {
  if (!process.env.KV_REST_API_URL && !process.env.KV_URL) return null
  try {
    const { kv } = await import("@vercel/kv")
    return kv
  } catch { return null }
}

export async function listClients(): Promise<AdminClient[]> {
  const kv = await getKv()
  let obj: Record<string, AdminClient> = {}
  if (kv) {
    obj = (await kv.get<Record<string, AdminClient>>(KEY)) ?? {}
  } else {
    obj = globalAny.__ctt_admin_clients__ ?? {}
  }
  return Object.values(obj).sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function getClient(id: string): Promise<AdminClient | null> {
  const list = await listClients()
  return list.find(c => c.id === id) ?? null
}

export async function saveClient(client: AdminClient): Promise<void> {
  const kv = await getKv()
  const current = kv
    ? (await kv.get<Record<string, AdminClient>>(KEY)) ?? {}
    : globalAny.__ctt_admin_clients__ ?? {}
  const next = { ...current, [client.id]: { ...client, updatedAt: Date.now() } }
  if (kv) await kv.set(KEY, next)
  else globalAny.__ctt_admin_clients__ = next
}

export async function deleteClient(id: string): Promise<void> {
  const kv = await getKv()
  const current = kv
    ? (await kv.get<Record<string, AdminClient>>(KEY)) ?? {}
    : globalAny.__ctt_admin_clients__ ?? {}
  const next = { ...current }
  delete next[id]
  if (kv) await kv.set(KEY, next)
  else globalAny.__ctt_admin_clients__ = next
}

// Bulk-seed voor migratie / testdata. Overslaat bestaande IDs.
export async function seedClients(clients: AdminClient[]): Promise<{ added: number; existing: number }> {
  const kv = await getKv()
  const current = kv
    ? (await kv.get<Record<string, AdminClient>>(KEY)) ?? {}
    : globalAny.__ctt_admin_clients__ ?? {}
  let added = 0
  let existing = 0
  const next = { ...current }
  for (const c of clients) {
    if (next[c.id]) { existing++; continue }
    next[c.id] = c
    added++
  }
  if (kv) await kv.set(KEY, next)
  else globalAny.__ctt_admin_clients__ = next
  return { added, existing }
}

export function newClientId(): string {
  return `client_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}
