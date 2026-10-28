/**
 * Opslaglaag van de app.
 *
 * Deze module kent de sleutels en de vorm van wat er in gaat. Waar die bytes
 * fysiek heen gaan weet hij niet: dat kiest de naad in lib/store/backend.ts —
 * Postgres als er een connectiestring is, anders Vercel KV, anders het
 * geheugen. Vandaar dat hier geen enkele `kv.*`-aanroep meer staat.
 *
 * SETUP (duurzaam — dit is de bestemming):
 *   DATABASE_URL (of POSTGRES_URL) zetten en `pg` installeren. Niets anders.
 *
 * SETUP (zoals het nu draait):
 *   KV_REST_API_URL / KV_URL. Werkt, maar Vercel KV is als product uitgefaseerd
 *   en kent geen harde duurzaamheidsbelofte.
 *
 * Zonder beide valt alles terug op het geheugen: dan overleeft een sessie geen
 * herstart en ziet een tweede instantie hem niet.
 */

// Alleen op de server. Zonder deze regel trekt één waarde-import uit een client
// component de hele keten mee de browserbundel in — tot en met `pg`, dat daar
// `util/types` niet kan vinden. Dat is precies hoe de build omviel toen
// rubric-scores.ts (geïmporteerd door de score-invoer) hier binnenkwam. Nu
// faalt zo'n import meteen, met een foutmelding die de oorzaak noemt.
import "server-only"

import type { SessionState } from "./types"
import type { ScenarioTemplate } from "./template-types"
import type { ScenarioGraph } from "./graph/types"
import { backendNaam, heeftKv, heeftPostgres, store, type StoreBackend } from "./store/backend"
import { geheugenBackend } from "./store/geheugen"

// ─────────────────────────────────────────────────────────────
// Keys
// ─────────────────────────────────────────────────────────────

const KEYS = {
  // Verwijzing naar de actieve sessie. Historisch stond hier de volledige
  // sessie; die oude vorm wordt nog gelezen (zie dbGetSession).
  session: "ctt:session",
  templates: "ctt:templates",
  users: "ctt:users",
  graphIndex: "scenario-graph-index",
} as const

// Elke sessie staat daarnaast onder zijn eigen sleutel, zodat er meer dan één
// naast elkaar kan bestaan en een opsomming geen aparte index nodig heeft.
const SESSIE_PREFIX = "ctt:session:"
function sessieKey(id: string) { return `${SESSIE_PREFIX}${id}` }

function graphKey(id: string) { return `scenario-graph:${id}` }

// ─────────────────────────────────────────────────────────────
// Degradatie: een omvallende opslag mag nooit een exceptie naar boven geven
// ─────────────────────────────────────────────────────────────

// Waarom dit bestaat: de opslag zat eerder verspreid over modules die elk hun
// eigen client maakten en alleen de *import* afschermden. Elke echte read stond
// onbeschermd, dus toen de store wegviel gaf /api/session/state een 500 — de
// endpoint die elke deelnemer en het dashboard elke paar seconden opvragen. De
// hele app lag eruit. Zie lib/__tests__/opslag-degradeert.test.ts.
let gedegradeerd = false
let gedegradeerdGemeld = false
let nood: StoreBackend | null = null

export function storageDegraded(): boolean {
  if (gedegradeerd) return true
  // Staat er een envvar voor duurzame opslag maar draaien we in het geheugen,
  // dan is de keuze van de achterkant stil mislukt. Dat is ook degradatie.
  return backendNaam() === "geheugen" && (heeftPostgres() || heeftKv())
}

function degradeer(label: string, err: unknown): StoreBackend {
  gedegradeerd = true
  if (!gedegradeerdGemeld) {
    console.error(
      `[ctt] opslag onbereikbaar bij ${label} — verder in geheugen. Sessies overleven geen herstart of tweede instantie.`,
      err,
    )
    gedegradeerdGemeld = true
  }
  nood ??= geheugenBackend()
  return nood
}

async function achterkant(): Promise<StoreBackend> {
  if (nood) return nood
  try {
    return await store()
  } catch (err) {
    return degradeer("achterkant kiezen", err)
  }
}

/**
 * Doe een opslagbewerking. Valt de achterkant om, dan doen we dezelfde
 * bewerking nog eens op het geheugen in plaats van de request te laten klappen.
 * De fout wordt één keer luid gelogd.
 *
 * Ook bruikbaar vanuit de andere opslagmodules (klant-store, sessie-archief),
 * zodat er één plek is die bepaalt of de opslag leeft. Dit verving `getLiveKv`.
 */
export async function withStore<T>(label: string, fn: (s: StoreBackend) => Promise<T>): Promise<T> {
  const s = await achterkant()
  try {
    return await fn(s)
  } catch (err) {
    return await fn(degradeer(label, err))
  }
}

// Variant voor bewerkingen die je níet op het geheugen wilt herhalen: bij een
// storing is er simpelweg geen slot, en dan is doordraaien het antwoord.
async function probeer<T>(label: string, fn: () => Promise<T>, terug: T): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    degradeer(label, err)
    return terug
  }
}

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

// De verwijzing naar de actieve sessie. Eigen vorm met een eigen veldnaam,
// zodat hij te onderscheiden is van de oude opzet waarin de volledige sessie op
// `ctt:session` stond.
interface ActieveSessie {
  actieveSessieId: string | null
}

function isVerwijzing(v: unknown): v is ActieveSessie {
  return typeof v === "object" && v !== null && "actieveSessieId" in v
}

export async function dbGetSession(): Promise<SessionState | null> {
  return await withStore("sessie lezen", async s => {
    const rauw = await s.get<unknown>(KEYS.session)
    if (!rauw) return null
    // Oude data: de volledige sessie stond op `ctt:session`, zonder eigen
    // sleutel. Die blijft leesbaar, anders was de eerste deploy na deze
    // wijziging een wisser voor elke lopende oefening.
    if (!isVerwijzing(rauw)) return rauw as SessionState
    if (!rauw.actieveSessieId) return null
    return (await s.get<SessionState>(sessieKey(rauw.actieveSessieId))) ?? null
  })
}

export async function dbSetSession(session: SessionState | null): Promise<void> {
  await withStore("sessie schrijven", async s => {
    if (!session) {
      // Reset: de sessie gaat echt weg. Vroeger ruimde de 24-uurs TTL de
      // achterblijvers op; die is eruit, dus het opruimen moet hier expliciet.
      const rauw = await s.get<unknown>(KEYS.session)
      const id = isVerwijzing(rauw) ? rauw.actieveSessieId : (rauw as SessionState | null)?.id
      if (id) await s.del(sessieKey(id))
      await s.del(KEYS.session)
      return
    }
    // GEEN levensduur op deze schrijfactie. Er stond `{ ex: 60 * 60 * 24 }` op:
    // een oefening van gisteren was vandaag weg zonder dat iemand iets had
    // verwijderd, en de eigenaar kon niet achterhalen waar zijn sessies bleven.
    // Een sessie verdwijnt alleen nog door een expliciete reset hierboven.
    // Zet die TTL niet terug.
    //
    // Eerst de sessie zelf, dan de verwijzing: een halve schrijfactie laat de
    // oude verwijzing dan staan in plaats van naar niets te wijzen.
    await s.set(sessieKey(session.id), session)
    await s.set<ActieveSessie>(KEYS.session, { actieveSessieId: session.id })
  })
}

// Een specifieke sessie, ook als hij niet de actieve is. Hiermee kan er meer
// dan één oefening naast elkaar bestaan.
export async function dbGetSessionById(id: string): Promise<SessionState | null> {
  return await withStore("sessie op id lezen", async s => {
    const eigen = await s.get<SessionState>(sessieKey(id))
    if (eigen) return eigen
    // Oude data: toen was er één sessie, als volledige blob op `ctt:session`.
    const rauw = await s.get<unknown>(KEYS.session)
    if (rauw && !isVerwijzing(rauw) && (rauw as SessionState).id === id) return rauw as SessionState
    return null
  })
}

export async function dbListSessionIds(): Promise<string[]> {
  return await withStore("sessies opsommen", async s => {
    const ids = (await s.keys(SESSIE_PREFIX))
      .map(k => k.slice(SESSIE_PREFIX.length))
      // `ctt:session:lock` was de sleutel van het sessieslot en is geen sessie.
      // Het slot heet nu `ctt:lock:session`, maar een live store kan er nog een
      // van voor de deploy hebben staan.
      .filter(id => id.length > 0 && id !== "lock")
    // Oude data: één sessie als volledige blob op `ctt:session`, zonder eigen
    // sleutel. Die mag niet uit de lijst vallen.
    const rauw = await s.get<unknown>(KEYS.session)
    if (rauw && !isVerwijzing(rauw)) {
      const id = (rauw as SessionState).id
      if (id && !ids.includes(id)) ids.push(id)
    }
    return ids
  })
}

/**
 * Waar de sessies staan en of ze een herstart overleven. `duurzaam` is alleen
 * waar bij Postgres: KV is uitgefaseerd en het geheugen is per definitie weg na
 * een herstart.
 */
export async function dbStorageStatus(): Promise<{ backend: string; duurzaam: boolean; uitleg: string }> {
  const naam = (await achterkant()).naam
  if (naam === "postgres") {
    return {
      backend: naam,
      duurzaam: true,
      uitleg: "Sessies staan in Postgres: ze overleven een herstart en verlopen niet.",
    }
  }
  if (naam === "kv") {
    return {
      backend: naam,
      duurzaam: false,
      uitleg: "Sessies staan in Vercel KV — dat product is uitgefaseerd; zet DATABASE_URL om naar Postgres over te gaan.",
    }
  }
  return {
    backend: naam,
    duurzaam: false,
    uitleg: storageDegraded()
      ? "De ingestelde opslag reageert niet: sessies staan nu in het geheugen van deze instantie en overleven geen herstart."
      : "Er is geen opslag ingesteld: sessies staan in het geheugen en overleven geen herstart of tweede instantie.",
  }
}

// ─────────────────────────────────────────────────────────────
// Session mutation lock — beschermt read-modify-write races tussen
// gelijktijdige facilitator- en deelnemerrequests. Een achterkant met
// setIfAbsent gebruikt een slot met levensduur; het geheugen een Promise-mutex.
// ─────────────────────────────────────────────────────────────

// Buiten de `ctt:session:`-prefix, want daar staan nu de sessies zelf en een
// slot is geen sessie. De sleutel is vluchtig (vervalt na SESSION_LOCK_TTL_MS),
// dus de naamswijziging raakt geen opgeslagen data.
const SESSION_LOCK_KEY = "ctt:lock:session"
const SESSION_LOCK_TTL_MS = 5_000

let memLockChain: Promise<unknown> = Promise.resolve()

export async function withSessionLock<T>(fn: () => Promise<T>): Promise<T> {
  const s = await achterkant()
  const zetSlot = s.setIfAbsent

  if (!zetSlot) {
    // Geheugen: serialiseer via één Promise-keten. De Node-runtime is
    // single-threaded maar gelijktijdige `await`s kunnen wel interleaven, en
    // mutate() is read-modify-write.
    let resolveNext!: () => void
    const gate = new Promise<void>(resolve => { resolveNext = resolve })
    const prev = memLockChain
    memLockChain = gate
    await prev
    try { return await fn() } finally { resolveNext() }
  }

  const pak = async (): Promise<string | null> => {
    const token = `${Date.now()}:${Math.random().toString(36).slice(2)}`
    return (await zetSlot(SESSION_LOCK_KEY, token, SESSION_LOCK_TTL_MS)) ? token : null
  }

  let token = await probeer("slot pakken", pak, null)
  if (!token && !gedegradeerd) {
    await new Promise(r => setTimeout(r, 100))
    token = await probeer("slot pakken", pak, null)
  }
  if (!token) {
    // Valt de store om terwijl we het slot pakken, dan draaien we zonder slot
    // door in plaats van de mutatie te laten mislukken: degraded is beter dan
    // stil.
    if (gedegradeerd) return await fn()
    throw new Error("Session busy — could not acquire lock")
  }
  try {
    return await fn()
  } finally {
    await probeer("slot vrijgeven", async () => {
      if ((await s.get<string>(SESSION_LOCK_KEY)) === token) await s.del(SESSION_LOCK_KEY)
    }, undefined)
  }
}

// ─────────────────────────────────────────────────────────────
// Template store
// ─────────────────────────────────────────────────────────────

export async function dbGetTemplates(): Promise<ScenarioTemplate[]> {
  return await withStore("templates lezen", async s =>
    (await s.get<ScenarioTemplate[]>(KEYS.templates)) ?? [])
}

export async function dbSaveTemplate(t: ScenarioTemplate): Promise<void> {
  await withStore("template schrijven", async s => {
    const bestaand = (await s.get<ScenarioTemplate[]>(KEYS.templates)) ?? []
    const idx = bestaand.findIndex(e => e.id === t.id)
    if (idx >= 0) bestaand[idx] = t
    else bestaand.push(t)
    await s.set(KEYS.templates, bestaand)
  })
}

export async function dbDeleteTemplate(id: string): Promise<void> {
  await withStore("template verwijderen", async s => {
    const bestaand = (await s.get<ScenarioTemplate[]>(KEYS.templates)) ?? []
    await s.set(KEYS.templates, bestaand.filter(t => t.id !== id))
  })
}

// ─────────────────────────────────────────────────────────────
// User store
// ─────────────────────────────────────────────────────────────

export async function dbGetUsers(): Promise<StoredUser[]> {
  return await withStore("gebruikers lezen", async s => (await s.get<StoredUser[]>(KEYS.users)) ?? [])
}

function normalizeEmail(email: string) { return email.trim().toLowerCase() }
function emailReservationKey(email: string) { return `ctt:user:email:${normalizeEmail(email)}` }

export async function dbGetUserByEmail(email: string): Promise<StoredUser | null> {
  const users = await dbGetUsers()
  const key = normalizeEmail(email)
  return users.find(u => u.email.toLowerCase() === key) ?? null
}

async function bewaarGebruiker(s: StoreBackend, user: StoredUser): Promise<void> {
  const bestaand = (await s.get<StoredUser[]>(KEYS.users)) ?? []
  const idx = bestaand.findIndex(u => u.id === user.id)
  if (idx >= 0) bestaand[idx] = user
  else bestaand.push(user)
  await s.set(KEYS.users, bestaand)
}

export async function dbSaveUser(user: StoredUser): Promise<void> {
  const genormaliseerd: StoredUser = { ...user, email: normalizeEmail(user.email) }
  await withStore("gebruiker schrijven", s => bewaarGebruiker(s, genormaliseerd))
}

export type CreateUserResult =
  | { ok: true }
  | { ok: false; reason: "duplicate_email" }

export async function dbCreateUserIfEmailFree(user: StoredUser): Promise<CreateUserResult> {
  const genormaliseerd: StoredUser = { ...user, email: normalizeEmail(user.email) }
  return await withStore<CreateUserResult>("gebruiker aanmaken", async s => {
    const zetSlot = s.setIfAbsent
    if (zetSlot) {
      // Reserveer het e-mailadres atomair, zodat twee gelijktijdige creates
      // niet beide winnen.
      const gereserveerd = await zetSlot(emailReservationKey(genormaliseerd.email), genormaliseerd.id)
      if (!gereserveerd) return { ok: false, reason: "duplicate_email" }
    } else {
      // Geheugen: één proces, dus een lees-check benadert dit goed genoeg.
      const bestaand = (await s.get<StoredUser[]>(KEYS.users)) ?? []
      if (bestaand.some(u => u.email === genormaliseerd.email)) {
        return { ok: false, reason: "duplicate_email" }
      }
    }
    await bewaarGebruiker(s, genormaliseerd)
    return { ok: true }
  })
}

// ─────────────────────────────────────────────────────────────
// Scenario graph store
// ─────────────────────────────────────────────────────────────

export async function dbSaveScenarioGraph(graph: ScenarioGraph): Promise<void> {
  await withStore("graaf schrijven", async s => {
    await s.set(graphKey(graph.id), graph)
    const index = (await s.get<string[]>(KEYS.graphIndex)) ?? []
    if (!index.includes(graph.id)) await s.set(KEYS.graphIndex, [...index, graph.id])
  })
}

export async function dbLoadScenarioGraph(id: string): Promise<ScenarioGraph | null> {
  return await withStore("graaf lezen", async s => (await s.get<ScenarioGraph>(graphKey(id))) ?? null)
}

export async function dbListScenarioGraphs(): Promise<ScenarioGraph[]> {
  return await withStore("grafen opsommen", async s => {
    const index = (await s.get<string[]>(KEYS.graphIndex)) ?? []
    const grafen = await Promise.all(index.map(id => s.get<ScenarioGraph>(graphKey(id))))
    return grafen.filter((g): g is ScenarioGraph => !!g)
  })
}

export async function dbDeleteScenarioGraph(id: string): Promise<void> {
  await withStore("graaf verwijderen", async s => {
    await s.del(graphKey(id))
    const index = (await s.get<string[]>(KEYS.graphIndex)) ?? []
    await s.set(KEYS.graphIndex, index.filter(gid => gid !== id))
  })
}

/**
 * Seed a default admin user if no users exist.
 * Credentials come from env vars: ADMIN_EMAIL, ADMIN_PASSWORD.
 *
 * De grens is de opslag, niet NODE_ENV. Dat was hier eerst
 * `NODE_ENV === 'production'`, en dat klopte zolang een laptop in het geheugen
 * draaide. Met DATABASE_URL in .env.local draait een laptop op dezelfde
 * database als productie, en dan zette een `pnpm dev` 'changeme123' als admin
 * in die database — met NODE_ENV=development, dus de oude controle liet het
 * door. Alleen een vluchtige achterkant mag dit wachtwoord krijgen.
 */
const DEFAULT_ADMIN_PASSWORD_FALLBACK = "changeme123"

export async function dbEnsureAdminUser(): Promise<void> {
  const users = await dbGetUsers()
  if (users.length > 0) return

  const vluchtig = (await achterkant()).naam === "geheugen"
  const password = process.env.ADMIN_PASSWORD ?? (vluchtig ? DEFAULT_ADMIN_PASSWORD_FALLBACK : "")

  if (!vluchtig && (!password || password === DEFAULT_ADMIN_PASSWORD_FALLBACK)) {
    throw new Error(
      "[ctt] Refusing to seed default admin into shared storage: set ADMIN_PASSWORD (and ADMIN_EMAIL), or remove DATABASE_URL from .env.local so this instance uses its own memory.",
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
