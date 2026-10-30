import { describe, it, expect } from "vitest"
import { EXAMPLES } from "../examples"
import { buildRoundIndexMap } from "../setup-injects"
import { computeRoundPhaseDurations } from "@/lib/engine/round-phases"
import { buildDraftGraph } from "@/lib/wizard/deterministic"
import { defaultWizardConfig } from "@/lib/wizard/config"
import type { ScenarioGraph, InjectNodeData, RoundNodeData, GraphNode } from "../types"

// Een inject die binnenkomt terwijl het team al aan het kiezen is, is geen
// inject meer maar een verrassing. De spreiding moet binnen de inject-fase
// blijven — dat is bij een ronde van vijftien minuten 96 seconden, niet de
// volle 900.

function controleer(graph: ScenarioGraph, naam: string) {
  const map = buildRoundIndexMap(graph)
  const rondes = graph.nodes
    .filter((n): n is GraphNode & { data: RoundNodeData } => n.type === "round")
    .map(node => ({ node, nummer: map.roundNumberById.get(node.id) ?? 0 }))
    .filter(r => r.nummer > 0)

  expect(rondes.length, `${naam}: geen rondes gevonden`).toBeGreaterThan(0)

  for (const { node, nummer } of rondes) {
    const injects = graph.nodes.filter(
      (n): n is GraphNode & { data: InjectNodeData } =>
        n.type === "inject" && map.byNode.get(n.id) === nummer,
    )
    if (injects.length === 0) continue

    const fase = computeRoundPhaseDurations((node.data.timerMinutes ?? 15) * 60).inject

    for (const inject of injects) {
      const sec = inject.data.deliverySeconds ?? 0
      expect(
        sec,
        `${naam} ronde ${nummer} inject ${inject.id}: ${sec}s valt buiten de inject-fase van ${fase}s`,
      ).toBeLessThanOrEqual(Math.ceil(fase))
      expect(sec, `${naam} ronde ${nummer} inject ${inject.id}: negatief`).toBeGreaterThanOrEqual(0)
    }

    // Niet alles op het startsignaal: zodra er meer dan één inject is moet er
    // spreiding zijn, anders komen ze alsnog in één klap binnen.
    if (injects.length >= 2) {
      const momenten = injects.map(n => n.data.deliverySeconds ?? 0)
      expect(
        new Set(momenten).size,
        `${naam} ronde ${nummer}: ${injects.length} injects op ${new Set(momenten).size} moment(en)`,
      ).toBeGreaterThan(1)
    }
  }
}

describe("injects vallen binnen de inject-fase", () => {
  for (const example of EXAMPLES) {
    it(example.key, () => {
      controleer(example.build(), example.key)
    })
  }

  for (const rondes of [3, 4, 6]) {
    it(`de deterministische bouwer spreidt binnen de fase (${rondes} rondes)`, () => {
      const config = { ...defaultWizardConfig(), clientName: "Testklant", rounds: rondes }
      controleer(buildDraftGraph(config), `deterministisch/${rondes}`)
    })
  }
})
