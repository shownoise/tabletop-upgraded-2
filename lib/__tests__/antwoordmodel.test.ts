import { describe, it, expect } from "vitest"
import { buildDraftGraph } from "@/lib/wizard/deterministic"
import { defaultWizardConfig, type WizardConfig } from "@/lib/wizard/config"
import { ruleQualityRanking, ruleEnoughExplanation } from "@/lib/wizard/framework"
import type { DecisionNodeData, ScenarioGraph } from "@/lib/graph/types"
import type { ChoiceQuality, Role } from "@/lib/types"

// Het antwoordmodel: per rol per beslispunt precies één beste antwoord, één
// tweede-beste, en de rest slecht.
//
// Waarom dit een eigen test heeft en niet alleen de framework-regel: de regel
// zegt of een graaf goed is, deze test zegt of de generátor er een maakt. Die
// twee liepen uit elkaar — de bouwer roteerde de middelste opties over
// [1,2,3,4] waar STANCES `good, good, poor, poor` staat, dus je kreeg per ronde
// soms twee tweede-beste antwoorden en soms geen enkele.

function config(over: Partial<WizardConfig> = {}): WizardConfig {
  return {
    ...defaultWizardConfig(),
    clientName: "Testklant",
    sector: "zorg",
    itArrangement: "uitbesteed",
    rounds: 3,
    injectsPerRound: 4,
    optionsPerRolePerRound: 4,
    rolesIncluded: ["ceo", "ciso", "legal"],
    specialConditions: [],
    ...over,
  }
}

function verdelingPerRol(graph: ScenarioGraph): Map<string, ChoiceQuality[]> {
  const uit = new Map<string, ChoiceQuality[]>()
  for (const node of graph.nodes) {
    if (node.type !== "decision") continue
    const data = node.data as DecisionNodeData
    const perRol = new Map<Role, ChoiceQuality[]>()
    for (const o of data.options) {
      if (o.implicit || !o.allowedRole) continue
      const rij = perRol.get(o.allowedRole) ?? []
      rij.push(o.qualityRank as ChoiceQuality)
      perRol.set(o.allowedRole, rij)
    }
    for (const [rol, rangen] of perRol) uit.set(`${node.id}|${rol}`, rangen)
  }
  return uit
}

describe("het antwoordmodel van de generator", () => {
  it.each([2, 3, 4, 5, 6])("geeft bij %i opties per rol altijd één beste en de rest in orde", aantal => {
    const graph = buildDraftGraph(config({ optionsPerRolePerRound: aantal }), { now: 1 })

    for (const [waar, rangen] of verdelingPerRol(graph)) {
      expect(rangen, `${waar}: ${rangen.join(",")}`).toHaveLength(aantal)
      expect(rangen.filter(r => r === "best"), `${waar}: aantal best`).toHaveLength(1)
      // Vanaf drie opties hoort er precies één tweede-beste te zijn; bij twee
      // niet, want dan zou er geen slecht antwoord overblijven.
      expect(rangen.filter(r => r === "good"), `${waar}: aantal good`).toHaveLength(aantal >= 3 ? 1 : 0)
      // De beste staat vooraan en de valkuil achteraan — dat is wat het
      // rijtje leesbaar maakt in de nabespreking.
      expect(rangen[0]).toBe("best")
      expect(rangen[rangen.length - 1]).toBe("wrong")
    }
  })

  it("haalt de kwaliteitsregel en de toelichtingsregel zonder reparatie", () => {
    for (const aantal of [3, 4, 5, 6]) {
      const graph = buildDraftGraph(config({ optionsPerRolePerRound: aantal }), { now: 1 })
      expect(ruleQualityRanking(graph), `${aantal} opties — kwaliteit`).toMatchObject({ ok: true })
      expect(ruleEnoughExplanation(graph), `${aantal} opties — toelichting`).toMatchObject({ ok: true })
    }
  })

  it("geeft elke optie een eigen label, ook bij zes opties per rol", () => {
    // De eerste versie van deze wijziging vulde de middenslots met twee
    // afwisselende teksten; bij zes opties stond dezelfde actie er dan twee
    // keer. Kwaliteit en tekst komen daarom uit aparte indexen.
    const graph = buildDraftGraph(config({ optionsPerRolePerRound: 6 }), { now: 1 })
    for (const node of graph.nodes) {
      if (node.type !== "decision") continue
      const data = node.data as DecisionNodeData
      const perRol = new Map<Role, string[]>()
      for (const o of data.options) {
        if (o.implicit || !o.allowedRole) continue
        perRol.set(o.allowedRole, [...(perRol.get(o.allowedRole) ?? []), o.label])
      }
      for (const [rol, labels] of perRol) {
        expect(new Set(labels).size, `${node.id}|${rol} heeft dubbele labels: ${labels.join(" / ")}`).toBe(labels.length)
      }
    }
  })

  it("vult de velden waarmee je een keuze kunt wegen en uitleggen", () => {
    const graph = buildDraftGraph(config(), { now: 1 })
    for (const node of graph.nodes) {
      if (node.type !== "decision") continue
      const data = node.data as DecisionNodeData
      expect(data.context?.length ?? 0, `${node.id} context`).toBeGreaterThan(80)
      expect(data.facilitatorRationale?.length ?? 0, `${node.id} rationale`).toBeGreaterThan(40)
      for (const o of data.options) {
        if (o.implicit) continue
        expect(`${o.label} ${o.description ?? ""}`.trim().length, `${node.id}/${o.label}`).toBeGreaterThan(80)
      }
    }
  })
})
