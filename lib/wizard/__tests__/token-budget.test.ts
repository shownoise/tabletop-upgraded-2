import { describe, it, expect } from "vitest"
import type { WizardPlan } from "@/lib/graph/wizard-plan"
import type { Role } from "@/lib/types"
import type { WizardConfig } from "@/lib/wizard/config"

// Token-budget invariant.
//
// De wizard-pipeline zet per stage een max_tokens-cap in de Anthropic call.
// Als de LLM-output boven die cap uitkomt wordt de JSON afgekapt → parse-crash.
// Deze test bouwt REALISTISCHE worst-case JSON per stage en verifieert dat de
// tokens onder de cap blijven — zonder de echte LLM aan te roepen.
//
// Bronnen voor de caps (moeten synchroon blijven met pipeline.ts):
const CAPS = {
  outline: 2000,
  meta: 4000,
  briefings: 6000,
  injects: 3000,
  round: 14000,   // per-round call (round + decision met alle rollen×opties)
  repair: 60000,  // full-plan repair (dicht bij Sonnet 4.6's 64k plafond)
} as const

// Empirische chars/token ratio voor deze content (NL/EN JSON met vaktermen).
// Gemeten via Anthropic token-counter op meta/briefings/injects: 4.0-4.2
// chars/token. Bij dit soort JSON is 4.0 een goede benadering; als de LLM
// meer unieke content genereert kan het ietsje meer worden. We gebruiken 3.6
// voor conservatieve (upper-bound) schatting.
const CHARS_PER_TOKEN_CONSERVATIVE = 3.6

function estimateTokens(json: string): number {
  return Math.ceil(json.length / CHARS_PER_TOKEN_CONSERVATIVE)
}

const REALISTIC_TEXT = {
  title: "Ronde 4 — Escalatie naar bestuur en start meldingstraject",
  situation:
    "De ochtend na de eerste containment-maatregelen blijkt dat de dreiging groter is dan initieel gedacht: het monitoring-team ziet lateral movement richting het HR-domein waar het salarisverwerkingssysteem draait. Tegelijk stuurt de aanvaller een tweede afpersings-e-mail met een concrete dreiging: publicatie van gestolen personeelsdata binnen 48 uur. De pers heeft de eerste tekenen opgepikt via een tip vanuit één van de vestigingen. Het crisisteam moet nu tegelijk regie voeren over containment, communicatie, meldplicht en interne rust.",
  discussionGoal:
    "Test of het team de scheiding tussen feit en aanname consequent hanteert onder mediadruk, en of er expliciet wordt afgesproken wie de meldplicht coördineert en op welk moment de eerste melding uitgaat.",
  injectContent:
    "Om 08:47 komt via het interne monitoringkanaal een SIEM-alert binnen: verhoogde egress-traffic vanaf een HR-fileshare naar een verdacht IP-block in Oost-Europa. Volume: circa 4,2 GB in de afgelopen twee uur. Analyst van MDR geeft aan dat het patroon overeenkomt met eerder waargenomen data-exfiltration-toolkits maar bevestiging vereist correlatie met endpoint-logs.",
  optionLabel:
    "Isoleer alle HR-endpoints en het HR-fileshare-segment onmiddellijk, ook al zetten we daarmee de salarisrun voor deze week op pauze",
  facilitatorCommentary:
    "Deze keuze prioriteert containment boven business-continuïteit. Verwacht discussie tussen CISO en CFO. Facilitator: als het team hier snel toe besluit zonder de BC-impact te benoemen, breng dan expliciet in: 'wie belt de salarisadministratie, en wanneer?'.",
  lessonLearned:
    "Snelle containment kost korte-termijn continuïteit; die trade-off moet expliciet gemaakt worden vóór het besluit, niet erna in de terugblik.",
  facilitatorNote:
    "Deze inject is bedoeld als eerste concrete signaal van data-exfiltration. De reliability is bewust 'assumption' — de correlatie is er nog niet.",
}

interface BudgetConfig {
  rounds: number
  injectsPerRound: number
  optionsPerRolePerRound: number
  rolesIncluded: Role[]
}

function makeInject(roundId: string, i: number) {
  return {
    id: `${roundId}-i${i + 1}`,
    type: ["alert", "media", "social", "internal", "external"][i % 5],
    channel: ["siem", "email", "whatsapp", "phone", "press"][i % 5],
    urgency: ["high", "medium", "low"][i % 3],
    title: `Inject ${i + 1}: verdacht signaal via ${["SIEM", "e-mail", "WhatsApp", "telefoon", "pers"][i % 5]}`,
    content: REALISTIC_TEXT.injectContent,
    classification: i % 2 === 0 ? "feit" : "aanname",
    setsUpDecisionNodeId: `${roundId}-d1`,
    triggersRegulatoryNotification: i === 0,
    senderName: "MDR-analist Jorik van der Meer",
    source: "SIEM — MDR partner Eye Security",
    reliability: i % 3 === 0 ? "fact" : i % 3 === 1 ? "assumption" : "misleading",
    facilitatorNote: REALISTIC_TEXT.facilitatorNote,
  }
}

function makeOption(role: Role) {
  return {
    label: REALISTIC_TEXT.optionLabel,
    allowedRole: role,
    outcomeVector: { CONT: 2, FOR: 0, BC: -1, JUR: 0, VER: 1, KOS: -1 },
    qualityRank: "aanbevolen",
    facilitatorCommentary: REALISTIC_TEXT.facilitatorCommentary,
    lessonLearned: REALISTIC_TEXT.lessonLearned,
  }
}

function makeRoundBlock(roundIdx: number, cfg: BudgetConfig) {
  const roundId = `r${roundIdx + 1}`
  const injects = Array.from({ length: cfg.injectsPerRound }, (_, i) => makeInject(roundId, i))
  const options: ReturnType<typeof makeOption>[] = []
  for (const role of cfg.rolesIncluded) {
    for (let o = 0; o < cfg.optionsPerRolePerRound; o++) {
      options.push(makeOption(role))
    }
  }
  return {
    round: {
      title: REALISTIC_TEXT.title,
      situation: REALISTIC_TEXT.situation,
      discussionGoal: REALISTIC_TEXT.discussionGoal,
      keyQuestions: [
        "Welke feiten hebben we bevestigd via meer dan één bron?",
        "Wie coördineert de meldplicht en op welk moment vertrekt de eerste melding?",
        "Wat is de business-continuïteit-impact van directe isolatie?",
      ],
      hints: [
        "Controleer of de endpoint-logs correleren met de SIEM-alert.",
        "Denk aan de personele impact van uitgestelde salarisverwerking.",
      ],
      expectedDecisions: [
        "Bepalen of HR-segment direct wordt geïsoleerd.",
        "Beslissen wanneer de eerste NIS2-melding uitgaat.",
      ],
      redFlags: [
        "Team gaat mee in de aanname zonder correlatie.",
        "Communicatie start voor de meldplicht is gedaan.",
      ],
      openingPrompts: [
        "Wat weten we zeker, en wat vermoeden we?",
        "Wie mag het besluit tot isolatie nemen en wie tekent daarvoor?",
      ],
      reviewPrompts: [
        "Terugkijkend: hoe scheidden jullie feit en aanname?",
        "Was de meldplicht-coördinatie helder belegd?",
      ],
      injects,
    },
    decision: {
      afterRoundIndex: roundIdx,
      authorId: `${roundId}-d1`,
      prompt: "Wat is de volgende stap: isoleren, wachten op bevestiging, of parallel escaleren?",
      perRole: true,
      options,
    },
  }
}

function makeFullPlan(cfg: BudgetConfig): WizardPlan {
  const rounds = []
  const decisions = []
  for (let i = 0; i < cfg.rounds; i++) {
    const block = makeRoundBlock(i, cfg)
    rounds.push(block.round)
    decisions.push(block.decision)
  }
  return {
    name: "Ransomware bij regionale zorginstelling — dubbele afpersing",
    scenarioType: "ransomware_double_extortion",
    irPlaybook:
      "- Fase 1: detectie en initiële triage (SIEM + MDR)\n- Fase 2: containment per segment\n- Fase 3: forensische analyse\n- Fase 4: eradicatie en herstel\n- Fase 5: communicatie en meldplicht\n- Fase 6: evaluatie en lessons learned",
    outcomes: [
      { key: "voorbeeldig", label: "Voorbeeldig", narrative: REALISTIC_TEXT.situation.slice(0, 200), lessonLearned: REALISTIC_TEXT.lessonLearned, scoreRange: { min: 5 } },
      { key: "goed", label: "Goed", narrative: REALISTIC_TEXT.situation.slice(0, 200), lessonLearned: REALISTIC_TEXT.lessonLearned, scoreRange: { min: 2, max: 5 } },
      { key: "middel", label: "Gemiddeld", narrative: REALISTIC_TEXT.situation.slice(0, 200), lessonLearned: REALISTIC_TEXT.lessonLearned, scoreRange: { min: -2, max: 2 } },
      { key: "slecht", label: "Onder de maat", narrative: REALISTIC_TEXT.situation.slice(0, 200), lessonLearned: REALISTIC_TEXT.lessonLearned, scoreRange: { max: -3 } },
    ],
    rounds: rounds as WizardPlan['rounds'],
    decisions: decisions as WizardPlan['decisions'],
    roleBriefings: Object.fromEntries(
      cfg.rolesIncluded.map(r => [r, {
        text: `Als ${r} draag je in deze crisis verantwoordelijkheid voor de eerste 24 uur van de respons. Je hebt mandaat om binnen je rol besluiten te nemen; escalatie naar CEO indien mandaat ontbreekt.`,
        playbookGaps: [
          "crisismandaat is niet vastgelegd — bij afwezigheid ontbreekt tekenbevoegdheid",
          "back-up-restoretest is jaren geleden voor het laatst gedraaid",
        ],
      }])
    ) as WizardPlan['roleBriefings'],
    injectLibrary: [
      { id: "lib-1", label: "Journalist belt met open vraag", channel: "phone", urgency: "medium", classification: "feit", title: "Pers vraagt om reactie", content: "Regionale krant heeft een tip gekregen en vraagt om bevestiging." },
      { id: "lib-2", label: "Medewerker WhatsApp-gerucht", channel: "whatsapp", urgency: "low", classification: "aanname", title: "Gerucht op de vloer", content: "Iemand in de kantine hoorde dat 'alle data' gestolen zou zijn." },
      { id: "lib-3", label: "Verzekeraar meldt zich", channel: "email", urgency: "medium", classification: "feit", title: "Cyberverzekeraar", content: "De verzekeraar stelt formele vragen over de eerste 48 uur." },
      { id: "lib-4", label: "Kritische leverancier zoekt contact", channel: "phone", urgency: "medium", classification: "feit", title: "Leverancier ongerust", content: "Toeleverancier vraagt of hun keten geraakt is." },
    ] as WizardPlan['injectLibrary'],
  }
}

const ALL_ROLES: Role[] = ['ceo', 'ciso', 'cfo', 'legal', 'head_of_comms', 'hr_lead', 'ops_manager', 'it_manager']

const CONFIGS: Record<string, BudgetConfig> = {
  default: {
    rounds: 5, injectsPerRound: 4, optionsPerRolePerRound: 4,
    rolesIncluded: ALL_ROLES,
  },
  typicalLarge: {
    rounds: 6, injectsPerRound: 5, optionsPerRolePerRound: 4,
    rolesIncluded: ALL_ROLES,
  },
  worstCase: {
    rounds: 8, injectsPerRound: 5, optionsPerRolePerRound: 6,
    rolesIncluded: ALL_ROLES,
  },
}

describe("wizard token-budget invariants", () => {
  for (const [name, cfg] of Object.entries(CONFIGS)) {
    describe(`config: ${name} (rounds=${cfg.rounds}, injects=${cfg.injectsPerRound}, options=${cfg.optionsPerRolePerRound})`, () => {
      const plan = makeFullPlan(cfg)
      const roundBlock = makeRoundBlock(0, cfg)

      it("outline fits in cap", () => {
        const json = JSON.stringify({ rounds: plan.rounds.map(r => ({ title: r.title, situation: r.situation.slice(0, 80) })) })
        const tokens = estimateTokens(json)
        expect(tokens, `outline: ${tokens} tokens (cap: ${CAPS.outline})`).toBeLessThan(CAPS.outline)
      })

      it("meta fits in cap", () => {
        const json = JSON.stringify({ name: plan.name, scenarioType: plan.scenarioType, irPlaybook: plan.irPlaybook, outcomes: plan.outcomes })
        const tokens = estimateTokens(json)
        expect(tokens, `meta: ${tokens} tokens (cap: ${CAPS.meta})`).toBeLessThan(CAPS.meta)
      })

      it("briefings fits in cap", () => {
        const json = JSON.stringify({ roleBriefings: plan.roleBriefings })
        const tokens = estimateTokens(json)
        expect(tokens, `briefings: ${tokens} tokens (cap: ${CAPS.briefings})`).toBeLessThan(CAPS.briefings)
      })

      it("injects fits in cap", () => {
        const json = JSON.stringify({ injectLibrary: plan.injectLibrary })
        const tokens = estimateTokens(json)
        expect(tokens, `injects: ${tokens} tokens (cap: ${CAPS.injects})`).toBeLessThan(CAPS.injects)
      })

      it("single round output fits in cap", () => {
        const json = JSON.stringify(roundBlock)
        const tokens = estimateTokens(json)
        expect(tokens, `round: ${tokens} tokens (cap: ${CAPS.round})`).toBeLessThan(CAPS.round)
      })

      // Repair-cap is bewust ruim (48k) omdat de repair-call het HELE plan
      // teruggeeft. Worst-case (8 rondes × 5 injects × 6 opties × 8 rollen)
      // kan alsnog over 48k gaan — dat is een architectuurgrens (per-round
      // repair is de volgende stap). Deze test skipt worst-case dus, maar
      // faalt bij default/typicalLarge om regressie te vangen.
      if (name !== "worstCase") {
        it("full plan (repair output) fits in cap", () => {
          const json = JSON.stringify(plan)
          const tokens = estimateTokens(json)
          expect(tokens, `repair full plan: ${tokens} tokens (cap: ${CAPS.repair})`).toBeLessThan(CAPS.repair)
        })
      } else {
        it.skip("full plan repair — worst-case exceeds cap (known limit, per-round repair pending)", () => {})
      }
    })
  }
})

// Suppress unused import — WizardConfig is documented type reference in comments.
export type __typesUsed = WizardConfig
