import { beforeEach, describe, expect, it, vi } from "vitest"
import { buildAssessmentReport, denominatorFromReport, scoreDenominator, scoreExercise } from "@/lib/scoring"
import { sessionToScoringInput } from "@/lib/scoring/graph-adapter"
import type { ScenarioGraph } from "@/lib/graph/types"
import type { Round, SessionState, SubmittedDecision } from "@/lib/types"

// Het rapport bestond alleen voor de sessie die op dát moment in de store stond:
//
//   if (sessionId !== "current" && sessionId !== session.id) notFound()
//
// Startte de facilitator een nieuwe oefening, dan was het rapport van de vorige
// onbereikbaar — terwijl het sessie-archief de volledige SessionState bewaart.
// Deze tests pinnen twee dingen vast: een gearchiveerde state gaat zonder
// aanpassing door dezelfde scoringketen (met dezelfde noemer), en de JSON-route
// lost elk gearchiveerd id op zonder er een rapport bij te verzinnen.

const ARCHIVED_ID = "sessie-oud"
const ACTIVE_ID = "sessie-nieuw"

const getSessionMock = vi.fn()
const getSnapshotMock = vi.fn()

vi.mock("@/auth", () => ({
  auth: () => Promise.resolve({ user: { id: "u1", role: "facilitator" } }),
}))

vi.mock("@/lib/session-store", () => ({
  getSession: () => getSessionMock() as Promise<SessionState | null>,
}))

// Het echte archief hangt aan de opslaglaag. Deze test gaat over het oplossen
// van het id en niet over KV, dus hier een archief dat de test zelf vult.
vi.mock("@/lib/admin/sessions-archive", () => ({
  getSnapshot: (id: string) => getSnapshotMock(id) as Promise<{ snapshot: SessionState } | null>,
}))

// ── Fixture ───────────────────────────────────────────────────────────
//
// Vier rondes in de graph, drie gespeeld:
//   ronde 1 — beslismoment, één inzending   → scoorbaar en gemeten
//   ronde 2 — beslismoment, geen inzending  → scoorbaar, nul punten
//   ronde 3 — geen beslismoment             → niet scoorbaar
//   ronde 4 — beslismoment, nooit gespeeld  → niet scoorbaar
// Noemer dus 2 x 100 punten. Dat is de regel uit lib/scoring/denominator.ts.

function makeGraph(): ScenarioGraph {
  const option = (id: string, label: string, cont: number) => ({
    id, label, allowedRole: "ceo" as const,
    outcomeVector: { CONT: cont, FOR: 0, BC: 0, JUR: 0, VER: 0, KOS: 0 },
  })
  const round = (id: string, title: string) => ({
    id, type: "round", position: { x: 0, y: 0 },
    data: { kind: "round", title, situation_update: "", timerMinutes: 10 },
  })
  const decision = (id: string, prompt: string, options: unknown[]) => ({
    id, type: "decision", position: { x: 0, y: 0 },
    data: { kind: "decision", prompt, perRole: true, options },
  })
  return {
    id: "g1",
    name: "Vier rondes, drie gespeeld",
    version: 1,
    scenarioType: "ransomware_double_extortion",
    createdAt: 0,
    updatedAt: 0,
    nodes: [
      { id: "start", type: "start", position: { x: 0, y: 0 }, data: { kind: "start" } },
      round("round1", "Dag 1"),
      decision("dec1", "Isoleren of doorwerken?", [option("r1_isoleren", "Isoleren", 2), option("r1_wachten", "Wachten", -2)]),
      round("round2", "Dag 2"),
      decision("dec2", "Melden of nog wachten?", [option("r2_melden", "Melden", 1), option("r2_zwijgen", "Zwijgen", -1)]),
      round("round3", "Dag 3"),
      round("round4", "Dag 4"),
      decision("dec4", "Herstarten?", [option("r4_herstart", "Herstarten", 1)]),
    ],
    edges: [
      { id: "e1", source: "start", target: "round1", type: "sequence" },
      { id: "e2", source: "round1", target: "dec1", type: "sequence" },
      { id: "e3", source: "dec1", target: "round2", type: "sequence" },
      { id: "e4", source: "round2", target: "dec2", type: "sequence" },
      { id: "e5", source: "dec2", target: "round3", type: "sequence" },
      { id: "e6", source: "round3", target: "round4", type: "sequence" },
      { id: "e7", source: "round4", target: "dec4", type: "sequence" },
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

function makeSession(id: string): SessionState {
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
    id,
    joinCode: "ABC123",
    config: { sector: "Zorg" },
    scenario: {
      scenario_title: "Ransomware",
      scenario_summary: "S",
      rounds: [makeRound(1, "Dag 1"), makeRound(2, "Dag 2"), makeRound(3, "Dag 3")],
    },
    currentRound: 2,
    status: "ended",
    mode: "training",
    participants: [{ id: "p1", name: "Marieke", role: "ceo", joinedAt: 1_000_000 }],
    pushedInjects: [],
    timeline: [],
    createdAt: 1_000_000,
    startedAt: 1_000_000,
    graph: makeGraph(),
    submittedDecisions: [decision],
  } as unknown as SessionState
}

// Het archief bewaart de state als JSON in KV. Dit is dus letterlijk wat er
// later weer uitkomt — geen class-instanties, geen Date-objecten.
function fromArchive(session: SessionState): SessionState {
  return JSON.parse(JSON.stringify(session)) as SessionState
}

describe("gearchiveerde sessie door de scoringketen", () => {
  it("levert dezelfde noemer als toen de sessie live was", () => {
    const live = makeSession(ARCHIVED_ID)
    const archived = fromArchive(live)

    const liveInput = sessionToScoringInput(live)
    const archivedInput = sessionToScoringInput(archived)
    expect(liveInput).toBeTruthy()
    expect(archivedInput).toBeTruthy()

    const liveScore = scoreExercise(liveInput!)
    const archivedScore = scoreExercise(archivedInput!)

    // Dit is de assertion die op de oude code niet te halen was: er bestond geen
    // pad waarlangs een gearchiveerde state het rapport in kwam, dus kon niemand
    // aantonen dat hij dezelfde punten en dezelfde noemer oplevert.
    expect(archivedScore.totalPoints).toBe(liveScore.totalPoints)
    expect(
      scoreDenominator(archivedInput!.scenario, archivedScore.outcomes, archivedScore.totalPoints),
    ).toEqual(
      scoreDenominator(liveInput!.scenario, liveScore.outcomes, liveScore.totalPoints),
    )

    // En langs exact de keten die de rapportpagina draait.
    expect(denominatorFromReport(buildAssessmentReport(archivedInput!)))
      .toEqual(denominatorFromReport(buildAssessmentReport(liveInput!)))
  })

  it("telt alleen gespeelde rondes met een beslismoment in de noemer", () => {
    const archived = fromArchive(makeSession(ARCHIVED_ID))
    const input = sessionToScoringInput(archived)!
    const score = scoreExercise(input)
    const denom = scoreDenominator(input.scenario, score.outcomes, score.totalPoints)

    // Ronde 3 had geen beslismoment, ronde 4 is nooit gespeeld. Blijft over: 1 en 2.
    expect(denom.rounds).toEqual([1, 2])
    expect(denom.maxPoints).toBe(200)
    // Ronde 2 was wél een kans en telt als nul punten mee.
    expect(denom.measuredRounds).toEqual([1])
  })

  it("geeft niets terug voor een sessie zonder graph, in plaats van te klappen", () => {
    const zonderGraph = fromArchive(makeSession(ARCHIVED_ID))
    delete (zonderGraph as { graph?: unknown }).graph
    expect(sessionToScoringInput(zonderGraph)).toBeNull()
  })
})

describe("GET /api/session/report lost elk gearchiveerd id op", () => {
  beforeEach(() => {
    getSessionMock.mockReset()
    getSnapshotMock.mockReset()
  })

  async function get(query = ""): Promise<{ status: number; body: Record<string, unknown> }> {
    const { GET } = await import("@/app/api/session/report/route")
    const res = await GET(new Request(`http://x/api/session/report${query}`))
    return { status: res.status, body: await res.json() as Record<string, unknown> }
  }

  it("levert het rapport van een gearchiveerd id, niet dat van de actieve sessie", async () => {
    getSessionMock.mockResolvedValue(makeSession(ACTIVE_ID))
    getSnapshotMock.mockImplementation((id: string) =>
      Promise.resolve(id === ARCHIVED_ID ? { snapshot: fromArchive(makeSession(ARCHIVED_ID)) } : null),
    )

    const { status, body } = await get(`?sessionId=${ARCHIVED_ID}`)

    // Faalde op de oude code: GET() nam geen parameter en las altijd
    // getSession(), dus hier stond `sessie-nieuw`.
    expect(status).toBe(200)
    expect(body.sessionId).toBe(ARCHIVED_ID)
    expect(body.totalRounds).toBe(3)
    expect(body.totalDecisions).toBe(1)
  })

  it("verzint geen rapport voor een id dat nergens bestaat", async () => {
    getSessionMock.mockResolvedValue(makeSession(ACTIVE_ID))
    getSnapshotMock.mockResolvedValue(null)

    const { status, body } = await get("?sessionId=bestaat-niet")

    expect(status).toBe(404)
    // Geen rapportvelden in het antwoord — zeker niet die van de actieve sessie.
    expect(body.sessionId).toBeUndefined()
    expect(body.scores).toBeUndefined()
    expect(typeof body.error).toBe("string")
  })

  it("blijft zonder parameter de actieve sessie opleveren", async () => {
    getSessionMock.mockResolvedValue(makeSession(ACTIVE_ID))
    getSnapshotMock.mockResolvedValue(null)

    const { status, body } = await get()

    expect(status).toBe(200)
    expect(body.sessionId).toBe(ACTIVE_ID)
    // Het archief is niet geraadpleegd voor de lopende sessie.
    expect(getSnapshotMock).not.toHaveBeenCalled()
  })

  it("geeft 404 in plaats van een crash als er niets is", async () => {
    getSessionMock.mockResolvedValue(null)
    getSnapshotMock.mockResolvedValue(null)

    expect((await get()).status).toBe(404)
  })

  it("laat een archiefsessie die nog op 'active' stond ook een rapport geven", async () => {
    // reset archiveert ook een lopende sessie. Die is daarna per definitie niet
    // meer aan de gang, dus de afgerond-check geldt alleen voor de live sessie.
    const halverwege = fromArchive(makeSession(ARCHIVED_ID))
    halverwege.status = "active"
    getSessionMock.mockResolvedValue(null)
    getSnapshotMock.mockResolvedValue({ snapshot: halverwege })

    const { status, body } = await get(`?sessionId=${ARCHIVED_ID}`)
    expect(status).toBe(200)
    expect(body.sessionId).toBe(ARCHIVED_ID)
  })
})
