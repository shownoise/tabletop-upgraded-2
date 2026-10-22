import { describe, it, expect, afterEach } from "vitest"
import {
  COMPANY_SIZE_BUCKETS,
  companySizeBucket,
  organisationFromClient,
  regimeForClient,
  resolveGraphGoalId,
} from "../admin/client-config"
import { NL_AVG_NIS2_REGIME, REGULATORY_REGIMES } from "../regulatory/regimes"
import type { AdminClient } from "../admin/clients"
import type { RegulatoryRegime } from "../types"
import type { ScenarioGraph } from "../graph/types"

// De klant houdt een aantal medewerkers, de oefenconfig een reeks. Die
// omzetting is de enige plek waar de grenzen liggen, dus die testen we hard:
// de labels overlappen op 250 / 500 / 1500 en moeten precies één kant kiezen.

function makeClient(over: Partial<AdminClient> = {}): AdminClient {
  return {
    id: "client_test",
    name: "Testklant BV",
    sector: "Onderwijs",
    employees: 400,
    itArrangement: "Entra ID, Exchange Online, SIS",
    crownJewels: "Leerlingdossiers, examengegevens",
    crisisTeamRoles: ["ceo", "ciso"],
    regimeId: "nl_avg_nis2",
    isTestClient: true,
    createdAt: 1,
    updatedAt: 1,
    ...over,
  }
}

describe("companySizeBucket", () => {
  it("kiest de bovengrens inclusief op elke overlappende grens", () => {
    expect(companySizeBucket(250)).toBe("100–250")
    expect(companySizeBucket(251)).toBe("250–500")
    expect(companySizeBucket(500)).toBe("250–500")
    expect(companySizeBucket(501)).toBe("500–1,500")
    expect(companySizeBucket(1500)).toBe("500–1,500")
    expect(companySizeBucket(1501)).toBe("1,500+")
  })

  it("klemt onder de kleinste bucket in plaats van een reeks te verzinnen", () => {
    expect(companySizeBucket(0)).toBe("100–250")
    expect(companySizeBucket(1)).toBe("100–250")
    expect(companySizeBucket(99)).toBe("100–250")
    expect(companySizeBucket(100)).toBe("100–250")
  })

  it("valt terug op de kleinste bucket bij een onbruikbaar aantal", () => {
    expect(companySizeBucket(Number.NaN)).toBe("100–250")
    expect(companySizeBucket(Number.POSITIVE_INFINITY)).toBe("100–250")
    expect(companySizeBucket(-5)).toBe("100–250")
  })

  it("levert altijd een waarde die in de keuzelijst van de setup-form staat", () => {
    for (const n of [0, 100, 249, 250, 251, 499, 500, 501, 1499, 1500, 1501, 50_000]) {
      expect(COMPANY_SIZE_BUCKETS).toContain(companySizeBucket(n))
    }
  })
})

describe("organisationFromClient", () => {
  it("vult de organisatievelden uit het klantdossier", () => {
    const org = organisationFromClient(makeClient())
    expect(org.sector).toBe("Onderwijs")
    expect(org.companySize).toBe("250–500")
    // IT-inrichting en kritieke systemen zijn hetzelfde gegeven (CONTEXT.md).
    expect(org.criticalSystems).toBe("Entra ID, Exchange Online, SIS")
    expect(org.crownJewels).toBe("Leerlingdossiers, examengegevens")
    expect(org.selectedRoles).toEqual(["ceo", "ciso"])
  })

  it("laat de rollen weg als de klant geen crisisteam heeft, zodat de graph die bepaalt", () => {
    const org = organisationFromClient(makeClient({ crisisTeamRoles: [] }))
    expect(org.selectedRoles).toBeUndefined()
  })

  it("kopieert de rollen zodat de config de klant niet kan muteren", () => {
    const client = makeClient()
    const org = organisationFromClient(client)
    org.selectedRoles?.push("legal")
    expect(client.crisisTeamRoles).toEqual(["ceo", "ciso"])
  })
})

describe("resolveGraphGoalId", () => {
  it("valt terug op decision_making voor een graph van voor de doel-koppeling", () => {
    const legacy = { id: "g1", name: "Oud scenario" } as ScenarioGraph
    expect(resolveGraphGoalId(legacy)).toBe("decision_making")
    expect(legacy.goalId).toBeUndefined()
  })

  it("gebruikt het doel van de graph als dat er staat", () => {
    expect(resolveGraphGoalId({ goalId: "crisis_management" })).toBe("crisis_management")
  })

  it("valt terug zonder graph", () => {
    expect(resolveGraphGoalId(null)).toBe("decision_making")
    expect(resolveGraphGoalId(undefined)).toBe("decision_making")
  })
})

describe("regimeForClient", () => {
  const FAKE: RegulatoryRegime = { ...NL_AVG_NIS2_REGIME, id: "test_regime", jurisdiction: "Testland" }

  afterEach(() => {
    delete REGULATORY_REGIMES[FAKE.id]
  })

  it("laat het regime van de klant winnen", () => {
    REGULATORY_REGIMES[FAKE.id] = FAKE
    expect(regimeForClient(makeClient({ regimeId: FAKE.id })).jurisdiction).toBe("Testland")
  })

  it("valt terug op NL AVG+NIS2 bij een onbekend regimeId", () => {
    expect(regimeForClient(makeClient({ regimeId: "regime_bestaat_niet" }))).toBe(NL_AVG_NIS2_REGIME)
  })

  it("valt terug zonder regimeId en zonder klant", () => {
    expect(regimeForClient(makeClient({ regimeId: "" }))).toBe(NL_AVG_NIS2_REGIME)
    expect(regimeForClient(null)).toBe(NL_AVG_NIS2_REGIME)
    expect(regimeForClient(undefined)).toBe(NL_AVG_NIS2_REGIME)
  })
})
