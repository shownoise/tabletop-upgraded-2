// De opslagnaad. Eén plek die bepaalt waar bytes heen gaan.
//
// Waarom dit bestaat: de opslag zat verspreid over drie modules die elk hun
// eigen `@vercel/kv`-client maakten, elk met hun eigen gat in de
// foutafhandeling. Toen de store wegviel gaf /api/session/state een 500 en lag
// de app eruit. Dat is in #115 gedicht, maar de opslag zelf draait nog op een
// uitgefaseerd product.
//
// Deze module is een sleutel-waarde-laag met drie achterkanten: Postgres als er
// een connectiestring is, anders Vercel KV als die envvars er zijn, anders het
// geheugen. Eén van de drie, gekozen bij de eerste aanroep. Alles wat erboven
// zit (lib/db.ts, de klant-store, het sessie-archief) weet niet welke.
//
// Bewust géén relationeel model: de bovenliggende code bewaart blobs, en een
// schema-ontwerp per entiteit is werk dat niets oplost zolang die blobs
// hetzelfde blijven. De Postgres-achterkant is dus ook een sleutel-waarde-tabel
// plus een aparte, append-only tabel voor gebeurtenissen — want dáár heeft de
// vorm wél betekenis.

export interface StoreBackend {
  readonly naam: "postgres" | "kv" | "geheugen"
  get<T>(key: string): Promise<T | null>
  set<T>(key: string, value: T): Promise<void>
  del(key: string): Promise<void>
  // Sleutels met een prefix. Nodig om sessies te kunnen opsommen zonder een
  // aparte index bij te houden die uit de pas kan lopen.
  keys(prefix: string): Promise<string[]>
  // Schrijf alleen als de sleutel nog vrij is; `true` betekent "van jou".
  // Atomair, want hier hangen twee dingen aan die een race niet mogen
  // verliezen: het sessieslot en de e-mailreservering bij een nieuwe
  // gebruiker. Optioneel: een achterkant die maar één proces bedient (het
  // geheugen) laat dit weg, en de bovenliggende code gebruikt dan een
  // Promise-keten die beter is dan een slot op een sleutel.
  setIfAbsent?(key: string, value: unknown, ttlMs?: number): Promise<boolean>
  // Append-only gebeurtenissen per sessie. `seq` wordt door de achterkant
  // bepaald, zodat twee gelijktijdige writers niet hetzelfde nummer krijgen.
  appendEvent(event: NieuweGebeurtenis): Promise<Gebeurtenis>
  listEvents(sessionId: string): Promise<Gebeurtenis[]>
}

// Een gebeurtenis in een sessie. Dit is de laag die ongedaan maken mogelijk
// maakt: niets wordt overschreven, er komt alleen iets bij.
export interface Gebeurtenis {
  id: string
  sessionId: string
  // Oplopend per sessie, door de achterkant bepaald.
  seq: number
  at: number
  // Wat er gebeurde, in de taal van de app: inject_pushed, decision_submitted,
  // phase_changed, special_started. Vrij veld; de app bepaalt de waarden.
  kind: string
  // Wie het deed: een participantId, "facilitator" of "system".
  actor: string
  payload: unknown
  // Zet een eerdere gebeurtenis terug. Compenserend, niet verwijderend: de
  // historie blijft kloppen en je kunt zien dát er is teruggedraaid.
  undoes?: string
}

export type NieuweGebeurtenis = Omit<Gebeurtenis, "id" | "seq">

// ── Keuze van de achterkant ────────────────────────────────────────────

let gekozen: StoreBackend | null = null
let kiezen: Promise<StoreBackend> | null = null

export function heeftPostgres(): boolean {
  return !!(process.env.DATABASE_URL ?? process.env.POSTGRES_URL)
}

export function heeftKv(): boolean {
  return !!(process.env.KV_REST_API_URL ?? process.env.KV_URL)
}

// Welke achterkant draait. Voor de statusregel in het beheer, zodat je niet
// hoeft te gokken of je sessies blijven bestaan.
export function backendNaam(): StoreBackend["naam"] | "nog niet gekozen" {
  return gekozen?.naam ?? "nog niet gekozen"
}

export async function store(): Promise<StoreBackend> {
  if (gekozen) return gekozen
  if (!kiezen) kiezen = kiesBackend()
  gekozen = await kiezen
  return gekozen
}

async function kiesBackend(): Promise<StoreBackend> {
  if (heeftPostgres()) {
    try {
      const { postgresBackend } = await import("./postgres")
      const b = await postgresBackend()
      if (b) return b
    } catch (err) {
      console.error("[ctt] Postgres niet bruikbaar — volgende achterkant proberen.", err)
    }
  }
  if (heeftKv()) {
    try {
      const { kvBackend } = await import("./kv")
      const b = await kvBackend()
      if (b) return b
    } catch (err) {
      console.error("[ctt] KV niet bruikbaar — verder in geheugen.", err)
    }
  }
  const { geheugenBackend } = await import("./geheugen")
  return geheugenBackend()
}

// Alleen voor tests: dwing een herkeuze af.
export function _resetBackendKeuze(): void {
  gekozen = null
  kiezen = null
}
