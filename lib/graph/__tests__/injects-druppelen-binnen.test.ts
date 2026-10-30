import { describe, it, expect } from "vitest"
import { EXAMPLES } from "../examples"
import { buildRoundIndexMap } from "../setup-injects"
import { computeRoundPhaseDurations } from "@/lib/engine/round-phases"
import { buildDraftGraph } from "@/lib/wizard/deterministic"
import { defaultWizardConfig } from "@/lib/wizard/config"
import type { ScenarioGraph, InjectNodeData, RoundNodeData, GraphNode } from "../types"

// Twee eisen, en de tweede is er omdat de eerste alleen niet genoeg bleek.
//
//  1. Niets komt meer binnen zodra het team aan het kiezen is. Een bericht dat
//     tijdens de beslisfase landt, laat de helft van de zaal iets anders wegen
//     dan de andere helft.
//  2. De berichten liggen echt verspreid over dat venster. Een eerdere versie
//     spreidde over de inject-fase alleen — bij vijftien minuten 82 seconden,
//     dus acht berichten met gaten van elf seconden. Dat haalde eis 1 met
//     vlag en wimpel en was in de zaal niet te onderscheiden van allemaal
//     tegelijk; zo kwam de klacht ook terug. Daarom een ondergrens op de
//     spreiding, niet alleen een bovengrens op het moment.

// Minimaal deel van het venster dat de berichten moeten beslaan.
const MIN_SPREIDING = 0.5
// Minimale afstand tussen twee opeenvolgende berichten, in seconden.
const MIN_GAT = 30

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

    const fasen = computeRoundPhaseDurations((node.data.timerMinutes ?? 15) * 60)
    const werkvenster = fasen.inject + fasen.discussion
    const momenten = injects.map(n => n.data.deliverySeconds ?? 0).sort((a, b) => a - b)
    const waar = `${naam} ronde ${nummer}`

    // 1. Niets tijdens of na de beslisfase.
    expect(
      momenten[momenten.length - 1],
      `${waar}: laatste bericht op ${momenten[momenten.length - 1]}s, maar na ${Math.round(werkvenster)}s zit het team al te kiezen`,
    ).toBeLessThanOrEqual(Math.ceil(werkvenster))
    expect(momenten[0], `${waar}: negatief moment`).toBeGreaterThanOrEqual(0)

    if (injects.length < 2) continue

    // 2. Echt verspreid, niet samengeklonterd aan het begin.
    const spreiding = momenten[momenten.length - 1] - momenten[0]
    expect(
      spreiding / werkvenster,
      `${waar}: ${injects.length} berichten liggen binnen ${spreiding}s van een venster van ${Math.round(werkvenster)}s — dat voelt als één klap`,
    ).toBeGreaterThanOrEqual(MIN_SPREIDING)

    // Geen twee berichten vlak op elkaar. Seconde 0 mag dubbel: de gedeelde
    // aankondiging en het rolbericht van wie meteen aan zet is openen samen.
    const naOpening = momenten.filter(s => s > 0)
    for (let i = 1; i < naOpening.length; i++) {
      expect(
        naOpening[i] - naOpening[i - 1],
        `${waar}: twee berichten op ${naOpening[i - 1]}s en ${naOpening[i]}s, dat leest als één bericht`,
      ).toBeGreaterThanOrEqual(MIN_GAT)
    }
  }
}

describe("injects druppelen binnen over de ronde", () => {
  for (const example of EXAMPLES) {
    it(example.key, () => {
      controleer(example.build(), example.key)
    })
  }

  for (const rondes of [3, 4, 6]) {
    it(`de deterministische bouwer spreidt ze echt (${rondes} rondes)`, () => {
      const config = { ...defaultWizardConfig(), clientName: "Testklant", rounds: rondes }
      controleer(buildDraftGraph(config), `deterministisch/${rondes}`)
    })
  }
})
