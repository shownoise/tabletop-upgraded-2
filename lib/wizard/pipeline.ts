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
  return JSON.parse(json) as WizardPlan
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

Framework-regels die de code toetst:
1. Elke decision heeft een setup-inject in dezelfde of vorige ronde (inject.setsUpDecisionNodeId).
2. Per decision: exact ${config.optionsPerRolePerRound} opties per rol.
3. Geen enkele optie domineert een andere op alle 6 outcome-assen.
4. Een aanname-inject mag nooit de enige setup zijn — feiten moeten een decision aankondigen (aannames mogen wél meebewegen).
5. Ronde N≥2 verwijst zichtbaar naar keuze/les uit ronde N-1.
6. Elke optie beweegt minstens één as van CONT/FOR/BC/JUR/VER/KOS (in -2..+2).
7. Fractie 'feit' in classificaties ≈ ${config.factsNoiseRatio.toFixed(2)} (±0.15).
8. Elke geselecteerde special condition verschijnt in het vereiste aantal rondes.
9. Minstens één inject met triggersRegulatoryNotification=true, met verwijzing naar de toezichthouder.
10. Elke ronde heeft facilitatorNotes.discussionGoal; feiten/namen in de goal moeten ook in de ronde-inhoud staan.

Geef ALLEEN geldige JSON terug volgens het WizardPlan schema, geen markdown, geen uitleg.`
}

// Build the outline prompt — round titles + one-sentence situations.
function buildOutlinePrompt(config: WizardConfig): string {
  return `Genereer eerst een OUTLINE: geef als JSON exact { "rounds": [{ "title": "…", "situation": "1 zin" }, …] } met precies ${config.rounds} entries. Geen andere velden.`
}

// Build the per-round generation prompt.
function buildRoundPrompt(config: WizardConfig, roundIdx: number, outline: OutlineRound[], previousRounds: WizardPlan['rounds'], previousDecisions: NonNullable<WizardPlan['decisions']>): string {
  const outlineJson = JSON.stringify(outline)
  return `Genereer ronde ${roundIdx + 1} van ${config.rounds}. Outline: ${outlineJson}.

Reeds eerder gegenereerd:
- Vorige rondes (${previousRounds.length}): ${JSON.stringify(previousRounds).slice(0, 4000)}
- Eerdere decisions: ${JSON.stringify(previousDecisions).slice(0, 2000)}

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

  // ── 2. Per-round generation ─────────────────────────────────────────
  const rounds: WizardPlan['rounds'] = []
  const decisions: NonNullable<WizardPlan['decisions']> = []
  for (let i = 0; i < config.rounds; i++) {
    const roundRaw = await opts.llm([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: buildRoundPrompt(config, i, outlineParsed.rounds, rounds, decisions) },
    ])
    const block = JSON.parse(extractJson(roundRaw)) as RoundGeneratedBlock
    if (!block.round) throw new Error(`Ronde ${i + 1}: LLM gaf geen 'round' terug`)
    rounds.push(block.round)
    if (block.decision) decisions.push({ ...block.decision, afterRoundIndex: i })
  }

  // Assemble the full plan. Ask the LLM once more for outcomes + roleBriefings
  // + injectLibrary + name/scenarioType/irPlaybook so we don't hard-code them.
  const closerRaw = await opts.llm([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `Geef nu als JSON: { "name": "…", "scenarioType": "ransomware_double_extortion" | "insider_threat" | "bec_cfo_fraud" | "supply_chain_compromise", "irPlaybook": "…markdown…", "outcomes": [ { "key": "…", "label": "…", "narrative": "…", "lessonLearned": "…", "scoreRange": {"min":…, "max":…} } ], "roleBriefings": { "ceo": {"text": "…", "playbookGaps": ["…"]}, … }, "injectLibrary": [ { "id":"…", "label":"…", "channel":"…", "urgency":"…", "classification":"feit|aanname", "title":"…", "content":"…" } ] }. Minstens 3 outcomes, roleBriefings voor elk van ${config.rolesIncluded.join(", ")}.` },
  ])
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
