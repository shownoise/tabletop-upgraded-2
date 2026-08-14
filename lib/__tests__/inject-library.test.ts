import { describe, it, expect } from "vitest"
import { sessionToScoringInput } from "@/lib/scoring/graph-adapter"
import { scoreExercise } from "@/lib/scoring/score-exercise"
import type { PremadeInject, ScenarioGraph } from "@/lib/graph/types"
import type { Inject, SessionState, TimelineEvent } from "@/lib/types"

// Phase 5 — the ruis-inject library is CONTEXT ONLY. Firing library injects
// during play must not shift any scoring axis. The timeline must also carry a
// libraryId tag so the review can attribute noise events to the facilitator.

const library: PremadeInject[] = [
  {
    id: "lib1",
    label: "Ouder belt",
    channel: "phone",
    urgency: "medium",
    classification: "aanname",
    title: "Ouder belt",
    content: "Bezorgd over TikTok",
  },
  {
    id: "lib2",
    label: "LinkedIn post",
    channel: "news",
    urgency: "low",
    classification: "aanname",
    title: "LinkedIn post",
    content: "Verkeerde regio",
  },
  {
    id: "lib3",
    label: "MSP update",
    channel: "system_alert",
    urgency: "medium",
    classification: "feit",
    title: "MSP update",
    content: "Tweede systeem geïsoleerd",
  },
]

function makeGraph(): ScenarioGraph {
  const now = 0
  return {
    id: "g_lib_test",
    name: "library scoring guard",
    version: 1,
    scenarioType: "ransomware_double_extortion",
    createdAt: now,
    updatedAt: now,
    nodes: [
      { id: "start", type: "start", position: { x: 0, y: 0 }, data: { kind: "start" } },
      {
        id: "r1", type: "round", position: { x: 100, y: 0 },
        data: { kind: "round", title: "R1", situation_update: "" },
      },
      {
        id: "r2", type: "round", position: { x: 200, y: 0 },
        data: { kind: "round", title: "R2", situation_update: "" },
      },
      {
        id: "d1", type: "decision", position: { x: 300, y: 0 },
        data: {
          kind: "decision",
          prompt: "kies",
          measuredBy: "participant_choice",
          perRole: true,
          options: [
            {
              id: "opt-a",
              label: "Actie A",
              allowedRole: "ciso",
              outcomeVector: { CONT: 1, FOR: 0, BC: 0, JUR: 0, VER: 0, KOS: 0 },
            },
          ],
        },
      },
    ],
    edges: [
      { id: "e1", source: "start", target: "r1", type: "sequence" },
      { id: "e2", source: "r1", target: "r2", type: "sequence" },
      { id: "e3", source: "r2", target: "d1", type: "sequence" },
    ],
    injectLibrary: library,
  }
}

function baseSession(graph: ScenarioGraph): SessionState {
  const created = 1_000_000
  return {
    id: "sess-lib",
    joinCode: "TEST01",
    status: "active",
    currentRound: 1,
    roundPhase: "discussion",
    createdAt: created,
    startedAt: created,
    participants: [
      { id: "p1", name: "Alice", role: "ciso", joinedAt: created },
    ],
    timeline: [],
    pushedInjects: [],
    submittedDecisions: [
      {
        participantId: "p1",
        participantName: "Alice",
        role: "ciso",
        roundIndex: 1,
        actionId: "opt-a",
        actionLabel: "Actie A",
        reasoning: "test",
        submittedAt: new Date(created + 60_000).toISOString(),
        isWrongRole: false,
        isIrDeviation: false,
      },
    ],
    graph,
    scenario: {
      scenario_title: "T",
      scenario_summary: "S",
      rounds: [
        { round_number: 1, title: "R1", situation_update: "", injects: [] },
        { round_number: 2, title: "R2", situation_update: "", injects: [] },
      ],
    },
    config: {
      sector: "test",
      companySize: "s",
      criticalSystems: "",
      crownJewels: "",
      scenarioType: "ransomware_double_extortion",
      duration: "1h",
    },
    mode: "training",
  } as unknown as SessionState
}

function fireLibraryInject(
  session: SessionState,
  libEntry: PremadeInject,
  atTs: number,
): SessionState {
  const inject: Inject = {
    id: `surp_${libEntry.id}`,
    type: "alert",
    channel: libEntry.channel,
    title: libEntry.title,
    content: libEntry.content,
    urgency: libEntry.urgency ?? "medium",
    source: "Facilitator",
    senderName: libEntry.senderName ?? "Facilitator",
    timestamp: new Date(atTs).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    ...(libEntry.classification ? { classification: libEntry.classification } : {}),
    ...(libEntry.targetRoles && libEntry.targetRoles.length > 0 ? { targetRoles: libEntry.targetRoles } : {}),
  }
  const timelineEntry: TimelineEvent = {
    id: `tl_${libEntry.id}`,
    timestamp: atTs,
    type: "surprise_inject",
    data: { inject, libraryId: libEntry.id },
  }
  return {
    ...session,
    pushedInjects: [
      ...session.pushedInjects,
      { inject, roundIndex: -1, pushedAt: atTs },
    ],
    timeline: [...session.timeline, timelineEntry],
  }
}

describe("Phase 5 — library injects are context only, never scoring", () => {
  it("scoring outcome is identical whether or not library injects were fired", () => {
    const g = makeGraph()

    // Baseline session — no library injects fired.
    const baseline = baseSession(g)
    const baselineInput = sessionToScoringInput(baseline)
    expect(baselineInput).not.toBeNull()
    const baselineOut = scoreExercise(baselineInput!)

    // Same session, but with all 3 library injects fired during DISCUSSION in round 2.
    let withFires = baseSession(g)
    withFires = fireLibraryInject(withFires, library[0], 1_000_100)
    withFires = fireLibraryInject(withFires, library[1], 1_000_200)
    withFires = fireLibraryInject(withFires, library[2], 1_000_300)
    const withFiresInput = sessionToScoringInput(withFires)
    expect(withFiresInput).not.toBeNull()
    const withFiresOut = scoreExercise(withFiresInput!)

    // Deep equality on the outcome payload — no axis, no round, nothing must move.
    expect(withFiresOut.outcomes).toEqual(baselineOut.outcomes)
    expect(withFiresOut.totalPoints).toEqual(baselineOut.totalPoints)
    expect(withFiresOut.roleResolution).toEqual(baselineOut.roleResolution)
    expect(withFiresOut.droppedOptionalDecisions).toEqual(baselineOut.droppedOptionalDecisions)
  })

  it("timeline has 3 surprise_inject entries carrying libraryId after 3 library fires", () => {
    const g = makeGraph()
    let s = baseSession(g)
    s = fireLibraryInject(s, library[0], 1_000_100)
    s = fireLibraryInject(s, library[1], 1_000_200)
    s = fireLibraryInject(s, library[2], 1_000_300)

    const surpriseEntries = s.timeline.filter(t => t.type === "surprise_inject")
    expect(surpriseEntries).toHaveLength(3)
    const libraryIds = surpriseEntries.map(t => (t.data as { libraryId?: string }).libraryId).sort()
    expect(libraryIds).toEqual(["lib1", "lib2", "lib3"])
  })
})
