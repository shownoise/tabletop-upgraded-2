import type { ScenarioGraph } from "./types"
import { schoolverenigingScenario } from "./examples-schoolvereniging"
import { eyeSecurityScenario } from "./examples-eye-security"

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
  {
    key: "eye_security_intern",
    label: "★ Eye Security — ons eigen beheerplatform (interne oefening)",
    description:
      "Interne oefening voor Eye Security zelf. Ons multi-tenant beheerplatform met privileged " +
      "access in 180 klantomgevingen wordt gecompromitteerd: een incident bij ons is per " +
      "definitie een ketenincident bij de klant, en hun meldklokken beginnen te lopen op ons " +
      "bericht. 5 rondes van zaterdagnacht 02:48 tot dinsdagmiddag. " +
      "Ronde 1 gaat bewust over alarmeren: om 02:48 bestaat het crisisteam niet, dus alleen de " +
      "CISO en de IT-manager hebben daar mandaat en de overige rollen lezen mee. " +
      "Wie opschaalt zet een vlag die in latere rondes opties ontsluit. " +
      "Hangt via clientId aan de klant Eye Security.",
    build: eyeSecurityScenario,
  },
]
