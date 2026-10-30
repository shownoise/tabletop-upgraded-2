// Het antwoordmodel voor de facilitator.
//
// De reviewkaarten zeggen wat een team koos en wat dat op de zes dimensies
// deed. Wat de facilitator miste: wat het bedoelde antwoord was en waarom het
// beter is dan het tweede. `facilitatorRationale` stond al in het type, in de
// scenario's, in de framework-regel en in de projectie — maar werd door geen
// enkele component gerenderd, dus hij kwam nooit op een scherm.
//
// Twee dingen staan hier vast: de rangorde van het model, en dat het model
// alleen zichtbaar is als de aanroeper er expliciet om vraagt. Die tweede eis
// is geen smaak: `RoundReviewSection` is bewust ook door de deelnemerskant te
// gebruiken, en standaard-aan zou daar het antwoord weggeven vóór de keuze.

import { describe, expect, it } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { RoundReviewSection } from "@/components/admin/facilitator/debrief-overview"
import { buildRoundReviews } from "@/components/admin/facilitator/review-items"
import type { ScenarioGraph } from "@/lib/graph/types"
import type { SessionState } from "@/lib/types"

const RATIONALE =
  "Isoleren is beter dan afwachten omdat de aanvaller nog actief is: elke minuut " +
  "wachten kost je een segment. Overleggen met de MSP is verdedigbaar, maar kost " +
  "een half uur dat je niet hebt."

function graph(): ScenarioGraph {
  return {
    nodes: [
      { id: "start", type: "start", position: { x: 0, y: 0 }, data: { kind: "start", title: "Start" } },
      {
        id: "r1",
        type: "round",
        position: { x: 0, y: 100 },
        data: {
          kind: "round",
          title: "Ontdekking",
          situation_update: "De servers staan stil.",
          timerMinutes: 15,
        },
      },
      {
        id: "d1",
        type: "decision",
        position: { x: 0, y: 200 },
        data: {
          kind: "decision",
          prompt: "Isoleer je het getroffen segment nu, of wacht je op de MSP?",
          context: "Je weet dat er versleuteling loopt. Je weet nog niet hoe ver.",
          facilitatorRationale: RATIONALE,
          measuredBy: "participant_choice",
          options: [
            {
              id: "o-poor",
              label: "Bel eerst de MSP",
              description: "Je wacht tot de MSP terugbelt voor je iets doet.",
              allowedRole: "ciso",
              qualityRank: "poor",
              facilitatorCommentary: "Kost een half uur dat je niet hebt.",
            },
            {
              id: "o-wrong",
              label: "Niets doen tot maandag",
              description: "Je laat de omgeving staan zoals hij is.",
              allowedRole: "ciso",
              qualityRank: "wrong",
            },
            {
              id: "o-best",
              label: "Isoleer het segment onmiddellijk",
              description: "Je trekt de VLAN-koppeling eruit en meldt het in het logboek.",
              allowedRole: "ciso",
              qualityRank: "best",
              facilitatorCommentary: "Containment vóór forensiek — de aanvaller is nog binnen.",
            },
            {
              id: "o-good",
              label: "Isoleer, maar bewaar eerst een image",
              description: "Je maakt een snapshot en isoleert daarna.",
              allowedRole: "ciso",
              qualityRank: "good",
            },
            {
              id: "o-implicit",
              label: "Geen besluit binnen de tijd",
              allowedRole: "ciso",
              implicit: true,
            },
          ],
        },
      },
    ],
    edges: [
      { id: "e1", source: "start", target: "r1", type: "sequence" },
      { id: "e2", source: "r1", target: "d1", type: "sequence" },
    ],
  } as unknown as ScenarioGraph
}

function session(): SessionState {
  return {
    id: "s1",
    joinCode: "ABCD",
    status: "active",
    mode: "assessment",
    currentRound: 0,
    roundPhase: "review",
    participants: [{ id: "p1", name: "Sanne", role: "ciso" }],
    pushedInjects: [],
    timeline: [],
    config: { specialsMode: "off" },
    graph: graph(),
    submittedDecisions: [
      {
        roundIndex: 0,
        participantId: "p1",
        participantName: "Sanne",
        role: "ciso",
        actionId: "o-good",
        actionLabel: "Isoleer, maar bewaar eerst een image",
        reasoning: "Forensiek wil het beeld.",
      },
    ],
    scenario: {
      title: "Ransomware",
      rounds: [{ title: "Ontdekking", situation_update: "De servers staan stil.", injects: [] }],
    },
  } as unknown as SessionState
}

describe("het antwoordmodel per ronde", () => {
  const round = buildRoundReviews(session())[0]

  it("staat op de ronde met de motivatie van de auteur", () => {
    expect(round.answerModel).toHaveLength(1)
    expect(round.answerModel[0].facilitatorRationale).toBe(RATIONALE)
    expect(round.answerModel[0].context).toMatch(/nog niet hoe ver/)
  })

  it("zet de antwoorden op rang: beste eerst, foute laatst", () => {
    const rol = round.answerModel[0].byRole.find(r => r.role === "ciso")
    expect(rol?.options.map(o => o.quality)).toEqual(["best", "good", "poor", "wrong"])
  })

  it("laat 'geen besluit' buiten het model — dat is geen antwoord dat je kiest", () => {
    const ids = round.answerModel[0].byRole.flatMap(r => r.options.map(o => o.id))
    expect(ids).not.toContain("o-implicit")
  })

  it("noemt bij elk antwoord wie het koos", () => {
    const rol = round.answerModel[0].byRole.find(r => r.role === "ciso")
    expect(rol?.options.find(o => o.id === "o-good")?.chosenBy).toEqual(["Sanne"])
    expect(rol?.options.find(o => o.id === "o-best")?.chosenBy).toEqual([])
  })

  it("draagt de toelichting per antwoord mee", () => {
    const rol = round.answerModel[0].byRole.find(r => r.role === "ciso")
    const best = rol?.options.find(o => o.id === "o-best")
    expect(best?.description).toMatch(/VLAN-koppeling/)
    expect(best?.commentary).toMatch(/Containment vóór forensiek/)
  })
})

describe("het model is alleen zichtbaar als de aanroeper erom vraagt", () => {
  const round = buildRoundReviews(session())[0]

  it("staat standaard niet in de reviewsectie", () => {
    const html = renderToStaticMarkup(createElement(RoundReviewSection, { round }))
    expect(html).not.toMatch(/antwoordmodel/i)
    expect(html).not.toMatch(/Containment vóór forensiek/)
  })

  it("komt met showAnswerModel wél mee, ingeklapt achter één regel", () => {
    const html = renderToStaticMarkup(
      createElement(RoundReviewSection, { round, showAnswerModel: true }),
    )
    expect(html).toMatch(/antwoordmodel/i)
    // Ingeklapt: de kop staat er, de inhoud nog niet.
    expect(html).not.toMatch(/Containment vóór forensiek/)
  })
})
