// Eenmalige overstap van Vercel KV naar de nieuwe achterkant.
//
// Waarom dit bestaat: de naad kiest Postgres zodra DATABASE_URL er is, en die
// database is leeg. Zonder deze stap is alles wat er in KV staat — de lopende
// sessie, de klanten, het sessie-archief, de scenario-grafen, de overrides —
// na één deploy onzichtbaar. Niet weg (KV blijft staan), maar wel onvindbaar
// voor de app. Dat is het soort stilte waar je pas achter komt als je het
// nodig hebt.
//
// Het is een kopie, geen verhuizing: KV wordt niet leeggemaakt. Draai je het
// twee keer, dan slaat de tweede ronde over wat al in de bestemming staat,
// tenzij je expliciet om overschrijven vraagt.

import { kvBackend } from "./kv"
import { store, heeftKv, type Gebeurtenis, type StoreBackend } from "./backend"

// Alle sleutels die de app gebruikt, op prefix. `scenario-graph` dekt zowel
// `scenario-graph:<id>` als `scenario-graph-index`.
export const MIGRATIE_PREFIXEN = ["ctt:", "admin:", "scenario-graph"] as const

// Het sessieslot en de gezondheidscheck zijn vluchtig: een slot uit een oude
// store overzetten zou de nieuwe opslag meteen op slot zetten.
const OVERSLAAN = new Set(["ctt:lock:session", "ctt:health"])

const GEBEURTENIS_PREFIX = "ctt:events:"

export interface MigratieUitslag {
  van: string
  naar: string
  /** Waarom er niets te doen was. Leeg als er wél gemigreerd is. */
  nietsTeDoen?: string
  gekopieerd: string[]
  /** Stond al in de bestemming en is niet aangeraakt. */
  overgeslagen: string[]
  gebeurtenissen: number
  mislukt: Array<{ key: string; fout: string }>
}

export async function migreerVanKv(
  opties: { overschrijven?: boolean } = {},
): Promise<MigratieUitslag> {
  const bestemming = await store()
  const leeg: MigratieUitslag = {
    van: "kv",
    naar: bestemming.naam,
    gekopieerd: [],
    overgeslagen: [],
    gebeurtenissen: 0,
    mislukt: [],
  }

  if (bestemming.naam === "kv") {
    return { ...leeg, nietsTeDoen: "De app draait zelf nog op KV — er is geen bestemming om naartoe te kopiëren." }
  }
  if (!heeftKv()) {
    return { ...leeg, nietsTeDoen: "Er staan geen KV-envvars, dus er is geen oude opslag om uit te lezen." }
  }
  if (bestemming.naam === "geheugen") {
    return { ...leeg, nietsTeDoen: "De bestemming is het geheugen van deze instantie; een kopie daarheen is na een herstart weg." }
  }

  let bron
  try {
    bron = await kvBackend()
  } catch (err) {
    return { ...leeg, nietsTeDoen: `De KV-store antwoordt niet: ${foutTekst(err)}` }
  }
  if (!bron) return { ...leeg, nietsTeDoen: "De KV-store is niet te openen." }

  const uitslag: MigratieUitslag = { ...leeg }

  // Dubbele treffers kunnen: `scenario-graph` en `ctt:` overlappen niet, maar
  // een KV-patroonscan mag niet twee keer hetzelfde werk opleveren.
  const sleutels = new Set<string>()
  for (const prefix of MIGRATIE_PREFIXEN) {
    try {
      for (const k of await bron.keys(prefix)) sleutels.add(k)
    } catch (err) {
      uitslag.mislukt.push({ key: `${prefix}*`, fout: foutTekst(err) })
    }
  }

  for (const key of [...sleutels].sort()) {
    if (OVERSLAAN.has(key)) continue
    try {
      if (key.startsWith(GEBEURTENIS_PREFIX)) {
        uitslag.gebeurtenissen += await kopieerGebeurtenissen(bron, bestemming, key, uitslag)
        continue
      }
      if (!opties.overschrijven && (await bestemming.get(key)) !== null) {
        uitslag.overgeslagen.push(key)
        continue
      }
      const waarde = await bron.get(key)
      if (waarde === null) continue
      await bestemming.set(key, waarde)
      uitslag.gekopieerd.push(key)
    } catch (err) {
      uitslag.mislukt.push({ key, fout: foutTekst(err) })
    }
  }

  return uitslag
}

// Gebeurtenissen staan in KV als één lijst per sessie, maar in Postgres in een
// append-only tabel. Een blob-kopie zou daar in de verkeerde tabel landen en
// dus onzichtbaar blijven, dus hier gaat elke gebeurtenis er apart in.
async function kopieerGebeurtenissen(
  bron: StoreBackend,
  bestemming: StoreBackend,
  key: string,
  uitslag: MigratieUitslag,
): Promise<number> {
  const sessionId = key.slice(GEBEURTENIS_PREFIX.length)
  const bestaand = await bestemming.listEvents(sessionId)
  if (bestaand.length > 0) {
    uitslag.overgeslagen.push(key)
    return 0
  }
  const rij = (await bron.get<Gebeurtenis[]>(key)) ?? []
  let n = 0
  for (const e of rij) {
    await bestemming.appendEvent({
      sessionId: e.sessionId,
      at: e.at,
      kind: e.kind,
      actor: e.actor,
      payload: e.payload,
      ...(e.undoes ? { undoes: e.undoes } : {}),
    })
    n++
  }
  return n
}

function foutTekst(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}
