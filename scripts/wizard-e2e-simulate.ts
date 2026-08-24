// End-to-end wizard-simulatie ZONDER Anthropic API.
//
// Doel: dezelfde code draaien die de builder gebruikt (runWizardPipeline →
// planToGraph → validateFramework → repair-loop), maar met een gestubde LLM
// die realistische, valid JSON teruggeeft. Zo kan ik lokaal itereren tot de
// pipeline een geldige ScenarioGraph produceert.
//
// Draai met: `npx tsx scripts/wizard-e2e-simulate.ts`
// Output: `scripts/e2e-output/graph.json` (voor inspectie in de UI/tests).

import { writeFileSync, mkdirSync } from "node:fs"
import { runWizardPipeline, type LlmMessage } from "../lib/wizard/pipeline"
import { defaultWizardConfig, ALL_WIZARD_ROLES, specialConditionById, type WizardConfig } from "../lib/wizard/config"
import type { WizardPlan } from "../lib/graph/wizard-plan"
import type { OutcomeVector, RoleBriefing, PremadeInject } from "../lib/graph/types"
import type { Role, InjectType, InjectChannel, Urgency, InjectReliability } from "../lib/types"

// ── 1. Config ─────────────────────────────────────────────────────────
// Realistische default: 5 rondes, 4 injects, 4 opties per rol, 8 rollen.
// Zelfde als de UI default — een klant zou dit typisch selecteren.
function makeConfig(): WizardConfig {
  return {
    ...defaultWizardConfig(),
    clientName: "Regionaal Ziekenhuis Noord-Oost",
    sector: "zorg — algemeen ziekenhuis",
    itArrangement: "IT deels uitbesteed aan regionale MSP; EPD in eigen datacenter",
    companySize: "mkbplus",
    rounds: 5,
    injectsPerRound: 4,
    optionsPerRolePerRound: 4,
    factsNoiseRatio: 0.7,
    rolesIncluded: [...ALL_WIZARD_ROLES],
    specialConditions: [],
    seed: "e2e-simulate-2026",
  }
}

// ── 2. Synthetic plan generator ────────────────────────────────────────
// Bouwt een WizardPlan dat door alle 12 framework-regels heen moet komen.
// Elke keuze hier is bewust gemaakt om regels te bevredigen; zie inline
// commentaar bij elke regel.

// Outcome-vectors die elkaar niet domineren: elke option "steekt uit" op één
// as (positief) en "verliest" op een andere. Rule 3 (dominantie) en Rule 6
// (elke option beweegt ≥1 as) samen gedekt.
function makeVector(idx: number): OutcomeVector {
  const axes: (keyof OutcomeVector)[] = ["CONT", "FOR", "BC", "JUR", "VER", "KOS"]
  const winAxis = axes[idx % 6]
  const loseAxis = axes[(idx + 3) % 6]
  const v: OutcomeVector = { CONT: 0, FOR: 0, BC: 0, JUR: 0, VER: 0, KOS: 0 }
  v[winAxis] = 2
  v[loseAxis] = -1
  return v
}

// Genereer per rol × per index een uniek label + toelichting. Rule 12 (NL):
// alleen NL-tekst, geen losse Engelse woorden ('urgency' etc). Vaktermen OK.
function makeOption(role: Role, roleIdx: number, optIdx: number, roundIdx: number) {
  const globalIdx = roleIdx * 10 + optIdx
  const labels = [
    "Isoleer het HR-fileshare-segment en pauzeer de salarisrun",
    "Wacht op MDR-correlatie voor je escaleert",
    "Activeer de IR-retainer en laat het over aan Eye Security",
    "Roep de crisisstaat uit en bel je verzekeraar",
    "Informeer de bestuurders en houd de pers voorlopig af",
    "Vraag legal om een eerste beoordeling voor je een melding doet",
  ]
  return {
    label: `${labels[optIdx % labels.length]} (ronde ${roundIdx + 1}, ${role})`,
    allowedRole: role,
    outcomeVector: makeVector(globalIdx + roundIdx),
    qualityRank: "good" as const,
    facilitatorCommentary: `Voor ronde ${roundIdx + 1}: deze keuze prioriteert containment boven business-continuïteit. Facilitator merkt op wanneer de trade-off expliciet wordt.`,
    lessonLearned: "Snelle containment kost korte-termijn continuïteit; die trade-off expliciet maken.",
  }
}

function makeInject(roundIdx: number, injectIdx: number, config: WizardConfig, decisionAuthorId: string) {
  const roundId = `r${roundIdx + 1}`
  const id = `${roundId}-i${injectIdx + 1}`

  // Rule 7: fact-ratio ≈ config.factsNoiseRatio (±0.15). Deterministisch
  // toewijzen op basis van index zodat het aantal facts overeenkomt met de
  // gevraagde ratio.
  const totalInjects = config.rounds * config.injectsPerRound
  const totalFacts = Math.round(totalInjects * config.factsNoiseRatio)
  const globalIdx = roundIdx * config.injectsPerRound + injectIdx
  const isFact = globalIdx < totalFacts

  const types: InjectType[] = ["alert", "media", "social", "internal", "intel"]
  const channels: InjectChannel[] = ["siem", "email", "whatsapp", "phone", "news_ticker"]
  const urgencies: Urgency[] = ["high", "medium", "low"]

  // Rule 9: ronde 0, inject 0 → triggersRegulatoryNotification=true met
  // verwijzing naar de toezichthouder (NIS2 default regime = 'AP / NCSC').
  const isFirstRegulatory = roundIdx === 0 && injectIdx === 0

  // Rule 4: setup-injects mogen niet ALLEMAAL misleading zijn. Eerste inject
  // is 'fact', overige varieren.
  const reliability: InjectReliability = injectIdx === 0
    ? "fact"
    : (injectIdx % 3 === 0 ? "misleading" : "assumption")

  // Rule 10: facilitatorNotes.discussionGoal moet feiten uit de ronde-inhoud
  // bevatten. Injects benoemen dus expliciet dezelfde termen als de goal
  // (zie makeRound below): "SIEM-alert", "HR-fileshare".
  const contents = [
    "Om 08:47 komt via het interne monitoringkanaal een SIEM-alert binnen: verhoogde egress-traffic vanaf een HR-fileshare naar een verdacht IP-block. Analyst van MDR bevestigt het patroon, maar correlatie met endpoint-logs ontbreekt nog. Onder NIS2 kan dit meldingsplichtig worden — de toezichthouder (NCSC) wil binnen 24 uur op de hoogte zijn.",
    "MDR-partner meldt lateral movement richting het HR-domein. Nog geen bevestigde exfiltratie. Onder AVG geldt bij persoonsgegevens 72-uurs meldingstermijn richting de AP.",
    "Een medewerker meldt via WhatsApp dat 'alle data weg' is. Bron onbevestigd, mogelijk ruis.",
    "De pers heeft een tip gekregen via een medewerker. Redacteur belt en vraagt om bevestiging binnen het uur.",
    "Verzekeraar stelt formele vragen over de eerste 48 uur.",
  ]

  return {
    id,
    type: types[injectIdx % types.length],
    channel: channels[injectIdx % channels.length],
    urgency: urgencies[injectIdx % urgencies.length],
    title: `Signaal ${injectIdx + 1} — ronde ${roundIdx + 1}`,
    content: contents[injectIdx % contents.length],
    classification: isFact ? "feit" as const : "aanname" as const,
    setsUpDecisionNodeId: decisionAuthorId,
    triggersRegulatoryNotification: isFirstRegulatory,
    reliability,
    senderName: "MDR-analist",
    source: "Eye Security MDR",
  }
}

function makeRound(roundIdx: number, config: WizardConfig): WizardPlan['rounds'][number] {
  const decisionAuthorId = `r${roundIdx + 1}-d1`
  const injects = Array.from({ length: config.injectsPerRound }, (_, i) =>
    makeInject(roundIdx, i, config, decisionAuthorId)
  )

  // Rule 5: ronde N≥2 verwijst zichtbaar naar keuze/les uit ronde N-1.
  // Standaardformule in de situation-text.
  const rule5Prefix = roundIdx >= 1
    ? `Het team koos in ronde ${roundIdx} voor "Isoleer het HR-fileshare-segment". `
    : ""

  // Rule 8: elke geselecteerde special condition moet in ≥ roundsRequired
  // rondes voorkomen. Simpel: eerste N rondes krijgen de narrativePrompt
  // in hun situation-text (voor elke condition).
  const specialsInThisRound = config.specialConditions
    .map(id => specialConditionById(id))
    .filter((c): c is NonNullable<ReturnType<typeof specialConditionById>> => !!c)
    .filter(c => roundIdx < c.roundsRequired)
    .map(c => c.narrativePrompt)
    .join(" ")

  return {
    title: `Ronde ${roundIdx + 1} — ${["Detectie", "Containment", "Communicatie", "Herstel", "Evaluatie"][roundIdx] ?? "Vervolg"}`,
    situation: `${rule5Prefix}Om ${8 + roundIdx}:${roundIdx * 15 % 60 || "00"} uur komt een SIEM-alert binnen over een HR-fileshare. MDR bevestigt het patroon. Onder NIS2 kan dit meldingsplichtig worden richting het NCSC; onder AVG geldt 72 uur richting de AP. ${specialsInThisRound}`,
    discussionGoal: "Test of het team feit van aanname scheidt bij een SIEM-alert op de HR-fileshare, en of de meldplicht richting NCSC/AP tijdig wordt gecoördineerd.",
    keyQuestions: [
      "Welke feiten hebben we bevestigd via meer dan één bron?",
      "Wie coördineert de meldplicht richting NCSC en op welk moment vertrekt de eerste melding?",
    ],
    hints: [
      "Controleer of endpoint-logs correleren met de SIEM-alert.",
    ],
    expectedDecisions: [
      "Bepalen of het HR-segment direct wordt geïsoleerd.",
    ],
    redFlags: [
      "Team gaat mee in de aanname zonder correlatie.",
    ],
    openingPrompts: [
      "Wat weten we zeker, en wat vermoeden we?",
    ],
    reviewPrompts: [
      "Terugkijkend: hoe scheidden jullie feit en aanname?",
    ],
    injects,
    decisionAuthorId,
  }
}

function makeDecision(roundIdx: number, config: WizardConfig): NonNullable<WizardPlan['decisions']>[number] {
  const authorId = `r${roundIdx + 1}-d1`
  const options: NonNullable<WizardPlan['decisions']>[number]['options'] = []
  for (let roleIdx = 0; roleIdx < config.rolesIncluded.length; roleIdx++) {
    const role = config.rolesIncluded[roleIdx]
    for (let optIdx = 0; optIdx < config.optionsPerRolePerRound; optIdx++) {
      options.push(makeOption(role, roleIdx, optIdx, roundIdx))
    }
  }
  return {
    afterRoundIndex: roundIdx,
    authorId,
    prompt: `Ronde ${roundIdx + 1} — welke volgende stap kiezen we?`,
    perRole: true,
    options,
  }
}

function makePlan(config: WizardConfig): WizardPlan {
  const rounds: WizardPlan['rounds'] = []
  const decisions: NonNullable<WizardPlan['decisions']> = []
  for (let i = 0; i < config.rounds; i++) {
    rounds.push(makeRound(i, config))
    decisions.push(makeDecision(i, config))
  }

  // Rule 11: minstens één rol heeft playbookGaps met minstens één ingang.
  const roleBriefings: Partial<Record<Role, RoleBriefing>> = {}
  for (const role of config.rolesIncluded) {
    roleBriefings[role] = {
      text: `Als ${role} coördineer je in deze crisis de eerste 24 uur van de respons. Mandaat tot beslissen binnen je rol; escaleren naar CEO wanneer mandaat ontbreekt.`,
      playbookGaps: ["crisismandaat niet vastgelegd — bij afwezigheid ontbreekt tekenbevoegdheid"],
    }
  }

  const injectLibrary: PremadeInject[] = [
    { id: "lib-1", label: "Journalist belt met open vraag", channel: "phone", urgency: "medium", classification: "feit", title: "Pers vraagt om reactie", content: "Regionale krant heeft een tip gekregen en vraagt om bevestiging." },
  ]

  return {
    name: `Ransomware-scenario voor ${config.clientName}`,
    scenarioType: "ransomware_double_extortion",
    rounds,
    decisions,
    outcomes: [
      { key: "voorbeeldig", label: "Voorbeeldig", narrative: "Team scheidde feit van aanname, coördineerde meldplicht op tijd.", scoreRange: { min: 5 } },
      { key: "middel", label: "Gemiddeld", narrative: "Team maakte redelijke keuzes maar aarzelde bij de meldplicht.", scoreRange: { min: -2, max: 4 } },
      { key: "slecht", label: "Onvoldoende", narrative: "Team ging mee in aannames; meldplicht te laat geactiveerd.", scoreRange: { max: -3 } },
    ],
    irPlaybook: "Fase 1: detectie. Fase 2: containment. Fase 3: forensische analyse. Fase 4: herstel. Fase 5: meldplicht en communicatie. Fase 6: evaluatie.",
    roleBriefings,
    injectLibrary,
  }
}

// ── 3. LLM stub ────────────────────────────────────────────────────────
// Mimicseert de Anthropic call: gegeven de messages, geef de bijbehorende
// JSON terug voor die stage. Zelfde pattern als in pipeline.test.ts.
// Als `repairPlan` gegeven is, wordt dat gebruikt in repair-pass — zo kan
// een test bewust een broken initial plan aanleveren en de repair-loop
// laten fixen.
function makeStubLlm(initialPlan: WizardPlan, repairPlan?: WizardPlan) {
  return async (messages: LlmMessage[]): Promise<string> => {
    const last = messages[messages.length - 1]?.content ?? ""
    if (last.startsWith("Genereer ronde ")) {
      const match = last.match(/^Genereer ronde (\d+)/)
      const idx = match ? Math.max(0, Number(match[1]) - 1) : 0
      return JSON.stringify({ round: initialPlan.rounds[idx], decision: initialPlan.decisions?.[idx] ?? null })
    }
    if (last.startsWith("Genereer eerst een OUTLINE")) {
      return JSON.stringify({ rounds: initialPlan.rounds.map(r => ({ title: r.title, situation: r.situation })) })
    }
    if (last.startsWith("De vorige plan overtreedt")) {
      // Repair-pass: gebruik het valid repair-plan als gegeven, anders het initial.
      const p = repairPlan ?? initialPlan
      return JSON.stringify(p)
    }
    if (last.includes('"roleBriefings"')) return JSON.stringify({ roleBriefings: initialPlan.roleBriefings ?? {} })
    if (last.includes('"injectLibrary"')) return JSON.stringify({ injectLibrary: initialPlan.injectLibrary ?? [] })
    if (last.includes('"outcomes"') || last.includes('"scenarioType"')) {
      return JSON.stringify({ name: initialPlan.name, scenarioType: initialPlan.scenarioType, outcomes: initialPlan.outcomes, irPlaybook: initialPlan.irPlaybook })
    }
    return ""
  }
}

// ── 4. Run — meerdere configs achter elkaar ────────────────────────────
interface Scenario {
  name: string
  config: WizardConfig
}

function makeScenarios(): ScenarioExt[] {
  const base = makeConfig()
  return [
    { name: "default", config: base },
    {
      name: "worst-case",
      config: { ...base, rounds: 8, injectsPerRound: 5, optionsPerRolePerRound: 6, seed: "worst-case" },
    },
    {
      name: "minimum",
      config: { ...base, rounds: 4, injectsPerRound: 3, optionsPerRolePerRound: 3, rolesIncluded: ["ceo", "ciso"], seed: "minimum" },
    },
    {
      name: "with-special-conditions",
      config: { ...base, specialConditions: ["backups_untested", "no_tested_crisis_plan"], seed: "with-specials" },
    },
    {
      name: "small-roles-many-rounds",
      config: { ...base, rounds: 7, rolesIncluded: ["ceo", "ciso", "cfo"], seed: "small-roles" },
    },
    {
      // Bewust: initial plan met broken setup-inject → rule 1 faalt →
      // repair-pass moet 'm fixen. Test dat de repair-loop end-to-end
      // werkt op productie-schaal (niet alleen minimal test-config).
      name: "needs-repair (rule1 broken)",
      config: { ...base, seed: "needs-repair" },
      brokenPlan: (plan) => {
        for (const inj of plan.rounds[0].injects ?? []) inj.setsUpDecisionNodeId = undefined
        return plan
      },
    },
    {
      // Bewust: initial plan met outcomes=null → historische crash uit
      // ref 260190c3. normalizePlan moet null → [] converteren, repair
      // moet dan de plan compleet maken.
      name: "outcomes-null (regression)",
      config: { ...base, seed: "outcomes-null" },
      brokenPlan: (plan) => {
        // outcomes-null zit in de META closer-part response, niet in de
        // initial plan-generator. Hier laten we de plan zelf staan zodat
        // de compile werkt; deze scenario is dus feitelijk = default.
        // De echte outcomes-null test staat in pipeline-robustness.test.ts.
        return plan
      },
    },
  ]
}

interface RunResult {
  name: string
  ok: boolean
  msg: string
  stats?: { nodes: number; edges: number; rounds: number; injects: number; decisions: number; outcomes: number; repairAttempts: number }
}

interface ScenarioExt extends Scenario {
  brokenPlan?: (plan: WizardPlan) => WizardPlan   // corrupt initial plan → forces repair
}

async function runOne(scenario: ScenarioExt): Promise<RunResult> {
  const plan = makePlan(scenario.config)
  const brokenPlan = scenario.brokenPlan ? scenario.brokenPlan(JSON.parse(JSON.stringify(plan)) as WizardPlan) : plan
  const llm = makeStubLlm(brokenPlan, scenario.brokenPlan ? plan : undefined)
  try {
    const result = await runWizardPipeline(scenario.config, { llm, now: () => 1_700_000_000, maxRepairAttempts: 2 })

    // Structuur-asserts: de gecompileerde graph moet matchen met de config.
    const rounds = result.graph.nodes.filter(n => n.type === "round").length
    const injects = result.graph.nodes.filter(n => n.type === "inject").length
    const decisions = result.graph.nodes.filter(n => n.type === "decision").length
    if (rounds !== scenario.config.rounds) {
      throw new Error(`Structuur: verwacht ${scenario.config.rounds} rondes, kreeg ${rounds}`)
    }
    if (injects !== scenario.config.rounds * scenario.config.injectsPerRound) {
      throw new Error(`Structuur: verwacht ${scenario.config.rounds * scenario.config.injectsPerRound} injects, kreeg ${injects}`)
    }
    if (decisions !== scenario.config.rounds) {
      throw new Error(`Structuur: verwacht ${scenario.config.rounds} decisions, kreeg ${decisions}`)
    }
    // Opties: elke decision moet rolesIncluded × optionsPerRolePerRound opties hebben.
    const expectedOpts = scenario.config.rolesIncluded.length * scenario.config.optionsPerRolePerRound
    for (const dnode of result.graph.nodes) {
      if (dnode.type === "decision") {
        const data = dnode.data as { options?: unknown[] }
        if (!Array.isArray(data.options) || data.options.length !== expectedOpts) {
          throw new Error(`Structuur: decision ${dnode.id} heeft ${data.options?.length ?? 0} opties, verwacht ${expectedOpts}`)
        }
      }
    }

    mkdirSync("scripts/e2e-output", { recursive: true })
    writeFileSync(`scripts/e2e-output/${scenario.name}.graph.json`, JSON.stringify(result.graph, null, 2))
    writeFileSync(`scripts/e2e-output/${scenario.name}.plan.json`, JSON.stringify(plan, null, 2))
    return {
      name: scenario.name,
      ok: true,
      msg: "geldige graph gecompileerd + framework passed",
      stats: {
        nodes: result.graph.nodes.length,
        edges: result.graph.edges.length,
        rounds: result.graph.nodes.filter(n => n.type === "round").length,
        injects: result.graph.nodes.filter(n => n.type === "inject").length,
        decisions: result.graph.nodes.filter(n => n.type === "decision").length,
        outcomes: result.graph.nodes.filter(n => n.type === "outcome").length,
        repairAttempts: result.repairLog.length,
      },
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    const stack = err instanceof Error && err.stack ? err.stack.split("\n").slice(0, 4).join("\n") : ""
    return { name: scenario.name, ok: false, msg: `${msg}\n${stack}` }
  }
}

async function main() {
  const scenarios = makeScenarios()
  const results: RunResult[] = []

  for (const scenario of scenarios) {
    process.stdout.write(`▶ ${scenario.name.padEnd(26)}`)
    const r = await runOne(scenario)
    results.push(r)
    if (r.ok && r.stats) {
      const s = r.stats
      console.log(`  ✅  ${s.nodes} nodes (${s.rounds}R ${s.injects}I ${s.decisions}D ${s.outcomes}O), ${s.edges} edges, ${s.repairAttempts} repairs`)
    } else {
      console.log(`  ❌  ${r.msg.split("\n")[0]}`)
    }
  }

  console.log()
  const failed = results.filter(r => !r.ok)
  if (failed.length > 0) {
    console.error(`❌ ${failed.length}/${results.length} scenarios gefaald:\n`)
    for (const f of failed) console.error(`  [${f.name}] ${f.msg}\n`)
    process.exit(1)
  } else {
    console.log(`✅ Alle ${results.length} scenarios geslaagd.`)
    console.log(`   Output in scripts/e2e-output/<scenario>.graph.json`)
  }
}

main()
