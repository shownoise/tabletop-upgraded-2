import { describe, it, expect } from "vitest"
import { eyeSecurityScenario, CRISISTEAM_OPGESCHAALD } from "@/lib/graph/examples-eye-security"
import { EYE_SECURITY_CLIENT_ID } from "@/lib/admin/seed-clients"
import { validateFramework } from "@/lib/wizard/framework"
import { validateGraph } from "@/lib/graph/validate"
import { defaultWizardConfig, type WizardConfig } from "@/lib/wizard/config"
import type { DecisionNodeData, InjectNodeData } from "@/lib/graph/types"
import type { ChoiceQuality, Role } from "@/lib/types"

// Het Eye Security-scenario is de eerste die op het nieuwe antwoordmodel is
// geschreven: één beste antwoord, één tweede, de rest slecht, en genoeg tekst
// om te kunnen wegen. Deze test houdt dat vast — anders zakt hij terug naar
// het niveau van het showcase-scenario, dat die toelichtingen nog mist.

const graph = eyeSecurityScenario()

const CONFIG: WizardConfig = {
  ...defaultWizardConfig(),
  clientName: "Eye Security",
  sector: "cybersecurity — MDR-dienstverlening",
  itArrangement: "intern",
  rounds: 5,
  injectsPerRound: 4,
  optionsPerRolePerRound: 4,
  factsNoiseRatio: 0.75,
  rolesIncluded: ["ceo", "ciso", "cfo", "legal", "head_of_comms", "ops_manager", "it_manager", "hr_lead"],
  specialConditions: [],
}

function beslispunten() {
  return graph.nodes.filter(n => n.type === "decision").map(n => ({ id: n.id, data: n.data as DecisionNodeData }))
}

describe("Eye Security — interne oefening", () => {
  it("hangt aan de klant Eye Security", () => {
    // Dit is wat hem op de klantpagina zet; de klantdetailpagina matcht hierop.
    expect(graph.clientId).toBe(EYE_SECURITY_CLIENT_ID)
  })

  it("heeft geen blokkerende structuurfouten", () => {
    // Alleen errors: validateGraph geeft ook waarschuwingen, zoals de
    // coverage-melding over onbedekte testgebieden. Die hoort bij een
    // scenario dat niet alle veertien gebieden wil raken.
    const errors = validateGraph(graph).filter(v => v.severity === "error")
    expect(errors, JSON.stringify(errors, null, 2)).toEqual([])
  })

  it("haalt alle zestien framework-regels", () => {
    const res = validateFramework(graph, CONFIG)
    expect(res.failures.map(f => f.ruleId), JSON.stringify(res.failures, null, 2)).toEqual([])
  })

  it("heeft vijf rondes en vijf beslispunten", () => {
    expect(graph.nodes.filter(n => n.type === "round")).toHaveLength(5)
    expect(beslispunten()).toHaveLength(5)
  })

  // ── Het punt van dit scenario: alarmeren is het eerste beslispunt ──
  it("laat ronde 1 alleen de CISO en de IT-manager beslissen", () => {
    // Om 02:48 bestaat het crisisteam niet. Dat is de les, dus de overige
    // rollen hebben hier bewust geen mandaat en lezen mee.
    const eerste = beslispunten()[0]
    const rollen = new Set(
      eerste.data.options.filter(o => !o.implicit && o.allowedRole).map(o => o.allowedRole as Role),
    )
    expect([...rollen].sort()).toEqual(["ciso", "it_manager"])
    expect(eerste.data.prompt.toLowerCase()).toContain("alarmeer")
  })

  it("ontsluit met opschalen een vlag die later opties mogelijk maakt", () => {
    const eerste = beslispunten()[0]
    const metVlag = eerste.data.options.filter(o => o.capabilityFlag === CRISISTEAM_OPGESCHAALD)
    expect(metVlag.length).toBeGreaterThan(0)
    // De vlag hoort op de opties te zitten die het team daadwerkelijk wekken,
    // niet op de opties die blijven wachten.
    for (const o of metVlag) expect(["best", "good"]).toContain(o.qualityRank)
  })

  it("geeft elke rol per beslispunt één beste, één tweede en de rest slecht", () => {
    for (const { id, data } of beslispunten()) {
      const perRol = new Map<Role, ChoiceQuality[]>()
      for (const o of data.options) {
        if (o.implicit || !o.allowedRole) continue
        perRol.set(o.allowedRole, [...(perRol.get(o.allowedRole) ?? []), o.qualityRank as ChoiceQuality])
      }
      expect(perRol.size, `${id} heeft geen rollen met opties`).toBeGreaterThan(0)
      for (const [rol, rangen] of perRol) {
        expect(rangen.filter(r => r === "best"), `${id}|${rol}: ${rangen.join(",")}`).toHaveLength(1)
        expect(rangen.filter(r => r === "good"), `${id}|${rol}: ${rangen.join(",")}`).toHaveLength(1)
        expect(rangen.filter(r => r === "wrong").length, `${id}|${rol}`).toBeGreaterThanOrEqual(1)
      }
    }
  })

  it("laat de rangorde en de uitkomstvector niet uit de pas lopen", () => {
    // Anders zegt de nabespreking iets anders dan het rapport: een `wrong` met
    // een hogere netto-uitkomst dan de `best` van dezelfde rol.
    const orde: Record<ChoiceQuality, number> = { best: 3, good: 2, poor: 1, wrong: 0 }
    for (const { id, data } of beslispunten()) {
      const perRol = new Map<Role, Array<{ rang: ChoiceQuality; netto: number }>>()
      for (const o of data.options) {
        if (o.implicit || !o.allowedRole || !o.outcomeVector) continue
        const netto = Object.values(o.outcomeVector).reduce((s, v) => s + (v ?? 0), 0)
        perRol.set(o.allowedRole, [...(perRol.get(o.allowedRole) ?? []), { rang: o.qualityRank as ChoiceQuality, netto }])
      }
      for (const [rol, rij] of perRol) {
        const gesorteerd = [...rij].sort((a, b) => orde[b.rang] - orde[a.rang])
        for (let i = 1; i < gesorteerd.length; i++) {
          expect(
            gesorteerd[i - 1].netto,
            `${id}|${rol}: ${gesorteerd.map(x => `${x.rang}=${x.netto}`).join(" ")}`,
          ).toBeGreaterThan(gesorteerd[i].netto)
        }
      }
    }
  })

  it("heeft per beslispunt een setup-inject die op de beslisvraag eindigt", () => {
    // Jouw eis: altijd één inject die je voorbereidt op het antwoord dat je
    // als rol moet geven. De vraagvorm is het signaal dat hij dat ook doet.
    const alleSetups = graph.nodes
      .filter(n => n.type === "inject")
      .map(n => n.data as InjectNodeData)
      .filter(d => !!d.setsUpDecisionNodeId)

    // Eén setup-inject per beslispunt, en elk beslispunt heeft er een.
    expect(alleSetups).toHaveLength(5)
    const gekoppeld = new Set(alleSetups.map(s => s.setsUpDecisionNodeId))
    expect(gekoppeld.size).toBe(5)

    // En hij eindigt op de vraag, niet op een mededeling: dat is wat hem tot
    // voorbereiding maakt in plaats van tot achtergrond.
    for (const s of alleSetups) {
      expect(s.content.trim().endsWith("?"), `${s.title} eindigt niet op een vraag`).toBe(true)
    }
  })

  it("heeft in elke ronde ruis naast de feiten", () => {
    // Jouw eis dat er altijd fabel tussen zit. Per ronde minstens één
    // aanname-inject, zodat classificeren in elke ronde werk is.
    const perRonde = new Map<string, string[]>()
    for (const edge of graph.edges.filter(e => e.type === "inject")) {
      const inject = graph.nodes.find(n => n.id === edge.target)
      if (!inject) continue
      const data = inject.data as InjectNodeData
      perRonde.set(edge.source, [...(perRonde.get(edge.source) ?? []), data.classification ?? "onbepaald"])
    }
    expect(perRonde.size).toBe(5)
    for (const [ronde, classificaties] of perRonde) {
      expect(classificaties, `${ronde} zonder aanname-inject`).toContain("aanname")
      expect(classificaties, `${ronde} zonder feit-inject`).toContain("feit")
    }
  })

  it("geeft alle acht rollen een briefing met playbook-gaten", () => {
    const rollen: Role[] = ["ceo", "ciso", "cfo", "legal", "head_of_comms", "ops_manager", "it_manager", "hr_lead"]
    for (const rol of rollen) {
      const b = graph.roleBriefings?.[rol]
      expect(b?.text?.length ?? 0, `${rol} briefing`).toBeGreaterThan(80)
      expect(b?.playbookGaps?.length ?? 0, `${rol} playbookGaps`).toBeGreaterThan(0)
    }
  })
})
