// Kwaliteits-scores tegen de 10-punts rubric uit docs/kwaliteit/rubric.md.
// Elke score-run legt vast: welke testklant, welke prompt-versie, per punt
// 0/1/2, en de notitie. Zo zie je over tijd of de wizard beter wordt.

import { withStore } from "@/lib/db"

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

// Via withStore, niet via een eigen @vercel/kv-client. Deze module had er een,
// die alleen de *import* afschermde: elke echte kv.get stond onbeschermd en
// nam bij een wegvallende store het hele admin-paneel mee. Hetzelfde gat als
// in #115.
export async function listRubricScores(): Promise<RubricScoreEntry[]> {
  const obj = await withStore("rubric-scores lezen", async s =>
    (await s.get<Record<string, RubricScoreEntry>>(KEY)) ?? {},
  )
  return Object.values(obj).sort((a, b) => b.createdAt - a.createdAt)
}

export async function saveRubricScore(entry: RubricScoreEntry): Promise<void> {
  await withStore("rubric-score schrijven", async s => {
    const current = (await s.get<Record<string, RubricScoreEntry>>(KEY)) ?? {}
    await s.set(KEY, { ...current, [entry.id]: entry })
  })
}

// RUBRIC_POINTS staat in rubric-punten.ts en newRubricEntryId in ids.ts: die
// worden door een client component gebruikt, en mogen de opslag (en daarmee
// pg) niet mee de browserbundel in trekken.
