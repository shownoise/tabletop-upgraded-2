// Postgres-achterkant. Dit is de bestemming: hij overleeft een herstart, heeft
// geen TTL, en de gebeurtenissen staan in een echte append-only tabel.
//
// Aanzetten kost één envvar: DATABASE_URL (of POSTGRES_URL). Zolang die er niet
// is verandert er niets en blijft de app op KV of geheugen draaien.
//
// Waarom `pg` en niet een ORM: er zijn twee tabellen en zes queries. Een ORM
// voegt een migratielaag en een generator toe aan iets wat in dertig regels SQL
// past.

import type { Gebeurtenis, NieuweGebeurtenis, StoreBackend } from "./backend"

// Twee tabellen. `ctt_kv` is de sleutel-waarde-laag waar de bestaande blobs in
// gaan; `ctt_events` is append-only, want daar heeft de vorm betekenis.
export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS ctt_kv (
  key        text PRIMARY KEY,
  value      jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ctt_events (
  id         text PRIMARY KEY,
  session_id text NOT NULL,
  seq        integer NOT NULL,
  at         bigint NOT NULL,
  kind       text NOT NULL,
  actor      text NOT NULL,
  payload    jsonb,
  undoes     text,
  UNIQUE (session_id, seq)
);

CREATE INDEX IF NOT EXISTS ctt_events_session_seq ON ctt_events (session_id, seq);
`

type QueryResult<T> = { rows: T[] }
type Client = { query: <T = unknown>(sql: string, params?: unknown[]) => Promise<QueryResult<T>> }

async function verbind(): Promise<Client | null> {
  const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL
  if (!url) return null
  // `pg` is een optionele afhankelijkheid: zonder DATABASE_URL hoeft die niet
  // geinstalleerd te zijn, en dan mag deze import stil mislukken.
  // Dynamische specifier, zodat TypeScript geen types voor `pg` eist en de
  // bundler het pakket niet probeert mee te nemen als het er niet is.
  const naam = "pg"
  const pg = (await import(/* webpackIgnore: true */ naam).catch(() => null)) as
    { Pool?: new (c: { connectionString: string }) => Client } | null
  if (!pg?.Pool) {
    console.error("[ctt] DATABASE_URL staat gezet maar het pakket pg is niet geinstalleerd.")
    return null
  }
  return new pg.Pool({ connectionString: url })
}

let schemaGereed = false

export async function postgresBackend(): Promise<StoreBackend | null> {
  const db = await verbind()
  if (!db) return null

  if (!schemaGereed) {
    await db.query(SCHEMA_SQL)
    schemaGereed = true
  }

  return {
    naam: "postgres",

    async get<T>(key: string): Promise<T | null> {
      const r = await db.query<{ value: T }>("SELECT value FROM ctt_kv WHERE key = $1", [key])
      return r.rows[0]?.value ?? null
    },

    async set<T>(key: string, value: T): Promise<void> {
      await db.query(
        `INSERT INTO ctt_kv (key, value, updated_at) VALUES ($1, $2, now())
         ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = now()`,
        [key, JSON.stringify(value)],
      )
    },

    async del(key: string): Promise<void> {
      await db.query("DELETE FROM ctt_kv WHERE key = $1", [key])
    },

    async keys(prefix: string): Promise<string[]> {
      const r = await db.query<{ key: string }>(
        "SELECT key FROM ctt_kv WHERE key LIKE $1 ORDER BY key",
        [`${prefix}%`],
      )
      return r.rows.map(x => x.key)
    },

    // Het volgnummer komt uit de database, niet uit de app: twee gelijktijdige
    // schrijvers krijgen dan nooit hetzelfde nummer.
    async appendEvent(event: NieuweGebeurtenis): Promise<Gebeurtenis> {
      const r = await db.query<{ seq: number; id: string }>(
        `INSERT INTO ctt_events (id, session_id, seq, at, kind, actor, payload, undoes)
         SELECT $1, $2, COALESCE(MAX(seq), 0) + 1, $3, $4, $5, $6, $7
         FROM ctt_events WHERE session_id = $2
         RETURNING seq, id`,
        [
          `ev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
          event.sessionId, event.at, event.kind, event.actor,
          JSON.stringify(event.payload ?? null), event.undoes ?? null,
        ],
      )
      return { ...event, id: r.rows[0].id, seq: r.rows[0].seq }
    },

    async listEvents(sessionId: string): Promise<Gebeurtenis[]> {
      const r = await db.query<Gebeurtenis>(
        `SELECT id, session_id AS "sessionId", seq, at, kind, actor, payload, undoes
         FROM ctt_events WHERE session_id = $1 ORDER BY seq`,
        [sessionId],
      )
      return r.rows
    },
  }
}
