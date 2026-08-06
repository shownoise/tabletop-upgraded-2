// Phase 9 — deterministic seeded id generator.
//
// The wizard pipeline is required to be reproducible: given the same config
// (including seed) AND the same LLM output the resulting ScenarioGraph must be
// byte-identical. That rules out Math.random() and Date.now() in the compile
// path — every id must derive from the seed.
//
// We implement a small, dependency-free PRNG (Mulberry32) seeded by a 32-bit
// hash of the seed string. Not cryptographically strong; we only need
// reproducibility and reasonable dispersion for id-suffix generation.

export interface SeededRng {
  // Return a small alphanumeric suffix (deterministic given call order).
  nid(prefix: string): string
  // Return a raw uniform [0, 1) number — used sparingly for stable ordering.
  next(): number
}

function xfnv1a(str: string): number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function mulberry32(seed: number): () => number {
  let s = seed >>> 0
  return function () {
    s = (s + 0x6D2B79F5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function createSeededRng(seed: string): SeededRng {
  const rand = mulberry32(xfnv1a(seed || 'default'))
  // Monotonically increasing counter guarantees uniqueness even if two random
  // draws collide on the 6-char suffix.
  let counter = 0
  return {
    nid(prefix: string): string {
      counter += 1
      const r = Math.floor(rand() * 0xffffffff).toString(36).padStart(7, '0').slice(0, 6)
      // Include the counter as an extra suffix to guarantee uniqueness across
      // any hash collisions within the same seed.
      return `${prefix}_${r}${counter.toString(36)}`
    },
    next(): number {
      return rand()
    },
  }
}

// Non-cryptographic random seed for callers that didn't specify one. Uses
// crypto.getRandomValues if available (browser + modern Node) else falls back
// to Math.random. Only invoked at config-preparation time — NEVER during
// compile.
export function cryptoRandomSeed(): string {
  const bytes = new Uint8Array(8)
  const g = globalThis as unknown as { crypto?: { getRandomValues?: (a: Uint8Array) => Uint8Array } }
  if (g.crypto && typeof g.crypto.getRandomValues === 'function') {
    g.crypto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256)
  }
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
}
