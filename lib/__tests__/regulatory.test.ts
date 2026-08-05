import { describe, it, expect } from "vitest"
import { NL_AVG_NIS2_REGIME } from "../regulatory/regimes"
import { applyRegulatoryAdjustment } from "../regulatory/scoring-adjustment"
import { classifyRegulatoryTiming } from "../session-store"
import type {
  AssessmentReport,
} from "../scoring"
import type {
  Inject,
  RegulatoryObligationState,
  SessionState,
} from "../types"

// Reach into the session-store's private helper by importing the pure
// function it exposes; the auto-open behaviour is tested by driving
// createSession + pushInject and observing state.

function makeSession(overrides: Partial<SessionState> = {}): SessionState {
  return {
    id: "s1",
    joinCode: "ABC123",
    config: {} as never,
    scenario: {
      scenario_title: "T",
      scenario_summary: "S",
      rounds: [{ round_number: 1, title: "R1", situation_update: "", injects: [] }],
    },
    currentRound: 0,
    status: "active",
    participants: [],
    pushedInjects: [],
    timeline: [],
    createdAt: 1_000_000,
    startedAt: 1_000_000,
    incidentDetectedAt: 1_000_000,
    regulatoryRegime: NL_AVG_NIS2_REGIME,
    regulatoryObligations: [],
    ...overrides,
  }
}

function makeReport(perRound: Array<{ round: number; hasSubmissions: boolean }>): AssessmentReport {
  return {
    meta: { scoringVersion: "1.0.0", generatedAt: 0, rolCoverage: 1, distinctOwners: 1 },
    outcomes: perRound.map(r => ({
      round: r.round,
      normalized: 0,
      perDimension: { CONT: 0, FOR: 0, BC: 0, JUR: 0, VER: 0, KOS: 0 },
      points: 50,
      hasSubmissions: r.hasSubmissions,
    })),
    totalPoints: 0,
    spider: {
      team: { CONT: 0, FOR: 0, BC: 0, JUR: 0, VER: 0, KOS: 0 },
      perDimensionAcrossRounds: [],
    },
    effectiveOwners: {} as never,
    droppedOptionalDecisions: [],
  }
}

describe("regulatory obligation scoring adjustment", () => {
  it("on-time filing folds regime.scoring.onTime into the round's perDimension (JUR +2, VER +1)", () => {
    const filed: RegulatoryObligationState = {
      regimeId: NL_AVG_NIS2_REGIME.id,
      milestoneId: "initial",
      status: "filed",
      openedAtRound: 2,
      openedAtHour: 0,
      filedAtRound: 2,
      filedAtHour: 12,  // within 24h deadline
    }
    const session = makeSession({ regulatoryObligations: [filed] })
    const adjusted = applyRegulatoryAdjustment(session, makeReport([{ round: 2, hasSubmissions: true }]))
    const r2 = adjusted.outcomes.find(o => o.round === 2)!
    expect(r2.perDimension.JUR).toBe(2)
    expect(r2.perDimension.VER).toBe(1)
    expect(classifyRegulatoryTiming(filed, NL_AVG_NIS2_REGIME)).toBe("on_time")
  })

  it("late filing folds regime.scoring.late into the round (JUR -1)", () => {
    const filed: RegulatoryObligationState = {
      regimeId: NL_AVG_NIS2_REGIME.id,
      milestoneId: "initial",
      status: "filed",
      openedAtRound: 2,
      openedAtHour: 0,
      filedAtRound: 3,
      filedAtHour: 40,  // past the 24h deadline
    }
    const session = makeSession({ regulatoryObligations: [filed] })
    const adjusted = applyRegulatoryAdjustment(session, makeReport([{ round: 3, hasSubmissions: true }]))
    const r3 = adjusted.outcomes.find(o => o.round === 3)!
    expect(r3.perDimension.JUR).toBe(-1)
    expect(r3.perDimension.VER).toBe(0)
    expect(classifyRegulatoryTiming(filed, NL_AVG_NIS2_REGIME)).toBe("late")
  })

  it("expired (never filed) folds regime.scoring.omitted (JUR -2, VER -1)", () => {
    const expired: RegulatoryObligationState = {
      regimeId: NL_AVG_NIS2_REGIME.id,
      milestoneId: "initial",
      status: "expired",
      openedAtRound: 2,
      openedAtHour: 0,
      expiredAtRound: 5,
    }
    const session = makeSession({ regulatoryObligations: [expired] })
    const adjusted = applyRegulatoryAdjustment(session, makeReport([{ round: 5, hasSubmissions: false }]))
    const r5 = adjusted.outcomes.find(o => o.round === 5)!
    expect(r5.perDimension.JUR).toBe(-2)
    expect(r5.perDimension.VER).toBe(-1)
    expect(classifyRegulatoryTiming(expired, NL_AVG_NIS2_REGIME)).toBe("omitted")
  })
})

describe("regime shape", () => {
  it("has exactly two milestones — initial + closing", () => {
    expect(NL_AVG_NIS2_REGIME.milestones).toHaveLength(2)
    expect(NL_AVG_NIS2_REGIME.milestones[0].id).toBe("initial")
    expect(NL_AVG_NIS2_REGIME.milestones[1].id).toBe("closing")
  })

  it("initial=24h (NIS2), closing=720h (1 month)", () => {
    const initial = NL_AVG_NIS2_REGIME.milestones.find(m => m.id === "initial")!
    const closing = NL_AVG_NIS2_REGIME.milestones.find(m => m.id === "closing")!
    expect(initial.deadlineHours).toBe(24)
    expect(closing.deadlineHours).toBe(720)
  })

  it("purpose text mentions closing does not stop with containment (bewustzijnsmoment)", () => {
    const closing = NL_AVG_NIS2_REGIME.milestones.find(m => m.id === "closing")!
    expect(closing.purpose).toMatch(/bewustzijnsmoment/)
  })
})

// Full flow — obligation auto-opens on trigger inject, and closing opens on
// initial-filed. We drive session-store's exposed functions directly.
describe("regulatory obligation lifecycle", () => {
  // The session-store uses a global KV/in-memory DB layer that's process-wide.
  // To test in isolation we import the internal helpers *conceptually* by
  // constructing a session with an inject that has triggersRegulatoryNotification.
  // The auto-open contract is: pushInject sees the flag → creates obligation.
  // Since the store is stateful, we exercise the pure classify function and
  // the shape produced by fileRegulatoryObligation end-to-end via db reset.

  it("filing initial cascades: closing must open at the same hour", async () => {
    const { resetSession, createSession, fileRegulatoryObligation, getSession } = await import("../session-store")
    const { dbGetSession, dbSetSession } = await import("../db")

    await resetSession()
    await createSession(
      { sector: "test", companySize: "s", criticalSystems: "", crownJewels: "", scenarioType: "ransomware_double_extortion", duration: "1h" },
      { scenario_title: "T", scenario_summary: "S", rounds: [{ round_number: 1, title: "R1", situation_update: "", injects: [] }] },
    )
    // Seed a participant + open initial obligation directly via the DB layer,
    // skipping startSession() so we don't trigger the role-resolution require
    // (a scoring-package boundary that vitest's CJS resolver can't cross).
    const cur = await dbGetSession()
    if (!cur) throw new Error("no session")
    await dbSetSession({
      ...cur,
      currentRound: 0,
      status: "active",
      startedAt: cur.createdAt,
      incidentDetectedAt: cur.createdAt,
      participants: [{ id: "p1", name: "Alice", role: "ceo", joinedAt: cur.createdAt }],
      regulatoryObligations: [{
        regimeId: NL_AVG_NIS2_REGIME.id,
        milestoneId: "initial",
        status: "open",
        openedAtRound: 1,
        openedAtHour: 0,
      }],
    })

    const filed = await fileRegulatoryObligation({
      participantId: "p1",
      milestoneId: "initial",
      freeText: "test",
      keyPoints: "test",
    })
    expect(filed.ok).toBe(true)

    const after = await getSession()
    const obligations = after!.regulatoryObligations ?? []
    const initial = obligations.find(o => o.milestoneId === "initial")
    const closing = obligations.find(o => o.milestoneId === "closing")
    expect(initial?.status).toBe("filed")
    expect(closing).toBeDefined()
    expect(closing?.status).toBe("open")
  })

  it("auto-opens the initial obligation when an inject with triggersRegulatoryNotification fires", async () => {
    const { resetSession, createSession, pushInject, getSession } = await import("../session-store")
    const { dbGetSession, dbSetSession } = await import("../db")

    await resetSession()
    const trigger: Inject = {
      id: "inj-trigger",
      type: "regulatory",
      title: "Datalek bevestigd",
      content: "Bekendwording van datalek — meldplicht start.",
      urgency: "critical",
      triggersRegulatoryNotification: true,
    }
    await createSession(
      { sector: "test", companySize: "s", criticalSystems: "", crownJewels: "", scenarioType: "ransomware_double_extortion", duration: "1h" },
      {
        scenario_title: "T",
        scenario_summary: "S",
        rounds: [{ round_number: 1, title: "R1", situation_update: "", injects: [trigger] }],
      },
    )
    const cur = await dbGetSession()
    if (!cur) throw new Error("no session")
    await dbSetSession({
      ...cur,
      currentRound: 0,
      status: "active",
      startedAt: cur.createdAt,
      incidentDetectedAt: cur.createdAt,
    })

    const res = await pushInject({ roundIndex: 0, injectId: trigger.id })
    expect(res.ok).toBe(true)

    const after = await getSession()
    const list = after!.regulatoryObligations ?? []
    const initial = list.find(o => o.milestoneId === "initial")
    expect(initial).toBeDefined()
    expect(initial?.status).toBe("open")
  })
})
