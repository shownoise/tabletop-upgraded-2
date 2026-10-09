import { describe, expect, it } from "vitest"
import type { ScenarioTemplate } from "@/lib/template-types"
import { legacyTemplateToScenarioGraph } from "@/lib/graph/legacy-template-migration"
import { validateGraph } from "@/lib/graph/validate"
import type { InjectNodeData } from "@/lib/graph/types"

const template: ScenarioTemplate = {
  id: "custom-finance",
  name: "Financieel incident",
  operationName: "OPERATION LEDGER",
  description: "Een legacy scenario.",
  tags: ["bec", "tabletop"],
  difficulty: "intermediate",
  contentMode: "hybrid",
  version: "2",
  createdAt: 1,
  updatedAt: 2,
  estimatedDurationMinutes: 30,
  organizationContext: { name: "Voorbeeld BV", sector: "financieel", size: "mkb", criticalSystems: "ERP", crownJewels: "betalingen" },
  outcomes: {
    good: ["Escalatie op tijd"],
    bad: ["Betaling zonder controle"],
    debriefQuestions: ["Wie had mandaat?"],
  },
  rounds: [
    {
      id: "round-1",
      title: "Verdachte betaling",
      situationUpdateTemplate: "De CFO ontvangt een spoedverzoek.",
      timerMinutes: 15,
      injects: [{
        id: "inject-1",
        type: "executive",
        channel: "email",
        urgency: "high",
        title: "Spoedbetaling",
        htmlContent: "<p>Betaal <strong>vandaag</strong>.</p><script>alert('x')</script>",
        showNotes: "Controleer IBAN buiten de e-mail om.",
      }],
      decisionPoint: {
        id: "decision-1",
        title: "Betaling autoriseren?",
        description: "De leverancier dreigt met opschorting.",
        teamLeadOnly: true,
        options: [
          { id: "pay", label: "Betalen", description: "Nu betalen", consequence: "Hoog risico" },
          { id: "verify", label: "Verifiëren", description: "Bel de leverancier", consequence: "Vertraging" },
        ],
      },
      facilitatorNotes: { discussionGoal: "Mandaat toetsen", keyQuestions: ["Wie controleert?"], hints: [], expectedDecisions: ["Betalen of verifiëren"], redFlags: [], debriefPoints: ["Was het mandaat helder?" ] },
    },
  ],
}

describe("legacyTemplateToScenarioGraph", () => {
  it("creates a valid draft graph without changing the legacy template", () => {
    const graph = legacyTemplateToScenarioGraph(template, "browser", 123)

    expect(graph.id).toMatch(/^legacy-browser-custom-finance-/)
    expect(graph.publishStatus).toBe("draft")
    expect(graph.scenarioType).toBe("bec_cfo_fraud")
    expect(graph.features).toEqual({ reliability: false, compliance: false, scoring: false })
    expect(validateGraph(graph).filter(issue => issue.severity === "error")).toEqual([])
    expect(template.rounds[0].injects[0].htmlContent).toContain("<script>")
  })

  it("imports rich legacy content as safe plain text and retains facilitator notes", () => {
    const graph = legacyTemplateToScenarioGraph(template, "browser", 123)
    const inject = graph.nodes.find(node => node.type === "inject")!.data as InjectNodeData

    expect(inject.content).toBe("Betaal vandaag.")
    expect(inject.content).not.toContain("alert")
    expect(inject.facilitatorNote).toBe("Controleer IBAN buiten de e-mail om.")
  })
})
