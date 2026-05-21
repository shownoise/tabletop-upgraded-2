import type { ExerciseConfig, Scenario, ScenarioType, DecisionFramework, ModuleId, InjectChannel, Role } from "../types"
import { ROLE_META } from "../types"
import type {
  ScenarioInstance,
  ScenarioSkeleton,
  AttackChainPhase,
  ClientProfile,
  TemplateModuleSlot,
} from "../types/scenario-instance"
import { CHAIN_REGISTRY } from "../chains/index"
import { MODULE_DEFINITIONS } from "../modules/definitions"
import { DEFAULT_MODULE_SETS, DEFAULT_VISIBLE_PHASES } from "../modules/defaults"
import { runAllValidators, formatValidationFeedback } from "../validators/index"
import { SCENARIO_GENERATOR_SYSTEM_PROMPT, buildTypeGuidance } from "./prompts"

const CODENAMES = [
  'STILVALLEN', 'ZWARTGAT', 'KORTSLUIT', 'SCHEMERLAND', 'VRIJVAL',
  'BRANDPUNT', 'SCHIJNSEL', 'DROOGDOK', 'WAAKZAAM', 'GRONDVLAK',
  'IJSVAL', 'SCHADUWNET', 'DONKERWATER', 'BLINDSPOT', 'SCHERPZICHT',
]

function randomCodename(): string {
  return CODENAMES[Math.floor(Math.random() * CODENAMES.length)]
}

// Maps ExerciseConfig.scenarioType string → ScenarioType union
function resolveScenarioType(raw: string): ScenarioType {
  const lower = raw.toLowerCase()
  if (lower.includes('insider')) return 'insider_threat'
  if (lower.includes('bec') || lower.includes('business email') || lower.includes('cfo')) return 'bec_cfo_fraud'
  if (lower.includes('supply chain') || lower.includes('supply_chain')) return 'supply_chain_compromise'
  return 'ransomware_double_extortion'
}

// Maps ExerciseConfig fields to ClientProfile
function buildClientProfile(config: ExerciseConfig): ClientProfile {
  const nis2: ClientProfile['nis2_status'] =
    config.exerciseGoal === 'nis2_readiness' ? 'essential'
    : config.sector === 'Energy & Utilities' || config.sector === 'Transportation' ? 'essential'
    : config.sector === 'Financial Services' || config.sector === 'Healthcare' ? 'important'
    : 'not_applicable'

  const employeeMap: Record<string, number> = {
    '100–250': 175, '250–500': 375, '500–1,500': 1000, '1,500+': 2500,
  }

  return {
    sector: config.sector || 'Algemeen',
    revenue_range: config.companySize === '100–250' ? '€10-25M'
      : config.companySize === '250–500' ? '€25-75M'
      : config.companySize === '500–1,500' ? '€75-250M'
      : '€250M+',
    employee_count: employeeMap[config.companySize ?? '250–500'] ?? 375,
    nis2_status: nis2,
    critical_systems: (config.criticalSystems ?? '').split(',').map(s => s.trim()).filter(Boolean),
    key_stakeholders: ['directie', 'OR', 'RvC', 'verzekeraar'],
  }
}

// Build T-offset string for module order
function moduleOffset(order: number, durationMinutes: number): string {
  const totalMinutes = (order - 1) * durationMinutes
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  return `T+${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
}

// ─── Explicit pipeline step 1: select attack chain ───

export function selectAttackChain(scenarioType: ScenarioType): typeof CHAIN_REGISTRY[ScenarioType] {
  return CHAIN_REGISTRY[scenarioType]
}

// ─── Explicit pipeline step 2: plan modules ───

export function planModules(
  config: ExerciseConfig,
  scenarioType: ScenarioType,
  overrideSlots?: TemplateModuleSlot[],
): TemplateModuleSlot[] {
  if (overrideSlots?.length) return overrideSlots

  let slots = [...DEFAULT_MODULE_SETS[scenarioType]]

  const goal = config.exerciseGoal
  const difficulty = config.difficulty

  // Goal-based module adjustments
  if (goal === 'crisis_comms' && !slots.find(s => s.module_id === 'crisis_communication')) {
    slots.push({ module_id: 'crisis_communication' })
  }
  if (goal === 'technical_containment' && !slots.find(s => s.module_id === 'triage_containment')) {
    slots.splice(1, 0, { module_id: 'triage_containment' })
  }
  if ((goal === 'nis2_readiness' || goal === 'data_breach') && !slots.find(s => s.module_id === 'legal_regulatory')) {
    slots.push({ module_id: 'legal_regulatory' })
  }

  // Difficulty adjustments
  if (difficulty === 'beginner' && slots.length > 3) {
    slots = slots.slice(0, 3)
  }
  if (difficulty === 'advanced' && !slots.find(s => s.module_id === 'forensic_attribution')) {
    slots.push({ module_id: 'forensic_attribution' })
  }

  // Cap to configured round count
  const cap = config.roundCount ?? 4
  if (slots.length > cap) slots = slots.slice(0, cap)

  return slots
}

// ─── Explicit pipeline step 3: build AI prompt ───

export function buildPrompt(
  skeleton: ScenarioSkeleton,
  _config: ExerciseConfig,
  priorErrors?: string,
): string {
  const typeGuidance = buildTypeGuidance(skeleton.scenario_type)
  const skeletonJson = JSON.stringify(skeleton, null, 2)

  const objectivesNote = `\n\nVERPLICHT: Voeg aan elk module-object een "learning_objectives" array toe met 1-2 leerdoelen, en aan elke DecisionBox een "options" array met 2-4 keuzes. Zie het systeemprompt voor de exacte veldstructuur. De triggerActionIds in learning_objectives moeten overeenkomen met ids van options in diezelfde module.`

  if (priorErrors) {
    return `${typeGuidance}\n\n${priorErrors}\n\nHier is het originele skelet:\n\n${skeletonJson}${objectivesNote}`
  }
  return `${typeGuidance}\n\nGenereer een tabletop scenario op basis van dit skelet:\n\n${skeletonJson}${objectivesNote}`
}

// ─── Skeleton builder (combines chain + modules → ScenarioSkeleton) ───

export function buildSkeleton(
  config: ExerciseConfig,
  moduleSlots: TemplateModuleSlot[],
  scenarioType: ScenarioType,
  framework: DecisionFramework,
  preselectedChain?: typeof CHAIN_REGISTRY[ScenarioType],
): ScenarioSkeleton {
  const chain = preselectedChain ?? CHAIN_REGISTRY[scenarioType]
  const clientProfile = buildClientProfile(config)
  const language: 'nl' | 'en' = 'nl'

  const defaultVisible = DEFAULT_VISIBLE_PHASES[scenarioType] ?? {}

  const modules = moduleSlots.map((slot, i) => {
    const def = MODULE_DEFINITIONS.find(d => d.id === slot.module_id)
    if (!def) throw new Error(`Unknown module: ${slot.module_id}`)

    const duration = slot.duration_minutes ?? def.default_duration_minutes
    const lens = slot.custom_lens ?? def.default_lens
    const channels = (slot.custom_channels ?? def.default_channels) as InjectChannel[]
    const modFramework = slot.decision_framework ?? framework

    const visiblePhases =
      defaultVisible[slot.module_id] ??
      chain.phases.slice(0, Math.ceil(chain.phases.length * ((i + 1) / moduleSlots.length))).map(p => p.id)

    return {
      module_id: slot.module_id as ModuleId,
      order: i + 1,
      t_offset: moduleOffset(i + 1, duration),
      duration_minutes: duration,
      observation_lens: lens,
      decision_framework: modFramework,
      visible_phases: visiblePhases,
      default_channels: channels,
    }
  })

  return {
    scenario_type: scenarioType,
    decision_framework: framework,
    client_profile: clientProfile,
    attack_chain: chain.phases as AttackChainPhase[],
    modules,
    language,
    codename: randomCodename(),
  }
}

// Parse JSON with a repair fallback for truncated responses.
// Walks back from the end inserting closing bracket combinations until
// a valid JSON object is found. Works for any JSON object shape.
function parseJsonWithRepair<T>(text: string, label: string): T {
  const cleaned = text.replace(/```json|```/g, '').trim()
  const match = cleaned.match(/\{[\s\S]*\}/)
  if (!match) throw new Error(`${label}: No JSON object found in AI response`)
  try {
    return JSON.parse(match[0]) as T
  } catch (firstErr) {
    const candidate = match[0]
    const closing = ']}]}]}]}]}'
    for (let i = candidate.length - 1; i > candidate.length - 4000; i--) {
      const ch = candidate[i]
      if (ch === ',' || ch === ':' || ch === '"' || ch === '[' || ch === '{') continue
      for (let depth = 1; depth <= closing.length; depth++) {
        try {
          const result = JSON.parse(candidate.slice(0, i + 1) + closing.slice(-depth)) as T
          console.warn(`[${label}] Repaired truncated JSON at char position ${i}`)
          return result
        } catch { /* try next */ }
      }
    }
    throw new Error(`JSON parse failed: ${String(firstErr)}`)
  }
}

// Typed wrapper for ScenarioInstance
function parseScenarioJson(text: string): ScenarioInstance {
  return parseJsonWithRepair<ScenarioInstance>(text, 'parseScenarioJson')
}

// Core AI call — returns raw ScenarioInstance (not yet validated)
async function callAI(
  userMessage: string,
  apiKey: string,
  model: string,
  maxTokens: number,
): Promise<ScenarioInstance> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 90_000)

  let res: Response
  try {
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        system: SCENARIO_GENERATOR_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
      }),
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timeoutId)
  }

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Anthropic API error ${res.status}: ${err.slice(0, 200)}`)
  }

  const data = await res.json() as { content: Array<{ type: string; text: string }> }
  const text = data.content?.find(b => b.type === 'text')?.text ?? ''
  return parseScenarioJson(text)
}

// Main export — generates a ScenarioInstance from ExerciseConfig
export async function generateScenarioInstance(
  config: ExerciseConfig,
  apiKey: string,
  options: {
    model?: string
    maxTokens?: number
    moduleSlots?: TemplateModuleSlot[]
    framework?: DecisionFramework
    maxRetries?: number
    maxModules?: number
  } = {},
): Promise<{ instance: ScenarioInstance; warnings: string[] }> {
  const scenarioType = resolveScenarioType(config.scenarioType ?? 'Ransomware')
  const framework: DecisionFramework = options.framework ?? 'bob'
  const model = options.model ?? 'claude-sonnet-4-6'
  const maxTokens = options.maxTokens ?? 16000

  // Explicit three-step pipeline
  const chain = selectAttackChain(scenarioType)
  const rawSlots = planModules(config, scenarioType, options.moduleSlots)
  const moduleSlots = options.maxModules ? rawSlots.slice(0, options.maxModules) : rawSlots
  const skeleton = buildSkeleton(config, moduleSlots, scenarioType, framework, chain)

  // First attempt
  let instance = await callAI(buildPrompt(skeleton, config), apiKey, model, maxTokens)

  // Validate + retry loop
  for (let attempt = 0; attempt < (options.maxRetries ?? 2); attempt++) {
    const errors = runAllValidators(instance)
    const hardErrors = errors.filter(e => e.severity === 'error')
    if (hardErrors.length === 0) break

    const feedback = formatValidationFeedback(hardErrors)
    instance = await callAI(buildPrompt(skeleton, config, feedback), apiKey, model, maxTokens)
  }

  // Final validation — collect warnings only (we already retried)
  const finalErrors = runAllValidators(instance)
  const warnings = finalErrors.map(e => `[${e.severity.toUpperCase()}] ${e.message}`)

  // Ensure meta fields are set correctly (AI may have drifted)
  instance.meta.scenario_type = scenarioType
  instance.meta.decision_framework = framework
  instance.meta.generated_at = new Date().toISOString()
  if (!instance.meta.codename) instance.meta.codename = skeleton.codename

  return { instance, warnings }
}

// ─── Lean generator for Haiku ──────────────────────────────────
// Uses simple rounds[] output format instead of complex ScenarioInstance.
// Haiku can reliably generate this; ScenarioInstance is too complex for it.

const FRAMEWORK_INSTRUCTIONS: Record<string, string> = {
  bob: 'Gebruik het BOB-kader (Beeldvorming → Oordeelvorming → Besluitvorming). Label elke roleAction description met [Beeldvorming], [Oordeelvorming] of [Besluit]. Ronde 1-2 = Beeldvorming, ronde 3 = Oordeelvorming, ronde 4 = Besluitvorming.',
  ooda: 'Gebruik het OODA-kader (Observe-Orient-Decide-Act). Elke ronde heeft een duidelijke OODA-fase. Stuurvragen in facilitatorNotes volgen de OODA-volgorde.',
  dair: 'Gebruik het DAIR-kader (Detect-Assess-Inform-Respond). Elke ronde heeft één primaire DAIR-fase. RoleActions zijn gelabeld met de bijbehorende fase.',
  nist_ir: 'Gebruik NIST IR-kader (Prepare-Detect-Contain-Eradicate-Recover). Elke ronde correspondeert met één NIST-fase.',
  free: 'Geen formeel kader. Beslissingen zijn open en contextueel.',
}

export async function generateLeanScenario(
  config: ExerciseConfig,
  apiKey: string,
  model: string,
  maxTokens: number,
): Promise<Scenario> {
  const scenarioType = resolveScenarioType(config.scenarioType ?? 'Ransomware')
  const framework = (config.decisionFramework ?? 'bob') as DecisionFramework
  const roundCount = Math.min(config.roundCount ?? 3, 3)
  const timerPerRound = config.timerPerRound ?? 15
  const chain = CHAIN_REGISTRY[scenarioType]

  // Pick phases spread across the chain to anchor each round
  const phaseCount = chain.phases.length
  const anchorPhases = Array.from({ length: roundCount }, (_, i) => {
    const idx = Math.floor((i / roundCount) * phaseCount)
    return chain.phases[Math.min(idx, phaseCount - 1)]
  })

  const typeGuidance = buildTypeGuidance(scenarioType)
  const frameworkGuidance = FRAMEWORK_INSTRUCTIONS[framework] ?? FRAMEWORK_INSTRUCTIONS.free

  // Lean path: only sector + scenario type — crown jewels / critical systems / company size
  // are intentionally omitted to keep token count low and avoid truncation.
  const sectorNote = config.sector ? `Sector: ${config.sector}.` : ''

  // Include selected roles so allowedRoles only references actual participants
  const selectedRoles = (config.selectedRoles ?? []) as Role[]
  const roleList = selectedRoles.length
    ? selectedRoles.map(r => `${r} (${ROLE_META[r].label})`).join(', ')
    : 'ceo, ciso, cfo, legal, head_of_comms'
  const roleConstraint = selectedRoles.length
    ? `KRITISCH: allowedRoles mag ALLEEN waarden bevatten uit: [${selectedRoles.join(', ')}]. Elke deelnemende rol moet minimaal één actie per ronde hebben.`
    : ''

  // Build two example roleAction entries using the first two actual roles for specificity
  const exRole1 = selectedRoles[0] ?? 'ciso'
  const exRole2 = selectedRoles[1] ?? 'ceo'
  const exRole3 = selectedRoles[2] ?? 'legal'

  const roundAnchors = anchorPhases.map((p, i) =>
    `Ronde ${i + 1} is verankerd in aanvalsfase "${p.id}" (${p.t_offset}): ${p.technique}. Detecteerbaarheid: ${p.detectability ?? 'laag'}.`
  ).join('\n')

  const prompt = `${typeGuidance}

${frameworkGuidance}

Organisatieprofiel:
${sectorNote}
Deelnemende rollen: ${roleList}
${roleConstraint}

Aanvalsfases per ronde (gebruik deze als inhoudelijke basis — verwijs ernaar in injects):
${roundAnchors}

Genereer een ${roundCount}-ronde tabletop scenario. Zorg dat elke ronde inhoudelijk verschilt: andere injects, andere beslissingen, oplopende urgentie. Elke ronde heeft minimaal één roleAction per deelnemende rol.

Geef ALLEEN geldige JSON terug (geen markdown):
{"scenario_title":"...","scenario_summary":"2 zinnen","rounds":[{"round_number":1,"title":"...","situation_update":"3-4 zinnen die de situatie beschrijven vanuit het perspectief van de spelers","timerMinutes":${timerPerRound},"injects":[{"id":"r1-i1","type":"technical","channel":"siem","title":"...","content":"Realistische inject-tekst met echte tijdstempels en namen","urgency":"medium","senderName":"...","senderHandle":"...","timestamp":"HH:MM","targetTeam":"all"},{"id":"r1-i2","type":"internal","channel":"whatsapp","title":"...","content":"...","urgency":"high","senderName":"...","timestamp":"HH:MM","targetTeam":"crisis_management"}],"roleActions":[{"id":"r1-a1","label":"...","description":"Concrete actie vanuit perspectief ${exRole1}","allowedRoles":["${exRole1}"],"isRecommended":true,"irPlanAligned":true,"consequence":"..."},{"id":"r1-a2","label":"...","description":"Concrete actie vanuit perspectief ${exRole2}","allowedRoles":["${exRole2}"],"isRecommended":false,"irPlanAligned":true,"consequence":"..."},{"id":"r1-a3","label":"...","description":"Concrete actie vanuit perspectief ${exRole3}","allowedRoles":["${exRole3}"],"isRecommended":false,"irPlanAligned":false,"consequence":"..."},{"id":"r1-do-nothing","label":"Wacht af en verzamel meer informatie","description":"Geen actie ondernemen totdat het beeld completer is.","allowedRoles":[],"irPlanAligned":true,"consequence":"..."}],"facilitatorNotes":{"discussionGoal":"...","keyQuestions":["...","..."],"hints":["..."],"expectedDecisions":["..."],"redFlags":["..."]}}]}`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Anthropic API error ${res.status}: ${err}`)
  }

  const data = await res.json() as { content: Array<{ type: string; text: string }> }
  const text = data.content?.find(b => b.type === 'text')?.text ?? ''
  if (!text) throw new Error('No text content in lean AI response')
  return parseJsonWithRepair<Scenario>(text, 'generateLeanScenario')
}
