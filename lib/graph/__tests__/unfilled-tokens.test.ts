import { describe, expect, it } from "vitest"
import { applyDynamicFill, findUnfilledTokens } from "../dynamic-fill"
import type { ScenarioGraph } from "../types"
import type { ExerciseConfig } from "@/lib/types"

// replaceTokens leaves a token verbatim when the config has no value, so an
// unfilled token reaches a participant as a literal "{{sector}}". This scanner
// has to mirror applyDynamicFill's rules exactly, or it warns about the wrong
// thing: aiPromptTemplate is filled even without dynamic.enabled, and decision
// nodes only take part once some node in the graph is dynamic.

const EMPTY = {} as ExerciseConfig
const FILLED = { sector: "Onderwijs", crownJewels: "leerlinggegevens" } as ExerciseConfig

function graph(nodes: ScenarioGraph["nodes"]): ScenarioGraph {
  return {
    id: "g", name: "g", version: 1, scenarioType: "ransomware_double_extortion",
    nodes, edges: [], createdAt: 0, updatedAt: 0,
  } as unknown as ScenarioGraph
}

type Node = ScenarioGraph["nodes"][number]

function inject(data: Record<string, unknown>): Node {
  return {
    id: "i1", type: "inject", position: { x: 0, y: 0 },
    data: { kind: "inject", type: "alert", urgency: "medium", title: "", content: "", ...data },
  } as unknown as Node
}

function round(data: Record<string, unknown>): Node {
  return {
    id: "r1", type: "round", position: { x: 0, y: 0 },
    data: { kind: "round", title: "", situation_update: "", injects: [], ...data },
  } as unknown as Node
}

function decision(data: Record<string, unknown>): Node {
  return {
    id: "d1", type: "decision", position: { x: 0, y: 0 },
    data: { kind: "decision", prompt: "", options: [], ...data },
  } as unknown as Node
}

describe("findUnfilledTokens", () => {
  it("reports a token the scenario substitutes but the config cannot fill", () => {
    const g = graph([inject({ content: "Het {{sector}}-netwerk ligt eruit.", dynamic: { enabled: true } })])
    expect(findUnfilledTokens(g, EMPTY)).toEqual(["sector"])
  })

  it("stays silent once the config has a value", () => {
    const g = graph([inject({ content: "Het {{sector}}-netwerk ligt eruit.", dynamic: { enabled: true } })])
    expect(findUnfilledTokens(g, FILLED)).toEqual([])
  })

  it("ignores a token in a node that is not dynamic", () => {
    const g = graph([inject({ content: "Het {{sector}}-netwerk ligt eruit." })])
    expect(findUnfilledTokens(g, EMPTY)).toEqual([])
  })

  it("respects fillFrom, which limits which tokens that node substitutes", () => {
    const g = graph([inject({
      content: "{{sector}} en {{crownJewels}}",
      dynamic: { enabled: true, fillFrom: ["crownJewels"] },
    })])
    expect(findUnfilledTokens(g, EMPTY)).toEqual(["crownJewels"])
  })

  it("catches aiPromptTemplate even without dynamic.enabled, because that is filled anyway", () => {
    const g = graph([inject({ aiPromptTemplate: "Schrijf iets over {{companySize}}." })])
    expect(findUnfilledTokens(g, EMPTY)).toEqual(["companySize"])
  })

  it("scans a round's situation_update and opening prompts", () => {
    const g = graph([round({
      situation_update: "{{criticalSystems}} zijn onbereikbaar.",
      openingPrompts: ["Wat betekent dit voor {{crownJewels}}?"],
      dynamic: { enabled: true },
    })])
    expect(findUnfilledTokens(g, EMPTY).sort()).toEqual(["criticalSystems", "crownJewels"])
  })

  // Decision nodes are substituted only when some other node is dynamic, so a
  // graph with a lone decision must not be warned about.
  it("skips decision text when no node in the graph is dynamic", () => {
    const g = graph([decision({ prompt: "Wat doen we met {{sector}}?" })])
    expect(findUnfilledTokens(g, EMPTY)).toEqual([])
  })

  it("scans decision text once another node is dynamic", () => {
    const g = graph([
      inject({ content: "geen tokens", dynamic: { enabled: true } }),
      decision({ prompt: "Wat doen we met {{sector}}?" }),
    ])
    expect(findUnfilledTokens(g, EMPTY)).toEqual(["sector"])
  })

  it("agrees with what actually survives substitution", () => {
    const g = graph([inject({ content: "Het {{sector}}-netwerk ligt eruit.", dynamic: { enabled: true } })])
    const filled = applyDynamicFill(g, EMPTY)
    const content = (filled.nodes[0].data as { content: string }).content
    // The warning is only honest if the literal token really does reach the text.
    expect(content).toContain("{{sector}}")
    expect(findUnfilledTokens(g, EMPTY)).toContain("sector")
  })
})
