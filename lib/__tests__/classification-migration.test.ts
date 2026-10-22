import { describe, it, expect } from "vitest"
import {
  classificationFromLegacyReliability,
  migrateGraphClassifications,
  migrateSessionClassifications,
} from "@/lib/classification"
import type { ScenarioGraph, InjectNodeData, PremadeInject } from "@/lib/graph/types"
import type { Inject, Round, SessionState } from "@/lib/types"

function injectNode(id: string, data: Partial<InjectNodeData>) {
  return {
    id,
    type: "inject" as const,
    position: { x: 0, y: 0 },
    data: {
      kind: "inject" as const,
      type: "internal" as const,
      title: `Inject ${id}`,
      content: "Body",
      urgency: "medium" as const,
      ...data,
    } as InjectNodeData,
  }
}

function graphWith(
  nodes: ReturnType<typeof injectNode>[],
  injectLibrary?: PremadeInject[],
): ScenarioGraph {
  return {
    id: "g1",
    name: "G",
    version: 1,
    scenarioType: "ransomware_double_extortion",
    nodes,
    edges: [],
    createdAt: 0,
    updatedAt: 0,
    ...(injectLibrary ? { injectLibrary } : {}),
  } as ScenarioGraph
}

function dataOf(graph: ScenarioGraph, id: string): InjectNodeData {
  return graph.nodes.find(n => n.id === id)!.data as InjectNodeData
}

describe("legacy reliability → classification mapping", () => {
  it("maps fact → feit, assumption → aanname and misleading → aanname", () => {
    expect(classificationFromLegacyReliability("fact")).toBe("feit")
    expect(classificationFromLegacyReliability("assumption")).toBe("aanname")
    expect(classificationFromLegacyReliability("misleading")).toBe("aanname")
  })

  it("leaves unknown or absent legacy values unmapped", () => {
    expect(classificationFromLegacyReliability(undefined)).toBeUndefined()
    expect(classificationFromLegacyReliability("fabel")).toBeUndefined()
  })

  it("fills classification on graph nodes from every legacy reliability value", () => {
    const graph = migrateGraphClassifications(graphWith([
      injectNode("a", { reliability: "fact" }),
      injectNode("b", { reliability: "assumption" }),
      injectNode("c", { reliability: "misleading" }),
    ]))
    expect(dataOf(graph, "a").classification).toBe("feit")
    expect(dataOf(graph, "b").classification).toBe("aanname")
    expect(dataOf(graph, "c").classification).toBe("aanname")
  })

  it("never overwrites a classification the author already set", () => {
    const graph = migrateGraphClassifications(graphWith([
      injectNode("a", { classification: "aanname", reliability: "fact" }),
      injectNode("b", { classification: "feit", reliability: "misleading" }),
    ]))
    expect(dataOf(graph, "a").classification).toBe("aanname")
    expect(dataOf(graph, "b").classification).toBe("feit")
  })

  it("rewrites the removed 'fabel' label to aanname", () => {
    const graph = migrateGraphClassifications(graphWith([
      injectNode("a", { classification: "fabel" as unknown as "aanname" }),
    ]))
    expect(dataOf(graph, "a").classification).toBe("aanname")
  })

  it("migrates injectLibrary entries, not only graph.nodes", () => {
    const graph = migrateGraphClassifications(graphWith(
      [injectNode("a", { reliability: "fact" })],
      [
        { id: "lib-1", label: "L1", channel: "email", title: "T1", content: "C1", reliability: "misleading" } as unknown as PremadeInject,
        { id: "lib-2", label: "L2", channel: "email", title: "T2", content: "C2", classification: "feit", reliability: "misleading" } as unknown as PremadeInject,
        { id: "lib-3", label: "L3", channel: "email", title: "T3", content: "C3", classification: "fabel" } as unknown as PremadeInject,
      ],
    ))
    expect(graph.injectLibrary?.[0].classification).toBe("aanname")
    expect(graph.injectLibrary?.[1].classification).toBe("feit")
    expect(graph.injectLibrary?.[2].classification).toBe("aanname")
  })

  it("returns the identical object when there is nothing to migrate", () => {
    const graph = graphWith([injectNode("a", { classification: "feit" })])
    expect(migrateGraphClassifications(graph)).toBe(graph)
  })
})

describe("migrateSessionClassifications", () => {
  function session(): SessionState {
    const rounds: Round[] = [{
      round_number: 1,
      title: "R1",
      situation_update: "s",
      injects: [
        { id: "i1", type: "internal", title: "I1", content: "c", urgency: "medium", reliability: "misleading" },
        { id: "i2", type: "internal", title: "I2", content: "c", urgency: "medium", classification: "feit", reliability: "misleading" },
      ] as Inject[],
      roleActions: [{
        id: "a1",
        label: "A",
        description: "d",
        allowedRoles: [],
        irPlanAligned: true,
        pushesInject: { title: "P", content: "c", reliability: "assumption" as const },
      }],
    }]
    return {
      id: "s1",
      joinCode: "ABC123",
      config: {} as SessionState["config"],
      scenario: { scenario_title: "T", rounds } as unknown as SessionState["scenario"],
      currentRound: 0,
      status: "active",
      participants: [],
      pushedInjects: [{
        inject: { id: "p1", type: "alert", title: "P1", content: "c", urgency: "high", reliability: "fact" } as Inject,
        roundIndex: -1,
        pushedAt: 0,
      }],
      timeline: [],
      createdAt: 0,
      graph: graphWith([injectNode("n1", { reliability: "assumption" })]),
    }
  }

  it("migrates materialised round injects, pushed injects and the embedded graph", () => {
    const s = migrateSessionClassifications(session())
    expect(s.scenario.rounds[0].injects[0].classification).toBe("aanname")
    expect(s.scenario.rounds[0].injects[1].classification).toBe("feit")
    expect(s.pushedInjects[0].inject.classification).toBe("feit")
    expect(dataOf(s.graph!, "n1").classification).toBe("aanname")
  })

  it("migrates the inject a role action pushes", () => {
    const s = migrateSessionClassifications(session())
    expect(s.scenario.rounds[0].roleActions?.[0].pushesInject?.classification).toBe("aanname")
  })

  it("is lossless: no inject that carried a legacy value ends up unclassified", () => {
    const s = migrateSessionClassifications(session())
    const all = [
      ...s.scenario.rounds.flatMap(r => r.injects),
      ...s.pushedInjects.map(p => p.inject),
    ]
    for (const inj of all) {
      if (inj.reliability !== undefined) expect(inj.classification).toBeDefined()
    }
  })
})
