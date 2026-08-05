import type { SessionState } from "@/lib/types"

// Phase 3 — one-sentence debrief advice on the IR-retainer decision.
// Reads session.retainerActivation (populated by submitDecision when an option
// with capabilityFlag='retainer_activated' is submitted).
//
// Three signatures, three tones:
//   • activated in round 1-2  → "IR-retainer vroeg geactiveerd (ronde X) — …"
//   • activated in round 3+   → "IR-retainer laat geactiveerd (ronde X) — …"
//   • never activated         → "IR-retainer niet geactiveerd — …"

export type RetainerAdviceTone = 'good' | 'warn' | 'bad'

export interface RetainerAdvice {
  text: string
  tone: RetainerAdviceTone
}

export function retainerAdvice(session: Pick<SessionState, 'retainerActivation'>): RetainerAdvice {
  const ra = session.retainerActivation
  if (!ra) {
    return {
      tone: 'bad',
      text: 'IR-retainer niet geactiveerd — teams zonder retainer moeten forensisch werk in eigen huis doen.',
    }
  }
  if (ra.activatedAtRound <= 2) {
    return {
      tone: 'good',
      text: `IR-retainer vroeg geactiveerd (ronde ${ra.activatedAtRound}) — forensische ondersteuning was op tijd beschikbaar.`,
    }
  }
  return {
    tone: 'warn',
    text: `IR-retainer laat geactiveerd (ronde ${ra.activatedAtRound}) — een deel van de forensische kansen ging verloren.`,
  }
}
