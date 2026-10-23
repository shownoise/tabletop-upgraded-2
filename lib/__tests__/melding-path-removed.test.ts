import { describe, it, expect } from "vitest"
import { existsSync, readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import * as sessionStore from "@/lib/session-store"
import { api } from "@/lib/api-client"

// Het tweede meldmechanisme (`MeldingMoment` op een ronde) had een eigen meldpad:
// api.fileMelding -> POST /api/session/melding -> fileMelding(). Sinds de
// deelnemer alleen nog via fileRegulatoryObligation() meldt was dat pad
// onbereikbaar — geen aanroeper, en de route stond niet in PUBLIC_API_ROUTES,
// dus een deelnemer kreeg er 401 op. Deze tests houden het pad weg.

const repoFile = (rel: string) => fileURLToPath(new URL(`../../${rel}`, import.meta.url))

describe("oud meldpad is verwijderd", () => {
  it("de route /api/session/melding bestaat niet meer", () => {
    expect(existsSync(repoFile("app/api/session/melding/route.ts"))).toBe(false)
  })

  it("de api-client heeft geen fileMelding-helper", () => {
    expect("fileMelding" in api).toBe(false)
    expect(readFileSync(repoFile("lib/api-client.ts"), "utf8")).not.toContain("/api/session/melding")
  })

  it("de session-store exporteert geen fileMelding meer", () => {
    expect("fileMelding" in sessionStore).toBe(false)
  })

  it("de route staat niet in PUBLIC_API_ROUTES", () => {
    expect(readFileSync(repoFile("proxy.ts"), "utf8")).not.toContain("/api/session/melding")
  })

  // Niets vult `session.meldingen` nog, dus het paneel dat die lijst toonde
  // rendert per definitie leeg. Een leeg paneel in het facilitatorgereedschap
  // is precies het ongebruikte overzicht dat issue #105 §7 eruit wil hebben;
  // de levende tegenhanger RegulatoryObligationsPanel staat op dezelfde stap.
  it("het meldingen-paneel is weg en wordt nergens meer gemount", () => {
    expect(existsSync(repoFile("components/admin/meldingen-panel.tsx"))).toBe(false)
    expect(readFileSync(repoFile("components/admin/facilitator/step-gereedschap.tsx"), "utf8"))
      .not.toContain("MeldingenPanel")
  })
})

// Opgeslagen scenario's van de gebruiker bevatten nog meldingMoments. Het type en
// de validatie blijven dus staan; alleen het meldpad is weg.
describe("MeldingMoment zelf blijft intact voor opgeslagen scenario's", () => {
  it("het type MeldingMoment bestaat nog", () => {
    expect(readFileSync(repoFile("lib/types.ts"), "utf8")).toContain("export interface MeldingMoment")
  })

  it("de graph-validatie loopt nog over meldingMoments", () => {
    expect(readFileSync(repoFile("lib/graph/validate.ts"), "utf8")).toContain("meldingMoments")
  })

  it("de wizard-plan-omzetting zet meldingMoments nog op een ronde", () => {
    expect(readFileSync(repoFile("lib/graph/wizard-plan.ts"), "utf8")).toContain("meldingMoments")
  })
})
