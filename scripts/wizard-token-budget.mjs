// Wizard token-budget probe.
//
// Doel: zonder de LLM aan te roepen, uitmeten hoeveel tokens de OUTPUT van
// elke wizard-stage in worst-case zou zijn, en dat vergelijken met de
// max_tokens-caps in route.ts / pipeline.ts.
//
// Draaien: `node scripts/wizard-token-budget.mjs` — print alleen JSON-groottes
// in tekens. De echte tokens meten we via de token-counter MCP in de session.
//
// Waarom niet in Vitest? Vitest heeft geen MCP-toegang. Deze file blijft dus
// een stub die de JSON opbouwt; de meting doet Claude in de conversatie.

// Realistische field-lengtes op basis van wat de LLM in de praktijk teruggeeft
// (geïnspireerd op passingPlan() in pipeline.test.ts + wizard-plan.ts schema).
const REALISTIC = {
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

function makeInject(id, config, i) {
  return {
    id: `${id}-i${i + 1}`,
    type: ["alert", "media", "social", "internal", "external"][i % 5],
    channel: ["siem", "email", "whatsapp", "phone", "press"][i % 5],
    urgency: ["high", "medium", "low"][i % 3],
    title: `Inject ${i + 1}: verdacht signaal via ${["SIEM", "e-mail", "WhatsApp", "telefoon", "pers"][i % 5]}`,
    content: REALISTIC.injectContent,
    classification: i % 2 === 0 ? "feit" : "aanname",
    setsUpDecisionNodeId: `${id}-d1`,
    triggersRegulatoryNotification: i === 0,
    senderName: "MDR-analist Jorik van der Meer",
    source: "SIEM — MDR partner Eye Security",
    reliability: i % 3 === 0 ? "fact" : i % 3 === 1 ? "assumption" : "misleading",
    facilitatorNote: REALISTIC.facilitatorNote,
  }
}

function makeOption(role, idx) {
  return {
    label: REALISTIC.optionLabel,
    allowedRole: role,
    outcomeVector: { CONT: 2, FOR: 0, BC: -1, JUR: 0, VER: 1, KOS: -1 },
    qualityRank: "aanbevolen",
    facilitatorCommentary: REALISTIC.facilitatorCommentary,
    lessonLearned: REALISTIC.lessonLearned,
  }
}

function makeRound(roundIdx, config) {
  const roundId = `r${roundIdx + 1}`
  const injects = Array.from({ length: config.injectsPerRound }, (_, i) => makeInject(roundId, config, i))
  const options = []
  for (const role of config.rolesIncluded) {
    for (let o = 0; o < config.optionsPerRolePerRound; o++) {
      options.push(makeOption(role, o))
    }
  }
  return {
    round: {
      title: REALISTIC.title,
      situation: REALISTIC.situation,
      discussionGoal: REALISTIC.discussionGoal,
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

function makeFullPlan(config) {
  const rounds = []
  const decisions = []
  for (let i = 0; i < config.rounds; i++) {
    const block = makeRound(i, config)
    rounds.push(block.round)
    decisions.push(block.decision)
  }
  return {
    name: "Ransomware bij regionale zorginstelling — dubbele afpersing",
    scenarioType: "ransomware_double_extortion",
    irPlaybook:
      "- Fase 1: detectie en initiële triage (SIEM + MDR)\n- Fase 2: containment per segment\n- Fase 3: forensische analyse\n- Fase 4: eradicatie en herstel\n- Fase 5: communicatie en meldplicht\n- Fase 6: evaluatie en lessons learned",
    outcomes: [
      { key: "voorbeeldig", label: "Voorbeeldig", narrative: REALISTIC.situation.slice(0, 200), lessonLearned: REALISTIC.lessonLearned, scoreRange: { min: 5 } },
      { key: "goed", label: "Goed", narrative: REALISTIC.situation.slice(0, 200), lessonLearned: REALISTIC.lessonLearned, scoreRange: { min: 2, max: 5 } },
      { key: "middel", label: "Gemiddeld", narrative: REALISTIC.situation.slice(0, 200), lessonLearned: REALISTIC.lessonLearned, scoreRange: { min: -2, max: 2 } },
      { key: "slecht", label: "Onder de maat", narrative: REALISTIC.situation.slice(0, 200), lessonLearned: REALISTIC.lessonLearned, scoreRange: { max: -3 } },
    ],
    rounds,
    decisions,
    roleBriefings: Object.fromEntries(
      config.rolesIncluded.map(r => [r, {
        text: `Als ${r} draag je in deze crisis verantwoordelijkheid voor de eerste 24 uur van de respons. Je hebt mandaat om binnen je rol besluiten te nemen; escalatie naar CEO indien mandaat ontbreekt.`,
        playbookGaps: [
          "crisismandaat is niet vastgelegd — bij afwezigheid ontbreekt tekenbevoegdheid",
          "back-up-restoretest is jaren geleden voor het laatst gedraaid",
        ],
      }])
    ),
    injectLibrary: [
      { id: "lib-1", label: "Journalist belt met open vraag", channel: "phone", urgency: "medium", classification: "feit", title: "Pers vraagt om reactie", content: "Regionale krant heeft een tip gekregen en vraagt om bevestiging." },
      { id: "lib-2", label: "Medewerker WhatsApp-gerucht", channel: "whatsapp", urgency: "low", classification: "aanname", title: "Gerucht op de vloer", content: "Iemand in de kantine hoorde dat 'alle data' gestolen zou zijn." },
      { id: "lib-3", label: "Verzekeraar meldt zich", channel: "email", urgency: "medium", classification: "feit", title: "Cyberverzekeraar", content: "De verzekeraar stelt formele vragen over de eerste 48 uur." },
      { id: "lib-4", label: "Kritische leverancier zoekt contact", channel: "phone", urgency: "medium", classification: "feit", title: "Leverancier ongerust", content: "Toeleverancier vraagt of hun keten geraakt is." },
    ],
  }
}

// Configs om te meten.
const configs = {
  worstCase: {
    rounds: 8, injectsPerRound: 5, optionsPerRolePerRound: 6,
    rolesIncluded: ["ceo", "ciso", "cfo", "legal", "head_of_comms", "hr_lead", "ops_manager", "it_manager"],
  },
  default: {
    rounds: 5, injectsPerRound: 4, optionsPerRolePerRound: 4,
    rolesIncluded: ["ceo", "ciso", "cfo", "legal", "head_of_comms", "hr_lead", "ops_manager", "it_manager"],
  },
  typicalLarge: {
    rounds: 6, injectsPerRound: 5, optionsPerRolePerRound: 4,
    rolesIncluded: ["ceo", "ciso", "cfo", "legal", "head_of_comms", "hr_lead", "ops_manager", "it_manager"],
  },
}

const results = {}

for (const [name, config] of Object.entries(configs)) {
  const plan = makeFullPlan(config)
  const block = makeRound(0, config)  // 1 round + 1 decision
  const meta = { name: plan.name, scenarioType: plan.scenarioType, irPlaybook: plan.irPlaybook, outcomes: plan.outcomes }
  const briefings = { roleBriefings: plan.roleBriefings }
  const injects = { injectLibrary: plan.injectLibrary }
  const outline = { rounds: plan.rounds.map(r => ({ title: r.title, situation: r.situation.slice(0, 80) })) }

  results[name] = {
    config,
    charCounts: {
      outline: JSON.stringify(outline).length,
      round_single: JSON.stringify(block).length,
      meta: JSON.stringify(meta).length,
      briefings: JSON.stringify(briefings).length,
      injects: JSON.stringify(injects).length,
      fullPlan_repair: JSON.stringify(plan).length,
    },
  }
}

console.log(JSON.stringify(results, null, 2))

// Ook de daadwerkelijke JSON-payloads dumpen zodat we tokens kunnen tellen.
const worst = makeFullPlan(configs.worstCase)
const worstBlock = makeRound(0, configs.worstCase)
// Om te reproduceren: uncomment onderstaande om worst-case JSON naar disk te
// schrijven (bijv. voor externe tokenizer-metingen).
// import { writeFileSync, mkdirSync } from "node:fs"
// mkdirSync("scripts/token-budget-out", { recursive: true })
// writeFileSync("scripts/token-budget-out/worst_round.json", JSON.stringify(worstBlock))
// writeFileSync("scripts/token-budget-out/worst_full_plan.json", JSON.stringify(worst))
void worst; void worstBlock;
