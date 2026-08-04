import type { ScenarioGraph } from "./types"
import { nis2PolderStormExample } from "./examples-nis2-polder-storm"
import { simpleStoryExample } from "./examples-simple-story"

// Registry of ScenarioGraph starter templates. Each build() returns a fresh
// graph with unique node ids, ready to load into the builder canvas.
//
// Facilitators may either pick one of these starters and tweak it, or run the
// AI wizard (POST /api/scenario-graph/ai-wizard) to generate a client-tailored
// scenario from scratch — both flows converge on the same ScenarioGraph shape.

export interface Example {
  key: string
  label: string
  description: string
  build: () => ScenarioGraph
}

export const EXAMPLES: Example[] = [
  {
    key: "nis2_polder_storm",
    label: "★ OPERATIE POLDER-STORM — Ransomware + Exfil (NIS2)",
    description:
      "Startscenario voor Dutch MKB+ als essential entity onder NIS2. Ransomware met data-exfiltratie, " +
      "72 uur tijdsbestek, 5 rondes met alle 8 rollen actief, twee melding-momenten (IR-retainer + AP-melding), " +
      "misleading signalen op R1/R3, en cumulatieve outcome-scoring op de 6 uitkomstdimensies.",
    build: nis2PolderStormExample,
  },
  {
    key: "simple_story",
    label: "Ransomware Crisis — 7 rondes (uitgebreid)",
    description:
      "Complete 7-ronde variant: detectie, exfiltratie, ransom-note, media/HR/klant-onrust, herstel, leaksite, post-mortem. " +
      "Meer parallelle keuzes per ronde en langere runtime — voor teams die de basis al beheersen.",
    build: simpleStoryExample,
  },
]
