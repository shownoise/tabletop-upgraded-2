import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"

// Live gevonden tijdens solo testen: de facilitator stond op fase 'beslissing'
// en wachtte op vier rollen, terwijl /play in dezelfde browser zei "De
// facilitator heeft de keuze van deze ronde nog niet opengezet".
//
// Oorzaak: beide live-routes gaven een ingelogde facilitator altijd de
// volledige sessie, en de volledige sessie heeft geen `activeDecision` — dat
// veld wordt door toParticipantState() gemaakt. De deelnemerpagina kreeg dus
// een staat zonder keuze.
//
// Alleen de volgorde omdraaien kon niet: useSessionStream stuurt de
// participantId uit localStorage altijd mee, ook op het facilitatordashboard.
// Daarom vraagt de pagina nu expliciet om een blik, met `as=participant`.

// Losse vorm, geen SessionState-cast: deze test raakt alleen de routekeuze, en
// `as never` maakte de spread hieronder ongeldig voor tsc.
const SESSIE: Record<string, unknown> = {
  id: "s1",
  joinCode: "ABC123",
  status: "active",
  currentRound: 0,
  roundPhase: "decision",
  participants: [{ id: "p1", name: "Bas", joinedAt: 1 }],
  scenario: { scenario_title: "T", scenario_summary: "", rounds: [] },
  config: {},
  timeline: [],
  createdAt: 1,
  mode: "training",
}

function routeMetAuth(ingelogd: boolean) {
  vi.resetModules()
  vi.doMock("@/auth", () => ({ auth: async () => (ingelogd ? { user: { email: "bas@example.com" } } : null) }))
  vi.doMock("@/lib/session-store", () => ({
    getState: async () => ({ session: SESSIE }),
    settleAndGetState: async () => ({ session: SESSIE }),
    // Herkenbaar aan het veld dat alleen de projectie zet.
    toParticipantState: (s: Record<string, unknown>, pid?: string) => ({
      ...s,
      activeDecision: { nodeId: "d1", prompt: "Kies", perRole: true, options: [] },
      voorDeelnemer: pid,
    }),
  }))
  return import("@/app/api/session/state/route")
}

describe("welke blik /api/session/state teruggeeft", () => {
  beforeEach(() => { vi.resetModules() })
  afterEach(() => {
    vi.doUnmock("@/auth")
    vi.doUnmock("@/lib/session-store")
    vi.resetModules()
  })

  it("geeft de facilitator de volledige sessie zolang hij niet om de deelnemerblik vraagt", async () => {
    const { GET } = await routeMetAuth(true)
    const res = await GET(new Request("http://t/api/session/state?participantId=p1"))
    const body = await res.json()
    // Volledige sessie: geen activeDecision, want dat veld maakt de projectie.
    expect(body.session.activeDecision).toBeUndefined()
  })

  it("geeft de facilitator op /play wél de deelnemerprojectie", async () => {
    const { GET } = await routeMetAuth(true)
    const res = await GET(new Request("http://t/api/session/state?participantId=p1&as=participant"))
    const body = await res.json()
    // Dit is de assertie die op de oude code faalde.
    expect(body.session.activeDecision).toBeDefined()
    expect(body.session.voorDeelnemer).toBe("p1")
  })

  it("geeft een deelnemer zonder facilitator-cookie de projectie, ook zonder as=participant", async () => {
    const { GET } = await routeMetAuth(false)
    const res = await GET(new Request("http://t/api/session/state?participantId=p1"))
    const body = await res.json()
    expect(body.session.activeDecision).toBeDefined()
  })

  it("weigert de deelnemerblik aan iemand die niet in de sessie zit", async () => {
    const { GET } = await routeMetAuth(false)
    const res = await GET(new Request("http://t/api/session/state?participantId=onbekend&as=participant"))
    expect(res.status).toBe(401)
  })

  it("weigert hem ook aan een facilitator met een onbekende participantId", async () => {
    // Anders zou as=participant een manier zijn om de membershipcheck te omzeilen.
    const { GET } = await routeMetAuth(true)
    const res = await GET(new Request("http://t/api/session/state?participantId=onbekend&as=participant"))
    expect(res.status).toBe(401)
  })
})
