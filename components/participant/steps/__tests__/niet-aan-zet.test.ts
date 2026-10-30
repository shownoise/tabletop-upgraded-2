import { describe, it, expect } from "vitest"
import { mandateView, decisionDataFromProjection } from "../mandate"
import type { SessionState, ActiveDecisionState } from "@/lib/types"

// Twee dingen die stil doodliepen tussen server en scherm.
//
// 1. `context` op de beslisvraag en `description` op een optie werden wél
//    geprojecteerd maar niet overgenomen door `decisionDataFromProjection`.
//    De teksten waren dus geschreven en onzichtbaar.
//
// 2. "Deze ronde niet aan zet" was niet uit `coverage` te halen: dat universum
//    bevat juist alleen de rollen van dít beslispunt, dus de lijst was altijd
//    leeg. In het Eye Security-scenario is dat de kern — om 02:48 zit het
//    crisisteam niet bijeen, en dan hoort het scherm dat te zeggen.

const AD: ActiveDecisionState = {
  nodeId: "d1",
  prompt: "Wie alarmeer je nu, wie laat je slapen, en wie neemt dat besluit?",
  context: "Het is 02:48 en je hebt één hard signaal. Deze keuze gaat over opschalen en mandaat.",
  perRole: true,
  options: [
    { optionId: "o1", optionLabel: "Crisisteam nu wekken", optionDescription: "Je belt CEO, Legal en Operations wakker.", allowedRole: "ciso" },
    { optionId: "o2", optionLabel: "Wachten tot de dagdienst", optionDescription: "Je laat het ticket open staan voor de ochtend.", allowedRole: "ciso" },
    { optionId: "o3", optionLabel: "Auditlogs veiligstellen", optionDescription: "Je exporteert en hasht de logs van het platform.", allowedRole: "it_manager" },
  ],
}

function sessie(): SessionState {
  return {
    id: "s1",
    joinCode: "ABC123",
    status: "active",
    currentRound: 0,
    roundPhase: "decision",
    participants: [{ id: "p1", name: "Bas", joinedAt: 1, role: "ciso" }],
    scenario: { scenario_title: "T", scenario_summary: "", rounds: [{ round_number: 1, title: "R1", situation_update: "", injects: [] }] },
    config: {},
    timeline: [],
    createdAt: 1,
    mode: "training",
    activeDecision: AD,
    // Zoals de server hem berekent: één deelnemer die alles draagt.
    roleDistribution: {
      computedAt: 1,
      coverage: 1,
      entries: [{
        participantId: "p1",
        participantName: "Bas",
        primaryRole: "ciso",
        inheritedRoles: ["it_manager", "ceo", "legal", "cfo", "head_of_comms", "hr_lead", "ops_manager"],
        workload: 1,
      }],
      unassignedRoles: [],
    },
  } as unknown as SessionState
}

describe("van projectie naar scherm", () => {
  it("neemt de context van de vraag en de toelichting per optie mee", () => {
    const d = decisionDataFromProjection(AD)
    expect(d.context).toBe(AD.context)
    expect(d.options.map(o => o.description)).toEqual([
      "Je belt CEO, Legal en Operations wakker.",
      "Je laat het ticket open staan voor de ochtend.",
      "Je exporteert en hasht de logs van het platform.",
    ])
  })

  it("noemt de rollen die deze ronde geen keuze hebben", () => {
    const view = mandateView(sessie(), "p1")
    expect(view).not.toBeNull()
    // CISO en IT-manager hebben opties; de overige zes niet.
    expect(view!.nietAanZet.sort()).toEqual(
      ["ceo", "cfo", "head_of_comms", "hr_lead", "legal", "ops_manager"],
    )
    expect(view!.nietAanZet).not.toContain("ciso")
    expect(view!.nietAanZet).not.toContain("it_manager")
  })

  it("rekent onbezette rollen ook mee als niet-aan-zet", () => {
    // Een rol die niemand draagt hoort óók in de lijst: hij doet mee in het
    // scenario maar heeft deze ronde niets te kiezen.
    const s = sessie()
    s.roleDistribution!.entries[0].inheritedRoles = ["it_manager"]
    s.roleDistribution!.unassignedRoles = ["ceo", "legal"]
    const view = mandateView(s, "p1")
    expect(view!.nietAanZet.sort()).toEqual(["ceo", "legal"])
  })

  it("geeft een lege lijst als elke rol in dit beslispunt aan zet is", () => {
    const s = sessie()
    s.roleDistribution!.entries[0].inheritedRoles = ["it_manager"]
    s.roleDistribution!.unassignedRoles = []
    const view = mandateView(s, "p1")
    expect(view!.nietAanZet).toEqual([])
  })
})
