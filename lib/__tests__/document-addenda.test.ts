import { describe, expect, it } from "vitest"
import { generateDocuments, withScenarioAddenda } from "../document-generator"
import { NL_AVG_NIS2_REGIME } from "../regulatory/regimes"
import type { ExerciseConfig, RoleDocument } from "../types"
import type { ScenarioGraph } from "../graph/types"

// The role documents were a fixed template with a few config variables swapped
// in, so every exercise handed out the same sheet. Anything the scenario
// actually pins down is now appended per role. A ransom amount is deliberately
// NOT derived: it lives in inject prose and would have to be guessed.

const CONFIG = {
  sector: "Onderwijs",
  companySize: "250–500",
  criticalSystems: "ERP, leerlingadministratie",
  crownJewels: "leerlinggegevens",
  scenarioType: "Ransomware",
} as unknown as ExerciseConfig

function graph(over: Partial<ScenarioGraph> = {}): ScenarioGraph {
  return {
    id: "g", name: "g", version: 1, scenarioType: "ransomware_double_extortion",
    nodes: [], edges: [], createdAt: 0, updatedAt: 0,
    ...over,
  } as unknown as ScenarioGraph
}

function docFor(docs: RoleDocument[], role: string): RoleDocument {
  const found = docs.find(d => d.targetRole === role)
  if (!found) throw new Error(`no document for ${role}`)
  return found
}

describe("scenario addenda on role documents", () => {
  it("keeps the generic template as the baseline", () => {
    const plain = generateDocuments(CONFIG)
    const withAddenda = withScenarioAddenda(plain, undefined)
    for (const doc of plain) {
      expect(docFor(withAddenda, doc.targetRole).content.startsWith(doc.content)).toBe(true)
    }
  })

  it("names the real IR party instead of 'externe IR-partij'", () => {
    const docs = withScenarioAddenda(generateDocuments(CONFIG), graph({
      irRetainerProfile: {
        name: "Eye Security IR",
        activationNumber: "+31 88 123 4567",
        scopeIncludes: ["forensisch onderzoek", "containment"],
        scopeExcludes: ["communicatie naar ouders"],
      },
    }))
    const ceo = docFor(docs, "ceo").content
    expect(ceo).toContain("Eye Security IR")
    expect(ceo).toContain("+31 88 123 4567")
    // The exclusions are the point for an IR retainer: they tell the team what
    // stays theirs, so the exercise does not drill work the retainer does.
    expect(ceo).toContain("communicatie naar ouders")
  })

  it("leaves the IR block out when the scenario defines no retainer", () => {
    const docs = withScenarioAddenda(generateDocuments(CONFIG), graph())
    expect(docFor(docs, "ceo").content).not.toContain("IR-PARTIJ:")
  })

  it("states the real notification authority and deadlines", () => {
    const docs = withScenarioAddenda(generateDocuments(CONFIG), graph())
    const legal = docFor(docs, "legal").content
    expect(legal).toContain(NL_AVG_NIS2_REGIME.authorityLabel)
    for (const milestone of NL_AVG_NIS2_REGIME.milestones) {
      expect(legal).toContain(`binnen ${milestone.deadlineHours} uur`)
    }
  })

  it("carries the authored playbook gaps for that role", () => {
    const docs = withScenarioAddenda(generateDocuments(CONFIG), graph({
      roleBriefings: {
        ciso: { text: "Je leidt de technische respons.", playbookGaps: ["geen getest backup-herstel"] },
      },
    } as Partial<ScenarioGraph>))
    expect(docFor(docs, "ciso").content).toContain("geen getest backup-herstel")
    expect(docFor(docs, "cfo").content).not.toContain("geen getest backup-herstel")
  })

  it("does not invent a ransom figure", () => {
    const docs = withScenarioAddenda(generateDocuments(CONFIG), graph())
    // The generic board threshold stays; nothing scenario-specific replaces it.
    expect(docFor(docs, "ceo").content).toContain("€ 100.000")
  })

  it("writes Dutch media talking points in a Dutch document", () => {
    const ceo = docFor(generateDocuments(CONFIG), "ceo").content
    expect(ceo).not.toContain("We are aware of the situation")
    expect(ceo).toContain("incidentresponsteam geactiveerd")
  })
})
