import { describe, it, expect } from "vitest"
import { toParticipantState } from "../session-store"
import type { ScenarioGraph } from "../graph/types"
import type { SessionState } from "../types"

// De zes dimensies van een optie zijn ground truth. Vóór de keuze zou het
// meesturen ervan de scoring verklappen: de deelnemer kan dan gewoon de optie
// met de mooiste vector aanklikken. In de review is het juist het gesprek.
//
// Deze test pint die grens vast, omdat hij makkelijk per ongeluk open gaat:
// de vector hangt achter dezelfde poort als facilitatorCommentary, en die
// poort is één `isReview`-ternary in projectActiveDecision.

const VECTOR = { CONT: 2, FOR: -1, BC: -2, JUR: 0, VER: 1, KOS: -1 }

function makeGraph(): ScenarioGraph {
  return {
    id: "g1",
    name: "Test",
    version: 1,
    scenarioType: "ransomware_double_extortion",
    createdAt: 0,
    updatedAt: 0,
    nodes: [
      { id: "start", type: "start", position: { x: 0, y: 0 }, data: { kind: "start" } },
      {
        id: "round1", type: "round", position: { x: 0, y: 0 },
        data: { kind: "round", title: "Ronde 1", situation_update: "", timerMinutes: 10 },
      },
      {
        id: "dec1", type: "decision", position: { x: 0, y: 0 },
        data: {
          kind: "decision", prompt: "Isoleren of doorwerken?", perRole: true,
          options: [{
            id: "opt_isoleren", label: "Direct isoleren", allowedRole: "ceo",
            outcomeVector: VECTOR,
            facilitatorCommentary: "GEHEIM-COMMENTAAR",
          }],
        },
      },
    ],
    edges: [
      { id: "e1", source: "start", target: "round1", type: "sequence" },
      { id: "e2", source: "round1", target: "dec1", type: "sequence" },
    ],
  } as unknown as ScenarioGraph
}

function makeSession(phase: SessionState["roundPhase"]): SessionState {
  return {
    id: "s1",
    joinCode: "ABC123",
    config: {} as never,
    scenario: {
      scenario_title: "Ransomware", scenario_summary: "S",
      rounds: [{ round_number: 1, title: "Ronde 1", situation_update: "", injects: [] }],
    },
    currentRound: 0,
    status: "active",
    roundPhase: phase,
    participants: [{ id: "p1", name: "Marieke", role: "ceo", joinedAt: 0 }],
    pushedInjects: [],
    timeline: [],
    createdAt: 0,
    startedAt: 0,
    graph: makeGraph(),
    graphState: { currentNodeId: "round1", pathHistory: ["start", "round1"] },
  } as unknown as SessionState
}

describe("de zes dimensies van een optie komen pas vrij in de review", () => {
  for (const phase of ["inject", "discussion", "decision"] as const) {
    it(`stuurt geen outcomeVector mee in fase ${phase}`, () => {
      const scrubbed = toParticipantState(makeSession(phase), "p1")
      const options = scrubbed.activeDecision?.options ?? []
      expect(options.length).toBeGreaterThan(0)
      for (const option of options) {
        expect(option.outcomeVector).toBeUndefined()
      }
      // Dubbele zekerheid: ook niet elders in de payload.
      expect(JSON.stringify(scrubbed)).not.toContain("GEHEIM-COMMENTAAR")
    })
  }

  it("stuurt de outcomeVector wel mee in de review-fase", () => {
    const scrubbed = toParticipantState(makeSession("review"), "p1")
    const option = (scrubbed.activeDecision?.options ?? [])[0]
    expect(option).toBeTruthy()
    expect(option.outcomeVector).toEqual(VECTOR)
  })
})
