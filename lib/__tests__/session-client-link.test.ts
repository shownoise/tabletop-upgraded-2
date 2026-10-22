import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { NL_AVG_NIS2_REGIME, REGULATORY_REGIMES } from "../regulatory/regimes"
import { resolveGraphGoalId } from "../admin/client-config"
import type { AdminClient } from "../admin/clients"
import type { ExerciseConfig, RegulatoryRegime, Scenario } from "../types"
import type { ScenarioGraph } from "../graph/types"

// Een sessie moet vastleggen voor welke klant hij gedraaid is — anders is de
// koppeling klant → scenario → sessie op de klantpagina niet terug te vinden —
// en hij moet oefenen onder het regime van die klant in plaats van altijd NL.

const CONFIG: ExerciseConfig = {
  sector: "Onderwijs",
  companySize: "250–500",
  criticalSystems: "",
  crownJewels: "",
  scenarioType: "ransomware_double_extortion",
  duration: "90 minutes",
}

const SCENARIO = {
  scenario_title: "T",
  scenario_summary: "S",
  rounds: [{ round_number: 1, title: "R1", situation_update: "", injects: [] }],
} as unknown as Scenario

const FAKE_REGIME: RegulatoryRegime = {
  ...NL_AVG_NIS2_REGIME,
  id: "test_regime_dora",
  jurisdiction: "Testland",
}

function makeClient(over: Partial<AdminClient> = {}): AdminClient {
  return {
    id: "client_link_test",
    name: "Onderwijsvereniging Noord",
    sector: "Onderwijs",
    employees: 400,
    itArrangement: "Entra ID, SIS",
    crownJewels: "Leerlingdossiers",
    crisisTeamRoles: ["ceo", "ciso"],
    regimeId: FAKE_REGIME.id,
    isTestClient: true,
    createdAt: 1,
    updatedAt: 1,
    ...over,
  }
}

function makeGraph(over: Partial<ScenarioGraph> = {}): ScenarioGraph {
  return {
    id: "graph_link_test",
    name: "Testscenario",
    version: 1,
    scenarioType: "ransomware_double_extortion",
    nodes: [{ id: "start_1", type: "start", position: { x: 0, y: 0 }, data: { kind: "start" } }],
    edges: [],
    createdAt: 1,
    updatedAt: 1,
    ...over,
  }
}

async function create(graph?: ScenarioGraph) {
  const { resetSession, createSession } = await import("../session-store")
  await resetSession()
  return createSession(CONFIG, SCENARIO, "training", [], graph)
}

beforeEach(async () => {
  REGULATORY_REGIMES[FAKE_REGIME.id] = FAKE_REGIME
  const { saveClient } = await import("../admin/clients")
  await saveClient(makeClient())
})

afterEach(async () => {
  delete REGULATORY_REGIMES[FAKE_REGIME.id]
  const { deleteClient } = await import("../admin/clients")
  await deleteClient("client_link_test")
  await deleteClient("client_zonder_regime")
})

describe("createSession legt de klant van het scenario vast", () => {
  it("schrijft adminClientId en -naam uit graph.clientId", async () => {
    const session = await create(makeGraph({ clientId: "client_link_test" }))
    expect(session.config.adminClientId).toBe("client_link_test")
    expect(session.config.adminClientName).toBe("Onderwijsvereniging Noord")
  })

  it("laat het regime van de klant winnen boven de NL-default", async () => {
    const session = await create(makeGraph({ clientId: "client_link_test" }))
    expect(session.regulatoryRegime?.id).toBe(FAKE_REGIME.id)
    expect(session.regulatoryRegime?.jurisdiction).toBe("Testland")
  })

  it("valt terug op NL AVG+NIS2 als het regimeId van de klant onbekend is", async () => {
    const { saveClient } = await import("../admin/clients")
    await saveClient(makeClient({ id: "client_zonder_regime", regimeId: "regime_bestaat_niet" }))
    const session = await create(makeGraph({ clientId: "client_zonder_regime" }))
    expect(session.config.adminClientId).toBe("client_zonder_regime")
    expect(session.regulatoryRegime?.id).toBe(NL_AVG_NIS2_REGIME.id)
  })

  it("laat een graph zonder clientId of goalId gewoon spelen", async () => {
    const legacy = makeGraph()
    const session = await create(legacy)
    expect(session.config.adminClientId).toBeUndefined()
    expect(session.config.adminClientName).toBeUndefined()
    expect(session.regulatoryRegime?.id).toBe(NL_AVG_NIS2_REGIME.id)
    expect(resolveGraphGoalId(session.graph)).toBe("decision_making")
    // Openen en spelen mag geen doel in de opgeslagen graph schrijven.
    expect(session.graph?.goalId).toBeUndefined()
    expect(legacy.goalId).toBeUndefined()
  })

  it("blijft werken als de klant van de graph niet meer bestaat", async () => {
    const session = await create(makeGraph({ clientId: "client_is_verwijderd" }))
    expect(session.config.adminClientId).toBeUndefined()
    expect(session.regulatoryRegime?.id).toBe(NL_AVG_NIS2_REGIME.id)
  })

  it("laat een sessie zonder graph ongemoeid", async () => {
    const session = await create(undefined)
    expect(session.config.adminClientId).toBeUndefined()
    expect(session.regulatoryRegime?.id).toBe(NL_AVG_NIS2_REGIME.id)
  })
})
