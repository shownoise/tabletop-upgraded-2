import { describe, it, expect } from "vitest"
import { tr, ESCALATION_KEYS, type Lang } from "../i18n"

const LANGS: Lang[] = ["nl", "en"]

describe("escalation level translation", () => {
  it("covers the four escalation levels", () => {
    expect(ESCALATION_KEYS).toHaveLength(4)
  })

  // tr() falls back to returning the key itself for an unknown key, so a key
  // that resolves to its own name is a missing translation rendered to the user.
  it("resolves every level in every language", () => {
    for (const lang of LANGS) {
      for (const key of ESCALATION_KEYS) {
        const label = tr(lang, key)
        expect(label, `${key} should be translated in ${lang}`).not.toBe(key)
        expect(label.trim()).not.toBe("")
      }
    }
  })

  it("translates the escalation heading in every language", () => {
    for (const lang of LANGS) {
      expect(tr(lang, "escalationLevel")).not.toBe("escalationLevel")
    }
  })

  it("gives Dutch labels for the Dutch locale", () => {
    const labels = ESCALATION_KEYS.map(key => tr("nl", key))
    expect(labels).toEqual(["Normaal", "Verhoogd", "Hoog", "Kritiek"])
  })
})
