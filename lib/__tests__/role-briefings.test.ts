import { describe, it, expect } from "vitest"
import { validateGraph } from "@/lib/graph/validate"
import type { ScenarioGraph } from "@/lib/graph/types"

function baseGraph(): ScenarioGraph {
  const now = Date.now()
  return {
    id: "g_test",
    name: "briefings-test",
    version: 1,
    scenarioType: "ransomware_double_extortion",
    createdAt: now,
    updatedAt: now,
    nodes: [
      { id: "start", type: "start", position: { x: 0, y: 0 }, data: { kind: "start" } },
      {
        id: "r1", type: "round", position: { x: 200, y: 0 },
        data: {
          kind: "round",
          title: "R1",
          situation_update: "De MDR meldt verdachte activiteit. Er is een discussie over backup-restore.",
          timerMinutes: 15,
        },
      },
      {
        id: "inj1", type: "inject", position: { x: 200, y: 100 },
        data: {
          kind: "inject",
          type: "alert",
          title: "MDR alert",
          content: "Backups zijn nooit hersteld getest — er is geen bewijs dat restore werkt.",
          urgency: "high",
          classification: "feit",
        },
      },
      {
        id: "dec1", type: "decision", position: { x: 400, y: 0 },
        data: {
          kind: "decision",
          prompt: "Wat doen we?",
          measuredBy: "participant_choice",
          perRole: true,
          advancesGraph: false,
          options: [
            { id: "opt1", label: "Isoleren", allowedRole: "ciso", outcomeVector: { CONT: 2, FOR: 0, BC: -1, JUR: 0, VER: 0, KOS: 0 } },
          ],
        },
      },
      {
        id: "out1", type: "outcome", position: { x: 600, y: 0 },
        data: { kind: "outcome", key: "end", label: "Einde", narrative: "" },
      },
    ],
    edges: [
      { id: "e1", source: "start", target: "r1", type: "sequence" },
      { id: "e2", source: "r1", target: "inj1", type: "inject" },
      { id: "e3", source: "r1", target: "dec1", type: "sequence" },
      { id: "e4", source: "dec1", target: "out1", type: "sequence", sourceHandle: "opt1" },
    ],
  }
}

describe("Phase 3 — role briefings validation", () => {
  it("does NOT warn when a briefing's playbook-gap is referenced in inject content", () => {
    const g = baseGraph()
    g.roleBriefings = {
      ciso: {
        text: "Coördineert IR",
        playbookGaps: ["backups nooit hersteld getest"],
      },
    }
    const issues = validateGraph(g)
    const gapWarn = issues.find(i => i.message.includes("Playbook-gap") && i.message.includes("backups"))
    expect(gapWarn).toBeUndefined()
  })

  it("warns when a briefing's playbook-gap does not appear anywhere in the scenario", () => {
    const g = baseGraph()
    g.roleBriefings = {
      ceo: {
        text: "Bestuurlijk",
        playbookGaps: ["iets dat nergens voorkomt in dit hele scenario"],
      },
    }
    const issues = validateGraph(g)
    const gapWarn = issues.find(i => i.severity === "warning" && i.message.includes("Playbook-gap") && i.message.includes("iets"))
    expect(gapWarn).toBeDefined()
  })
})
