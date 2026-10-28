import { beforeEach, describe, expect, it } from "vitest"

// Deze tests pinnen de serverkant van de keuze in ronde 1 met het échte
// showcase-scenario: dat de eerste ronde een per-rol-beslissing aan een
// sequence-edge heeft, en dat de deelnemer-projectie daar een `activeDecision`
// van maakt — in beide simulatiemodi en via het echte startpad.
//
// Ze zijn geschreven tijdens het zoeken naar een live bug waarbij de
// facilitator op 'beslissing' stond en de deelnemer "nog niet opengezet" las.
// Die bug zat niet hier maar in de route (zie
// deelnemerblik-voor-facilitator.test.ts). Deze tests bleven staan omdat ze
// wél de aanname vastleggen waarop die projectie rust: een hand-gebouwde
// minigraaf (event-decision-flow.test.ts) dekt de vorm van het echte
// scenario niet.

describe("de keuze van ronde 1 in het showcase-scenario", () => {
  let graph: import("@/lib/graph/types").ScenarioGraph
  let eersteRondeId: string

  beforeEach(async () => {
    const { schoolverenigingScenario } = await import("@/lib/graph/examples-schoolvereniging")
    graph = schoolverenigingScenario()
    const rondes = graph.nodes.filter(n => n.type === "round")
    expect(rondes.length).toBeGreaterThan(0)
    eersteRondeId = rondes[0].id
  })

  it("hangt een beslissing aan de eerste ronde, per rol", () => {
    const uitgaand = graph.edges.filter(e => e.source === eersteRondeId && e.type === "sequence")
    const doelen = uitgaand.map(e => graph.nodes.find(n => n.id === e.target))
    const beslissing = doelen.find(n => n?.type === "decision")
    expect(beslissing, "ronde 1 heeft geen sequence-edge naar een decision").toBeDefined()
    const data = beslissing!.data as import("@/lib/graph/types").DecisionNodeData
    // perRole !== true laat projectActiveDecision bewust undefined teruggeven,
    // want een facilitator-keuze hoort de deelnemer niet te zien.
    expect(data.perRole).toBe(true)
    expect(data.options.filter(o => !o.implicit).length).toBeGreaterThan(0)
  })

  it("geeft de deelnemer in de beslisfase een activeDecision met perRole", async () => {
    const { resetSession, createSession, toParticipantState } = await import("@/lib/session-store")
    const { dbGetSession, dbSetSession } = await import("@/lib/db")
    await resetSession()
    await createSession(
      { sector: "onderwijs", companySize: "m", criticalSystems: "", crownJewels: "", scenarioType: "ransomware_double_extortion", duration: "1h" },
      { scenario_title: "Showcase", scenario_summary: "", rounds: [{ round_number: 1, title: "R1", situation_update: "", injects: [] }] },
      "event", [], graph,
    )
    const s = await dbGetSession()
    if (!s) throw new Error("geen sessie")
    await dbSetSession({
      ...s,
      status: "active",
      currentRound: 0,
      roundPhase: "decision",
      participants: [{ id: "p1", name: "Bas", joinedAt: s.createdAt }],
      graphState: { currentNodeId: eersteRondeId, pathHistory: [eersteRondeId], branchLog: [] },
    })

    const sessie = await dbGetSession()
    const projectie = toParticipantState(sessie!, "p1")

    expect(projectie.activeDecision, "deelnemer krijgt geen activeDecision").toBeDefined()
    expect(projectie.activeDecision?.perRole).toBe(true)
    expect(projectie.activeDecision!.options.length).toBeGreaterThan(0)
  })

  // De test hierboven zet graphState met de hand. Deze loopt het pad dat de
  // facilitator in de browser loopt: sessie starten, fases doorzetten. Dáár
  // ging het mis — `currentNodeId` begint op de start-node, en
  // projectActiveDecision kent alleen een round- en een decision-node.
  // Let op de modus: 'training', niet 'event'. Dat is wat de sessie die via
  // Scenario's > Start wordt aangemaakt gebruikt, en precies daar viel het om.
  it.each(["training", "event"] as const)("geeft de deelnemer ook een keuze na het echte startpad (%s)", async modus => {
    const { resetSession, createSession, startSession, setPhase, toParticipantState } = await import("@/lib/session-store")
    const { dbGetSession, dbSetSession } = await import("@/lib/db")
    await resetSession()
    await createSession(
      { sector: "onderwijs", companySize: "m", criticalSystems: "", crownJewels: "", scenarioType: "ransomware_double_extortion", duration: "1h" },
      { scenario_title: "Showcase", scenario_summary: "", rounds: [{ round_number: 1, title: "R1", situation_update: "", injects: [] }] },
      modus, [], graph,
    )
    const s = await dbGetSession()
    if (!s) throw new Error("geen sessie")
    await dbSetSession({
      ...s,
      participants: [{ id: "p1", name: "Bas", joinedAt: s.createdAt, readyAt: s.createdAt }],
    })

    expect((await startSession()).ok).toBe(true)
    await setPhase("discussion")
    expect((await setPhase("decision")).ok).toBe(true)

    const sessie = await dbGetSession()
    expect(sessie?.roundPhase).toBe("decision")

    const projectie = toParticipantState(sessie!, "p1")
    expect(
      projectie.activeDecision,
      `facilitator staat op 'decision' maar de deelnemer krijgt geen keuze; currentNodeId = ${sessie?.graphState?.currentNodeId}`,
    ).toBeDefined()
    expect(projectie.activeDecision?.perRole).toBe(true)
  })
})
