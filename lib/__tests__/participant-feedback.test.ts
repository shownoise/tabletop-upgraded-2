import { describe, it, expect, beforeEach } from "vitest"
import { toParticipantState } from "../session-store"
import type { SessionState } from "../types"

const CONFIG = {
  sector: "test",
  companySize: "s",
  criticalSystems: "",
  crownJewels: "",
  scenarioType: "ransomware_double_extortion" as const,
  duration: "1h" as const,
}

const SCENARIO = {
  scenario_title: "T",
  scenario_summary: "S",
  rounds: [
    { round_number: 1, title: "R1", situation_update: "", injects: [] },
    { round_number: 2, title: "R2", situation_update: "", injects: [] },
  ],
}

async function seedSession(): Promise<SessionState> {
  const { resetSession, createSession } = await import("../session-store")
  const { dbGetSession, dbSetSession } = await import("../db")
  await resetSession()
  await createSession(CONFIG, SCENARIO)
  const cur = await dbGetSession()
  if (!cur) throw new Error("no session")
  const seeded: SessionState = {
    ...cur,
    currentRound: 1,
    status: "active",
    startedAt: cur.createdAt,
    participants: [
      { id: "p1", name: "Marieke", role: "ceo", joinedAt: cur.createdAt },
      { id: "p2", name: "Iris", role: "ciso", joinedAt: cur.createdAt },
      { id: "p3", name: "Zonder rol", joinedAt: cur.createdAt },
    ],
  }
  await dbSetSession(seeded)
  return seeded
}

describe("participant feedback persistence", () => {
  beforeEach(async () => {
    await seedSession()
  })

  it("stores the answers on the round the participant was asked about", async () => {
    const { submitParticipantFeedback, getSession } = await import("../session-store")

    const res = await submitParticipantFeedback({
      participantId: "p1",
      roundIndex: 0,
      worked: "snel geschakeld",
      didnt: "rolverdeling onduidelijk",
      gap: "geen uitwijkplan",
    })
    expect(res.ok).toBe(true)

    const after = await getSession()
    const progress = after!.roundProgress ?? []
    expect(progress).toHaveLength(1)
    expect(progress[0].roundIndex).toBe(0)
    const entry = progress[0].participantFeedback[0]
    expect(entry.participantId).toBe("p1")
    expect(entry.participantName).toBe("Marieke")
    expect(entry.worked).toBe("snel geschakeld")
    expect(entry.didnt).toBe("rolverdeling onduidelijk")
    expect(entry.gap).toBe("geen uitwijkplan")
    expect(entry.submittedAt).toBeGreaterThan(0)
  })

  it("keeps two rounds and two participants apart", async () => {
    const { submitParticipantFeedback, getSession } = await import("../session-store")

    await submitParticipantFeedback({ participantId: "p1", roundIndex: 0, worked: "ronde een van Marieke" })
    await submitParticipantFeedback({ participantId: "p2", roundIndex: 0, worked: "ronde een van Iris" })
    await submitParticipantFeedback({ participantId: "p1", roundIndex: 1, worked: "ronde twee van Marieke" })

    const progress = (await getSession())!.roundProgress ?? []
    expect(progress.map(r => r.roundIndex)).toEqual([0, 1])

    const r0 = progress[0].participantFeedback
    expect(r0).toHaveLength(2)
    expect(r0.find(f => f.participantId === "p1")!.worked).toBe("ronde een van Marieke")
    expect(r0.find(f => f.participantId === "p2")!.worked).toBe("ronde een van Iris")

    const r1 = progress[1].participantFeedback
    expect(r1).toHaveLength(1)
    expect(r1[0].participantId).toBe("p1")
    expect(r1[0].worked).toBe("ronde twee van Marieke")
  })

  it("replaces a participant's own earlier answer for the same round", async () => {
    const { submitParticipantFeedback, getSession } = await import("../session-store")

    await submitParticipantFeedback({ participantId: "p1", roundIndex: 0, worked: "eerste poging" })
    await submitParticipantFeedback({ participantId: "p1", roundIndex: 0, worked: "tweede poging" })

    const progress = (await getSession())!.roundProgress ?? []
    expect(progress[0].participantFeedback).toHaveLength(1)
    expect(progress[0].participantFeedback[0].worked).toBe("tweede poging")
  })

  it("writes a timeline event naming the participant and round", async () => {
    const { submitParticipantFeedback, getSession } = await import("../session-store")
    await submitParticipantFeedback({ participantId: "p2", roundIndex: 1, gap: "geen woordvoerder" })

    const ev = (await getSession())!.timeline.find(t => t.type === "participant_feedback_submitted")
    expect(ev).toBeDefined()
    expect(ev!.data.participantId).toBe("p2")
    expect(ev!.data.roundIndex).toBe(1)
  })

  it("rejects an unknown participantId without writing anything", async () => {
    const { submitParticipantFeedback, getSession } = await import("../session-store")

    const res = await submitParticipantFeedback({
      participantId: "p_does_not_exist",
      roundIndex: 0,
      worked: "ingesmokkeld",
    })
    expect(res.ok).toBe(false)
    expect(res.error).toBeTruthy()

    const after = await getSession()
    expect(after!.roundProgress ?? []).toHaveLength(0)
    expect(JSON.stringify(after)).not.toContain("ingesmokkeld")
  })

  it("rejects a participant who joined but has no role", async () => {
    const { submitParticipantFeedback, getSession } = await import("../session-store")

    const res = await submitParticipantFeedback({ participantId: "p3", roundIndex: 0, worked: "rolloos" })
    expect(res.ok).toBe(false)

    expect((await getSession())!.roundProgress ?? []).toHaveLength(0)
  })

  it("ignores a skipped form instead of overwriting with blanks", async () => {
    const { submitParticipantFeedback, getSession } = await import("../session-store")

    await submitParticipantFeedback({ participantId: "p1", roundIndex: 0, worked: "bewaard" })
    const res = await submitParticipantFeedback({ participantId: "p1", roundIndex: 0, worked: "  ", didnt: "", gap: "" })
    expect(res.ok).toBe(true)

    const progress = (await getSession())!.roundProgress ?? []
    expect(progress[0].participantFeedback[0].worked).toBe("bewaard")
  })
})

describe("feedback privacy in the participant projection", () => {
  it("hands a participant their own reflection but not someone else's", async () => {
    await seedSession()
    const { submitParticipantFeedback, getSession } = await import("../session-store")
    await submitParticipantFeedback({ participantId: "p1", roundIndex: 0, worked: "mijn-eigen-woorden" })
    await submitParticipantFeedback({ participantId: "p2", roundIndex: 0, worked: "woorden-van-iris" })

    const session = (await getSession())!
    const mine = toParticipantState(session, "p1")
    const raw = JSON.stringify(mine)
    expect(raw).toContain("mijn-eigen-woorden")
    expect(raw).not.toContain("woorden-van-iris")

    // No caller identity → nobody's reflections at all.
    const anonymous = JSON.stringify(toParticipantState(session))
    expect(anonymous).not.toContain("mijn-eigen-woorden")
    expect(anonymous).not.toContain("woorden-van-iris")
  })
})
