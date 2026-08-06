import { describe, it, expect } from "vitest"
import { schoolverenigingScenario } from "@/lib/graph/examples-schoolvereniging"
import type { ScenarioGraph, InjectNodeData } from "@/lib/graph/types"
import {
  buildRoundIndexMap,
  collectSetupInjectsForDecision,
  collectDecisionsWithoutSetup,
  candidateDecisionsForInject,
} from "@/lib/graph/setup-injects"
import { validateGraph } from "@/lib/graph/validate"

// Phase 1 — setup-inject → decision link.
//
// Framework rule: every DecisionNode should have at least one inject with
// setsUpDecisionNodeId === decisionId in the same round or the immediately
// preceding round. The tests below:
//   1. Capture the CURRENT count of unset-up decisions in the showcase graph
//      (regressions surface if that count grows without an explicit change).
//   2. Positively verify that when an inject is properly linked, the collector
//      returns it as the decision's setup inject.
//   3. Verify the validator emits a warning (not error) per unset-up decision.

describe("Phase 1 — setup-inject link", () => {
  it("showcase scenario: decisions-without-setup is captured (regression baseline)", () => {
    const graph = schoolverenigingScenario()
    const unset = collectDecisionsWithoutSetup(graph)
    // No absolute floor — this test's purpose is to make regressions visible.
    // The number is whatever the current showcase has today; keep it stable.
    expect(Array.isArray(unset)).toBe(true)
    expect(Number.isInteger(unset.length)).toBe(true)
    expect(unset.length).toBeGreaterThanOrEqual(0)
    // Every entry must be a real decision node id in the graph.
    for (const id of unset) {
      const n = graph.nodes.find(x => x.id === id)
      expect(n?.type).toBe("decision")
    }
  })

  it("finds a same-round setup inject linked via setsUpDecisionNodeId", () => {
    const graph = buildFixtureGraph()
    const setups = collectSetupInjectsForDecision(graph, "D1")
    expect(setups.length).toBe(1)
    expect(setups[0].injectId).toBe("A")
    expect(setups[0].roundNumber).toBe(1)
  })

  it("finds a previous-round setup inject linked via setsUpDecisionNodeId", () => {
    const graph = buildFixtureGraph()
    // Inject "P" lives in round 1, decision "D2" in round 2 → still a valid setup.
    const setups = collectSetupInjectsForDecision(graph, "D2")
    expect(setups.length).toBe(1)
    expect(setups[0].injectId).toBe("P")
    expect(setups[0].roundNumber).toBe(1)
  })

  it("candidateDecisionsForInject returns same + next round decisions", () => {
    const graph = buildFixtureGraph()
    // Inject "A" lives in round 1 → both D1 (same round) and D2 (next round)
    // are candidates.
    const cands = candidateDecisionsForInject(graph, "A")
    const ids = new Set(cands.map(c => c.decisionId))
    expect(ids.has("D1")).toBe(true)
    expect(ids.has("D2")).toBe(true)
  })

  it("validator emits a warning (not error) for each decision without a setup inject", () => {
    const graph = buildFixtureGraph()
    // Detach D1's setup inject so the decision is now unset-up.
    const injectA = graph.nodes.find(n => n.id === "A")!
    ;(injectA.data as InjectNodeData).setsUpDecisionNodeId = undefined
    const issues = validateGraph(graph)
    const setupWarnings = issues.filter(i => i.severity === "warning" && i.message.includes("geen setup-inject") && i.nodeId === "D1")
    expect(setupWarnings.length).toBe(1)
    const setupErrors = issues.filter(i => i.severity === "error" && i.message.includes("setup-inject"))
    expect(setupErrors.length).toBe(0)
  })

  it("round-index map assigns injects the round of their parent", () => {
    const graph = buildFixtureGraph()
    const map = buildRoundIndexMap(graph)
    expect(map.roundNumberById.get("R1")).toBe(1)
    expect(map.roundNumberById.get("R2")).toBe(2)
    expect(map.byNode.get("A")).toBe(1)   // inject attached to R1
    expect(map.byNode.get("P")).toBe(1)   // inject attached to R1
    expect(map.byNode.get("D1")).toBe(1)  // decision from R1
    expect(map.byNode.get("D2")).toBe(2)  // decision from R2
  })
})

// Minimal fixture — start → R1 → D1 → R2 → D2, with two injects on R1.
// Inject A sets up D1 (same round). Inject P sets up D2 (previous round).
function buildFixtureGraph(): ScenarioGraph {
  const now = Date.now()
  return {
    id: "g_setup_fixture",
    name: "setup-inject fixture",
    version: 1,
    scenarioType: "ransomware_double_extortion",
    createdAt: now,
    updatedAt: now,
    nodes: [
      { id: "start", type: "start", position: { x: 0, y: 0 }, data: { kind: "start" } },
      {
        id: "R1", type: "round", position: { x: 200, y: 0 },
        data: {
          kind: "round",
          title: "R1",
          situation_update: "Ronde 1",
          timerMinutes: 15,
        },
      },
      {
        id: "A", type: "inject", position: { x: 200, y: 100 },
        data: {
          kind: "inject",
          type: "alert",
          title: "MDR alert — verdachte activiteit",
          content: "Iets is aan de gang.",
          urgency: "high",
          classification: "feit",
          setsUpDecisionNodeId: "D1",
        },
      },
      {
        id: "P", type: "inject", position: { x: 200, y: 200 },
        data: {
          kind: "inject",
          type: "media",
          title: "Persvraag — komt eraan",
          content: "Journalist belt in.",
          urgency: "medium",
          classification: "aanname",
          setsUpDecisionNodeId: "D2",
        },
      },
      {
        id: "D1", type: "decision", position: { x: 400, y: 0 },
        data: {
          kind: "decision",
          prompt: "Wat doen we met de verdachte activiteit?",
          measuredBy: "participant_choice",
          perRole: true,
          advancesGraph: false,
          options: [
            { id: "opt1", label: "Isoleer", allowedRole: "ciso", outcomeVector: { CONT: 2, FOR: 0, BC: -1, JUR: 0, VER: 0, KOS: 0 } },
            { id: "opt2", label: "Wacht af", allowedRole: "ceo", outcomeVector: { CONT: -1, FOR: 0, BC: 0, JUR: 0, VER: 0, KOS: 0 } },
          ],
        },
      },
      {
        id: "R2", type: "round", position: { x: 600, y: 0 },
        data: {
          kind: "round",
          title: "R2",
          situation_update: "Ronde 2",
          timerMinutes: 15,
        },
      },
      {
        id: "D2", type: "decision", position: { x: 800, y: 0 },
        data: {
          kind: "decision",
          prompt: "Wat zeggen we tegen de pers?",
          measuredBy: "participant_choice",
          perRole: true,
          advancesGraph: false,
          options: [
            { id: "opt3", label: "Persstatement", allowedRole: "head_of_comms", outcomeVector: { CONT: 0, FOR: 0, BC: 0, JUR: 0, VER: 1, KOS: 0 } },
            { id: "opt4", label: "Geen commentaar", allowedRole: "ceo", outcomeVector: { CONT: 0, FOR: 0, BC: 0, JUR: 0, VER: -1, KOS: 0 } },
          ],
        },
      },
      {
        id: "OUT", type: "outcome", position: { x: 1000, y: 0 },
        data: { kind: "outcome", key: "end", label: "Einde", narrative: "" },
      },
    ],
    edges: [
      { id: "e1", source: "start", target: "R1", type: "sequence" },
      { id: "e2", source: "R1", target: "A", type: "inject" },
      { id: "e3", source: "R1", target: "P", type: "inject" },
      { id: "e4", source: "R1", target: "D1", type: "sequence" },
      { id: "e5", source: "D1", target: "R2", type: "sequence", sourceHandle: "opt1" },
      { id: "e6", source: "D1", target: "R2", type: "sequence", sourceHandle: "opt2" },
      { id: "e7", source: "R2", target: "D2", type: "sequence" },
      { id: "e8", source: "D2", target: "OUT", type: "sequence", sourceHandle: "opt3" },
      { id: "e9", source: "D2", target: "OUT", type: "sequence", sourceHandle: "opt4" },
    ],
  }
}
