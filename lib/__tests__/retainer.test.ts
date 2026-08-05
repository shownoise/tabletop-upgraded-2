import { describe, it, expect, beforeEach } from "vitest"
import { retainerAdvice } from "@/lib/scoring/retainer-advice"
import { RETAINER_ACTIVATED_FLAG } from "@/lib/graph/types"
import type { ScenarioGraph } from "@/lib/graph/types"
import type { SessionState } from "@/lib/types"

// Phase 3 — the retainer-activation option is a session-scoped DecisionNode
// option that (a) sets the RETAINER_ACTIVATED_FLAG capability, (b) is consumed
// once submitted, (c) unlocks downstream injects/options gated on that flag,
// and (d) yields three distinct advice signatures in the review reveal.

function makeMinimalGraph(): ScenarioGraph {
  // One round → one decision node with three options:
  //   • retainer-activate — capabilityFlag + consumesOptionAfterUse
  //   • plain-option      — normal
  //   • gated-option      — requiresCapability: retainer_activated
  return {
    id: "g_test",
    name: "test graph",
    version: 1,
    scenarioType: "ransomware_double_extortion",
    createdAt: 0,
    updatedAt: 0,
    nodes: [
      { id: "start", type: "start", position: { x: 0, y: 0 }, data: { kind: "start" } },
      {
        id: "r1", type: "round", position: { x: 100, y: 0 },
        data: { kind: "round", title: "R1", situation_update: "" },
      },
      {
        id: "d1", type: "decision", position: { x: 200, y: 0 },
        data: {
          kind: "decision",
          prompt: "kies",
          measuredBy: "participant_choice",
          perRole: true,
          options: [
            {
              id: "opt-retainer",
              label: "Eye Security-retainer activeren",
              allowedRole: "ciso",
              outcomeVector: { CONT: 1, FOR: 2, BC: 0, JUR: 0, VER: 0, KOS: 0 },
              capabilityFlag: RETAINER_ACTIVATED_FLAG,
              consumesOptionAfterUse: true,
            },
            {
              id: "opt-plain",
              label: "Iets anders doen",
              allowedRole: "ciso",
              outcomeVector: { CONT: 0, FOR: 0, BC: 0, JUR: 0, VER: 0, KOS: 0 },
            },
            {
              id: "opt-gated",
              label: "Alleen met retainer beschikbaar",
              allowedRole: "ciso",
              outcomeVector: { CONT: 1, FOR: 1, BC: 0, JUR: 0, VER: 0, KOS: 0 },
              requiresCapability: RETAINER_ACTIVATED_FLAG,
            },
          ],
        },
      },
    ],
    edges: [
      { id: "e1", source: "start", target: "r1", type: "sequence" },
      { id: "e2", source: "r1", target: "d1", type: "sequence" },
    ],
  }
}

async function primeSession(): Promise<void> {
  const { resetSession, createSession } = await import("@/lib/session-store")
  const { dbGetSession, dbSetSession } = await import("@/lib/db")
  await resetSession()
  const graph = makeMinimalGraph()
  await createSession(
    { sector: "test", companySize: "s", criticalSystems: "", crownJewels: "", scenarioType: "ransomware_double_extortion", duration: "1h" },
    { scenario_title: "T", scenario_summary: "S", rounds: [{ round_number: 1, title: "R1", situation_update: "", injects: [] }] },
    "training",
    [],
    graph,
  )
  const cur = await dbGetSession()
  if (!cur) throw new Error("no session")
  await dbSetSession({
    ...cur,
    currentRound: 0,
    status: "active",
    roundPhase: "decision",
    startedAt: cur.createdAt,
    participants: [
      { id: "p1", name: "Alice", role: "ciso", joinedAt: cur.createdAt },
      { id: "p2", name: "Bob",   role: "ciso", joinedAt: cur.createdAt },
    ],
    graphState: {
      currentNodeId: "d1",
      pathHistory: ["start", "r1", "d1"],
      branchLog: [],
    },
  })
}

describe("retainerAdvice() — three timings, three signatures", () => {
  it("round 1-2 activation → good tone with 'vroeg geactiveerd'", () => {
    const advice = retainerAdvice({
      retainerActivation: { activatedAtRound: 1, activatedByParticipantId: "p1", activatedAtTs: 1 },
    })
    expect(advice.tone).toBe("good")
    expect(advice.text).toMatch(/vroeg geactiveerd/)
    expect(advice.text).toMatch(/ronde 1/)
  })

  it("round 3+ activation → warn tone with 'laat geactiveerd'", () => {
    const advice = retainerAdvice({
      retainerActivation: { activatedAtRound: 3, activatedByParticipantId: "p1", activatedAtTs: 1 },
    })
    expect(advice.tone).toBe("warn")
    expect(advice.text).toMatch(/laat geactiveerd/)
    expect(advice.text).toMatch(/ronde 3/)
  })

  it("never activated → bad tone with 'niet geactiveerd'", () => {
    const advice = retainerAdvice({ retainerActivation: undefined })
    expect(advice.tone).toBe("bad")
    expect(advice.text).toMatch(/niet geactiveerd/)
  })

  it("three timings produce three distinct text signatures", () => {
    const a = retainerAdvice({ retainerActivation: { activatedAtRound: 1, activatedByParticipantId: "p1", activatedAtTs: 1 } }).text
    const b = retainerAdvice({ retainerActivation: { activatedAtRound: 3, activatedByParticipantId: "p1", activatedAtTs: 1 } }).text
    const c = retainerAdvice({ retainerActivation: undefined }).text
    expect(new Set([a, b, c]).size).toBe(3)
  })
})

describe("submitDecision — capability side-effects", () => {
  beforeEach(async () => {
    await primeSession()
  })

  it("submitting an option with capabilityFlag sets session.flags[flag] and populates retainerActivation", async () => {
    const { submitDecision, getSession } = await import("@/lib/session-store")
    const result = await submitDecision({
      participantId: "p1",
      participantName: "Alice",
      roundIndex: 0,
      actionId: "opt-retainer",
      reasoning: "We bellen Eye Security direct — meer dan twintig karakters uitleg.",
    })
    expect(result.ok).toBe(true)
    const session = await getSession()
    expect(session?.flags?.[RETAINER_ACTIVATED_FLAG]).toBe(true)
    expect(session?.retainerActivation).toBeDefined()
    expect(session?.retainerActivation?.activatedByParticipantId).toBe("p1")
    // currentRound=0, so 1-based round = 1.
    expect(session?.retainerActivation?.activatedAtRound).toBe(1)
    expect(typeof session?.retainerActivation?.activatedAtTs).toBe("number")
  })

  it("submitting a non-capability option does not touch flags or retainerActivation", async () => {
    const { submitDecision, getSession } = await import("@/lib/session-store")
    const result = await submitDecision({
      participantId: "p1",
      participantName: "Alice",
      roundIndex: 0,
      actionId: "opt-plain",
      reasoning: "Doen we iets anders — meer dan twintig karakters aan uitleg.",
    })
    expect(result.ok).toBe(true)
    const session = await getSession()
    expect(session?.flags?.[RETAINER_ACTIVATED_FLAG]).toBeFalsy()
    expect(session?.retainerActivation).toBeUndefined()
  })
})

describe("activeDecision projection — option filtering", () => {
  beforeEach(async () => {
    await primeSession()
  })

  it("options with requiresCapability are hidden until the flag is set", async () => {
    const { getSession } = await import("@/lib/session-store")
    const { toParticipantState } = await import("@/lib/session-store")
    const before = await getSession()
    const projectedBefore = toParticipantState(before!)
    const optIdsBefore = new Set(projectedBefore.activeDecision?.options.map(o => o.optionId) ?? [])
    expect(optIdsBefore.has("opt-retainer")).toBe(true)
    expect(optIdsBefore.has("opt-plain")).toBe(true)
    // Gated option is hidden — flag is not set yet.
    expect(optIdsBefore.has("opt-gated")).toBe(false)
  })

  it("options with requiresCapability appear after the flag is set", async () => {
    const { submitDecision, getSession, toParticipantState } = await import("@/lib/session-store")
    await submitDecision({
      participantId: "p1",
      participantName: "Alice",
      roundIndex: 0,
      actionId: "opt-retainer",
      reasoning: "We bellen Eye Security direct — meer dan twintig karakters uitleg.",
    })
    const after = await getSession()
    const projectedAfter = toParticipantState(after!)
    const optIdsAfter = new Set(projectedAfter.activeDecision?.options.map(o => o.optionId) ?? [])
    expect(optIdsAfter.has("opt-gated")).toBe(true)
    // consumesOptionAfterUse: opt-retainer is now gone from the visible set.
    expect(optIdsAfter.has("opt-retainer")).toBe(false)
    // Non-consuming plain option stays around.
    expect(optIdsAfter.has("opt-plain")).toBe(true)
  })

  it("consumed option is only removed from future presentations — historical submission remains", async () => {
    const { submitDecision, getSession } = await import("@/lib/session-store")
    await submitDecision({
      participantId: "p1",
      participantName: "Alice",
      roundIndex: 0,
      actionId: "opt-retainer",
      reasoning: "We bellen Eye Security direct — meer dan twintig karakters uitleg.",
    })
    const session = await getSession()
    // The submission is still in submittedDecisions — filtering only affects
    // future projections of activeDecision.
    const submitted = session?.submittedDecisions ?? []
    expect(submitted.find(d => d.actionId === "opt-retainer")).toBeDefined()
  })
})

describe("participant inject visibility — requiresCapability", () => {
  beforeEach(async () => {
    await primeSession()
  })

  async function pushWithFlag(inject: Partial<SessionState["pushedInjects"][number]["inject"]>, roundIndex: number) {
    const { dbGetSession, dbSetSession } = await import("@/lib/db")
    const cur = await dbGetSession()
    if (!cur) throw new Error("no session")
    await dbSetSession({
      ...cur,
      pushedInjects: [
        ...cur.pushedInjects,
        {
          inject: {
            id: "inj-forensic",
            type: "intel",
            title: "Forensisch rapport",
            content: "Alleen zichtbaar met retainer.",
            urgency: "medium",
            requiresCapability: RETAINER_ACTIVATED_FLAG,
            ...inject,
          },
          roundIndex,
          pushedAt: Date.now(),
        },
      ],
    })
  }

  it("inject with requiresCapability is hidden before the flag is set", async () => {
    await pushWithFlag({}, 0)
    const { getSession, toParticipantState } = await import("@/lib/session-store")
    const cur = await getSession()
    const projected = toParticipantState(cur!)
    const ids = projected.pushedInjects.map(p => p.inject.id)
    expect(ids.includes("inj-forensic")).toBe(false)
  })

  it("inject with requiresCapability becomes visible after the flag is set", async () => {
    await pushWithFlag({}, 0)
    const { submitDecision, getSession, toParticipantState } = await import("@/lib/session-store")
    await submitDecision({
      participantId: "p1",
      participantName: "Alice",
      roundIndex: 0,
      actionId: "opt-retainer",
      reasoning: "We bellen Eye Security direct — meer dan twintig karakters uitleg.",
    })
    const cur = await getSession()
    const projected = toParticipantState(cur!)
    const ids = projected.pushedInjects.map(p => p.inject.id)
    expect(ids.includes("inj-forensic")).toBe(true)
  })
})
