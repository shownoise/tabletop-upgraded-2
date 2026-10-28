// Postgres-achterkant. Dit is de bestemming: hij overleeft een herstart, heeft
// geen TTL, en de gebeurtenissen staan in een echte append-only tabel.
//
// Aanzetten kost één envvar: DATABASE_URL (of POSTGRES_URL). Zolang die er niet
// is verandert er niets en blijft de app op KV of geheugen draaien.
//
// Waarom `pg` en niet een ORM: er zijn twee tabellen en zes queries. Een ORM
// voegt een migratielaag en een generator toe aan iets wat in dertig regels SQL
// past.

import type { Pool } from "pg"
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

async function verbind(): Promise<Pool | null> {
  const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL
  // Zonder connectiestring hoort deze achterkant niet te draaien, en dan mag
  // `pg` ook niet geladen worden.
  if (!url) return null
  try {
    // Dynamisch, zodat het pakket alleen in het spel komt als er echt een
    // database is. Mislukt het laden alsnog, dan is dat niet fataal: we geven
    // null terug en de naad gaat door naar KV of het geheugen.
    const { Pool } = await import("pg")
    const pool = new Pool({ connectionString: url })
    // Verplicht, niet netjes-maar-optioneel: een `error` op een idle client is
    // een EventEmitter-event, en zonder luisteraar gooit Node dat als
    // uncaught exception. Geen enkele try/catch hierboven vangt dat. Dan valt
    // het proces om op precies de storing die we juist willen opvangen.
    pool.on("error", err => {
      console.error("[ctt] Postgres-verbinding viel weg op een inactieve client.", err)
    })
    return pool
  } catch (err) {
    console.error("[ctt] DATABASE_URL staat gezet maar het pakket pg is niet te laden.", err)
    return null
  }
}

let schemaGereed = false

export async function postgresBackend(): Promise<StoreBackend | null> {
  const db = await verbind()
  if (!db) return null

  if (!schemaGereed) {
    // Dit is de eerste echte verbinding: `new Pool()` praat nog niet met de
    // database. Lukt dit niet (verkeerde credentials, store bestaat niet), dan
    // sluiten we de pool voordat we null teruggeven — een achtergebleven pool
    // blijft anders opnieuw verbinden terwijl de app al op KV is overgegaan.
    try {
      await db.query(SCHEMA_SQL)
      schemaGereed = true
    } catch (err) {
      console.error("[ctt] Postgres bereikbaar maken mislukt — volgende achterkant proberen.", err)
      await db.end().catch(() => {})
      return null
    }
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

    // Eén statement, dus atomair. Met `ttlMs` is het een lease: de rij mag
    // overgenomen worden zodra hij ouder is dan die levensduur, zodat een
    // request die onderweg sneuvelt het sessieslot niet voor altijd vasthoudt.
    // De RETURNING-clausule geeft alleen een rij als wij hem te pakken kregen.
    async setIfAbsent(key: string, value: unknown, ttlMs?: number): Promise<boolean> {
      const r = ttlMs
        ? await db.query<{ key: string }>(
            `INSERT INTO ctt_kv (key, value, updated_at) VALUES ($1, $2, now())
             ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = now()
             WHERE ctt_kv.updated_at < now() - ($3::double precision * interval '1 millisecond')
             RETURNING key`,
            [key, JSON.stringify(value), ttlMs],
          )
        : await db.query<{ key: string }>(
            `INSERT INTO ctt_kv (key, value, updated_at) VALUES ($1, $2, now())
             ON CONFLICT (key) DO NOTHING
             RETURNING key`,
            [key, JSON.stringify(value)],
          )
      return r.rows.length > 0
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
      const r = await db.query<{
        id: string
        sessionId: string
        seq: number
        // `bigint` komt als string terug uit pg, niet als number. Met de echte
        // pg-types valt dat nu op in plaats van pas in de UI.
        at: string | number
        kind: string
        actor: string
        payload: unknown
        undoes: string | null
      }>(
        `SELECT id, session_id AS "sessionId", seq, at, kind, actor, payload, undoes
         FROM ctt_events WHERE session_id = $1 ORDER BY seq`,
        [sessionId],
      )
      return r.rows.map(rij => ({
        ...rij,
        at: Number(rij.at),
        undoes: rij.undoes ?? undefined,
      }))
    },
  }
}
