// Fixed-window teller per instantie.
//
// Hier stond een eigen @vercel/kv-client, en die was de laatste in de app.
// Twee dingen waren er mis met hem:
//
//  1. Geen foutopvang. `kv.incr` gooide gewoon door. Toen de Upstash-store zijn
//     plan-limiet raakte ("ERR This database has reached current Fixed plan
//     limits") gooide dus élke aanroep — en deze functie zit op de login, op
//     deelnemen, op sessie aanmaken en op de wizard. Een volle store legde
//     daarmee de hele app plat, niet alleen de opslag.
//  2. Hij hing aan een uitgefaseerd product, terwijl de opslag naar Postgres is
//     verhuisd.
//
// Wat er nu staat is de fallback die er al was: een teller in het geheugen van
// deze instantie. Bewust, en met een bekende beperking — op meerdere instanties
// telt ieder voor zich, dus de echte limiet is hoger dan het getal zegt. Voor
// een rem op brute-force is dat aanvaardbaar (Fluid Compute hergebruikt
// instanties, dus hij bijt in de praktijk), maar het is geen harde grens.
//
// Wil je dat wel: geef StoreBackend een atomaire `incr(key, windowMs)` —
// Postgres kan dat in één INSERT ... ON CONFLICT DO UPDATE ... RETURNING — en
// gebruik die hier met dit geheugen als terugval. Dan hoort er ook opruiming
// bij, want de naad kent geen vervaltijd meer.

const memWindows = new Map<string, { count: number; expiresAt: number }>()

// Zonder opruiming groeit deze map met elk uniek sleutelpatroon (ip, e-mail,
// participantId). Dat is een traag lek in een proces dat lang leeft.
function ruimOp(now: number) {
  if (memWindows.size < 1000) return
  for (const [k, v] of memWindows) if (v.expiresAt <= now) memWindows.delete(k)
}

export interface RateLimitResult {
  ok: boolean
  remaining: number
  resetSeconds: number
}

export async function rateLimit(key: string, limit: number, windowSec: number): Promise<RateLimitResult> {
  const now = Date.now()
  ruimOp(now)

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

// Alleen voor tests.
export function _resetRateLimits(): void {
  memWindows.clear()
}
