import type { ScenarioGraph } from "@/lib/graph/types"
import { planToGraph, type WizardPlan } from "@/lib/graph/wizard-plan"
import { validateFramework, type RuleFailure } from "./framework"
import type { WizardConfig } from "./config"
import { specialConditionById } from "./config"
import { cryptoRandomSeed } from "./seed"
import { REGULATORY_REGIMES } from "@/lib/regulatory/regimes"

// Phase 9 — the Wizard pipeline.
//
// The pipeline sequence:
//   1. Determine the seed (config.seed or cryptoRandomSeed()).
//   2. Outline pass — LLM produces a list of round titles + brief situation.
//   3. Per-round generation — LLM produces situation + injects + decisions +
//      facilitator guidance for each round, given the outline and prior rounds.
//   4. Compile the assembled WizardPlan → ScenarioGraph via planToGraph.
//   5. Framework validation — run all 10 rules from framework.ts.
//   6. If failures: send the LLM the specific rule + hint + current plan;
//      request a minimal fix; replace affected nodes only; retry.
//   7. On repeated failure: throw with the list of un-fixable rules. The
//      wizard NEVER writes a graph that violates the framework.
//
// The compiled graph is always publishStatus='draft' — the wizard never
// publishes directly; the builder promotes explicitly.

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export type WizardLlm = (messages: LlmMessage[]) => Promise<string>

export interface PipelineOptions {
  llm: WizardLlm
  maxRepairAttempts?: number    // default 3
  // Optional injection for tests — override wall clock.
  now?: () => number
}

export interface RepairLogEntry {
  attempt: number       // 1-based repair round
  ruleId: string
  violation: string
}

export interface PipelineResult {
  graph: ScenarioGraph
  seed: string
  repairLog: RepairLogEntry[]
}

// Extract the last JSON object from a text response. LLMs sometimes wrap
// output in code fences even when told not to; be tolerant.
export function extractJson(text: string): string {
  const cleaned = text.replace(/```json|```/g, "").trim()
  // If the cleaned string begins with a JSON object/array, use it directly.
  if (cleaned.startsWith("{") || cleaned.startsWith("[")) return cleaned
  // Otherwise find the first `{` and the matching last `}`.
  const first = cleaned.indexOf("{")
  const last = cleaned.lastIndexOf("}")
  if (first >= 0 && last > first) return cleaned.slice(first, last + 1)
  return cleaned
}

function parsePlan(text: string): WizardPlan {
  const json = extractJson(text)
  return normalizePlan(JSON.parse(json) as WizardPlan)
}

// Normaliseer arrays die de LLM soms als object/null/undefined teruggeeft.
// Beter een leeg array met warning dan een crash op .map/.forEach/.length
// verderop in de pipeline. Kritieke velden (rounds ontbreekt) → laat door
// zodat de validator er een leesbare fout van maakt.
function normalizePlan(plan: WizardPlan): WizardPlan {
  if (!Array.isArray(plan.rounds)) {
    console.warn("[wizard-plan] plan.rounds geen array — leeg gemaakt")
    plan.rounds = []
  }
  if (plan.decisions != null && !Array.isArray(plan.decisions)) {
    console.warn(`[wizard-plan] plan.decisions geen array (kreeg: ${typeof plan.decisions}) — leeg gemaakt`)
    plan.decisions = []
  }
  if (plan.outcomes != null && !Array.isArray(plan.outcomes)) {
    console.warn(`[wizard-plan] plan.outcomes geen array — leeg gemaakt`)
    plan.outcomes = []
  }
  if (plan.injectLibrary != null && !Array.isArray(plan.injectLibrary)) {
    plan.injectLibrary = []
  }
  // Per round: injects moet array zijn.
  for (const round of plan.rounds) {
    if (round && !Array.isArray(round.injects)) {
      round.injects = []
    }
  }
  // Per decision: options moet array zijn — anders skippen we hem verderop.
  // Hier niet skippen (behoud volgorde/afterRoundIndex), gewoon options leeg
  // maken zodat planToGraph 'm netjes kan afvangen.
  for (const d of (plan.decisions ?? [])) {
    if (d && !Array.isArray(d.options)) {
      console.warn(`[wizard-plan] decision ${d.authorId ?? "?"} — options leeg gemaakt (was ${typeof d.options})`)
      d.options = []
    }
  }
  return plan
}

// Assemble the base LLM system prompt given a config. Includes all the config
// levers so the model can be steered before we resort to repair.
export function buildSystemPrompt(config: WizardConfig): string {
  const regime = REGULATORY_REGIMES[config.regulatoryRegimeId]
  const regimeLine = regime
    ? `Meldplicht-regime: ${regime.authorityLabel} (${regime.jurisdiction}). Minstens één inject moet triggersRegulatoryNotification=true hebben en de toezichthouder benoemen.`
    : `Meldplicht-regime: onbekend (${config.regulatoryRegimeId}).`
  const conds = config.specialConditions
    .map(id => specialConditionById(id))
    .filter((c): c is NonNullable<ReturnType<typeof specialConditionById>> => !!c)
    .map(c => `  - [${c.id}] ${c.narrativePrompt} (in minstens ${c.roundsRequired} verschillende rondes)`)
    .join("\n") || "  (geen)"

  return `Je bent een tabletop-scenarioschrijver voor Eye Security's IR-retainer klanten. Genereer een compleet scenario als een WizardPlan-JSON. Volg de framework-regels — code valideert ze achteraf.

Klant: ${config.clientName}
Sector: ${config.sector}
Bedrijfsgrootte: ${config.companySize}
IT-inrichting: ${config.itArrangement}
${config.importantContext ? `Extra context: ${config.importantContext}` : ""}

Structuur:
- Aantal rondes: ${config.rounds}
- Injects per ronde: ${config.injectsPerRound}
- Opties per rol per decision: ${config.optionsPerRolePerRound}
- Feit/aanname-ratio: ${config.factsNoiseRatio.toFixed(2)} (0 = alle aannames, 1 = alle feiten). Elke inject krijgt classification 'feit' of 'aanname'.

Rollen betrokken: ${config.rolesIncluded.join(", ")}

${regimeLine}

Special conditions (verweef in de inhoud):
${conds}

Narratieve richtlijnen (geen strikte framework-check maar wél kwaliteitscriterium):

A. Keuzes van onderop. Beslissingen komen bij voorkeur van onderop aangedragen — iemand onder de verantwoordelijke rol stelt iets voor (technisch medewerker vraagt aan CISO of ze isoleren; MSP-engineer suggereert de retainer te activeren; controller stelt aan CFO voor de verzekeraar te bellen). Het decision-moment is dan "keur je dit voorstel goed?" of "kies uit deze varianten die het team heeft aangedragen". Niet elke decision moet zo, maar minstens de helft.

B. Balans ruis / toegevoegde waarde. De feit-ratio is een numerieke check, maar denk ook aan kwaliteit: sommige injects zijn puur ruis (WhatsApp-gerucht, media-vraag zonder scope), sommige lijken ruis maar dragen verborgen waarde (medewerker appt dat hij misschien de back-up vergat — bleek later relevant). Streef expliciet naar deze mix: ~40-50% signal (echte beslispunt-onderbouwing), ~30% context (feit maar niet direct handeling), ~20-30% ruis-met-verdekte-waarde of pure ruis.

C. Standaard-zwakte in het verhaal. Kies ÉÉN van deze zwaktes en verweef 'm door het scenario:
   - back-ups zijn nooit volledig hersteld getest
   - crisisplan bestaat maar is nooit geoefend
   - crisismandaat is niet vastgelegd (wie mag wat tekenen?)
   - kritieke systeem-kennis zit bij één persoon die onbereikbaar is
   De gekozen zwakte landt in de briefing van de meest-getroffen rol (roleBriefings.<role>.playbookGaps als één van de items), en komt LATER in een decision-moment concreet terug (bijv. een optie "test toch de back-up voor je gaat herstellen" of "activeer plaatsvervangende mandaat"). Dit is de rode draad die de sessie een leermoment geeft.

D. Consequent één taal. Alle vrije-tekstvelden in het Nederlands: titel, content, opties, briefings, prompts, facilitatorNotes. Engelse vaktermen (SLA, MSP, EPD, MDR, DPO, SOC) zijn OK. Volledige Engelse zinnen of losse Engelse woorden ('urgency', 'assumption failed', 'critical event' als label) niet. Consistent = alle scenario-tekst is NL-first.

Framework-regels die de code toetst:
1. Elke decision heeft een setup-inject in dezelfde of vorige ronde (inject.setsUpDecisionNodeId).
2. Per decision: exact ${config.optionsPerRolePerRound} opties per rol (minimum uit config is 3; geen binaire wel-of-niet).
3. Geen enkele optie domineert een andere op alle 6 outcome-assen.
4. Geen enkele decision mag alleen misleidende setup-injects hebben. Het reliability-veld (ground truth) mag 'misleading' zijn voor red-herring injects, maar minstens één setup van elke decision moet reliability=fact of reliability=assumption zijn.
5. Ronde N≥2 verwijst zichtbaar naar keuze/les uit ronde N-1.
6. Elke optie beweegt minstens één as van CONT/FOR/BC/JUR/VER/KOS (in -2..+2).
7. Fractie 'feit' in classificaties ≈ ${config.factsNoiseRatio.toFixed(2)} (±0.15).
8. Elke geselecteerde special condition verschijnt in het vereiste aantal rondes.
9. Minstens één inject met triggersRegulatoryNotification=true, met verwijzing naar de toezichthouder.
10. Elke ronde heeft facilitatorNotes.discussionGoal; feiten/namen in de goal moeten ook in de ronde-inhoud staan.
11. Minstens één rol heeft roleBriefings.<role>.playbookGaps met minstens één ingang — daar landt de standaard-zwakte (richtlijn C).
12. Taalconsistentie: geen losse Engelse zinnen of typische Engelse UI-woorden (urgency/high/critical/handled/dismissed) in NL-teksten. Vaktermen (SLA, MSP, EPD) zijn OK.

Geef ALLEEN geldige JSON terug volgens het WizardPlan schema, geen markdown, geen uitleg.`
}

// Build the outline prompt — round titles + one-sentence situations.
function buildOutlinePrompt(config: WizardConfig): string {
  return `Genereer eerst een OUTLINE: geef als JSON exact { "rounds": [{ "title": "…", "situation": "1 zin" }, …] } met precies ${config.rounds} entries. Geen andere velden.`
}

// Build the per-round generation prompt.
// Merk op: sinds parallel-generation is `previousRounds`/`previousDecisions` leeg —
// consistentie zit dan in de gedeelde outline (elke ronde krijgt de volledige
// outline zodat de LLM weet wat vóór en na komt).
function buildRoundPrompt(config: WizardConfig, roundIdx: number, outline: OutlineRound[], previousRounds: WizardPlan['rounds'], previousDecisions: NonNullable<WizardPlan['decisions']>): string {
  const outlineJson = JSON.stringify(outline)
  const previousContext = previousRounds.length > 0 || previousDecisions.length > 0
    ? `\nReeds eerder gegenereerd:\n- Vorige rondes (${previousRounds.length}): ${JSON.stringify(previousRounds).slice(0, 4000)}\n- Eerdere decisions: ${JSON.stringify(previousDecisions).slice(0, 2000)}\n`
    : ""
  return `Genereer ronde ${roundIdx + 1} van ${config.rounds}. Outline (alle ${config.rounds} rondes): ${outlineJson}.${previousContext}

Consistentie: hou rekening met de outline van vorige én latere rondes zodat het narratief samenhangt.

Geef als JSON: { "round": WizardPlanRound, "decision": WizardPlanDecision | null } — de decision hoort bij deze ronde (afterRoundIndex=${roundIdx}). Gebruik author-id's zoals "r${roundIdx + 1}-d1" voor decision en "r${roundIdx + 1}-i1", "r${roundIdx + 1}-i2" voor injects. Elke inject die een decision opzet, zet setsUpDecisionNodeId op de decision's author-id.`
}

interface OutlineRound {
  title: string
  situation: string
}

interface RoundGeneratedBlock {
  round: WizardPlan['rounds'][number]
  decision: NonNullable<WizardPlan['decisions']>[number] | null
}

// The pipeline entrypoint. Callers pass the config + an LLM callable; the
// pipeline handles outline, per-round generation, compile, validate, and
// repair.
export async function runWizardPipeline(config: WizardConfig, opts: PipelineOptions): Promise<PipelineResult> {
  const maxRepair = opts.maxRepairAttempts ?? 3
  const seed = config.seed && config.seed.trim().length > 0 ? config.seed.trim() : cryptoRandomSeed()
  const now = opts.now ? opts.now() : Date.now()

  const systemPrompt = buildSystemPrompt({ ...config, seed })

  // ── 1. Outline pass ──────────────────────────────────────────────────
  const outlineRaw = await opts.llm([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: buildOutlinePrompt(config) },
  ])
  const outlineParsed = JSON.parse(extractJson(outlineRaw)) as { rounds: OutlineRound[] }
  if (!outlineParsed.rounds || outlineParsed.rounds.length !== config.rounds) {
    throw new Error(`Outline pass produced ${outlineParsed.rounds?.length ?? 0} rondes, verwacht ${config.rounds}.`)
  }

  // ── 2. Per-round generation + closer (alles parallel) ────────────────
  // Voorheen sequentieel: outline → 5x rondes → closer = ~3-4 min.
  // Nu: outline eerst (nodig voor rondes-prompt); rondes en closer daarna
  // volledig parallel. De closer gebruikt niet de rondes-content — hij
  // maakt outcomes, roleBriefings, injectLibrary op basis van systemPrompt
  // en config, dus scheidbaar van de rondes-generatie.
  const closerPromise = opts.llm([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `Geef nu als JSON: { "name": "…", "scenarioType": "ransomware_double_extortion" | "insider_threat" | "bec_cfo_fraud" | "supply_chain_compromise", "irPlaybook": "…markdown…", "outcomes": [ { "key": "…", "label": "…", "narrative": "…", "lessonLearned": "…", "scoreRange": {"min":…, "max":…} } ], "roleBriefings": { "ceo": {"text": "…", "playbookGaps": ["…"]}, … }, "injectLibrary": [ { "id":"…", "label":"…", "channel":"…", "urgency":"…", "classification":"feit|aanname", "title":"…", "content":"…" } ] }. Minstens 3 outcomes, roleBriefings voor elk van ${config.rolesIncluded.join(", ")}.` },
  ])

  const roundPromises = Array.from({ length: config.rounds }, (_, i) =>
    opts.llm([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: buildRoundPrompt(config, i, outlineParsed.rounds, [], []) },
    ]).then(raw => {
      const block = JSON.parse(extractJson(raw)) as RoundGeneratedBlock
      if (!block.round) throw new Error(`Ronde ${i + 1}: LLM gaf geen 'round' terug`)
      // Defensief: als de LLM een decision teruggaf zonder valid options-array,
      // gooi hem weg (behandel als "geen decision deze ronde"). De repair-loop
      // of latere framework-check kan het aanvullen. Beter dan een hard crash
      // in planToGraph.
      if (block.decision && !Array.isArray(block.decision.options)) {
        console.warn(`[wizard] Ronde ${i + 1}: decision gooit weg — options is geen array (kreeg: ${typeof block.decision.options})`)
        block.decision = null
      }
      // Zelfde voor round.injects: LLM moet een array geven.
      if (block.round && !Array.isArray(block.round.injects)) {
        console.warn(`[wizard] Ronde ${i + 1}: injects geen array (kreeg: ${typeof block.round.injects}) — leeg gemaakt`)
        block.round.injects = []
      }
      return { i, block }
    })
  )

  const [roundResults, closerRaw] = await Promise.all([
    Promise.all(roundPromises),
    closerPromise,
  ])

  const rounds: WizardPlan['rounds'] = []
  const decisions: NonNullable<WizardPlan['decisions']> = []
  for (const { i, block } of roundResults.sort((a, b) => a.i - b.i)) {
    rounds.push(block.round)
    if (block.decision) decisions.push({ ...block.decision, afterRoundIndex: i })
  }

  const closer = JSON.parse(extractJson(closerRaw)) as {
    name: string
    scenarioType: WizardPlan['scenarioType']
    irPlaybook?: string
    outcomes: WizardPlan['outcomes']
    roleBriefings?: WizardPlan['roleBriefings']
    injectLibrary?: WizardPlan['injectLibrary']
  }

  let plan: WizardPlan = {
    name: closer.name,
    scenarioType: closer.scenarioType,
    rounds,
    decisions,
    outcomes: closer.outcomes,
    irPlaybook: closer.irPlaybook,
    roleBriefings: closer.roleBriefings,
    injectLibrary: closer.injectLibrary,
  }

  // ── 3-4. Compile + validate ─────────────────────────────────────────
  let graph = planToGraph(plan, { seed, now, publishStatus: 'draft' })
  let result = validateFramework(graph, config)
  const repairLog: RepairLogEntry[] = []

  // ── 5. Repair loop ──────────────────────────────────────────────────
  let attempt = 0
  while (!result.ok && attempt < maxRepair) {
    attempt += 1
    // Feed all outstanding failures at once so the LLM can align its edits.
    const failuresText = result.failures.map(f => `- [${f.ruleId}] ${f.violation}\n  Hint: ${f.hint}`).join("\n")
    const repairRaw = await opts.llm([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `De vorige plan overtreedt deze framework-regels:\n${failuresText}\n\nHuidig plan (JSON):\n${JSON.stringify(plan).slice(0, 12000)}\n\nGeef een aangepast plan als JSON. Verander ALLEEN wat nodig is om de genoemde regels te herstellen — behoud de rest.` },
    ])
    for (const f of result.failures) {
      repairLog.push({ attempt, ruleId: f.ruleId, violation: f.violation })
    }
    try {
      plan = parsePlan(repairRaw)
    } catch (err) {
      throw new Error(`Repair pass ${attempt}: LLM gaf ongeldige JSON (${err instanceof Error ? err.message : String(err)}).`)
    }
    graph = planToGraph(plan, { seed, now, publishStatus: 'draft' })
    result = validateFramework(graph, config)
  }

  if (!result.ok) {
    const remaining = result.failures.map(f => `[${f.ruleId}] ${f.violation}`).join("; ")
    throw new WizardPipelineError(
      `Wizard kon na ${maxRepair} repair-passes niet aan het framework voldoen. Overgebleven schendingen: ${remaining}`,
      result.failures,
      repairLog,
      seed,
    )
  }

  return { graph, seed, repairLog }
}

// Distinct error type so the API route can surface repair-log context without
// resorting to string parsing.
export class WizardPipelineError extends Error {
  readonly failures: RuleFailure[]
  readonly repairLog: RepairLogEntry[]
  readonly seed: string
  constructor(message: string, failures: RuleFailure[], repairLog: RepairLogEntry[], seed: string) {
    super(message)
    this.name = 'WizardPipelineError'
    this.failures = failures
    this.repairLog = repairLog
    this.seed = seed
  }
}
