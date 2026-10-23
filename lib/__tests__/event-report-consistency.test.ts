import { describe, it, expect } from "vitest"
import { sessionToScoringInput } from "../scoring/graph-adapter"
import { scoreExercise } from "../scoring"
import type { ScenarioGraph } from "../graph/types"
import type { Round, SessionState, SubmittedDecision } from "../types"

// De rapportpagina stuurde een vaste `mode: "ASSESSMENT"` mee. In een
// event-sessie krijgen de beslispunten daarmee plain node-id's, terwijl de
// inzendingen `node::rol` dragen — dus matchte geen enkele inzending en zei het
// rapport "niets te scoren, 0 van 100" terwijl de facilitator en de deelnemer
// 64 van 200 zagen. Issue #105 verbiedt precies die inconsistentie.
//
// Deze test pint vast dat scoren zonder modus-override de inzendingen van een
// event-sessie wél meeneemt. De override terugzetten laat hem falen.

function makeGraph(): ScenarioGraph {
  const option = (id: string, role: "ceo" | "ciso", cont: number) => ({
    id, label: `Optie ${id}`, allowedRole: role,
    outcomeVector: { CONT: cont, FOR: 0, BC: 0, JUR: 0, VER: 0, KOS: 0 },
  })
  return {
    id: "g1",
    name: "Event",
    version: 1,
    scenarioType: "ransomware_double_extortion",
    createdAt: 0,
    updatedAt: 0,
    nodes: [
      { id: "start", type: "start", position: { x: 0, y: 0 }, data: { kind: "start" } },
      {
        id: "round1", type: "round", position: { x: 0, y: 0 },
        data: { kind: "round", title: "Dag 1", situation_update: "", timerMinutes: 10 },
      },
      {
        id: "dec1", type: "decision", position: { x: 0, y: 0 },
        data: {
          kind: "decision", prompt: "Isoleren of doorwerken?", perRole: true,
          options: [option("ceo_a", "ceo", 2), option("ciso_a", "ciso", 1)],
        },
      },
    ],
    edges: [
      { id: "e1", source: "start", target: "round1", type: "sequence" },
      { id: "e2", source: "round1", target: "dec1", type: "sequence" },
    ],
  } as unknown as ScenarioGraph
}

function submission(role: "ceo" | "ciso", actionId: string): SubmittedDecision {
  return {
    participantId: "p1",
    participantName: "UX-testteam",
    role,
    roundIndex: 0,
    actionId,
    actionLabel: `Optie ${actionId}`,
    reasoning: "",
    submittedAt: new Date(1_000_500).toISOString(),
    isWrongRole: false,
    isIrDeviation: false,
    // In event-modus submitteert één device namens de groep.
    groupId: "group_1",
  }
}

function makeEventSession(): SessionState {
  return {
    id: "s1",
    joinCode: "ABC123",
    config: {} as never,
    mode: "event",
    scenario: {
      scenario_title: "Ransomware", scenario_summary: "S",
      rounds: [{ round_number: 1, title: "Dag 1", situation_update: "", injects: [] } as unknown as Round],
    },
    currentRound: 0,
    status: "ended",
    participants: [{ id: "p1", name: "Notulist", role: "ceo", joinedAt: 0, groupId: "group_1" }],
    groups: [{ id: "group_1", name: "UX-testteam", createdAt: 0 }],
    pushedInjects: [],
    timeline: [],
    createdAt: 0,
    startedAt: 0,
    graph: makeGraph(),
    submittedDecisions: [submission("ceo", "ceo_a"), submission("ciso", "ciso_a")],
  } as unknown as SessionState
}

describe("rapport en facilitator scoren een event-sessie gelijk", () => {
  it("telt de inzendingen van een event-sessie mee zonder modus-override", () => {
    const session = makeEventSession()
    const input = sessionToScoringInput(session)
    expect(input).toBeTruthy()
    expect(input!.mode).toBe("EVENT")

    const scored = scoreExercise(input!)
    const round1 = scored.outcomes.find(o => o.round === 1)
    expect(round1?.hasSubmissions).toBe(true)
    expect(scored.totalPoints).toBeGreaterThan(0)
  })

  it("laat zien waarom een vaste ASSESSMENT-modus het rapport op nul zette", () => {
    const session = makeEventSession()
    // Dit is precies wat de rapportpagina deed.
    const forced = sessionToScoringInput(session, { mode: "ASSESSMENT" })!
    const scored = scoreExercise(forced)
    const round1 = scored.outcomes.find(o => o.round === 1)
    // De beslispunt-id's lopen niet gelijk, dus de ronde lijkt onbeantwoord.
    expect(round1?.hasSubmissions).toBe(false)
    expect(scored.totalPoints).toBe(0)
  })
})
