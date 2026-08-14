import type {
  DecisionNodeData,
  InjectNodeData,
  RoundNodeData,
  ScenarioGraph,
  GraphNode,
  OutcomeVector,
} from "@/lib/graph/types"
import type { Role } from "@/lib/types"
import { buildRoundIndexMap } from "@/lib/graph/setup-injects"
import type { WizardConfig } from "./config"
import { specialConditionById } from "./config"
import { REGULATORY_REGIMES } from "@/lib/regulatory/regimes"

// Phase 9 — Generation Framework Rules.
//
// Ten rules, each expressed as a pure function on (graph, config). Every rule
// returns either { ok: true } or { ok: false, violation, hint }. The pipeline
// runs the whole set after each generation and feeds specific violations back
// to the LLM for a targeted repair.
//
// The rules are DELIBERATELY in code, not in the model prompt. Prose-only
// rules become "hopes"; code rules are enforced.

export interface RuleFailure {
  ruleId: string
  violation: string
  hint: string
}

export type RuleResult = { ok: true } | ({ ok: false } & Omit<RuleFailure, 'ruleId'>)

// ───────────────────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────────────────

function isDecision(n: GraphNode): n is GraphNode & { data: DecisionNodeData } {
  return n.type === 'decision'
}
function isInject(n: GraphNode): n is GraphNode & { data: InjectNodeData } {
  return n.type === 'inject'
}
function isRound(n: GraphNode): n is GraphNode & { data: RoundNodeData } {
  return n.type === 'round'
}

const OUTCOME_AXES: Array<keyof OutcomeVector> = ['CONT', 'FOR', 'BC', 'JUR', 'VER', 'KOS']

function decisionNodes(graph: ScenarioGraph): Array<GraphNode & { data: DecisionNodeData }> {
  return graph.nodes.filter(isDecision)
}
function injectNodes(graph: ScenarioGraph): Array<GraphNode & { data: InjectNodeData }> {
  return graph.nodes.filter(isInject)
}
function roundNodes(graph: ScenarioGraph): Array<GraphNode & { data: RoundNodeData }> {
  return graph.nodes.filter(isRound)
}

// Order rounds by their assigned round-number (1-based) so rule 5 can walk them.
function orderedRounds(graph: ScenarioGraph): Array<{ node: GraphNode & { data: RoundNodeData }; roundNumber: number }> {
  const map = buildRoundIndexMap(graph)
  const rounds = roundNodes(graph)
    .map(node => ({ node, roundNumber: map.roundNumberById.get(node.id) ?? 0 }))
    .filter(r => r.roundNumber > 0)
  rounds.sort((a, b) => a.roundNumber - b.roundNumber)
  return rounds
}

// Return all inject nodes whose parent round has the given round number.
function injectsInRound(graph: ScenarioGraph, roundNumber: number): Array<GraphNode & { data: InjectNodeData }> {
  const map = buildRoundIndexMap(graph)
  return injectNodes(graph).filter(n => map.byNode.get(n.id) === roundNumber)
}

// Return the decisions whose parent round has the given round number.
function decisionsInRound(graph: ScenarioGraph, roundNumber: number): Array<GraphNode & { data: DecisionNodeData }> {
  const map = buildRoundIndexMap(graph)
  return decisionNodes(graph).filter(n => map.byNode.get(n.id) === roundNumber)
}

// ───────────────────────────────────────────────────────────────────────────
// Rule 1 — every decision has a setup-inject in same or previous round
// ───────────────────────────────────────────────────────────────────────────
export function ruleEveryDecisionHasSetupInject(graph: ScenarioGraph): RuleResult {
  const map = buildRoundIndexMap(graph)
  const decisions = decisionNodes(graph)
  const injects = injectNodes(graph)
  const missing: string[] = []
  for (const d of decisions) {
    const dRound = map.byNode.get(d.id)
    if (!dRound) continue
    const setups = injects.filter(i => {
      if (i.data.setsUpDecisionNodeId !== d.id) return false
      const iRound = map.byNode.get(i.id)
      if (!iRound) return false
      return iRound === dRound || iRound === dRound - 1
    })
    if (setups.length === 0) missing.push(d.id)
  }
  if (missing.length === 0) return { ok: true }
  return {
    ok: false,
    violation: `Decision(s) zonder setup-inject: ${missing.join(', ')}`,
    hint: 'Voeg per genoemde decision een inject toe in dezelfde of de direct voorafgaande ronde met setsUpDecisionNodeId gelijk aan het decision-id. De inject moet de spanning of het dilemma van die beslissing introduceren.',
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Rule 2 — per-role options match config.optionsPerRolePerRound
// ───────────────────────────────────────────────────────────────────────────
export function ruleOptionsPerRoleMatchConfig(graph: ScenarioGraph, config: WizardConfig): RuleResult {
  const decisions = decisionNodes(graph)
  const target = config.optionsPerRolePerRound
  const problems: string[] = []
  for (const d of decisions) {
    if (!d.data.perRole) continue
    const byRole = new Map<Role, number>()
    for (const opt of d.data.options) {
      if (!opt.allowedRole) continue
      byRole.set(opt.allowedRole, (byRole.get(opt.allowedRole) ?? 0) + 1)
    }
    // Only fail for roles that appear at all (an unhandled role is a different
    // problem — see rule 10 / coverage warnings). Count must match the target
    // exactly; off-by-one fails.
    for (const [role, count] of byRole) {
      if (count !== target) {
        problems.push(`${d.id} ${role}=${count}(target ${target})`)
      }
    }
  }
  if (problems.length === 0) return { ok: true }
  return {
    ok: false,
    violation: `Per-role optie-aantal wijkt af van target ${target}: ${problems.join('; ')}`,
    hint: `Voeg opties toe of verwijder opties zodat elke rol op elke decision precies ${target} opties heeft. Configuratie: optionsPerRolePerRound=${target}.`,
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Rule 3 — no strictly-dominating option per decision
// ───────────────────────────────────────────────────────────────────────────
export function ruleNoDominantOption(graph: ScenarioGraph): RuleResult {
  const decisions = decisionNodes(graph)
  const problems: string[] = []
  for (const d of decisions) {
    // In a perRole:true decision a participant only sees options for their own
    // role, so cross-role dominance is meaningless — an author is expected to
    // shape different vectors for CISO vs. Legal without those being comparable.
    // Compare only within-role option pairs. For facilitator-picked (perRole:false)
    // decisions, everyone sees every option, so compare all pairs.
    const withVec = d.data.options.filter(o => o.outcomeVector)
    const groups = d.data.perRole === true
      ? Object.values(groupBy(withVec, o => o.allowedRole ?? '__any__'))
      : [withVec]
    for (const options of groups) {
      for (let i = 0; i < options.length; i++) {
        for (let j = 0; j < options.length; j++) {
          if (i === j) continue
          const A = options[i].outcomeVector!
          const B = options[j].outcomeVector!
          let dominatesEvery = true
          let strictlyOnOne = false
          for (const ax of OUTCOME_AXES) {
            const a = A[ax] ?? 0
            const b = B[ax] ?? 0
            if (a < b) { dominatesEvery = false; break }
            if (a > b) strictlyOnOne = true
          }
          if (dominatesEvery && strictlyOnOne) {
            problems.push(`${d.id}: "${options[i].label}" domineert "${options[j].label}"`)
          }
        }
      }
    }
  }
  if (problems.length === 0) return { ok: true }
  return {
    ok: false,
    violation: `Dominante opties gevonden: ${problems.join('; ')}`,
    hint: 'Elke optie moet een trade-off zijn — er mag geen optie zijn die op elke as ≥ een andere is (en op minstens één strikt >). Verlaag de dominante optie op minstens één as, of verhoog de gedomineerde op minstens één andere.',
  }
}

function groupBy<T>(items: T[], key: (t: T) => string): Record<string, T[]> {
  const out: Record<string, T[]> = {}
  for (const it of items) {
    const k = key(it)
    ;(out[k] ??= []).push(it)
  }
  return out
}

// ───────────────────────────────────────────────────────────────────────────
// Rule 4 — geen enkele decision mag ALLEEN misleidende injects als setup hebben.
//
// Semantiek: ground truth is 'reliability' (fact / assumption / misleading).
// Een decision moet gedragen worden door minstens één inject die WAAR is (fact
// of ten minste een aanname) — anders leunt de beslissing op verzonnen info,
// wat pedagogisch niet houdbaar is voor wizard-generatie.
//
// Alleen actief in de wizard-pipeline (validateFramework). Bestaande scenarios
// die dit overtreden krijgen hier geen blokkade — de builder toont dit apart
// als warning via lib/graph/validate.ts als je die uitbreidt.
// ───────────────────────────────────────────────────────────────────────────
export function ruleNoiseNeverCarriesOnlyPath(graph: ScenarioGraph): RuleResult {
  const injects = injectNodes(graph)
  const setupsByDecision = new Map<string, Array<{ id: string; reliability?: string }>>()
  for (const i of injects) {
    const target = i.data.setsUpDecisionNodeId
    if (!target) continue
    const arr = setupsByDecision.get(target) ?? []
    arr.push({ id: i.id, reliability: i.data.reliability })
    setupsByDecision.set(target, arr)
  }
  const problems: string[] = []
  for (const [target, setups] of setupsByDecision.entries()) {
    if (setups.length === 0) continue
    // Alleen falen als álle setups misleidend zijn (of onbekend + misleidend).
    // Als er minstens één fact of assumption bij zit, is de decision gedragen.
    const anyTruthful = setups.some(s => s.reliability === 'fact' || s.reliability === 'assumption')
    if (anyTruthful) continue
    const allMisleading = setups.every(s => s.reliability === 'misleading')
    if (allMisleading) {
      problems.push(`decision ${target}: alleen misleidende setup-injects (${setups.map(s => s.id).join(', ')})`)
    }
  }
  if (problems.length === 0) return { ok: true }
  return {
    ok: false,
    violation: `Decisions op alleen misleidende setups: ${problems.join('; ')}`,
    hint: 'Elke decision moet minstens één feit- of aanname-setup hebben. Een decision op puur misleidende injects test alleen of het team liegt kan herkennen — voeg een echt signaal (reliability=fact of assumption) toe of downgrade een misleidend-inject.',
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Rule 5 — round N (N≥2) references prior-round decision lesson
// ───────────────────────────────────────────────────────────────────────────
export function ruleRoundReferencesPrevRoundConsequence(graph: ScenarioGraph): RuleResult {
  const rounds = orderedRounds(graph)
  const map = buildRoundIndexMap(graph)
  const problems: string[] = []

  for (let idx = 1; idx < rounds.length; idx++) {
    const cur = rounds[idx]
    const prev = rounds[idx - 1]
    // Collect previous round decision option labels + lessonLearned strings.
    const prevDecisions = decisionsInRound(graph, prev.roundNumber)
    const needles: string[] = []
    for (const d of prevDecisions) {
      for (const opt of d.data.options) {
        if (opt.label) needles.push(opt.label)
        if (opt.lessonLearned) needles.push(opt.lessonLearned)
      }
    }
    if (needles.length === 0) continue // no prior decisions to reference
    const situation = cur.node.data.situation_update ?? ''
    const haystack = situation.toLowerCase()
    const found = needles.some(n => {
      // Fuzzy substring: take the first 12 chars of the needle (or all if
      // shorter). This lets the LLM paraphrase without needing verbatim quote.
      const key = n.toLowerCase().trim().slice(0, 12)
      if (key.length < 4) return false
      return haystack.includes(key)
    })
    if (!found) {
      problems.push(`ronde ${cur.roundNumber} (${cur.node.id}) verwijst niet naar ronde ${prev.roundNumber} keuzes`)
      // Ensure map is exercised so unused-var lint stays quiet.
      void map
    }
  }
  if (problems.length === 0) return { ok: true }
  return {
    ok: false,
    violation: `Ontbrekende cross-round koppeling: ${problems.join('; ')}`,
    hint: 'Herschrijf de situation_update van de genoemde ronde zodat er expliciet wordt teruggegrepen op een keuze of les uit de vorige ronde (parafraseren mag, maar de eerste woorden van de optie-label of lessonLearned moeten herkenbaar terugkomen).',
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Rule 6 — every option maps to at least one non-zero outcome axis
// ───────────────────────────────────────────────────────────────────────────
export function ruleEveryDecisionMapsToDimension(graph: ScenarioGraph): RuleResult {
  const problems: string[] = []
  for (const d of decisionNodes(graph)) {
    for (const opt of d.data.options) {
      const v = opt.outcomeVector
      if (!v) {
        problems.push(`${d.id}: "${opt.label}" zonder outcomeVector`)
        continue
      }
      const allZero = OUTCOME_AXES.every(ax => (v[ax] ?? 0) === 0)
      if (allZero) problems.push(`${d.id}: "${opt.label}" alle-nul vector`)
    }
  }
  if (problems.length === 0) return { ok: true }
  return {
    ok: false,
    violation: `Opties zonder impact op enige as: ${problems.join('; ')}`,
    hint: 'Elke decision-optie moet minstens één van CONT/FOR/BC/JUR/VER/KOS bewegen (waarde in -2..+2). Kies voor elke optie welke dimensie het duidelijkst raakt en zet daar minstens ±1.',
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Rule 7 — classification ratio approximates config.factsNoiseRatio (±0.15)
// ───────────────────────────────────────────────────────────────────────────
export function ruleClassificationRatio(graph: ScenarioGraph, config: WizardConfig): RuleResult {
  const classified = injectNodes(graph).filter(i => !!i.data.classification)
  if (classified.length === 0) {
    // No classified injects at all → hard fail; the wizard should always
    // classify.
    return {
      ok: false,
      violation: 'Geen injects met classification — kan factsNoiseRatio niet toetsen',
      hint: 'Voorzie ELKE inject van een classification (feit of aanname).',
    }
  }
  const facts = classified.filter(i => i.data.classification === 'feit').length
  const ratio = facts / classified.length
  const diff = Math.abs(ratio - config.factsNoiseRatio)
  if (diff <= 0.15) return { ok: true }
  return {
    ok: false,
    violation: `Feit-ratio ${ratio.toFixed(2)} wijkt te veel af van target ${config.factsNoiseRatio.toFixed(2)}`,
    hint: `Verschuif classificaties: ${ratio < config.factsNoiseRatio ? 'meer feit, minder aanname' : 'meer aanname, minder feit'}. Target-marge ±0.15.`,
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Rule 8 — every selected special condition appears in ≥ roundsRequired rounds
// ───────────────────────────────────────────────────────────────────────────
export function ruleSpecialConditionsAppear(graph: ScenarioGraph, config: WizardConfig): RuleResult {
  if (config.specialConditions.length === 0) return { ok: true }
  const rounds = orderedRounds(graph)
  const problems: string[] = []

  for (const condId of config.specialConditions) {
    const cond = specialConditionById(condId)
    if (!cond) continue
    // Take a stable 20-char slice of the prompt as the search key. LLM can
    // paraphrase around it but must include this core phrase.
    const key = cond.narrativePrompt.toLowerCase().slice(0, 20)
    let hits = 0
    for (const r of rounds) {
      const situation = (r.node.data.situation_update ?? '').toLowerCase()
      const injectText = injectsInRound(graph, r.roundNumber)
        .map(i => `${i.data.title ?? ''} ${i.data.content ?? ''}`)
        .join(' ')
        .toLowerCase()
      // Fuzzy: split key into two halves and count either-substring as a hit.
      const half1 = key.slice(0, 10)
      const half2 = key.slice(10, 20)
      const matches = (t: string) =>
        (half1.length >= 4 && t.includes(half1)) ||
        (half2.length >= 4 && t.includes(half2))
      if (matches(situation) || matches(injectText)) hits += 1
    }
    if (hits < cond.roundsRequired) {
      problems.push(`${condId} verschijnt in ${hits}/${cond.roundsRequired} rondes`)
    }
  }
  if (problems.length === 0) return { ok: true }
  return {
    ok: false,
    violation: `Special conditions onvoldoende vertegenwoordigd: ${problems.join('; ')}`,
    hint: 'Voor elke special condition: weef de narrativePrompt (of een duidelijke parafrasering) in de situation_update of in de inject-teksten van het vereiste aantal rondes.',
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Rule 9 — regulatory notification is placed with correct authority reference
// ───────────────────────────────────────────────────────────────────────────
export function ruleRegulatoryWindowPlaced(graph: ScenarioGraph, config: WizardConfig): RuleResult {
  const regime = REGULATORY_REGIMES[config.regulatoryRegimeId]
  if (!regime) {
    return {
      ok: false,
      violation: `Onbekend regulatoryRegimeId: ${config.regulatoryRegimeId}`,
      hint: 'Kies een geldig regime (bv. nl_avg_nis2).',
    }
  }
  const injects = injectNodes(graph)
  const trigger = injects.filter(i => i.data.triggersRegulatoryNotification === true)
  if (trigger.length === 0) {
    return {
      ok: false,
      violation: 'Geen enkele inject heeft triggersRegulatoryNotification=true',
      hint: 'Voeg minstens één inject toe (bij voorkeur in een middenronde) met triggersRegulatoryNotification=true zodat de meldplicht-klok start.',
    }
  }
  // Extract authority keywords from the regime label; if the regime is
  // nl_avg_nis2, they include "AP", "AVG", "NIS2".
  const authority = regime.authorityLabel.toLowerCase()
  const keywords: string[] = []
  if (authority.includes('autoriteit persoonsgegevens') || authority.includes('avg')) keywords.push('avg', 'ap', 'autoriteit')
  if (authority.includes('nis2') || authority.includes('ncsc') || authority.includes('csirt')) keywords.push('nis2', 'ncsc', 'csirt')
  const flagged = trigger.some(i => {
    const t = `${i.data.title ?? ''} ${i.data.content ?? ''}`.toLowerCase()
    return keywords.some(k => t.includes(k))
  })
  if (!flagged) {
    return {
      ok: false,
      violation: `Meldplicht-inject bevat geen verwijzing naar toezichthouder (${keywords.join(' / ')})`,
      hint: `Vermeld in de titel of tekst van de trigger-inject één van: ${keywords.join(', ')}.`,
    }
  }
  return { ok: true }
}

// ───────────────────────────────────────────────────────────────────────────
// Rule 10 — facilitator guidance exists and is grounded in round content
// ───────────────────────────────────────────────────────────────────────────
export function ruleFacilitatorGuidanceExists(graph: ScenarioGraph): RuleResult {
  const rounds = orderedRounds(graph)
  const problems: string[] = []
  for (const r of rounds) {
    const notes = r.node.data.facilitatorNotes
    const goal = notes?.discussionGoal?.trim() ?? ''
    if (!goal) {
      problems.push(`ronde ${r.roundNumber} zonder discussionGoal`)
      continue
    }
    // Approximate grounding: any sentence in the goal that contains a specific
    // number (e.g. "72 uur", "€500k") or a proper noun (a capitalized word ≥3
    // chars not starting a sentence) must reappear in the round content.
    const roundContent = `${r.node.data.situation_update ?? ''} ${injectsInRound(graph, r.roundNumber).map(i => `${i.data.title ?? ''} ${i.data.content ?? ''}`).join(' ')}`
    const roundLower = roundContent.toLowerCase()

    // Numbers with unit suffixes — only when a specific numeric quantity is
    // named. Bare years like "24" or "72" that aren't in the round text are
    // treated as "concrete claims" and must be grounded.
    const numbers = goal.match(/\b\d+[.,]?\d*\s?(?:%|uur|dagen|weken|k|m|€|eur|min|minuten|uren)?\b/gi) ?? []

    // Proper nouns: capitalized words length ≥3. Because Dutch capitalizes the
    // first word of every sentence AND many common verbs are Dutch words that
    // happen to be capitalized at sentence-start (e.g. "Bespreek"), we only
    // flag capitalized tokens that are (a) NOT the first token of a sentence,
    // AND (b) not in a small stopword set. First-token check strips exactly
    // the leading word after each sentence boundary.
    const goalNoLeaders = goal.replace(/(^|[.!?]\s+)([A-Z][A-Za-z0-9-]{2,})/g, '$1')
    const stops = new Set(['De', 'Het', 'Een', 'En', 'Of', 'Bij', 'Naar', 'Voor', 'Met', 'Van', 'Op', 'In', 'Aan', 'Om', 'Als', 'Dat', 'Die', 'Tot', 'Uit', 'Nu', 'Ook', 'Nog', 'Daar', 'Hier', 'Wel', 'Test', 'Bespreek', 'Wat', 'Hoe', 'Waarom'])
    const properNouns = (goalNoLeaders.match(/\b[A-Z][A-Za-z0-9-]{2,}\b/g) ?? []).filter(w => !stops.has(w))

    const unmatched: string[] = []
    for (const n of numbers) {
      const key = n.toLowerCase().trim()
      if (key.length >= 2 && !roundLower.includes(key)) unmatched.push(n)
    }
    for (const p of properNouns) {
      const key = p.toLowerCase()
      if (!roundLower.includes(key)) unmatched.push(p)
    }
    if (unmatched.length > 0) {
      problems.push(`ronde ${r.roundNumber}: discussionGoal noemt onbekend ${unmatched.slice(0, 3).join(', ')}`)
    }
  }
  if (problems.length === 0) return { ok: true }
  return {
    ok: false,
    violation: `Facilitator sturing niet gegrond in ronde-inhoud: ${problems.join('; ')}`,
    hint: 'De discussionGoal mag alleen concreet feit- of naamgebruik bevatten dat ook echt in de situation_update of injects van dezelfde ronde staat. Anders lees de facilitator een tegenstrijdig verhaal voor.',
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Aggregate
// ───────────────────────────────────────────────────────────────────────────

export interface FrameworkResult {
  ok: boolean
  failures: RuleFailure[]
}

const RULES: Array<{ id: string; fn: (g: ScenarioGraph, c: WizardConfig) => RuleResult }> = [
  { id: 'rule1_setup_inject',           fn: (g)     => ruleEveryDecisionHasSetupInject(g) },
  { id: 'rule2_options_per_role',       fn: (g, c)  => ruleOptionsPerRoleMatchConfig(g, c) },
  { id: 'rule3_no_dominant',            fn: (g)     => ruleNoDominantOption(g) },
  { id: 'rule4_noise_not_only_path',    fn: (g)     => ruleNoiseNeverCarriesOnlyPath(g) },
  { id: 'rule5_cross_round_lesson',     fn: (g)     => ruleRoundReferencesPrevRoundConsequence(g) },
  { id: 'rule6_dimension_mapped',       fn: (g)     => ruleEveryDecisionMapsToDimension(g) },
  { id: 'rule7_classification_ratio',   fn: (g, c)  => ruleClassificationRatio(g, c) },
  { id: 'rule8_special_conditions',     fn: (g, c)  => ruleSpecialConditionsAppear(g, c) },
  { id: 'rule9_regulatory_window',      fn: (g, c)  => ruleRegulatoryWindowPlaced(g, c) },
  { id: 'rule10_facilitator_guidance',  fn: (g)     => ruleFacilitatorGuidanceExists(g) },
]

export function validateFramework(graph: ScenarioGraph, config: WizardConfig): FrameworkResult {
  const failures: RuleFailure[] = []
  for (const r of RULES) {
    const res = r.fn(graph, config)
    if (!res.ok) failures.push({ ruleId: r.id, violation: res.violation, hint: res.hint })
  }
  return { ok: failures.length === 0, failures }
}

export const FRAMEWORK_RULE_IDS: readonly string[] = RULES.map(r => r.id)
