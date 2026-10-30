import { describe, it, expect } from "vitest"
import { resolveInjectRecipients } from "@/lib/inject-routing"
import type { Inject, Role, RoleDistributionSnapshot } from "@/lib/types"
import type { TeamId } from "@/lib/team-roster"

// De beslisvraag komt per rol als eigen inject binnen (`targetRoles: [rol]`).
// Die opzet staat of valt bij twee dingen: zo'n bericht landt alléén bij die
// rol, en het verdwijnt niet als niemand die rol heeft geclaimd — dan hoort
// het bij wie hem heeft overgenomen.
//
// Zonder deze test is het een belofte: het veld wordt gezet, en of er iets mee
// gebeurt zie je alleen door een oefening te spelen.

const TEAMS = {} as Record<TeamId, Role[]>

// Bas speelt CISO en heeft IT-manager overgenomen; Nadia speelt CEO.
const VERDELING: RoleDistributionSnapshot = {
  computedAt: 1,
  coverage: 1,
  entries: [
    { participantId: "p1", participantName: "Bas", primaryRole: "ciso", inheritedRoles: ["it_manager"], workload: 2 },
    { participantId: "p2", participantName: "Nadia", primaryRole: "ceo", inheritedRoles: [], workload: 1 },
  ],
  unassignedRoles: [],
}

const AANWEZIG: Role[] = ["ciso", "ceo"]

function inject(over: Partial<Inject> = {}): Inject {
  return {
    id: "i1",
    type: "internal",
    urgency: "medium",
    title: "Bericht",
    content: "Tekst",
    ...over,
  } as Inject
}

describe("een inject voor één rol", () => {
  it("landt bij de rol die iemand zelf speelt", () => {
    const uit = resolveInjectRecipients({
      inject: inject({ targetRoles: ["ceo"] }),
      presentRoles: AANWEZIG, teamRoles: TEAMS, distribution: VERDELING,
    })
    expect(uit).toEqual(["ceo"])
  })

  it("gaat naar wie de rol heeft overgenomen als niemand hem speelt", () => {
    // IT-manager is door niemand geclaimd maar wel overgenomen door Bas.
    // Zonder die doorverwijzing zou dit bericht nergens aankomen en zou die
    // rol zijn eigen beslisvraag nooit zien.
    const uit = resolveInjectRecipients({
      inject: inject({ id: "i2", targetRoles: ["it_manager"] }),
      presentRoles: AANWEZIG, teamRoles: TEAMS, distribution: VERDELING,
    })
    expect(uit).toEqual(["ciso"])
  })

  it("houdt twee rol-berichten van dezelfde ronde gescheiden", () => {
    const naarCiso = resolveInjectRecipients({
      inject: inject({ id: "i3", targetRoles: ["ciso"] }),
      presentRoles: AANWEZIG, teamRoles: TEAMS, distribution: VERDELING,
    })
    const naarCeo = resolveInjectRecipients({
      inject: inject({ id: "i4", targetRoles: ["ceo"] }),
      presentRoles: AANWEZIG, teamRoles: TEAMS, distribution: VERDELING,
    })
    expect(naarCiso).toEqual(["ciso"])
    expect(naarCeo).toEqual(["ceo"])
    expect(naarCiso).not.toEqual(naarCeo)
  })

  it("stuurt niets naar een rol die niemand speelt én niemand heeft overgenomen", () => {
    const uit = resolveInjectRecipients({
      inject: inject({ id: "i5", targetRoles: ["hr_lead"] }),
      presentRoles: AANWEZIG, teamRoles: TEAMS,
      distribution: { ...VERDELING, entries: VERDELING.entries.map(e => ({ ...e, inheritedRoles: [] })) },
    })
    // Valt terug op de deterministische hash — één aanwezige rol, zodat het
    // bericht niet stil verdwijnt. Welke dat is doet hier niet toe; dat het er
    // precies één is wél.
    expect(uit).toHaveLength(1)
    expect(AANWEZIG).toContain(uit[0])
  })
})
