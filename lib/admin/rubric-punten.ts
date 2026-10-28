// De 10 rubric-punten uit docs/kwaliteit/rubric.md. Pure data, geen opslag.
//
// Waarom dit los staat van rubric-scores.ts: de score-invoer is een client
// component en gebruikt deze lijst. Zolang de lijst in rubric-scores.ts stond
// trok die import ook de opslag mee de browserbundel in — en daarmee `pg`, dat
// in de browser niet bestaat. De build viel om op `util/types`.
// Het id voor een score-run staat in ids.ts, om dezelfde reden.

// Titels zijn stabiel; als je de rubric wijzigt update je hier de lijst —
// bestaande scores blijven kloppen omdat we ze per pointNumber bewaren.
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
