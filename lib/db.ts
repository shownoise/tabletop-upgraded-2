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
import type { ScenarioGraph } from "./graph/types"

// ─────────────────────────────────────────────────────────────
// Keys
// ─────────────────────────────────────────────────────────────

const KEYS = {
  session: "ctt:session",
  templates: "ctt:templates",
  users: "ctt:users",
  graphIndex: "scenario-graph-index",
} as const

function graphKey(id: string) { return `scenario-graph:${id}` }

// ─────────────────────────────────────────────────────────────
// KV client (lazy-loaded so build doesn't fail without env vars)
// ─────────────────────────────────────────────────────────────

let kvLoadWarned = false

async function getKV() {
  if (!process.env.KV_REST_API_URL && !process.env.KV_URL) return null
  try {
    const { kv } = await import("@vercel/kv")
    return kv
  } catch (err) {
    // KV envs are set but the client can't load — this is an operational incident
    // (bad deploy, dependency mismatch, package missing). Fall back to in-memory but
    // warn loudly so it shows up in logs instead of silently degrading.
    if (!kvLoadWarned) {
      console.error("[ctt] @vercel/kv failed to load — falling back to in-memory. Sessions will not persist across instances.", err)
      kvLoadWarned = true
    }
    return null
  }
}

// ─────────────────────────────────────────────────────────────
// In-memory fallback (development)
// ─────────────────────────────────────────────────────────────

const globalAny = globalThis as any
if (!globalAny.__ctt_mem__) {
  globalAny.__ctt_mem__ = { session: null, templates: [], users: [], graphs: {} }
}
if (!globalAny.__ctt_mem__.graphs) globalAny.__ctt_mem__.graphs = {}
const mem: {
  session: SessionState | null
  templates: ScenarioTemplate[]
  users: StoredUser[]
  graphs: Record<string, ScenarioGraph>
} = globalAny.__ctt_mem__

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
// Session mutation lock — protects read-modify-write races between
// concurrent facilitator + participant requests. KV mode uses a
// SET NX PX lock; in-memory mode uses a Promise mutex.
// ─────────────────────────────────────────────────────────────

const SESSION_LOCK_KEY = "ctt:session:lock"
const SESSION_LOCK_TTL_MS = 5_000

async function acquireKvLock(kv: NonNullable<Awaited<ReturnType<typeof getKV>>>): Promise<string | null> {
  const token = `${Date.now()}:${Math.random().toString(36).slice(2)}`
  // @vercel/kv historically returned "OK" on success; newer versions may return the token
  // itself (Upstash SDK convention) or null on NX collision. Treat any truthy return as
  // acquired — the collision case is always null/undefined.
  const res = await kv.set(SESSION_LOCK_KEY, token, { nx: true, px: SESSION_LOCK_TTL_MS })
  return res ? token : null
}

async function releaseKvLock(kv: NonNullable<Awaited<ReturnType<typeof getKV>>>, token: string): Promise<void> {
  const current = await kv.get<string>(SESSION_LOCK_KEY)
  if (current === token) await kv.del(SESSION_LOCK_KEY)
}

let memLockChain: Promise<unknown> = Promise.resolve()

export async function withSessionLock<T>(fn: () => Promise<T>): Promise<T> {
  const kv = await getKV()
  if (!kv) {
    // Serialize through a single Promise chain — the Node.js runtime is single-threaded
    // but concurrent `await`s can still interleave, and mutate() is read-modify-write.
    let resolveNext!: () => void
    const gate = new Promise<void>(resolve => { resolveNext = resolve })
    const prev = memLockChain
    memLockChain = gate
    await prev
    try { return await fn() } finally { resolveNext() }
  }

  // KV mode: try to acquire, retry once with backoff.
  let token = await acquireKvLock(kv)
  if (!token) {
    await new Promise(r => setTimeout(r, 100))
    token = await acquireKvLock(kv)
  }
  if (!token) throw new Error("Session busy — could not acquire lock")
  try { return await fn() } finally { await releaseKvLock(kv, token) }
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

function normalizeEmail(email: string) { return email.trim().toLowerCase() }
function emailReservationKey(email: string) { return `ctt:user:email:${normalizeEmail(email)}` }

export async function dbGetUserByEmail(email: string): Promise<StoredUser | null> {
  const users = await dbGetUsers()
  const key = normalizeEmail(email)
  return users.find(u => u.email.toLowerCase() === key) ?? null
}

export async function dbSaveUser(user: StoredUser): Promise<void> {
  const normalized: StoredUser = { ...user, email: normalizeEmail(user.email) }
  const kv = await getKV()
  if (kv) {
    const existing = await dbGetUsers()
    const idx = existing.findIndex(u => u.id === normalized.id)
    if (idx >= 0) existing[idx] = normalized
    else existing.push(normalized)
    await kv.set(KEYS.users, existing)
    return
  }
  const idx = mem.users.findIndex(u => u.id === normalized.id)
  if (idx >= 0) mem.users[idx] = normalized
  else mem.users.push(normalized)
}

export type CreateUserResult =
  | { ok: true }
  | { ok: false; reason: "duplicate_email" }

export async function dbCreateUserIfEmailFree(user: StoredUser): Promise<CreateUserResult> {
  const normalized: StoredUser = { ...user, email: normalizeEmail(user.email) }
  const kv = await getKV()
  if (kv) {
    // Reserve the email with an NX SET so two concurrent creates can't both win.
    // Truthy return = reserved; null/undefined = collision (SDK versions vary on "OK" vs token).
    const reserved = await kv.set(emailReservationKey(normalized.email), normalized.id, { nx: true })
    if (!reserved) return { ok: false, reason: "duplicate_email" }
    await dbSaveUser(normalized)
    return { ok: true }
  }
  // In-memory fallback — no true atomicity; approximate with a read-modify-write.
  const existing = mem.users.find(u => u.email === normalized.email)
  if (existing) return { ok: false, reason: "duplicate_email" }
  mem.users.push(normalized)
  return { ok: true }
}

// ─────────────────────────────────────────────────────────────
// Scenario graph store
// ─────────────────────────────────────────────────────────────

export async function dbSaveScenarioGraph(graph: ScenarioGraph): Promise<void> {
  const kv = await getKV()
  if (kv) {
    await kv.set(graphKey(graph.id), graph)
    const index = (await kv.get<string[]>(KEYS.graphIndex)) ?? []
    if (!index.includes(graph.id)) {
      await kv.set(KEYS.graphIndex, [...index, graph.id])
    }
    return
  }
  mem.graphs[graph.id] = graph
}

export async function dbLoadScenarioGraph(id: string): Promise<ScenarioGraph | null> {
  const kv = await getKV()
  if (kv) return (await kv.get<ScenarioGraph>(graphKey(id))) ?? null
  return mem.graphs[id] ?? null
}

export async function dbListScenarioGraphs(): Promise<ScenarioGraph[]> {
  const kv = await getKV()
  if (kv) {
    const index = (await kv.get<string[]>(KEYS.graphIndex)) ?? []
    const graphs = await Promise.all(index.map(id => kv.get<ScenarioGraph>(graphKey(id))))
    return graphs.filter((g): g is ScenarioGraph => !!g)
  }
  return Object.values(mem.graphs)
}

export async function dbDeleteScenarioGraph(id: string): Promise<void> {
  const kv = await getKV()
  if (kv) {
    await kv.del(graphKey(id))
    const index = (await kv.get<string[]>(KEYS.graphIndex)) ?? []
    await kv.set(KEYS.graphIndex, index.filter(gid => gid !== id))
    return
  }
  delete mem.graphs[id]
}

/**
 * Seed a default admin user if no users exist.
 * Credentials come from env vars: ADMIN_EMAIL, ADMIN_PASSWORD.
 * In production we refuse to seed with the historical default password —
 * that used to boot a live tenant with 'changeme123'. Fail loud instead.
 */
const DEFAULT_ADMIN_PASSWORD_FALLBACK = "changeme123"

export async function dbEnsureAdminUser(): Promise<void> {
  const users = await dbGetUsers()
  if (users.length > 0) return

  const isProd = process.env.NODE_ENV === "production"
  const password = process.env.ADMIN_PASSWORD ?? (isProd ? "" : DEFAULT_ADMIN_PASSWORD_FALLBACK)

  if (isProd && (!password || password === DEFAULT_ADMIN_PASSWORD_FALLBACK)) {
    throw new Error(
      "[ctt] Refusing to seed default admin: set ADMIN_PASSWORD (and ADMIN_EMAIL) in the deployment environment.",
    )
  }

  const { hash } = await import("bcryptjs")
  const email = process.env.ADMIN_EMAIL ?? "admin@cyber-tabletop.local"
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
