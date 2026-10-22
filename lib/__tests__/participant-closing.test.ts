import { describe, it, expect } from "vitest"
import { toParticipantState } from "../session-store"
import { buildParticipantClosing } from "../participant-closing"
import type { ScenarioGraph } from "../graph/types"
import { ROLE_META } from "../types"
import type { Round, SessionState, SubmittedDecision } from "../types"

// A two-round graph with one per-role decision node per round. Each option
// carries an authored outcomeVector, so the closing recap never has to infer.
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
        data: { kind: "round", title: "Eerste melding", situation_update: "", timerMinutes: 10 },
      },
      {
        id: "dec1", type: "decision", position: { x: 0, y: 0 },
        data: {
          kind: "decision", prompt: "Wat doet u?", perRole: true,
          options: [
            {
              id: "opt_isoleren", label: "Direct isoleren", allowedRole: "ceo",
              outcomeVector: { CONT: 2, FOR: -1, BC: -2, JUR: 0, VER: 1, KOS: -1 },
              lessonLearned: "Isoleren dempt de dreiging maar kost continuïteit.",
              facilitatorCommentary: "GEHEIME-FACILITATOR-COMMENTAAR",
            },
            {
              id: "opt_wachten", label: "Afwachten", allowedRole: "ceo",
              outcomeVector: { CONT: -2, FOR: 1, BC: 1, JUR: -1, VER: -1, KOS: 0 },
            },
          ],
        },
      },
      {
        id: "round2", type: "round", position: { x: 0, y: 0 },
        data: { kind: "round", title: "Tweede dag", situation_update: "", timerMinutes: 10 },
      },
    ],
    edges: [
      { id: "e1", source: "start", target: "round1", type: "sequence" },
      { id: "e2", source: "round1", target: "dec1", type: "sequence" },
      { id: "e3", source: "dec1", target: "round2", type: "sequence" },
    ],
  } as unknown as ScenarioGraph
}

function makeRound(n: number, title: string): Round {
  return {
    round_number: n,
    title,
    situation_update: `situatie ${n}`,
    injects: [{
      id: `r${n}-i1`, type: "internal", title: `Inject ${n}`, content: "Body",
      urgency: "medium", facilitatorNote: "GEHEIME-INJECT-NOOT",
    }],
    facilitatorNotes: {
      discussionGoal: "GEHEIM-DISCUSSIEDOEL",
      keyQuestions: ["GEHEIME-VRAAG"],
      hints: ["GEHEIME-HINT"],
      expectedDecisions: [],
      redFlags: [],
    },
  }
}

function makeDecision(overrides: Partial<SubmittedDecision> = {}): SubmittedDecision {
  return {
    participantId: "p1",
    participantName: "Marieke",
    role: "ceo",
    roundIndex: 0,
    actionId: "opt_isoleren",
    actionLabel: "Direct isoleren",
    reasoning: "",
    submittedAt: new Date(1_000_500).toISOString(),
    isWrongRole: false,
    isIrDeviation: false,
    ...overrides,
  }
}

function makeEndedSession(overrides: Partial<SessionState> = {}): SessionState {
  return {
    id: "s1",
    joinCode: "ABC123",
    config: {} as never,
    scenario: {
      scenario_title: "Ransomware",
      scenario_summary: "S",
      rounds: [makeRound(1, "Eerste melding"), makeRound(2, "Tweede dag")],
    },
    currentRound: 1,
    status: "ended",
    participants: [
      { id: "p1", name: "Marieke", role: "ceo", joinedAt: 1_000_000 },
      { id: "p2", name: "Iris", role: "ciso", joinedAt: 1_000_000 },
    ],
    pushedInjects: [],
    timeline: [],
    createdAt: 1_000_000,
    startedAt: 1_000_000,
    graph: makeGraph(),
    submittedDecisions: [makeDecision()],
    ...overrides,
  }
}

describe("participant closing recap", () => {
  it("lists every played round with the participant's own choice", () => {
    const closing = buildParticipantClosing(makeEndedSession(), "p1")
    expect(closing.rounds.map(r => [r.roundNumber, r.title])).toEqual([
      [1, "Eerste melding"],
      [2, "Tweede dag"],
    ])
    expect(closing.rounds[0].choices).toHaveLength(1)
    expect(closing.rounds[0].choices[0].optionLabel).toBe("Direct isoleren")
    // Label from ROLE_META, never the raw enum value.
    expect(closing.rounds[0].choices[0].roleLabel).toBe(ROLE_META.ceo.label)
    expect(closing.rounds[1].choices).toHaveLength(0)
  })

  it("carries the authored six-dimension vector of the chosen option", () => {
    const closing = buildParticipantClosing(makeEndedSession(), "p1")
    expect(closing.rounds[0].choices[0].outcomeVector).toEqual({
      CONT: 2, FOR: -1, BC: -2, JUR: 0, VER: 1, KOS: -1,
    })
  })

  it("reports a session total only over the rounds that were actually submitted", () => {
    const closing = buildParticipantClosing(makeEndedSession(), "p1")
    expect(closing.maxPoints).toBe(100)
    expect(closing.totalPoints).toBeGreaterThan(0)
    expect(closing.totalPoints).toBeLessThanOrEqual(closing.maxPoints!)
    // Round 2 had no submission — no invented score for it.
    expect(closing.rounds[1].points).toBeUndefined()
    expect(closing.rounds[1].perDimension).toBeUndefined()
  })

  it("leaves the total out entirely when nothing was scored", () => {
    const closing = buildParticipantClosing(makeEndedSession({ submittedDecisions: [] }), "p1")
    expect(closing.totalPoints).toBeUndefined()
    expect(closing.maxPoints).toBeUndefined()
    expect(closing.rounds.every(r => r.points === undefined)).toBe(true)
  })

  it("shows a participant their own choice, not someone else's", () => {
    const session = makeEndedSession({
      submittedDecisions: [
        makeDecision(),
        makeDecision({ participantId: "p2", participantName: "Iris", role: "ciso", actionId: "opt_wachten", actionLabel: "Afwachten" }),
      ],
    })
    const mine = buildParticipantClosing(session, "p1")
    expect(mine.rounds[0].choices.map(c => c.optionLabel)).toEqual(["Direct isoleren"])
    const theirs = buildParticipantClosing(session, "p2")
    expect(theirs.rounds[0].choices.map(c => c.optionLabel)).toEqual(["Afwachten"])
  })
})

describe("the end-of-session payload carries no facilitator-only field", () => {
  it("strips facilitator notes, the raw graph and the role resolution", () => {
    const session = makeEndedSession()
    const payload = toParticipantState(session, "p1")
    const raw = JSON.stringify(payload)

    expect(payload.participantClosing).toBeDefined()
    expect(raw).not.toContain("GEHEIME-INJECT-NOOT")
    expect(raw).not.toContain("GEHEIM-DISCUSSIEDOEL")
    expect(raw).not.toContain("GEHEIME-VRAAG")
    expect(raw).not.toContain("GEHEIME-HINT")
    // The graph itself stays stripped even at the end.
    expect(payload.graph?.nodes).toEqual([])
    expect(payload.graphState).toBeUndefined()

    // The recap itself: the scoring output's facilitator-facing parts stay out,
    // and the debrief line is the authored lesson rather than the facilitator's
    // own commentary on the option.
    const recap = JSON.stringify(payload.participantClosing)
    expect(recap).not.toContain("effectiveOwners")
    expect(recap).not.toContain("rolCoverage")
    expect(recap).not.toContain("distinctOwners")
    expect(recap).not.toContain("droppedOptionalDecisions")
    expect(recap).not.toContain("GEHEIME-FACILITATOR-COMMENTAAR")
    expect(recap).toContain("Isoleren dempt de dreiging")
  })

  it("keeps the recap out of the payload while the session is still running", () => {
    const running = toParticipantState(makeEndedSession({ status: "active" }), "p1")
    expect(running.participantClosing).toBeUndefined()
  })

  it("hands out no recap when the caller is not identified", () => {
    expect(toParticipantState(makeEndedSession()).participantClosing).toBeUndefined()
  })
})
