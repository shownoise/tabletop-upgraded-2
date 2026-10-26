import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { FRAMEWORK_RULES, FRAMEWORK_RULE_IDS } from "@/lib/wizard/framework"

// Het settings-tabblad somde de framework-regels eerder zélf op. Die kopie liep
// achter: rule0_decision_per_round en rule13_situation_no_spoiler ontbraken.
// Deze tests pinnen vast dat de UI de lijst uit het framework haalt, zodat een
// nieuwe regel automatisch meekomt in plaats van op twee plekken te moeten.

const UI_PATH = fileURLToPath(
  new URL("../../../components/admin/hub/wizard-prompt-tab.tsx", import.meta.url),
)
const uiSource = readFileSync(UI_PATH, "utf8")

const IMPORTS_FROM_FRAMEWORK =
  /import\s*\{[^}]*\bFRAMEWORK_RULES\b[^}]*\}\s*from\s*["']@\/lib\/wizard\/framework["']/.test(uiSource)

// Regel-ids die letterlijk in de UI staan. Leeg zodra de lijst uit de bron komt.
const HARDCODED_IDS = uiSource.match(/\brule\d+_[a-z_]+\b/g) ?? []

describe("framework-regels — één bron voor code en UI", () => {
  it("elke regel in de bron heeft een niet-lege omschrijving", () => {
    for (const r of FRAMEWORK_RULES) {
      expect(r.description.trim().length, `${r.id} mist een omschrijving`).toBeGreaterThan(0)
    }
  })

  it("FRAMEWORK_RULES dekt exact dezelfde ids, in dezelfde orde, als FRAMEWORK_RULE_IDS", () => {
    expect(FRAMEWORK_RULES.map(r => r.id)).toEqual([...FRAMEWORK_RULE_IDS])
  })

  it("de UI rendert de lijst uit het framework", () => {
    expect(IMPORTS_FROM_FRAMEWORK).toBe(true)
    expect(uiSource).toMatch(/FRAMEWORK_RULES\.map\(/)
  })

  it("de UI hardcodeert geen regel-ids", () => {
    expect(HARDCODED_IDS).toEqual([])
  })

  // De vangrail die het echte probleem afdekt: zou de UI ooit weer een eigen
  // lijst krijgen, dan moet die elk id uit de bron bevatten.
  it("elk regel-id uit de bron komt voor in de lijst die de UI rendert", () => {
    const renderedIds = IMPORTS_FROM_FRAMEWORK ? FRAMEWORK_RULES.map(r => r.id) : HARDCODED_IDS
    for (const id of FRAMEWORK_RULE_IDS) {
      expect(renderedIds, `${id} ontbreekt in de lijst die de UI toont`).toContain(id)
    }
  })
})
