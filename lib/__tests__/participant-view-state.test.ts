import { describe, it, expect } from "vitest"
import { toParticipantState } from "../session-store"
import type { SessionState, Round } from "../types"

function makeRound(n: number, overrides: Partial<Round> = {}): Round {
  return {
    round_number: n,
    title: `Round ${n}`,
    situation_update: `situation ${n}`,
    injects: [],
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
      rounds: [makeRound(1), makeRound(2)],
    },
    currentRound: 0,
    status: "active",
    participants: [
      { id: "pA", name: "Alice", joinedAt: Date.now() },
      { id: "pB", name: "Bob", joinedAt: Date.now() },
    ],
    pushedInjects: [],
    timeline: [],
    createdAt: Date.now(),
    participantViewState: {
      pA: { hidden: ["injA1", "injA2"], handled: ["injA3"] },
      pB: { hidden: ["injB1"], handled: [] },
    },
    ...overrides,
  }
}

describe("Phase 6 — participantViewState isolation", () => {
  it("participant A never sees participant B's view state", () => {
    const projA = toParticipantState(makeSession(), "pA")
    const raw = JSON.stringify(projA)
    // A's own ids are fine (they should be present in A's projection)
    expect(raw.includes("injA1")).toBe(true)
    // B's ids must NOT appear
    expect(raw.includes("injB1")).toBe(false)
    expect(projA.participantViewState?.pB).toBeUndefined()
    expect(projA.participantViewState?.pA?.hidden).toEqual(["injA1", "injA2"])
  })

  it("without a participantId hint, no view state at all is exposed", () => {
    const proj = toParticipantState(makeSession())
    expect(proj.participantViewState).toBeUndefined()
    const raw = JSON.stringify(proj)
    expect(raw.includes("injA1")).toBe(false)
    expect(raw.includes("injB1")).toBe(false)
  })

  it("participant with no entry gets undefined map (not an empty leak)", () => {
    const proj = toParticipantState(makeSession(), "unknown-participant")
    expect(proj.participantViewState).toBeUndefined()
  })
})
