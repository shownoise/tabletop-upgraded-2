import { describe, it, expect } from "vitest"
import { NL_AVG_NIS2_REGIME } from "../regulatory/regimes"

// Ending an exercise and destroying it used to be the same action. Ending must
// keep the session, because the participant closing screen and the report both
// read it; only destroying may wipe it.
//
// The two ways to end also have to settle identically. Playing to the final
// round's review skipped the obligation expiry that the explicit force-end
// does, so an unfiled notification scored as "still open" in one path and as
// "omitted" in the other.

const CONFIG = {
  sector: "test", companySize: "s", criticalSystems: "", crownJewels: "",
  scenarioType: "ransomware_double_extortion", duration: "1h",
} as never

const SCENARIO = {
  scenario_title: "T",
  scenario_summary: "S",
  rounds: [{ round_number: 1, title: "R1", situation_update: "", injects: [] }],
} as never

// Exercise hours are wall-clock hours since the incident anchor, so backdating
// the anchor past the 24h initial deadline is what makes an unfiled obligation
// overdue. Within its deadline an obligation legitimately stays open — the team
// did not miss anything, the exercise merely stopped.
const OVERDUE_ANCHOR_MS = 30 * 60 * 60 * 1000

async function seedEndableSession(phase: "review" | "inject", overdue = true) {
  const { resetSession, createSession } = await import("../session-store")
  const { dbGetSession, dbSetSession } = await import("../db")
  await resetSession()
  await createSession(CONFIG, SCENARIO)
  const cur = await dbGetSession()
  if (!cur) throw new Error("no session")
  const anchor = overdue ? Date.now() - OVERDUE_ANCHOR_MS : cur.createdAt
  await dbSetSession({
    ...cur,
    status: "active",
    currentRound: 0,
    roundPhase: phase,
    startedAt: anchor,
    incidentDetectedAt: anchor,
    graph: undefined,
    participants: [{ id: "p1", name: "Alice", role: "ceo", joinedAt: cur.createdAt }],
    regulatoryObligations: [{
      regimeId: NL_AVG_NIS2_REGIME.id,
      milestoneId: "initial",
      status: "open",
      openedAtRound: 1,
      openedAtHour: 0,
    }],
  })
}

describe("ending an exercise", () => {
  it("keeps the session so the closing screen and report still have data", async () => {
    await seedEndableSession("inject")
    const { endSessionForced, getSession } = await import("../session-store")
    expect((await endSessionForced()).ok).toBe(true)
    const after = await getSession()
    expect(after).not.toBeNull()
    expect(after!.status).toBe("ended")
    expect(after!.participants).toHaveLength(1)
  })

  it("is idempotent", async () => {
    await seedEndableSession("inject")
    const { endSessionForced } = await import("../session-store")
    expect((await endSessionForced()).ok).toBe(true)
    expect((await endSessionForced()).ok).toBe(true)
  })

  it("settles an overdue notification, so it scores as omitted", async () => {
    await seedEndableSession("inject")
    const { endSessionForced, getSession } = await import("../session-store")
    await endSessionForced()
    const open = (await getSession())!.regulatoryObligations?.filter(o => o.status === "open") ?? []
    expect(open).toHaveLength(0)
  })

  // This is the one that was broken: the play-to-the-end branch set status
  // 'ended' without the expiry, so the same unfiled notification settled in one
  // path and stayed open in the other.
  it("settles it the same way when the exercise is played to the end", async () => {
    await seedEndableSession("review")
    const { goToNextRound, getSession } = await import("../session-store")
    // Final round + review phase, so this is the end-of-session branch.
    expect((await goToNextRound()).ok).toBe(true)
    const after = await getSession()
    expect(after!.status).toBe("ended")
    const open = after!.regulatoryObligations?.filter(o => o.status === "open") ?? []
    expect(open).toHaveLength(0)
  })

  it("leaves an obligation still inside its deadline open", async () => {
    await seedEndableSession("inject", false)
    const { endSessionForced, getSession } = await import("../session-store")
    await endSessionForced()
    const open = (await getSession())!.regulatoryObligations?.filter(o => o.status === "open") ?? []
    expect(open).toHaveLength(1)
  })
})

describe("destroying a session", () => {
  it("is the only action that removes it", async () => {
    await seedEndableSession("inject")
    const { resetSession, getSession } = await import("../session-store")
    await resetSession()
    expect(await getSession()).toBeNull()
  })
})
