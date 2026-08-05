import { describe, it, expect, beforeEach } from "vitest"
import type { OutcomeDimension } from "@/lib/scoring/constants"
import type { ScenarioGraph } from "@/lib/graph/types"
import type { Role, RoleDistributionSnapshot, SessionState } from "@/lib/types"

// Phase 4 — solo/understaffed play. When one participant carries multiple
// (inherited) roles, projectActiveDecision hands them a sequential pending
// queue, and missingDecisionRoles counts each (participantId, role) tuple as
// an independent SLA so DECISION → REVIEW is blocked until every tuple is
// satisfied.

const ALL_SIX_ROLES: Role[] = ['ceo', 'ciso', 'cfo', 'legal', 'head_of_comms', 'ops_manager']

function zeroVector(): Record<OutcomeDimension, number> {
  return { CONT: 0, FOR: 0, BC: 0, JUR: 0, VER: 0, KOS: 0 }
}

function vectorFor(role: Role): Record<OutcomeDimension, number> {
  // Each role gets a distinct outcome vector so the round's perDimension
  // reveals the average across submitted options, not a single vector.
  const dims: OutcomeDimension[] = ['CONT', 'FOR', 'BC', 'JUR', 'VER', 'KOS']
  const seed = ALL_SIX_ROLES.indexOf(role)
  const v = zeroVector()
  v[dims[seed % dims.length]] = 2
  v[dims[(seed + 1) % dims.length]] = -1
  return v
}

function makeGraph(): ScenarioGraph {
  return {
    id: "g_solo",
    name: "solo test graph",
    version: 1,
    scenarioType: "ransomware_double_extortion",
    createdAt: 0,
    updatedAt: 0,
    nodes: [
      { id: "start", type: "start", position: { x: 0, y: 0 }, data: { kind: "start" } },
      {
        id: "r1", type: "round", position: { x: 100, y: 0 },
        data: {
          kind: "round", title: "R1", situation_update: "",
          roleActions: ALL_SIX_ROLES.map(role => ({
            id: `a_${role}`,
            label: `Actie ${role}`,
            description: "",
            allowedRoles: [role],
            irPlanAligned: true,
          })),
        },
      },
      {
        id: "d1", type: "decision", position: { x: 200, y: 0 },
        data: {
          kind: "decision",
          prompt: "Keuze voor jouw rol",
          measuredBy: "participant_choice",
          perRole: true,
          options: ALL_SIX_ROLES.map(role => ({
            id: `opt_${role}`,
            label: `Optie ${role}`,
            allowedRole: role,
            outcomeVector: vectorFor(role),
          })),
        },
      },
    ],
    edges: [
      { id: "e1", source: "start", target: "r1", type: "sequence" },
      { id: "e2", source: "r1", target: "d1", type: "sequence" },
    ],
  }
}

function makeDistribution(entries: Array<{ id: string; name: string; primary: Role; inherited: Role[] }>): RoleDistributionSnapshot {
  return {
    computedAt: 1,
    entries: entries.map(e => ({
      participantId: e.id,
      participantName: e.name,
      primaryRole: e.primary,
      inheritedRoles: e.inherited,
      workload: 1 + e.inherited.length,
    })),
    unassignedRoles: [],
    coverage: 1,
  }
}

async function primeSession(
  distribution: RoleDistributionSnapshot,
  participants: Array<{ id: string; name: string; role: Role }>,
): Promise<void> {
  const { resetSession, createSession } = await import("@/lib/session-store")
  const { dbGetSession, dbSetSession } = await import("@/lib/db")
  await resetSession()
  const graph = makeGraph()
  await createSession(
    { sector: "test", companySize: "s", criticalSystems: "", crownJewels: "", scenarioType: "ransomware_double_extortion", duration: "1h" },
    {
      scenario_title: "Solo",
      scenario_summary: "",
      rounds: [{
        round_number: 1,
        title: "R1",
        situation_update: "",
        injects: [],
        roleActions: (graph.nodes.find(n => n.id === "r1")!.data as { roleActions: unknown }).roleActions as never,
      }],
    },
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
    participants: participants.map(p => ({ id: p.id, name: p.name, role: p.role, joinedAt: cur.createdAt })),
    roleDistribution: distribution,
    graphState: {
      currentNodeId: "d1",
      pathHistory: ["start", "r1", "d1"],
      branchLog: [],
    },
  })
}

async function currentSession(): Promise<SessionState> {
  const { dbGetSession } = await import("@/lib/db")
  const s = await dbGetSession()
  if (!s) throw new Error("no session")
  return s
}

describe("Phase 4 — solo play sequential decision queue", () => {
  beforeEach(async () => {
    const distribution = makeDistribution([
      { id: "p1", name: "Solo", primary: "ceo", inherited: ["ciso", "cfo", "legal", "head_of_comms", "ops_manager"] },
    ])
    await primeSession(distribution, [{ id: "p1", name: "Solo", role: "ceo" }])
  })

  it("projectActiveDecision returns pendingByParticipant with total === (# roles with an option)", async () => {
    const { toParticipantState } = await import("@/lib/session-store")
    const projected = toParticipantState(await currentSession())
    const pending = projected.activeDecision?.pendingByParticipant?.p1
    expect(pending).toBeDefined()
    expect(pending!.total).toBe(6)
    expect(pending!.completed).toBe(0)
    expect(pending!.currentIndex).toBe(0)
    expect(pending!.roleSequence[0]).toBe("ceo")
  })

  it("after submitting the first pending option, currentIndex advances and completed becomes 1", async () => {
    const { submitDecision, toParticipantState } = await import("@/lib/session-store")
    const before = toParticipantState(await currentSession())
    const first = before.activeDecision!.pendingByParticipant!.p1.roleSequence[0]
    expect(first).toBe("ceo")

    const res = await submitDecision({
      participantId: "p1",
      participantName: "Solo",
      roundIndex: 0,
      actionId: "opt_ceo",
      reasoning: "Meer dan twintig karakters uitleg zodat de check niet klaagt over lengte.",
    })
    expect(res.ok).toBe(true)

    const after = toParticipantState(await currentSession())
    const pending = after.activeDecision!.pendingByParticipant!.p1
    expect(pending.completed).toBe(1)
    expect(pending.currentIndex).toBe(1)
    expect(pending.roleSequence[pending.currentIndex]).toBe("ciso")
  })

  it("DECISION → REVIEW transition is blocked until all pending items are submitted", async () => {
    const { setPhase, submitDecision } = await import("@/lib/session-store")

    // Right after prime: nothing submitted — must be blocked.
    let blocked = await setPhase("review")
    expect(blocked.ok).toBe(false)
    expect(blocked.error).toBeDefined()

    // Submit five of six — still blocked because one is missing.
    for (const role of ["ceo", "ciso", "cfo", "legal", "head_of_comms"] as Role[]) {
      const r = await submitDecision({
        participantId: "p1",
        participantName: "Solo",
        roundIndex: 0,
        actionId: `opt_${role}`,
        reasoning: "Meer dan twintig karakters uitleg zodat de check niet klaagt over lengte.",
        activeRole: role,
      })
      expect(r.ok).toBe(true)
    }
    blocked = await setPhase("review")
    expect(blocked.ok).toBe(false)

    // Submit the last — transition now succeeds.
    const last = await submitDecision({
      participantId: "p1",
      participantName: "Solo",
      roundIndex: 0,
      actionId: "opt_ops_manager",
      reasoning: "Meer dan twintig karakters uitleg zodat de check niet klaagt over lengte.",
      activeRole: "ops_manager",
    })
    expect(last.ok).toBe(true)

    const ok = await setPhase("review")
    expect(ok.ok).toBe(true)
  })

  it("participant is omitted from pendingByParticipant once every inherited role is submitted", async () => {
    const { submitDecision, toParticipantState } = await import("@/lib/session-store")
    for (const role of ALL_SIX_ROLES) {
      await submitDecision({
        participantId: "p1",
        participantName: "Solo",
        roundIndex: 0,
        actionId: `opt_${role}`,
        reasoning: "Meer dan twintig karakters uitleg zodat de check niet klaagt over lengte.",
        activeRole: role,
      })
    }
    const projected = toParticipantState(await currentSession())
    expect(projected.activeDecision?.pendingByParticipant?.p1).toBeUndefined()
  })
})

describe("Phase 4 — near-solo (5-for-6) distribution", () => {
  beforeEach(async () => {
    // Five participants for a 6-role scenario. p1 inherits one extra role.
    const distribution = makeDistribution([
      { id: "p1", name: "A", primary: "ceo",           inherited: ["cfo"] },
      { id: "p2", name: "B", primary: "ciso",          inherited: [] },
      { id: "p3", name: "C", primary: "legal",         inherited: [] },
      { id: "p4", name: "D", primary: "head_of_comms", inherited: [] },
      { id: "p5", name: "E", primary: "ops_manager",   inherited: [] },
    ])
    await primeSession(distribution, [
      { id: "p1", name: "A", role: "ceo" },
      { id: "p2", name: "B", role: "ciso" },
      { id: "p3", name: "C", role: "legal" },
      { id: "p4", name: "D", role: "head_of_comms" },
      { id: "p5", name: "E", role: "ops_manager" },
    ])
  })

  it("the inheriting participant has total=2, others have total=1", async () => {
    const { toParticipantState } = await import("@/lib/session-store")
    const projected = toParticipantState(await currentSession())
    const map = projected.activeDecision?.pendingByParticipant ?? {}
    expect(map.p1?.total).toBe(2)
    expect(map.p2?.total).toBe(1)
    expect(map.p3?.total).toBe(1)
    expect(map.p4?.total).toBe(1)
    expect(map.p5?.total).toBe(1)
  })
})

describe("Phase 4 — solo run produces a non-degenerate score profile", () => {
  it("perDimension is the average of submitted vectors and matches expected shape", async () => {
    const { computeRoundOutcome } = await import("@/lib/scoring/outcome-round")
    const { OUTCOME_DIMENSIONS } = await import("@/lib/scoring/constants")

    // Build a scoring-package ScenarioSpec that mirrors the graph above.
    const decisionPoints = ALL_SIX_ROLES.map(role => ({
      id: `dp_${role}`,
      round: 1,
      domain: 'CONTAINMENT' as const,
      designedOwner: role,
      options: [
        { id: `opt_${role}`, label: `Optie ${role}`, outcomeVector: vectorFor(role) },
      ],
    }))

    const scenario = {
      rounds: [{
        number: 1,
        designTimeMinutes: 20,
        outcomeWeights: { CONT: 1, FOR: 1, BC: 1, JUR: 1, VER: 1, KOS: 1 } as Record<OutcomeDimension, number>,
      }],
      decisionPoints,
      injects: [],
    }

    // Solo participant submits every option.
    const events = ALL_SIX_ROLES.map(role => ({
      kind: 'decision_submitted' as const,
      t: 1,
      round: 1,
      decisionPointId: `dp_${role}`,
      optionId: `opt_${role}`,
      by: role,
    }))

    const outcome = computeRoundOutcome(scenario, events, 1)
    expect(outcome.hasSubmissions).toBe(true)

    // Expected: mean across the six per-role vectors, per dimension.
    const expected = zeroVector()
    for (const role of ALL_SIX_ROLES) {
      const v = vectorFor(role)
      for (const d of OUTCOME_DIMENSIONS) expected[d] += v[d]
    }
    for (const d of OUTCOME_DIMENSIONS) expected[d] /= ALL_SIX_ROLES.length

    for (const d of OUTCOME_DIMENSIONS) {
      expect(outcome.perDimension[d]).toBeCloseTo(expected[d], 10)
    }

    // Sanity: not every dimension is zero (options carry distinct non-zero vectors)
    const anyNonZero = OUTCOME_DIMENSIONS.some(d => Math.abs(outcome.perDimension[d]) > 1e-9)
    expect(anyNonZero).toBe(true)

    // Sanity: perDimension is not equal to any single option's vector.
    const singleMatch = ALL_SIX_ROLES.some(role => {
      const v = vectorFor(role)
      return OUTCOME_DIMENSIONS.every(d => Math.abs(v[d] - outcome.perDimension[d]) < 1e-9)
    })
    expect(singleMatch).toBe(false)
  })
})
