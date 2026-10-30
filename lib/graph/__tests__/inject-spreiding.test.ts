import { describe, expect, it } from "vitest"
import { spreidInjectsIndienNodig, spreidVensterVoorRonde } from "../inject-spreiding"
import type { InjectNodeData, ScenarioGraph } from "../types"

// "Gebruiken" op de Scenario's-pagina slaat een kopie van het voorbeeld op.
// Latere hertiming raakt die kopie niet, dus een scenario dat al in de
// bibliotheek stond houdt zijn oude momenten — in de praktijk: alles op
// seconde 0, en dan komt een hele ronde in één klap binnen.
//
// Deze reparatie loopt bij het starten van een oefening. Twee dingen staan
// hier vast: hij repareert zo'n ronde, en hij laat tijden die een auteur zelf
// in de builder heeft gezet staan.

function graaf(seconden: Array<number | undefined>, timerMinutes = 15): ScenarioGraph {
  return {
    id: "g", name: "t", version: 1, scenarioType: "ransomware_double_extortion",
    createdAt: 1, updatedAt: 1,
    nodes: [
      { id: "start", type: "start", position: { x: 0, y: 0 }, data: { kind: "start" } },
      {
        id: "R1", type: "round", position: { x: 0, y: 1 },
        data: { kind: "round", title: "R1", situation_update: "x", timerMinutes },
      },
      ...seconden.map((s, i) => ({
        id: `I${i}`, type: "inject" as const, position: { x: 0, y: 10 + i },
        data: {
          kind: "inject", type: "alert", urgency: "high",
          title: `i${i}`, content: "x", deliverySeconds: s,
        } as unknown as InjectNodeData,
      })),
    ],
    edges: [
      { id: "e0", source: "start", target: "R1", type: "sequence" },
      ...seconden.map((_, i) => ({
        id: `ei${i}`, source: "R1", target: `I${i}`, type: "inject" as const,
      })),
    ],
  } as unknown as ScenarioGraph
}

function momenten(graph: ScenarioGraph): number[] {
  return graph.nodes
    .filter(n => n.type === "inject")
    .map(n => (n.data as InjectNodeData).deliverySeconds ?? 0)
}

describe("spreiding repareren bij het starten van een oefening", () => {
  it("spreidt een ronde waarin alles op seconde 0 staat", () => {
    const venster = spreidVensterVoorRonde(15)
    const uit = momenten(spreidInjectsIndienNodig(graaf([undefined, undefined, undefined, undefined])))
    expect(uit[0]).toBe(0)
    expect(uit[uit.length - 1]).toBe(venster)
    // Oplopend en met echte gaten.
    for (let i = 1; i < uit.length; i++) {
      expect(uit[i] - uit[i - 1]).toBeGreaterThanOrEqual(30)
    }
  })

  it("spreidt een ronde die binnen de inject-fase samengeklonterd zat", () => {
    // Precies de reeks die de vorige poging opleverde: uniek, maar alles
    // binnen tweeëntachtig seconden van een ronde van vijftien minuten.
    const uit = momenten(spreidInjectsIndienNodig(graaf([0, 12, 23, 35, 47, 59, 70, 82])))
    expect(uit[uit.length - 1]).toBe(spreidVensterVoorRonde(15))
    expect(uit[1]).toBeGreaterThanOrEqual(30)
  })

  it("laat een auteur die zelf tijden heeft gezet met rust", () => {
    const eigen = [0, 120, 260, 400, 500]
    const uit = momenten(spreidInjectsIndienNodig(graaf(eigen)))
    expect(uit).toEqual(eigen)
  })

  it("haalt een bericht terug dat ná het werkvenster zou landen", () => {
    // 900 seconden is voorbij de discussie: dan valt het binnen terwijl het
    // team al aan het kiezen is.
    const uit = momenten(spreidInjectsIndienNodig(graaf([0, 300, 900])))
    expect(Math.max(...uit)).toBeLessThanOrEqual(spreidVensterVoorRonde(15))
  })

  it("rekent het venster per rondetijd, niet met een vast getal", () => {
    expect(spreidVensterVoorRonde(15)).toBe(520)
    expect(spreidVensterVoorRonde(20)).toBe(699)
    expect(spreidVensterVoorRonde(20)).toBeGreaterThan(spreidVensterVoorRonde(15))
  })

  it("laat een ronde met één inject ongemoeid", () => {
    expect(momenten(spreidInjectsIndienNodig(graaf([0])))).toEqual([0])
  })

  it("geeft dezelfde graph terug als er niets te repareren is", () => {
    const g = graaf([0, 120, 260, 400, 500])
    expect(spreidInjectsIndienNodig(g)).toBe(g)
  })
})
