import { describe, it, expect } from "vitest"
import { buildParticipantClosing } from "../participant-closing"
import { sessionToScoringInput } from "../scoring/graph-adapter"
import { scoreDenominator, scoreExercise } from "../scoring"
import type { ScenarioGraph } from "../graph/types"
import type { Round, SessionState, SubmittedDecision } from "../types"

// Issue #105 eist dat deelnemer, facilitator en rapport exact dezelfde noemer
// tonen. Dat kon niet: participant-closing.ts rekende `scoredRounds.length * 100`
// — alleen rondes waarin het team wél indiende. Een gemiste ronde verdween
// daardoor uit de noemer en maakte de score van de deelnemer juist mooier dan
// die van de facilitator.
//
// Deze opstelling is precies het geval waarin de twee implementaties uiteen
// lopen: twee gespeelde rondes die beide een beslismoment hadden, maar maar
// één ingediende keuze.

function makeGraph(): ScenarioGraph {
  const option = (id: string, label: string, cont: number) => ({
    id, label, allowedRole: "ceo" as const,
    outcomeVector: { CONT: cont, FOR: 0, BC: 0, JUR: 0, VER: 0, KOS: 0 },
  })
  return {
    id: "g1",
    name: "Twee beslismomenten",
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
          options: [option("r1_isoleren", "Isoleren", 2), option("r1_wachten", "Wachten", -2)],
        },
      },
      {
        id: "round2", type: "round", position: { x: 0, y: 0 },
        data: { kind: "round", title: "Dag 2", situation_update: "", timerMinutes: 10 },
      },
      {
        id: "dec2", type: "decision", position: { x: 0, y: 0 },
        data: {
          kind: "decision", prompt: "Melden of nog wachten?", perRole: true,
          options: [option("r2_melden", "Melden", 1), option("r2_zwijgen", "Zwijgen", -1)],
        },
      },
    ],
    edges: [
      { id: "e1", source: "start", target: "round1", type: "sequence" },
      { id: "e2", source: "round1", target: "dec1", type: "sequence" },
      { id: "e3", source: "dec1", target: "round2", type: "sequence" },
      { id: "e4", source: "round2", target: "dec2", type: "sequence" },
    ],
  } as unknown as ScenarioGraph
}

function makeRound(n: number, title: string): Round {
  return {
    round_number: n,
    title,
    situation_update: `situatie ${n}`,
    injects: [],
    facilitatorNotes: {
      discussionGoal: "", keyQuestions: [], hints: [], expectedDecisions: [], redFlags: [],
    },
  } as unknown as Round
}

// Alleen ronde 1 is beantwoord. Ronde 2 is wél gespeeld en had wél een
// beslismoment, dus die kans was er en hoort in de noemer.
function makeSession(): SessionState {
  const decision: SubmittedDecision = {
    participantId: "p1",
    participantName: "Marieke",
    role: "ceo",
    roundIndex: 0,
    actionId: "r1_isoleren",
    actionLabel: "Isoleren",
    reasoning: "",
    submittedAt: new Date(1_000_500).toISOString(),
    isWrongRole: false,
    isIrDeviation: false,
  }
  return {
    id: "s1",
    joinCode: "ABC123",
    config: {} as never,
    scenario: {
      scenario_title: "Ransomware",
      scenario_summary: "S",
      rounds: [makeRound(1, "Dag 1"), makeRound(2, "Dag 2")],
    },
    currentRound: 1,
    status: "ended",
    participants: [{ id: "p1", name: "Marieke", role: "ceo", joinedAt: 1_000_000 }],
    pushedInjects: [],
    timeline: [],
    createdAt: 1_000_000,
    startedAt: 1_000_000,
    graph: makeGraph(),
    submittedDecisions: [decision],
  } as unknown as SessionState
}

describe("één noemer voor deelnemer en facilitator", () => {
  it("rekent een gespeelde ronde met beslismoment mee, ook zonder inzending", () => {
    const session = makeSession()
    const input = sessionToScoringInput(session)
    expect(input).toBeTruthy()
    const facilitator = scoreDenominator(input!.scenario, scoreExercise(input!).outcomes, 0)

    // Beide rondes zijn gespeeld en hadden beide een beslismoment.
    expect(facilitator.rounds).toEqual([1, 2])
    expect(facilitator.maxPoints).toBe(200)
    // Alleen ronde 1 is daadwerkelijk beantwoord.
    expect(facilitator.measuredRounds).toEqual([1])
  })

  it("geeft de deelnemer dezelfde noemer als de facilitator", () => {
    const session = makeSession()
    const input = sessionToScoringInput(session)!
    const facilitator = scoreDenominator(input.scenario, scoreExercise(input).outcomes, 0)

    const closing = buildParticipantClosing(session, "p1")

    // Dit is de assertion die op de oude code faalde: `scoredRounds.length * 100`
    // gaf 100, want ronde 2 was niet ingediend en verdween uit de noemer.
    expect(closing.maxPoints).toBe(facilitator.maxPoints)
    expect(closing.maxPoints).toBe(200)
  })

  it("laat de noemer weg zolang er niets is ingediend", () => {
    const session = { ...makeSession(), submittedDecisions: [] } as SessionState
    const closing = buildParticipantClosing(session, "p1")
    // Geen verzonnen "0 van 200": zonder enige inzending is er niets te scoren.
    expect(closing.maxPoints).toBeUndefined()
    expect(closing.totalPoints).toBeUndefined()
  })
})
