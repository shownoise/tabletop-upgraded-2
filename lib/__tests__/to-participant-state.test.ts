import { describe, it, expect } from "vitest"
import { toParticipantState } from "../session-store"
import type { SessionState, Round, Inject } from "../types"

function makeInject(id: string, overrides: Partial<Inject> = {}): Inject {
  return {
    id,
    type: "internal",
    title: `Inject ${id}`,
    content: "Body",
    urgency: "medium",
    reliability: "fact",
    groundTruthAnnotations: [{ start: 0, end: 3, label: "misleading" as never }] as never,
    ...overrides,
  }
}

function makeRound(n: number, overrides: Partial<Round> = {}): Round {
  return {
    round_number: n,
    title: `Round ${n}`,
    situation_update: `situation ${n}`,
    injects: [makeInject(`r${n}-i1`)],
    facilitatorNotes: {
      discussionGoal: "GOAL",
      keyQuestions: ["Q1"],
      hints: ["H1"],
      expectedDecisions: ["E1"],
      redFlags: ["R1"],
    },
    roleActions: [
      {
        id: `r${n}-a1`,
        label: "Do the thing",
        description: "desc",
        allowedRoles: ["ceo"],
        irPlanAligned: true,
        facilitatorCommentary: "FAC COMMENT",
        qualityRank: "good" as never,
        lessonLearned: "LESSON",
      } as never,
    ],
    learningObjectives: [
      { id: "o1", text: "Learn X", triggerActionIds: ["r1-a1"], triggerSpecialType: "ransomware_negotiation" } as never,
    ],
    ...overrides,
  }
}

function makeSession(overrides: Partial<SessionState> = {}): SessionState {
  return {
    id: "s1",
    joinCode: "ABC123",
    config: {} as never,
    scenario: {
      scenario_title: "T",
      scenario_summary: "S",
      rounds: [makeRound(1), makeRound(2), makeRound(3)],
    },
    currentRound: 1,
    status: "active",
    participants: [],
    pushedInjects: [],
    timeline: [],
    createdAt: Date.now(),
    roundPhase: "decision",
    governanceFlags: [
      { id: "gf1", type: "wrong_role", roundIndex: 0, participantId: "p1", actionId: "a1", timestamp: Date.now() } as never,
    ],
    submittedDecisions: [
      { participantId: "p1", roundIndex: 0, actionId: "a1", reasoning: "x", isWrongRole: true, isIrDeviation: true, timestamp: Date.now() } as never,
    ],
    ...overrides,
  }
}

describe("toParticipantState", () => {
  it("blanks out situation_update, injects, roleActions, facilitatorNotes on future rounds", () => {
    const scrubbed = toParticipantState(makeSession())
    // rounds[2] is future (currentRound = 1)
    const future = scrubbed.scenario.rounds[2]
    expect(future.situation_update).toBe("")
    expect(future.injects).toEqual([])
    expect(future.roleActions).toBeUndefined()
    expect(future.facilitatorNotes).toBeUndefined()
  })

  it("strips facilitatorNotes on current + past rounds", () => {
    const scrubbed = toParticipantState(makeSession())
    expect(scrubbed.scenario.rounds[0].facilitatorNotes).toBeUndefined()
    expect(scrubbed.scenario.rounds[1].facilitatorNotes).toBeUndefined()
  })

  it("hides facilitatorCommentary/qualityRank/lessonLearned during non-review phase", () => {
    const scrubbed = toParticipantState(makeSession({ roundPhase: "decision" }))
    const action = scrubbed.scenario.rounds[1].roleActions?.[0] as { facilitatorCommentary?: unknown; qualityRank?: unknown; lessonLearned?: unknown } | undefined
    expect(action?.facilitatorCommentary).toBeUndefined()
    expect(action?.qualityRank).toBeUndefined()
    expect(action?.lessonLearned).toBeUndefined()
  })

  it("reveals facilitatorCommentary during review phase", () => {
    const scrubbed = toParticipantState(makeSession({ roundPhase: "review" }))
    const action = scrubbed.scenario.rounds[1].roleActions?.[0] as { facilitatorCommentary?: string } | undefined
    expect(action?.facilitatorCommentary).toBe("FAC COMMENT")
  })

  it("strips inject reliability + groundTruthAnnotations before review", () => {
    const scrubbed = toParticipantState(makeSession({ roundPhase: "decision" }))
    const inject = scrubbed.scenario.rounds[1].injects[0] as { reliability?: unknown; groundTruthAnnotations?: unknown }
    expect(inject.reliability).toBeUndefined()
    expect(inject.groundTruthAnnotations).toBeUndefined()
  })

  it("exposes inject reliability at review phase", () => {
    const scrubbed = toParticipantState(makeSession({ roundPhase: "review" }))
    const inject = scrubbed.scenario.rounds[1].injects[0] as { reliability?: string }
    expect(inject.reliability).toBe("fact")
  })

  it("clears governanceFlags", () => {
    const scrubbed = toParticipantState(makeSession())
    expect(scrubbed.governanceFlags).toEqual([])
  })

  it("nulls out isWrongRole and isIrDeviation on submittedDecisions", () => {
    const scrubbed = toParticipantState(makeSession())
    for (const d of scrubbed.submittedDecisions ?? []) {
      expect(d.isWrongRole).toBe(false)
      expect(d.isIrDeviation).toBe(false)
    }
  })

  it("strips triggerActionIds and triggerSpecialType from learningObjectives", () => {
    const scrubbed = toParticipantState(makeSession())
    const objs = scrubbed.scenario.rounds[1].learningObjectives as Array<{ triggerActionIds?: unknown; triggerSpecialType?: unknown }> | undefined
    expect(objs?.[0]?.triggerActionIds).toBeUndefined()
    expect(objs?.[0]?.triggerSpecialType).toBeUndefined()
  })
})
