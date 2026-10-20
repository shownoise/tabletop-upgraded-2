import { describe, it, expect } from "vitest"
import { urgencyLabel, injectTypeLabel, channelLabel } from "../format"
import { URGENCY_LABELS } from "../config/texts"
import type { Urgency, InjectType, InjectChannel } from "../types"

const URGENCIES: Urgency[] = ["low", "medium", "high", "critical"]

const INJECT_TYPES: InjectType[] = [
  "alert", "intel", "media", "executive", "technical", "regulatory", "social", "internal",
]

const CHANNELS: InjectChannel[] = [
  "whatsapp", "slack", "email", "siem_alert", "sms", "phone", "news_ticker", "system_alert", "raw",
]

// These labels are read by participants and by a client audience on a beamer.
// The regression they guard against is a label function falling back to the raw
// enum value, which renders as an English word in a Dutch screen.
describe("urgencyLabel", () => {
  it("uses the configured Dutch labels", () => {
    for (const urgency of URGENCIES) {
      expect(urgencyLabel(urgency)).toBe(URGENCY_LABELS[urgency].toUpperCase())
    }
  })

  it("never renders the raw enum value", () => {
    for (const urgency of URGENCIES) {
      expect(urgencyLabel(urgency)).not.toBe(urgency.toUpperCase())
    }
  })
})

describe("injectTypeLabel", () => {
  it("labels every inject type", () => {
    for (const type of INJECT_TYPES) {
      const label = injectTypeLabel(type)
      expect(label, `${type} should have a label`).toBeTruthy()
    }
  })

  it("translates the types whose enum value is an English word", () => {
    expect(injectTypeLabel("alert")).toBe("MELDING")
    expect(injectTypeLabel("media")).toBe("PERS")
    expect(injectTypeLabel("executive")).toBe("DIRECTIE")
    expect(injectTypeLabel("technical")).toBe("TECHNISCH")
    expect(injectTypeLabel("regulatory")).toBe("TOEZICHT")
    expect(injectTypeLabel("internal")).toBe("INTERN")
  })
})

describe("channelLabel", () => {
  it("labels every channel", () => {
    for (const channel of CHANNELS) {
      expect(channelLabel(channel), `${channel} should have a label`).toBeTruthy()
    }
  })

  it("translates the channels whose enum value is an English word", () => {
    expect(channelLabel("phone")).toBe("Telefoon")
    expect(channelLabel("news_ticker")).toBe("Nieuws")
    expect(channelLabel("system_alert")).toBe("Systeem")
    expect(channelLabel("email")).toBe("E-mail")
  })

  it("keeps product names untranslated", () => {
    expect(channelLabel("whatsapp")).toBe("WhatsApp")
    expect(channelLabel("slack")).toBe("Slack")
    expect(channelLabel("siem_alert")).toBe("SIEM")
  })
})
