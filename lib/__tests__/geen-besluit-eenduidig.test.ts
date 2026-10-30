import { describe, expect, it } from "vitest"
import {
  decisionReviewItems,
  isNoDecisionSubmission,
  noDecisionSummarySentence,
} from "../scoring/decision-review"
import { buildRoundReviews } from "@/components/admin/facilitator/review-items"
import { buildParticipantClosing } from "../participant-closing"
import type { ScenarioGraph } from "../graph/types"
import type { Round, SessionState, SubmittedDecision } from "../types"

// "Geen besluit binnen de tijd" werd op twee plekken verschillend
// gerepresenteerd. `finalizeDecision` schrijft een onbeantwoorde rol weg als een
// gewone inzending met participantId 'IMPLICIT' en het label van de impliciete
// optie. De facilitatorconsole kende die afspraak en toonde "GEEN BESLUIT"; het
// rapport kende hem niet en toonde "GEKOZEN — Geen besluit binnen de tijd".
// Daardoor was in de rapportsamenvatting niet te zeggen hoeveel beslismomenten
// echt een keuze bevatten: elke detectie klopte op maar één van de twee paden.
//
// Deze test pint vast dat beide paden hetzelfde zeggen, via `item.noDecision`.
// Het veld weghalen of één pad weer op `chosenLabel === null` laten leunen laat
// hem falen.

const IMPLICIT_LABEL = "Geen besluit binnen de tijd"

function makeGraph(): ScenarioGraph {
  const vector = (cont: number) => ({ CONT: cont, FOR: 0, BC: 0, JUR: 0, VER: 0, KOS: 0 })
  return {
    id: "g1",
    name: "Alarmeren",
    version: 1,
    scenarioType: "ransomware_double_extortion",
    createdAt: 0,
    updatedAt: 0,
    nodes: [
      { id: "start", type: "start", position: { x: 0, y: 0 }, data: { kind: "start" } },
      {
        id: "round1",
        type: "round",
        position: { x: 0, y: 0 },
        data: { kind: "round", title: "Dag 1", situation_update: "", timerMinutes: 10 },
      },
      {
        id: "dec1",
        type: "decision",
        position: { x: 0, y: 0 },
        data: {
          kind: "decision",
          prompt: "Alarmeren of eerst verifiëren?",
          perRole: true,
          options: [
            { id: "ceo_alarm", label: "Direct alarmeren", allowedRole: "ceo", outcomeVector: vector(2) },
            { id: "ciso_isoleer", label: "Isoleren", allowedRole: "ciso", outcomeVector: vector(1) },
            {
              id: "geen_ceo",
              label: IMPLICIT_LABEL,
              allowedRole: "ceo",
              implicit: true,
              outcomeVector: vector(-1),
            },
            {
              id: "geen_ciso",
              label: IMPLICIT_LABEL,
              allowedRole: "ciso",
              implicit: true,
              outcomeVector: vector(-1),
            },
          ],
        },
      },
    ],
    edges: [
      { id: "e1", source: "start", target: "round1", type: "sequence" },
      { id: "e2", source: "round1", target: "dec1", type: "sequence" },
    ],
  } as unknown as ScenarioGraph
}

// Zoals `finalizeDecision` in lib/session-store.ts hem wegschrijft.
function implicitRow(role: "ceo" | "ciso", actionId: string): SubmittedDecision {
  return {
    participantId: "IMPLICIT",
    participantName: "Geen besluit",
    role,
    roundIndex: 0,
    actionId,
    actionLabel: IMPLICIT_LABEL,
    reasoning: "Geen besluit binnen de tijd — impliciete keuze bij afronding beslissing",
    submittedAt: new Date(1_000_500).toISOString(),
    isWrongRole: false,
    isIrDeviation: false,
    groupId: "group_1",
  }
}

function echteInzending(): SubmittedDecision {
  return {
    participantId: "p1",
    participantName: "Noor",
    role: "ceo",
    roundIndex: 0,
    actionId: "ceo_alarm",
    actionLabel: "Direct alarmeren",
    reasoning: "Vermoeden van exfiltratie.",
    submittedAt: new Date(1_000_200).toISOString(),
    isWrongRole: false,
    isIrDeviation: false,
    groupId: "group_1",
  }
}

function makeSession(submittedDecisions: SubmittedDecision[]): SessionState {
  return {
    id: "s1",
    joinCode: "ABC123",
    config: {} as never,
    mode: "event",
    scenario: {
      scenario_title: "Ransomware",
      scenario_summary: "S",
      rounds: [
        { round_number: 1, title: "Dag 1", situation_update: "", injects: [] } as unknown as Round,
      ],
    },
    currentRound: 0,
    status: "ended",
    participants: [{ id: "p1", name: "Noor", role: "ceo", joinedAt: 0, groupId: "group_1" }],
    groups: [{ id: "group_1", name: "UX-testteam", createdAt: 0 }],
    pushedInjects: [],
    timeline: [],
    createdAt: 0,
    startedAt: 0,
    graph: makeGraph(),
    submittedDecisions,
  } as unknown as SessionState
}

describe("geen besluit heet op elk pad hetzelfde", () => {
  it("markeert de impliciete inzending op beide paden als geen besluit", () => {
    const session = makeSession([implicitRow("ceo", "geen_ceo"), implicitRow("ciso", "geen_ciso")])

    const rapport = decisionReviewItems(session).flatMap(r => r.entries)
    const console_ = buildRoundReviews(session).flatMap(r => r.items)

    expect(rapport.length).toBe(2)
    expect(console_.length).toBe(2)
    expect(rapport.every(e => e.item.noDecision)).toBe(true)
    expect(console_.every(item => item.noDecision)).toBe(true)
  })

  it("laat het label van de impliciete optie nergens als gekozen keuze lezen", () => {
    const session = makeSession([implicitRow("ceo", "geen_ceo"), implicitRow("ciso", "geen_ciso")])

    // Dit was de bug: het rapport zette hier IMPLICIT_LABEL in `chosenLabel`,
    // dus toonde de kaart "GEKOZEN" met de tekst van de impliciete optie.
    for (const entry of decisionReviewItems(session).flatMap(r => r.entries)) {
      expect(entry.item.chosenLabel).toBeNull()
    }
    for (const item of buildRoundReviews(session).flatMap(r => r.items)) {
      expect(item.chosenLabel).toBeNull()
    }
  })

  it("laat een echte keuze op beide paden een keuze blijven", () => {
    const session = makeSession([echteInzending(), implicitRow("ciso", "geen_ciso")])

    const rapport = decisionReviewItems(session).flatMap(r => r.entries)
    const console_ = buildRoundReviews(session).flatMap(r => r.items)

    const flags = (noDecision: boolean) => ({
      rapport: rapport.filter(e => e.item.noDecision === noDecision).length,
      console: console_.filter(item => item.noDecision === noDecision).length,
    })
    expect(flags(false)).toEqual({ rapport: 1, console: 1 })
    expect(flags(true)).toEqual({ rapport: 1, console: 1 })

    expect(rapport.find(e => !e.item.noDecision)?.item.chosenLabel).toBe("Direct alarmeren")
    expect(console_.find(item => !item.noDecision)?.chosenLabel).toBe("Direct alarmeren")
  })

  it("geeft elke onbeantwoorde rol een eigen key in het rapport", () => {
    const session = makeSession([implicitRow("ceo", "geen_ceo"), implicitRow("ciso", "geen_ciso")])
    const keys = decisionReviewItems(session).flatMap(r => r.entries.map(e => e.key))
    expect(new Set(keys).size).toBe(keys.length)
  })

  it("noemt de impliciete rij ook in de terugblik van de deelnemer geen keuze", () => {
    // In EVENT-modus draagt de impliciete rij een groupId, dus komt hij in de
    // terugblik van het team terecht naast de echte keuzes.
    const session = makeSession([echteInzending(), implicitRow("ciso", "geen_ciso")])
    const choices = buildParticipantClosing(session, "p1").rounds.flatMap(r => r.choices)

    expect(choices.length).toBe(2)
    expect(choices.filter(c => c.noDecision).length).toBe(1)
    expect(choices.find(c => c.noDecision)?.optionLabel).toBe(IMPLICIT_LABEL)
    expect(choices.find(c => !c.noDecision)?.optionLabel).toBe("Direct alarmeren")
  })

  it("zegt in de rapportsamenvatting hoeveel beslismomenten geen besluit zijn", () => {
    const niets = makeSession([implicitRow("ceo", "geen_ceo"), implicitRow("ciso", "geen_ciso")])
    const regel = noDecisionSummarySentence(decisionReviewItems(niets))
    expect(regel).toContain("Alle 2 besproken beslismomenten")
    expect(regel).toContain('"geen besluit binnen de tijd" gescoord')
    // De hele reden voor deze regel: zeggen waar de punten vandaan komen.
    expect(regel).toContain("het gevolg van niets doen")

    const half = noDecisionSummarySentence(
      decisionReviewItems(makeSession([echteInzending(), implicitRow("ciso", "geen_ciso")])),
    )
    expect(half).toContain("1 van de 2 besproken beslismomenten")
    expect(half).not.toContain("niets doen")

    const alles = noDecisionSummarySentence(
      decisionReviewItems(
        makeSession([
          echteInzending(),
          { ...echteInzending(), participantId: "p2", role: "ciso", actionId: "ciso_isoleer", actionLabel: "Isoleren" },
        ]),
      ),
    )
    expect(alles).toContain("volgen dus uit wat het team besloot")
  })

  it("zwijgt als er geen enkel beslismoment besproken is", () => {
    expect(noDecisionSummarySentence([])).toBe("")
  })

  it("herkent geen besluit aan de inzender én aan de impliciete optie", () => {
    expect(isNoDecisionSubmission({ participantId: "IMPLICIT" })).toBe(true)
    expect(isNoDecisionSubmission({ participantId: "p1" }, { implicit: true })).toBe(true)
    expect(isNoDecisionSubmission({ participantId: "p1" }, { implicit: false })).toBe(false)
    expect(isNoDecisionSubmission({ participantId: "p1" })).toBe(false)
  })
})
