// KV-backed override store voor admin-panel wijzigingen.
//
// Patroon: defaults staan in code (lib/config/texts.ts, ROLE_META,
// vector-overrides.ts). Wijzigingen via admin-panel worden hier als
// override bewaard. Runtime merge: overrides winnen boven defaults.
//
// Voor developers: dit is één KV-blob. Toekomstige database-migratie
// vervangt dit met tabellen; het patroon zelf (overrides bovenop
// defaults) blijft geldig.

import type { OutcomeVector } from '@/lib/scoring/vector-overrides'
import type { Role } from '@/lib/types'

export interface RoleOverride {
  label?: string
  description?: string
  mandateSummary?: string
  authorities?: string[]
  notResponsibleFor?: string
}

export interface AdminOverrides {
  // Texts uit lib/config/texts.ts.
  // Sleutels zijn dot-paths — bv. "BUTTON_LABELS.finalizeDecision" of
  // "ERROR_MESSAGES.submitFailed" of "ESCALATION_LABELS.0" (array-item).
  texts?: Record<string, string>
  // Role overrides — sleutel is de Role-key ('ceo', 'ciso', etc.).
  roles?: Partial<Record<Role, RoleOverride>>
  // Scoring vectors — sleutel is "${allowedRole}::${label}", value is OutcomeVector.
  scoring?: Record<string, OutcomeVector>
  // Metadata
  updatedAt?: number
}

const KEY = 'admin:overrides'

// Cache per serverless instance. TTL kort zodat multi-instance-writes
// binnen 30s zichtbaar worden. Handmatig clearen via clearCache().
let cache: { data: AdminOverrides; loadedAt: number } | null = null
const CACHE_TTL_MS = 30_000

const globalAny = globalThis as unknown as { __ctt_admin_overrides__?: AdminOverrides }

async function getKv() {
  if (!process.env.KV_REST_API_URL && !process.env.KV_URL) return null
  try {
    const { kv } = await import('@vercel/kv')
    return kv
  } catch {
    return null
  }
}

export async function loadOverrides(): Promise<AdminOverrides> {
  if (cache && Date.now() - cache.loadedAt < CACHE_TTL_MS) return cache.data
  const kv = await getKv()
  let data: AdminOverrides = {}
  if (kv) {
    data = (await kv.get<AdminOverrides>(KEY)) ?? {}
  } else {
    data = globalAny.__ctt_admin_overrides__ ?? {}
  }
  cache = { data, loadedAt: Date.now() }
  return data
}

export async function saveOverrides(next: AdminOverrides): Promise<void> {
  const withStamp: AdminOverrides = { ...next, updatedAt: Date.now() }
  const kv = await getKv()
  if (kv) {
    await kv.set(KEY, withStamp)
  } else {
    globalAny.__ctt_admin_overrides__ = withStamp
  }
  cache = { data: withStamp, loadedAt: Date.now() }
}

// Force cache-refresh op de volgende load. Wordt door de admin-write-API
// aangeroepen zodat wijzigingen niet 30s wachten.
export function clearCache(): void {
  cache = null
}

// Utility voor client-side merging: pak een dot-path uit een genest object.
export function resolvePath(obj: unknown, path: string): unknown {
  const parts = path.split('.')
  let cur: unknown = obj
  for (const p of parts) {
    if (cur == null) return undefined
    if (typeof cur === 'object') {
      cur = (cur as Record<string, unknown>)[p]
    } else {
      return undefined
    }
  }
  return cur
}
