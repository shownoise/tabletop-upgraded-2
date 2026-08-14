// Kwaliteits-scores tegen de 10-punts rubric uit docs/kwaliteit/rubric.md.
// Elke score-run legt vast: welke testklant, welke prompt-versie, per punt
// 0/1/2, en de notitie. Zo zie je over tijd of de wizard beter wordt.

export type RubricScorePerPoint = 0 | 1 | 2

export interface RubricScoreEntry {
  id: string
  createdAt: number
  clientId: string             // AdminClient.id
  clientName: string
  scenarioGraphId?: string     // als het scenario in de bibliotheek is opgeslagen
  scenarioName: string
  promptVersion: string        // "v1.0" of git-sha of iets — Bas geeft dit op of we hashen de prompt
  scores: Array<{
    pointNumber: number        // 1..10
    pointTitle: string         // korte titel bv "Beslissingen aangekondigd"
    score: RubricScorePerPoint
    note?: string
  }>
  total: number                // 0..20
  observations?: string        // vrij tekstvak "wat opviel"
  promptImprovements?: string  // wat opnieuw naar de wizard-prompt zou moeten
}

const KEY = "admin:rubric-scores"

const globalAny = globalThis as unknown as { __ctt_admin_rubric__?: Record<string, RubricScoreEntry> }

async function getKv() {
  if (!process.env.KV_REST_API_URL && !process.env.KV_URL) return null
  try { const { kv } = await import("@vercel/kv"); return kv }
  catch { return null }
}

export async function listRubricScores(): Promise<RubricScoreEntry[]> {
  const kv = await getKv()
  const obj = kv
    ? (await kv.get<Record<string, RubricScoreEntry>>(KEY)) ?? {}
    : globalAny.__ctt_admin_rubric__ ?? {}
  return Object.values(obj).sort((a, b) => b.createdAt - a.createdAt)
}

export async function saveRubricScore(entry: RubricScoreEntry): Promise<void> {
  const kv = await getKv()
  const current = kv
    ? (await kv.get<Record<string, RubricScoreEntry>>(KEY)) ?? {}
    : globalAny.__ctt_admin_rubric__ ?? {}
  const next = { ...current, [entry.id]: entry }
  if (kv) await kv.set(KEY, next)
  else globalAny.__ctt_admin_rubric__ = next
}

export function newRubricEntryId(): string {
  return `rubric_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

// De 10 rubric-punten uit docs/kwaliteit/rubric.md. Titels zijn stabiel;
// als je de rubric wijzigt update je hier de lijst — bestaande scores
// blijven kloppen omdat we ze per pointNumber bewaren.
export const RUBRIC_POINTS: ReadonlyArray<{ n: number; title: string; hint: string }> = [
  { n: 1,  title: "Beslissingen aangekondigd",       hint: "0 = niet, 1 = via minstens één inject, 2 = inject wordt geadresseerd" },
  { n: 2,  title: ">2 opties per rol",               hint: "0 = binair, 1 = ≥3 maar dominant beste, 2 = ≥3 échte trade-offs" },
  { n: 3,  title: "Geen dominant antwoord",          hint: "0 = triviaal, 1 = één dilemma en de rest niet, 2 = alle beslissingen dilemma" },
  { n: 4,  title: "Sectorcontext gebruikt",          hint: "0 = decor, 1 = kroonjuwelen wel maar generiek, 2 = concreet + beïnvloedt keuze" },
  { n: 5,  title: "Tijdlijn klopt",                  hint: "0 = fout of ontbreekt, 1 = klopt, 2 = tikt zichtbaar en forceert een keuze" },
  { n: 6,  title: "Rollen uit lijst + passend",      hint: "0 = uit fantasie, 1 = lijst, niet passend, 2 = lijst én bezette rollen kloppen" },
  { n: 7,  title: "Taal consistent",                 hint: "0 = mix, 1 = met 1-2 vaktermen anders, 2 = volledig consistent" },
  { n: 8,  title: "Zwakte komt terug",               hint: "0 = ontbreekt, 1 = alleen in briefing, 2 = beïnvloedt latere keuze" },
  { n: 9,  title: "Ruis/signaal balans",             hint: "0 = scheef, 1 = 20-40% of 50-70%, 2 = 40-50% met ruis-met-verdekte-waarde" },
  { n: 10, title: "Feit/aanname spanningsvol",       hint: "0 = geen mix, 1 = mix zonder verwarring, 2 = één aanname die makkelijk voor feit doorgaat" },
]
