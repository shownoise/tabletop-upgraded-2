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
export function ruleDecisionPerRound(graph: ScenarioGraph, config: WizardConfig): RuleResult {
  const rounds = orderedRounds(graph)
  const missing = rounds
    .filter(({ roundNumber }) => decisionsInRound(graph, roundNumber).length !== 1)
    .map(({ roundNumber }) => roundNumber)
  if (rounds.length !== config.rounds || missing.length > 0) {
    return {
      ok: false,
      violation: `Verwacht ${config.rounds} rondes met precies één gescoord keuzemoment per ronde; gevonden ${rounds.length} rondes, afwijking in ronde(s): ${missing.join(', ') || 'geen'}.`,
      hint: `Voeg in elke ronde precies één perRole-decision toe voor de betrokken mandaatrollen uit ${config.rolesIncluded.join(', ')}. Iedere optie heeft een expliciete outcomeVector met CONT/FOR/BC/JUR/VER/KOS (nul is toegestaan als er geen effect is).`,
    }
  }
  return { ok: true }
}

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
    // Only roles that have mandate at this decision need options. Other
    // selected roles may receive their own decisions elsewhere in the graph.
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
// Rule 14 — kwaliteitsverdeling per rol: één beste, één tweede, rest slecht
//
// Waarom dit een regel moet zijn: er stond niets dat dit afdwong. De
// deterministische bouwer roteerde de middelste opties, dus je kreeg per ronde
// soms twee keer `good` en soms geen enkele — en de LLM-wizard had alleen
// prozaregels. Voor de nabespreking is dit de kern: je kunt alleen uitleggen
// waarom één antwoord beter is als er precies één beste antwoord is.
//
// De verdeling, per rol per beslispunt:
//   2 opties  → 1× best, 1× poor|wrong
//   3 opties  → 1× best, 1× good, rest poor|wrong
//   4 of meer → 1× best, 1× good, rest poor|wrong (minstens één `wrong`)
// Impliciete opties ("geen besluit") tellen niet mee: die horen bij elke rol.
// ───────────────────────────────────────────────────────────────────────────
export function ruleQualityRanking(graph: ScenarioGraph): RuleResult {
  const problems: string[] = []
  for (const d of decisionNodes(graph)) {
    if (!d.data.perRole) continue
    const byRole = new Map<Role, DecisionNodeData['options']>()
    for (const opt of d.data.options) {
      if (opt.implicit || !opt.allowedRole) continue
      const rij = byRole.get(opt.allowedRole) ?? []
      rij.push(opt)
      byRole.set(opt.allowedRole, rij)
    }
    for (const [role, opties] of byRole) {
      const telling = { best: 0, good: 0, poor: 0, wrong: 0, leeg: 0 }
      for (const o of opties) {
        if (!o.qualityRank) telling.leeg++
        else telling[o.qualityRank]++
      }
      const waar = `${d.id} ${role}`
      if (telling.leeg > 0) {
        problems.push(`${waar}: ${telling.leeg} optie(s) zonder qualityRank`)
        continue
      }
      if (telling.best !== 1) {
        problems.push(`${waar}: ${telling.best}× best (hoort 1 te zijn)`)
      }
      const verwachtGood = opties.length >= 3 ? 1 : 0
      if (telling.good !== verwachtGood) {
        problems.push(`${waar}: ${telling.good}× good (hoort ${verwachtGood} te zijn bij ${opties.length} opties)`)
      }
      if (opties.length >= 4 && telling.wrong < 1) {
        problems.push(`${waar}: geen enkele optie met wrong, bij ${opties.length} opties`)
      }
    }
  }
  if (problems.length === 0) return { ok: true }
  return {
    ok: false,
    violation: `Kwaliteitsverdeling klopt niet: ${problems.join('; ')}`,
    hint:
      'Geef elke rol per beslispunt precies één optie met qualityRank="best" en ' +
      '(bij 3 of meer opties) precies één met "good". Alle overige opties zijn ' +
      '"poor" of "wrong", en bij 4 of meer opties is er minstens één "wrong". ' +
      'De impliciete "geen besluit"-optie heeft geen qualityRank nodig.',
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Rule 15 — er staat genoeg tekst om een keuze te kunnen wegen
//
// Live bleek dat je uit een optielabel van vijf woorden de context niet kon
// halen, en dat de facilitator geen materiaal had om uit te leggen waarom het
// ene antwoord beter was dan het andere. Deze regel eist dat die velden er
// zijn én dat ze iets zeggen — een lengtedrempel, want een leeg veld en een
// veld met "nvt" zijn hetzelfde probleem.
// ───────────────────────────────────────────────────────────────────────────
const MIN_PROMPT = 60
const MIN_CONTEXT = 80
// Label en description samen, niet de description apart: een label van vijf
// woorden vraagt om een toelichting, maar "Eye Security-retainer nu al
// activeren — vóór bevestiging" zegt het al. De eis is dat de deelnemer de
// keuze kan wégen, niet dat er een veld gevuld is.
const MIN_OPTIE_TOTAAL = 80
const MIN_COMMENTAAR = 40

export function ruleEnoughExplanation(graph: ScenarioGraph): RuleResult {
  const problems: string[] = []
  const kort = (s: string | undefined, min: number) => (s ?? '').trim().length < min

  for (const d of decisionNodes(graph)) {
    if (kort(d.data.prompt, MIN_PROMPT)) {
      problems.push(`${d.id}: beslisvraag korter dan ${MIN_PROMPT} tekens`)
    }
    if (kort(d.data.context, MIN_CONTEXT)) {
      problems.push(`${d.id}: geen context bij de vraag (wat ligt er, waar knelt het, waar gaat dit niet over)`)
    }
    // De vergelijking tussen beste en tweede optie — het materiaal voor de
    // nabespreking. Alleen vereist als er iets te vergelijken valt.
    const echteOpties = d.data.options.filter(o => !o.implicit)
    if (echteOpties.length >= 3 && kort(d.data.facilitatorRationale, MIN_COMMENTAAR)) {
      problems.push(`${d.id}: geen facilitatorRationale (waarom is de beste optie beter dan de tweede)`)
    }
    for (const o of echteOpties) {
      const samen = `${o.label ?? ''} ${o.description ?? ''}`.trim()
      if (samen.length < MIN_OPTIE_TOTAAL) {
        problems.push(`${d.id}/${o.id}: label + description samen korter dan ${MIN_OPTIE_TOTAAL} tekens`)
      }
      if (kort(o.facilitatorCommentary, MIN_COMMENTAAR)) {
        problems.push(`${d.id}/${o.id}: optie zonder facilitatorCommentary`)
      }
    }
  }
  if (problems.length === 0) return { ok: true }
  return {
    ok: false,
    violation: `Te weinig toelichting: ${problems.slice(0, 12).join('; ')}${problems.length > 12 ? ` (+${problems.length - 12} meer)` : ''}`,
    hint:
      `Elke beslisvraag heeft een prompt van minstens ${MIN_PROMPT} tekens en een context van ` +
      `minstens ${MIN_CONTEXT} tekens (wat ligt er, waar knelt het, waar gaat deze keuze niet over). ` +
      `Elke optie heeft label + description die samen minstens ${MIN_OPTIE_TOTAAL} tekens zijn en ` +
      `zeggen wat je concreet doet, plus een facilitatorCommentary van minstens ${MIN_COMMENTAAR} ` +
      `tekens. Per beslispunt staat in facilitatorRationale waarom de beste optie beter is dan de tweede.`,
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
// Rule 4 — elke decision heeft minstens één setup met een classification.
//
// Oorspronkelijk: "niet alle setups mogen verzonnen zijn" (reliability=
// misleading). Die waarde bestaat niet meer — een bewuste onwaarheid is
// achteraf een aanname — dus de oude conditie kan niet meer vuren. Wat
// overblijft en wél zinvol is: de wizard mag geen decision opleveren waarvan
// de evidentiële status volledig onbepaald is. Een decision die bewust op een
// aanname rust blijft geldig: dát is precies de les (een team dat een aanname
// als feit behandelt, beslist slecht).
//
// Alleen actief in de wizard-pipeline (validateFramework). Bestaande scenarios
// die dit overtreden krijgen hier geen blokkade — de builder toont dit apart
// als warning via lib/graph/validate.ts als je die uitbreidt.
// ───────────────────────────────────────────────────────────────────────────
export function ruleNoiseNeverCarriesOnlyPath(graph: ScenarioGraph): RuleResult {
  const injects = injectNodes(graph)
  const setupsByDecision = new Map<string, Array<{ id: string; classification?: string }>>()
  for (const i of injects) {
    const target = i.data.setsUpDecisionNodeId
    if (!target) continue
    const arr = setupsByDecision.get(target) ?? []
    arr.push({ id: i.id, classification: i.data.classification })
    setupsByDecision.set(target, arr)
  }
  const problems: string[] = []
  for (const [target, setups] of setupsByDecision.entries()) {
    if (setups.length === 0) continue
    const anyClassified = setups.some(s => s.classification === 'feit' || s.classification === 'aanname')
    if (!anyClassified) {
      problems.push(`decision ${target}: geen enkele setup geclassificeerd (${setups.map(s => s.id).join(', ')})`)
    }
  }
  if (problems.length === 0) return { ok: true }
  return {
    ok: false,
    violation: `Decisions zonder geclassificeerde setup: ${problems.join('; ')}`,
    hint: 'Elke decision moet minstens één setup-inject hebben met classification feit of aanname, anders weet het team bij de review niet waarop de keuze rustte.',
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
      const invalidAxes = OUTCOME_AXES.filter(ax => !Number.isInteger(v[ax]) || v[ax] < -2 || v[ax] > 2)
      if (invalidAxes.length > 0) {
        problems.push(`${d.id}: "${opt.label}" ongeldige score op ${invalidAxes.join(', ')}`)
        continue
      }
      const allZero = OUTCOME_AXES.every(ax => v[ax] === 0)
      if (allZero) problems.push(`${d.id}: "${opt.label}" alle-nul vector`)
    }
  }
  if (problems.length === 0) return { ok: true }
  return {
    ok: false,
    violation: `Ongeldige scorevectoren: ${problems.join('; ')}`,
    hint: 'Elke optie heeft alle zes assen CONT/FOR/BC/JUR/VER/KOS met gehele waarden in -2..+2. Nul betekent geen effect op die as; minstens één as heeft een niet-nul waarde.',
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
// Rule 11 — hidden weakness in het scenario (voor generatie-narratief)
//
// Elke wizard-scenario moet één standaard-zwakte hebben die in de briefing van
// een rol is opgenomen (roleBriefings.<role>.playbookGaps). Zonder deze rode
// draad mist het scenario zijn belangrijkste leermoment. Concreet: minstens
// één rol met minstens één playbookGaps-item.
// ───────────────────────────────────────────────────────────────────────────
export function ruleHiddenWeaknessAuthored(graph: ScenarioGraph): RuleResult {
  const briefings = graph.roleBriefings ?? {}
  const rolesWithGaps = Object.entries(briefings).filter(
    ([_role, brief]) => Array.isArray(brief?.playbookGaps) && (brief!.playbookGaps!.length > 0),
  )
  if (rolesWithGaps.length > 0) return { ok: true }
  return {
    ok: false,
    violation: 'Geen enkele rol heeft playbookGaps — hidden weakness ontbreekt',
    hint: 'Voeg één standaard-zwakte toe (back-ups nooit getest, plan nooit geoefend, mandaat niet vastgelegd, kritieke kennis bij één persoon) via roleBriefings.<role>.playbookGaps van de meest-getroffen rol. Zorg dat die zwakte later in een decision-optie terugkomt.',
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Rule 12 — taalconsistentie (geen Engelse UI-woorden in NL-teksten)
//
// Heuristiek: check vrije-tekstvelden in het scenario (titles, content,
// briefings, options.label, prompts, facilitatorNotes) op typische Engelse
// UI-uitdrukkingen die niet als vakterm door de vingers gaan. Vaktermen zoals
// SLA, MSP, EPD, MDR, DPO, SOC, IR, KPI mogen wel. Deze heuristiek is bewust
// grof — een taalfout is een prompt-signal, geen datamigratie.
// ───────────────────────────────────────────────────────────────────────────
export function ruleLanguageConsistency(graph: ScenarioGraph): RuleResult {
  const ENGLISH_LEAK_PATTERNS = /\b(urgency|dismissed|handled|assumption failed|critical event|no comment|breaking news|please note|be advised|regards|kind regards)\b/gi
  const problems: string[] = []
  const seen = new Set<string>()
  const check = (source: string, text: string | undefined) => {
    if (!text) return
    const m = text.match(ENGLISH_LEAK_PATTERNS)
    if (!m) return
    const key = `${source}::${m[0].toLowerCase()}`
    if (seen.has(key)) return
    seen.add(key)
    problems.push(`${source}: "${m[0]}"`)
  }
  for (const n of graph.nodes) {
    if (n.type === 'round') {
      const d = n.data as RoundNodeData
      check(`round.title`, d.title)
      check(`round.situation`, d.situation_update)
      for (const p of d.openingPrompts ?? []) check(`round.openingPrompts`, p)
      for (const p of d.reviewPrompts ?? []) check(`round.reviewPrompts`, p)
      check(`round.facilitatorNotes.goal`, d.facilitatorNotes?.discussionGoal)
    } else if (n.type === 'inject') {
      const d = n.data as InjectNodeData
      check(`inject.title`, d.title)
      check(`inject.content`, d.content)
    } else if (n.type === 'decision') {
      const d = n.data as DecisionNodeData
      check(`decision.prompt`, d.prompt)
      for (const o of d.options) {
        check(`decision.option.label`, o.label)
        check(`decision.option.lesson`, o.lessonLearned)
      }
    }
  }
  const briefings = graph.roleBriefings ?? {}
  for (const [role, brief] of Object.entries(briefings)) {
    check(`briefing.${role}.text`, brief?.text)
    for (const g of brief?.playbookGaps ?? []) check(`briefing.${role}.gap`, g)
  }
  if (graph.irPlaybook) check('irPlaybook', graph.irPlaybook)
  if (problems.length === 0) return { ok: true }
  return {
    ok: false,
    violation: `Engelse woorden in NL-teksten: ${problems.slice(0, 6).join('; ')}${problems.length > 6 ? ` (+${problems.length - 6} meer)` : ''}`,
    hint: 'Alle vrije-tekst in het scenario moet Nederlands zijn. Vaktermen (SLA, MSP, EPD, MDR, DPO, SOC) mogen. Losse Engelse UI-woorden ("urgency", "handled", "critical event") niet.',
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Rule 13 — de situatieschets mag de injects van dezelfde ronde niet verklappen
//
// WAAROM: de rondeheader is het enige dat alle rollen tegelijk lezen. Staat
// daar al in wat de injects straks brengen, dan is de onderzoeksvraag weg —
// niemand hoeft nog iets te ontdekken en rolgericht uitvragen heeft geen zin.
// De schets hoort kort en algemeen te zijn (waar staan we, hoeveel tijd is
// verstreken, wat is de stand van zaken) plus één expliciete beslisvraag.
//
// Hoe we het meten — deterministisch, uitlegbaar, geen AI:
//   1. Letterlijk fragment: een reeks van VERBATIM_WINDOW opeenvolgende woorden
//      die zowel in de schets als in één inject van dezelfde ronde staat.
//   2. Inject-eigen woord: een woord van minstens DISTINCTIVE_MIN_LENGTH
//      letters dat in precies één inject van die ronde voorkomt. Woorden die in
//      meerdere injects staan zijn de gedeelde taal van de ronde en zeggen
//      niets. Deelt de schets DISTINCTIVE_SHARED_LIMIT of meer inject-eigen
//      woorden met dezelfde inject, dan vertelt de schets die inject vooruit.
//
// Beide drempels zijn bewust ruim: twee of drie gedeelde namen (de klant, de
// MSP, het kernsysteem) horen in een algemene schets. Een halve inject
// overschrijven niet. Dit is een WAARSCHUWING, geen blokkade — de drempel is
// een heuristiek en de auteur mag hem beargumenteerd negeren.
// ───────────────────────────────────────────────────────────────────────────

const VERBATIM_WINDOW = 5
const DISTINCTIVE_MIN_LENGTH = 7
const DISTINCTIVE_SHARED_LIMIT = 4

// Accenten eerst wegstrippen, anders breekt "coördinator" in twee woorden en
// matcht hij nooit met zijn eigen voorkomen in een inject.
function overlapWords(text: string): string[] {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
}

function wordWindows(words: string[], size: number): Set<string> {
  const out = new Set<string>()
  for (let i = 0; i + size <= words.length; i++) out.add(words.slice(i, i + size).join(' '))
  return out
}

export interface SituationOverlapFinding {
  injectTitle: string
  /** Gedeelde woordreeksen van VERBATIM_WINDOW woorden — letterlijk overgeschreven. */
  verbatim: string[]
  /** Inject-eigen woorden die ook in de situatieschets staan. */
  sharedTerms: string[]
}

/**
 * Overlap tussen één situatieschets en de injects van diezelfde ronde.
 * Geeft per inject een bevinding terug zodra die boven de drempel komt.
 * Leeg = de schets verklapt niets.
 */
export function situationInjectOverlap(
  situation: string,
  injects: Array<{ title?: string; content?: string }>,
): SituationOverlapFinding[] {
  const situationWords = overlapWords(situation)
  if (situationWords.length === 0 || injects.length === 0) return []
  const situationWindows = wordWindows(situationWords, VERBATIM_WINDOW)
  const situationWordSet = new Set(situationWords)

  const perInject = injects.map(i => new Set(overlapWords(`${i.title ?? ''} ${i.content ?? ''}`)))
  const injectsPerWord = new Map<string, number>()
  for (const set of perInject) {
    for (const word of set) {
      if (word.length < DISTINCTIVE_MIN_LENGTH) continue
      injectsPerWord.set(word, (injectsPerWord.get(word) ?? 0) + 1)
    }
  }

  const findings: SituationOverlapFinding[] = []
  injects.forEach((inject, idx) => {
    const words = overlapWords(`${inject.title ?? ''} ${inject.content ?? ''}`)
    const verbatim = [...wordWindows(words, VERBATIM_WINDOW)].filter(w => situationWindows.has(w)).sort()
    const sharedTerms = [...perInject[idx]]
      .filter(w => w.length >= DISTINCTIVE_MIN_LENGTH && injectsPerWord.get(w) === 1 && situationWordSet.has(w))
      .sort()
    if (verbatim.length > 0 || sharedTerms.length >= DISTINCTIVE_SHARED_LIMIT) {
      findings.push({ injectTitle: inject.title?.trim() || `inject ${idx + 1}`, verbatim, sharedTerms })
    }
  })
  return findings
}

export interface RoundSpoilerReport {
  roundNumber: number
  nodeId: string
  findings: SituationOverlapFinding[]
}

/** Alle rondes waarvan de situatieschets haar eigen injects vooruitvertelt. */
export function roundsRevealingInjects(graph: ScenarioGraph): RoundSpoilerReport[] {
  const reports: RoundSpoilerReport[] = []
  for (const r of orderedRounds(graph)) {
    const injects = injectsInRound(graph, r.roundNumber).map(n => ({
      title: n.data.title,
      content: n.data.content,
    }))
    const findings = situationInjectOverlap(r.node.data.situation_update ?? '', injects)
    if (findings.length > 0) reports.push({ roundNumber: r.roundNumber, nodeId: r.node.id, findings })
  }
  return reports
}

export function ruleSituationDoesNotRevealInjects(graph: ScenarioGraph): RuleResult {
  const reports = roundsRevealingInjects(graph)
  if (reports.length === 0) return { ok: true }
  const problems = reports.flatMap(report =>
    report.findings.map(f => {
      const why = f.verbatim.length > 0
        ? `letterlijk fragment "${f.verbatim[0]}"`
        : `${f.sharedTerms.length} inject-eigen woorden (${f.sharedTerms.slice(0, 5).join(', ')})`
      return `ronde ${report.roundNumber} verklapt "${f.injectTitle}" — ${why}`
    }),
  )
  return {
    ok: false,
    violation: `Situatieschets vertelt injects vooruit: ${problems.slice(0, 6).join('; ')}${problems.length > 6 ? ` (+${problems.length - 6} meer)` : ''}`,
    hint: 'Maak de situation_update van de genoemde ronde een korte algemene introductie van maximaal 3 à 4 zinnen: waar staan we, hoeveel tijd is verstreken, wat is de algemene stand van zaken, en welke beslisvraag ligt aan het einde van deze ronde op tafel. Geen rol-specifieke feiten, geen namen of signalen die een inject van deze ronde nog moet brengen — die horen in de inject zelf.',
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Aggregate
// ───────────────────────────────────────────────────────────────────────────

export interface FrameworkResult {
  ok: boolean
  failures: RuleFailure[]
}

// `description` staat hier en niet in de UI: het settings-tabblad toont deze
// lijst read-only, en een nieuwe regel moet automatisch meekomen in plaats van
// op twee plekken bijgewerkt te hoeven worden.
export interface FrameworkRule {
  id: string
  description: string
  fn: (g: ScenarioGraph, c: WizardConfig) => RuleResult
}

const RULES: readonly FrameworkRule[] = [
  { id: 'rule0_decision_per_round',     description: 'Elke ronde heeft minstens één decision.',                                                      fn: (g, c)  => ruleDecisionPerRound(g, c) },
  { id: 'rule1_setup_inject',           description: 'Elke decision heeft een setup-inject in dezelfde of vorige ronde.',                            fn: (g)     => ruleEveryDecisionHasSetupInject(g) },
  { id: 'rule2_options_per_role',       description: 'Per decision: exact `optionsPerRolePerRound` opties per rol.',                                  fn: (g, c)  => ruleOptionsPerRoleMatchConfig(g, c) },
  { id: 'rule3_no_dominant',            description: 'Geen enkele optie domineert een andere op alle 6 outcome-assen.',                               fn: (g)     => ruleNoDominantOption(g) },
  { id: 'rule4_noise_not_only_path',    description: 'Elke decision heeft minstens één setup-inject met een classification (feit of aanname).',       fn: (g)     => ruleNoiseNeverCarriesOnlyPath(g) },
  { id: 'rule5_cross_round_lesson',     description: 'Ronde N≥2 verwijst zichtbaar naar keuze/les uit N-1.',                                          fn: (g)     => ruleRoundReferencesPrevRoundConsequence(g) },
  { id: 'rule6_dimension_mapped',       description: 'Elke optie beweegt minstens één as van CONT/FOR/BC/JUR/VER/KOS.',                               fn: (g)     => ruleEveryDecisionMapsToDimension(g) },
  { id: 'rule7_classification_ratio',   description: 'Aandeel classification=feit ≈ factsNoiseRatio (±0.15).',                                        fn: (g, c)  => ruleClassificationRatio(g, c) },
  { id: 'rule8_special_conditions',     description: 'Elke geselecteerde special condition verschijnt in het vereiste aantal rondes.',                fn: (g, c)  => ruleSpecialConditionsAppear(g, c) },
  { id: 'rule9_regulatory_window',      description: 'Minstens één inject met triggersRegulatoryNotification=true en verwijzing naar toezichthouder.', fn: (g, c)  => ruleRegulatoryWindowPlaced(g, c) },
  { id: 'rule10_facilitator_guidance',  description: 'Elke ronde heeft facilitatorNotes.discussionGoal; feiten/namen matchen de ronde-inhoud.',        fn: (g)     => ruleFacilitatorGuidanceExists(g) },
  { id: 'rule11_hidden_weakness',       description: 'Minstens één rol heeft roleBriefings.<role>.playbookGaps non-empty.',                            fn: (g)     => ruleHiddenWeaknessAuthored(g) },
  { id: 'rule12_language_consistency',  description: 'Geen typische Engelse UI-woorden in NL-vrije-teksten.',                                          fn: (g)     => ruleLanguageConsistency(g) },
  { id: 'rule13_situation_no_spoiler',  description: 'De situatieschets van een ronde verklapt de injects van die ronde niet.',                        fn: (g)     => ruleSituationDoesNotRevealInjects(g) },
  { id: 'rule14_quality_ranking',       description: 'Per rol per beslispunt: precies één beste optie, één tweede-beste, rest slecht.',               fn: (g)     => ruleQualityRanking(g) },
  { id: 'rule15_enough_explanation',    description: 'Beslisvraag, opties en facilitator-motivatie hebben genoeg tekst om een keuze te wegen.',        fn: (g)     => ruleEnoughExplanation(g) },
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

// Read-only weergave voor het settings-tabblad. Zonder `fn`, zodat de UI alleen
// de beschrijving ziet en niet de regelimplementatie aanroept.
export const FRAMEWORK_RULES: readonly { id: string; description: string }[] =
  RULES.map(({ id, description }) => ({ id, description }))
