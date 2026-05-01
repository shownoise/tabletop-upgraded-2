/**
 * Database abstraction layer.
 *
 * Uses @vercel/kv (Redis) in production.
 * Falls back to in-memory store in development when KV_URL is not set.
 *
 * SETUP (production):
 *   1. In Vercel dashboard: Storage → Create KV Database
 *   2. Connect to your project → env vars are auto-injected (KV_URL, KV_REST_API_URL, KV_REST_API_TOKEN)
 *   3. That's it — this file handles the rest.
 *
 * SETUP (local dev):
 *   Option A: Copy the env vars from Vercel into .env.local
 *   Option B: Leave empty — falls back to in-memory (sessions reset on restart)
 */

import type { SessionState } from "./types"
import type { ScenarioTemplate } from "./template-types"

// ─────────────────────────────────────────────────────────────
// Keys
// ─────────────────────────────────────────────────────────────

const KEYS = {
  session: "ctt:session",
  templates: "ctt:templates",
  users: "ctt:users",
} as const

// ─────────────────────────────────────────────────────────────
// KV client (lazy-loaded so build doesn't fail without env vars)
// ─────────────────────────────────────────────────────────────

async function getKV() {
  if (!process.env.KV_REST_API_URL && !process.env.KV_URL) return null
  try {
    const { kv } = await import("@vercel/kv")
    return kv
  } catch {
    return null
  }
}

// ─────────────────────────────────────────────────────────────
// In-memory fallback (development)
// ─────────────────────────────────────────────────────────────

const globalAny = globalThis as any
if (!globalAny.__ctt_mem__) {
  globalAny.__ctt_mem__ = { session: null, templates: [], users: [] }
}
const mem: { session: SessionState | null; templates: ScenarioTemplate[]; users: StoredUser[] } = globalAny.__ctt_mem__

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface StoredUser {
  id: string
  email: string
  passwordHash: string
  role: "admin" | "facilitator"
  name: string
  createdAt: number
}

// ─────────────────────────────────────────────────────────────
// Session store
// ─────────────────────────────────────────────────────────────

export async function dbGetSession(): Promise<SessionState | null> {
  const kv = await getKV()
  if (kv) {
    return await kv.get<SessionState>(KEYS.session)
  }
  return mem.session
}

export async function dbSetSession(session: SessionState | null): Promise<void> {
  const kv = await getKV()
  if (kv) {
    if (session) {
      await kv.set(KEYS.session, session, { ex: 60 * 60 * 24 }) // 24h TTL
    } else {
      await kv.del(KEYS.session)
    }
    return
  }
  mem.session = session
}

// ─────────────────────────────────────────────────────────────
// Template store
// ─────────────────────────────────────────────────────────────

export async function dbGetTemplates(): Promise<ScenarioTemplate[]> {
  const kv = await getKV()
  if (kv) {
    return (await kv.get<ScenarioTemplate[]>(KEYS.templates)) ?? []
  }
  return mem.templates
}

export async function dbSaveTemplate(t: ScenarioTemplate): Promise<void> {
  const kv = await getKV()
  if (kv) {
    const existing = (await kv.get<ScenarioTemplate[]>(KEYS.templates)) ?? []
    const idx = existing.findIndex(e => e.id === t.id)
    if (idx >= 0) existing[idx] = t
    else existing.push(t)
    await kv.set(KEYS.templates, existing)
    return
  }
  const idx = mem.templates.findIndex(e => e.id === t.id)
  if (idx >= 0) mem.templates[idx] = t
  else mem.templates.push(t)
}

export async function dbDeleteTemplate(id: string): Promise<void> {
  const kv = await getKV()
  if (kv) {
    const existing = (await kv.get<ScenarioTemplate[]>(KEYS.templates)) ?? []
    await kv.set(KEYS.templates, existing.filter(t => t.id !== id))
    return
  }
  mem.templates = mem.templates.filter(t => t.id !== id)
}

// ─────────────────────────────────────────────────────────────
// User store
// ─────────────────────────────────────────────────────────────

export async function dbGetUsers(): Promise<StoredUser[]> {
  const kv = await getKV()
  if (kv) {
    return (await kv.get<StoredUser[]>(KEYS.users)) ?? []
  }
  return mem.users
}

export async function dbGetUserByEmail(email: string): Promise<StoredUser | null> {
  const users = await dbGetUsers()
  return users.find(u => u.email.toLowerCase() === email.toLowerCase()) ?? null
}

export async function dbSaveUser(user: StoredUser): Promise<void> {
  const kv = await getKV()
  if (kv) {
    const existing = await dbGetUsers()
    const idx = existing.findIndex(u => u.id === user.id)
    if (idx >= 0) existing[idx] = user
    else existing.push(user)
    await kv.set(KEYS.users, existing)
    return
  }
  const idx = mem.users.findIndex(u => u.id === user.id)
  if (idx >= 0) mem.users[idx] = user
  else mem.users.push(user)
}

/**
 * Seed a default admin user if no users exist.
 * Credentials come from env vars: ADMIN_EMAIL, ADMIN_PASSWORD
 * Defaults: admin@cyber-tabletop.local / changeme123
 */
export async function dbEnsureAdminUser(): Promise<void> {
  const users = await dbGetUsers()
  if (users.length > 0) return

  const { hash } = await import("bcryptjs")
  const email = process.env.ADMIN_EMAIL ?? "admin@cyber-tabletop.local"
  const password = process.env.ADMIN_PASSWORD ?? "changeme123"
  const passwordHash = await hash(password, 12)

  await dbSaveUser({
    id: "admin-seed",
    email,
    passwordHash,
    role: "admin",
    name: "Admin",
    createdAt: Date.now(),
  })

  console.log(`[ctt] Seeded admin user: ${email}`)
}
