import type { ScenarioGraph } from "./types"
import { simpleStoryExample } from "./examples-simple-story"

// Registry van voorbeeldscenarios. Elke `build()` levert een verse
// ScenarioGraph met unieke node-ids, klaar om in de builder te laden.

export interface Example {
  key: string
  label: string
  description: string
  build: () => ScenarioGraph
}

export const EXAMPLES: Example[] = [
  {
    key: "simple_story",
    label: "★ Ransomware Crisis — 7 rondes",
    description:
      "Compleet crisis-scenario met 7 rondes: detectie, exfiltratie, ransom-note, media/HR/klant-onrust, herstel, leaksite, en post-mortem. " +
      "Elke ronde meerdere parallelle keuzes voor verschillende rollen (CISO / Legal / CEO / Comms / CFO / HR / Ops). " +
      "Realistische MDR-alerts, exclusieve injects per rol, misroute, en drie uitkomsten afhankelijk van cumulatieve score.",
    build: simpleStoryExample,
  },
]
