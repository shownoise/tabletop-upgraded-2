import { describe, it, expect } from "vitest"
import { toParticipantState } from "../session-store"
import { roundReviewNarrative } from "../scoring/round-review-narrative"
import type { Inject, Round, SessionState } from "../types"

function makeInject(id: string, overrides: Partial<Inject> = {}): Inject {
  return {
    id,
    type: "internal",
    title: `Inject ${id}`,
    content: "Body",
    urgency: "medium",
    ...overrides,
  }
}

function makeRound(n: number, overrides: Partial<Round> = {}): Round {
  return {
    round_number: n,
    title: `Round ${n}`,
    situation_update: `situation ${n}`,
    injects: [makeInject(`r${n}-i1`, { facilitatorNote: "geheim-inject-noot" })],
    facilitatorNotes: {
      discussionGoal: "geheim-round-noot",
      keyQuestions: ["geheim-vraag"],
      hints: ["geheim-tip"],
      expectedDecisions: [],
      redFlags: [],
    },
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
    pushedInjects: [
      { inject: makeInject("p1", { facilitatorNote: "geheim-pushed-noot" }), roundIndex: 1, pushedAt: Date.now() },
    ],
    timeline: [],
    createdAt: Date.now(),
    roundPhase: "decision",
    ...overrides,
  }
}

describe("Phase 4 — facilitator-only fields never reach participants", () => {
  it("strips inject.facilitatorNote in decision phase", () => {
    const scrubbed = toParticipantState(makeSession({ roundPhase: "decision" }))
    const raw = JSON.stringify(scrubbed)
    expect(raw.includes("geheim-inject-noot")).toBe(false)
    expect(raw.includes("geheim-pushed-noot")).toBe(false)
  })

  it("strips inject.facilitatorNote even in review phase", () => {
    const scrubbed = toParticipantState(makeSession({ roundPhase: "review" }))
    const raw = JSON.stringify(scrubbed)
    expect(raw.includes("geheim-inject-noot")).toBe(false)
    expect(raw.includes("geheim-pushed-noot")).toBe(false)
  })

  it("strips round.facilitatorNotes so 'geheim-round-noot' does not appear anywhere", () => {
    const scrubbed = toParticipantState(makeSession())
    const raw = JSON.stringify(scrubbed)
    expect(raw.includes("geheim-round-noot")).toBe(false)
    expect(raw.includes("geheim-vraag")).toBe(false)
    expect(raw.includes("geheim-tip")).toBe(false)
  })
})

describe("Phase 7 — round-review narrative never leaks into participant payload", () => {
  it("the narrative output is not exposed via toParticipantState", () => {
    // Build a session where a submitted decision would generate narrative strings.
    const session: SessionState = {
      id: "s2",
      joinCode: "XYZ789",
      config: {} as never,
      scenario: {
        scenario_title: "T",
        scenario_summary: "",
        rounds: [makeRound(1)],
      },
      currentRound: 0,
      status: "active",
      participants: [{ id: "p1", name: "Iris", role: "ciso", joinedAt: Date.now() }],
      pushedInjects: [],
      timeline: [],
      createdAt: Date.now(),
      roundPhase: "review",
      submittedDecisions: [{
        participantId: "p1",
        participantName: "Iris",
        role: "ciso",
        roundIndex: 0,
        actionId: "opt_narrative_only",
        actionLabel: "narrative-only-choice",
        reasoning: "",
        submittedAt: new Date().toISOString(),
        isWrongRole: false,
        isIrDeviation: false,
      }],
    }
    // Build the narrative directly. If any of these unique strings appear in
    // the participant payload, we have a leak.
    const narrative = roundReviewNarrative(session, 0)
    // The narrative should have at least one line for the submitted decision.
    expect(narrative.lines.length).toBeGreaterThan(0)
    // Snapshot the concatenated narrative and verify nothing from it appears
    // in toParticipantState output.
    const narrativeBlob = [...narrative.lines, ...narrative.omissions].join(" | ")
    const scrubbed = toParticipantState(session)
    const rawScrubbed = JSON.stringify(scrubbed)
    // Split narrative into distinct words ≥6 chars and assert none of the
    // narrative-composed sentences appear whole in the participant payload.
    for (const line of [...narrative.lines, ...narrative.omissions]) {
      expect(rawScrubbed.includes(line)).toBe(false)
    }
    // Sanity — the composite is non-empty; this test only makes sense if it is.
    expect(narrativeBlob.length).toBeGreaterThan(0)
  })
})
