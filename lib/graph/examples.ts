import type { ScenarioGraph } from "./types"
import { schoolverenigingScenario } from "./examples-schoolvereniging"

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
    key: "schoolvereniging_ransomware",
    label: "★ Onderwijsvereniging — Play-ransomware (AVG + NIS2)",
    description:
      "Nederlandse onderwijsvereniging (MKB+, 5 VO-scholen, ~4000 leerlingen) getroffen door Play-ransomware met exfiltratie. " +
      "6 rondes over 5 dagen verhaaltijd. Essentiële entiteit onder NIS2, verwerkingsverantwoordelijke onder AVG. " +
      "Realistische MKB+-pijnpunten: uitbestede ICT (MSP), backup nooit volledig getest, IT-coördinator op vakantie, " +
      "cyberpolis-clausules onbekend, leverancierscontract met notificatie-clause (Magister 48u).",
    build: schoolverenigingScenario,
  },
]
