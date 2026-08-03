// KV-backed fixed-window counter. Cheap and adequate for facilitator-facing endpoints;
// swap for @upstash/ratelimit later if we need burst-tolerant token buckets.

const memWindows = new Map<string, { count: number; expiresAt: number }>()

async function getKV() {
  if (!process.env.KV_REST_API_URL && !process.env.KV_URL) return null
  try {
    const { kv } = await import("@vercel/kv")
    return kv
  } catch {
    return null
  }
}

export interface RateLimitResult {
  ok: boolean
  remaining: number
  resetSeconds: number
}

export async function rateLimit(key: string, limit: number, windowSec: number): Promise<RateLimitResult> {
  const kv = await getKV()
  if (kv) {
    const rlKey = `rl:${key}`
    const count = await kv.incr(rlKey)
    if (count === 1) await kv.expire(rlKey, windowSec)
    return { ok: count <= limit, remaining: Math.max(0, limit - count), resetSeconds: windowSec }
  }

  // In-memory fallback (dev / single-process).
  const now = Date.now()
  const existing = memWindows.get(key)
  if (!existing || existing.expiresAt <= now) {
    memWindows.set(key, { count: 1, expiresAt: now + windowSec * 1000 })
    return { ok: 1 <= limit, remaining: Math.max(0, limit - 1), resetSeconds: windowSec }
  }
  existing.count += 1
  return {
    ok: existing.count <= limit,
    remaining: Math.max(0, limit - existing.count),
    resetSeconds: Math.max(1, Math.ceil((existing.expiresAt - now) / 1000)),
  }
}
