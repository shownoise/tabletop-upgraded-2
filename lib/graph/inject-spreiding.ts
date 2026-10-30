import { computeRoundPhaseDurations } from "@/lib/engine/round-phases"
import { buildRoundIndexMap } from "./setup-injects"
import type { GraphNode, InjectNodeData, RoundNodeData, ScenarioGraph } from "./types"

// Repareert de aflevermomenten van een scenario dat opgeslagen is vóórdat de
// spreiding bestond — of met een spreiding die in de zaal niet te merken is.
//
// Waarom dit nodig is: "Gebruiken" op de Scenario's-pagina slaat een *kopie*
// van het voorbeeld op. Nieuwe code hertimet die kopie niet; een scenario dat
// vorige week in de bibliotheek belandde houdt zijn oude `deliverySeconds`
// voor altijd. In de praktijk betekende dat: alles op seconde 0, dus alle
// berichten van een ronde in één klap, precies de klacht.
//
// Wat het bewust NIET doet: tijden overschrijven die een auteur zelf heeft
// gezet. De builder heeft een veld voor `deliverySeconds` en iemand die daar
// 240 intypt bedoelt 240. Daarom grijpt dit alleen in als een ronde geen
// spreiding van betekenis heeft — dezelfde maat die
// `rule16_injects_staggered` en de druppeltest gebruiken.

// Een ronde met minder spreiding dan dit deel van het venster wordt hertimed.
const MIN_SPREIDING = 0.5
// Het deel van inject-fase plus discussie waarover we spreiden. Daarna begint
// de beslisfase en hoort er niets nieuws meer binnen te vallen.
const VENSTER_DEEL = 0.85

export function spreidVensterVoorRonde(timerMinutes: number | undefined): number {
  const fasen = computeRoundPhaseDurations((timerMinutes ?? 15) * 60)
  return Math.round((fasen.inject + fasen.discussion) * VENSTER_DEEL)
}

export function spreidInjectsIndienNodig(graph: ScenarioGraph): ScenarioGraph {
  const map = buildRoundIndexMap(graph)
  const nieuweSeconden = new Map<string, number>()

  const rondes = graph.nodes
    .filter((n): n is GraphNode & { data: RoundNodeData } => n.type === "round")
    .map(node => ({ node, nummer: map.roundNumberById.get(node.id) ?? 0 }))
    .filter(r => r.nummer > 0)

  for (const { node, nummer } of rondes) {
    const injects = graph.nodes.filter(
      (n): n is GraphNode & { data: InjectNodeData } =>
        n.type === "inject" && map.byNode.get(n.id) === nummer,
    )
    if (injects.length < 2) continue

    const venster = spreidVensterVoorRonde(node.data.timerMinutes)
    const momenten = injects.map(n => n.data.deliverySeconds ?? 0)
    const spreiding = Math.max(...momenten) - Math.min(...momenten)
    // Valt het laatste bericht ná het werkvenster, dan is het ook fout: dan
    // landt er iets terwijl het team al aan het kiezen is.
    const teLaat = Math.max(...momenten) > venster
    if (spreiding >= venster * MIN_SPREIDING && !teLaat) continue

    injects.forEach((inject, slot) => {
      nieuweSeconden.set(
        inject.id,
        slot === 0 ? 0 : Math.round((venster * slot) / (injects.length - 1)),
      )
    })
  }

  if (nieuweSeconden.size === 0) return graph

  return {
    ...graph,
    nodes: graph.nodes.map(node => {
      const seconden = nieuweSeconden.get(node.id)
      if (seconden === undefined || node.type !== "inject") return node
      return { ...node, data: { ...(node.data as InjectNodeData), deliverySeconds: seconden } }
    }),
  }
}
