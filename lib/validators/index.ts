import type { ScenarioInstance, ValidationError, DecisionScope } from "../types/scenario-instance"

// ─── Retainer-scope keyword lists ───

const RETAINER_KEYWORDS = [
  'isoleer server', 'isoleer systeem', 'endpoint platleggen', 'edr-policy',
  'forensisch onderzoek starten', 'malware analyseren', 'malware reverse',
  'ioc extraheren', 'ioc\'s delen', 'logs preserveren', 'log preservation',
  'attribution-analyse', 'attributie-analyse', 'threat intel verzamelen',
  'dark web monitor', 'chain-of-custody', 'memory dump', 'memory analyse',
  'welke server isoleren', 'welke endpoint', 'welke processen killen',
]

const SHARED_KEYWORDS = [
  'samen met ons ir-team', 'autoriseren', 'ons ir-team stelt voor',
  'wij stellen voor', 'ir-team adviseert',
]

// ─── Validator 1: every inject references an existing chain phase ───

export function validateInjectChainReference(scenario: ScenarioInstance): ValidationError[] {
  const phaseIds = new Set(scenario.attack_chain.map(p => p.id))
  const errors: ValidationError[] = []

  for (const mod of scenario.modules) {
    for (const inject of mod.injects) {
      if (!phaseIds.has(inject.source_phase_id)) {
        errors.push({
          module_id: mod.module_id,
          inject_id: inject.id,
          validator: 'validateInjectChainReference',
          message: `Inject '${inject.id}' verwijst naar onbekende phase '${inject.source_phase_id}'. Bestaande phase-ids: ${[...phaseIds].join(', ')}.`,
          severity: 'error',
        })
      }
    }
  }

  return errors
}

// ─── Validator 2: every inject's source_phase is in its module's visible_phases ───

export function validateInjectVisibility(scenario: ScenarioInstance): ValidationError[] {
  const errors: ValidationError[] = []

  for (const mod of scenario.modules) {
    const visible = new Set(mod.visible_phases)
    for (const inject of mod.injects) {
      if (!visible.has(inject.source_phase_id)) {
        errors.push({
          module_id: mod.module_id,
          inject_id: inject.id,
          validator: 'validateInjectVisibility',
          message: `Inject '${inject.id}' (phase: '${inject.source_phase_id}') staat niet in visible_phases van module '${mod.module_id}'. Zichtbare fasen: ${[...visible].join(', ')}.`,
          severity: 'error',
        })
      }
    }
  }

  return errors
}

// ─── Validator 3: each module uses at least 3 distinct channels ───

export function validateChannelDiversity(scenario: ScenarioInstance): ValidationError[] {
  const errors: ValidationError[] = []

  for (const mod of scenario.modules) {
    const channels = new Set(mod.injects.map(i => i.channel))
    if (channels.size < 3) {
      errors.push({
        module_id: mod.module_id,
        validator: 'validateChannelDiversity',
        message: `Module '${mod.module_id}' gebruikt maar ${channels.size} kanaal/kanalen (${[...channels].join(', ')}). Minimaal 3 vereist.`,
        severity: 'error',
      })
    }
  }

  return errors
}

// ─── Validator 4: no decisions fall in retainer scope ───

export function classifyDecision(prompt: string): DecisionScope {
  const lower = prompt.toLowerCase()

  if (RETAINER_KEYWORDS.some(k => lower.includes(k))) return 'retainer'
  if (SHARED_KEYWORDS.some(k => lower.includes(k))) return 'shared'

  const clientPatterns = [
    'communicer', 'stakeholder', 'melding', 'meldplicht', 'verzekeraar',
    'crisisniveau', 'mandaat', 'escalat', 'woordvoerder', 'betaal', 'ransom',
    'workaround', 'medewerker', 'or ', 'rvC', 'aangifte', 'juridisch',
    'contractu', 'aansprakelijkheid',
  ]
  if (clientPatterns.some(p => lower.includes(p))) return 'client'

  return 'invalid'
}

export function validateDecisionScope(scenario: ScenarioInstance): ValidationError[] {
  const errors: ValidationError[] = []

  for (const mod of scenario.modules) {
    for (const decision of mod.decisions) {
      for (const question of decision.questions) {
        const scope = classifyDecision(question)
        if (scope === 'retainer') {
          errors.push({
            module_id: mod.module_id,
            validator: 'validateDecisionScope',
            message: `Decision in module '${mod.module_id}' valt in retainer-scope: "${question.slice(0, 80)}…". Vervang door een governance/BC/comms/legal/strategie-vraag.`,
            severity: 'error',
          })
        } else if (scope === 'invalid') {
          errors.push({
            module_id: mod.module_id,
            validator: 'validateDecisionScope',
            message: `Decision in module '${mod.module_id}' heeft onduidelijke scope: "${question.slice(0, 80)}…". Markeer voor review.`,
            severity: 'warning',
          })
        }
      }
    }
  }

  return errors
}

// ─── Validator 5: severity curve never drops ───

const SEVERITY_ORDER: Record<string, number> = { medium: 1, high: 2, critical: 3 }

export function validateSeverityProgression(scenario: ScenarioInstance): ValidationError[] {
  const errors: ValidationError[] = []
  let prevSeverity = 0

  for (const mod of scenario.modules) {
    const current = SEVERITY_ORDER[mod.severity] ?? 0
    if (current < prevSeverity) {
      errors.push({
        module_id: mod.module_id,
        validator: 'validateSeverityProgression',
        message: `Module '${mod.module_id}' heeft severity '${mod.severity}' terwijl de vorige module hoger was. Severity-curve mag niet dalen.`,
        severity: 'warning',
      })
    }
    prevSeverity = Math.max(prevSeverity, current)
  }

  return errors
}

// ─── Validator 6: scenario type matches chain and module selection ───

// Modules that are only valid for specific scenario types
const MODULE_SCENARIO_CONSTRAINTS: Record<string, string[]> = {
  ransom_negotiation: ['ransomware_double_extortion'],
  insider_investigation: ['insider_threat'],
  supply_chain_response: ['supply_chain_compromise'],
}

export function validateScenarioCoherence(scenario: ScenarioInstance): ValidationError[] {
  const errors: ValidationError[] = []
  const type = scenario.meta.scenario_type

  if (scenario.attack_chain.length === 0) {
    errors.push({
      validator: 'validateScenarioCoherence',
      message: 'Attack chain is leeg — scenario heeft geen fasen.',
      severity: 'error',
    })
  }

  for (const mod of scenario.modules) {
    const allowed = MODULE_SCENARIO_CONSTRAINTS[mod.module_id]
    if (allowed && !allowed.includes(type)) {
      errors.push({
        module_id: mod.module_id,
        validator: 'validateScenarioCoherence',
        message: `Module '${mod.module_id}' is alleen geldig voor scenario-types: ${allowed.join(', ')}. Huidig type: '${type}'.`,
        severity: 'error',
      })
    }
  }

  // insider_threat must not have attacker_voice lens modules
  if (type === 'insider_threat') {
    for (const mod of scenario.modules) {
      if (mod.observation_lens === 'attacker_voice') {
        errors.push({
          module_id: mod.module_id,
          validator: 'validateScenarioCoherence',
          message: `Insider threat scenario heeft geen aanvaller-voice. Module '${mod.module_id}' mag geen 'attacker_voice' lens gebruiken.`,
          severity: 'error',
        })
      }
    }
  }

  return errors
}

// ─── Run all validators ───

export function runAllValidators(scenario: ScenarioInstance): ValidationError[] {
  return [
    ...validateInjectChainReference(scenario),
    ...validateInjectVisibility(scenario),
    ...validateChannelDiversity(scenario),
    ...validateDecisionScope(scenario),
    ...validateSeverityProgression(scenario),
    ...validateScenarioCoherence(scenario),
  ]
}

export function formatValidationFeedback(errors: ValidationError[]): string {
  const numbered = errors
    .filter(e => e.severity === 'error')
    .map((e, i) => `${i + 1}. ${e.message}`)
    .join('\n\n')

  if (!numbered) return ''

  return `De vorige output had de volgende validation-errors:\n\n${numbered}\n\nCorrigeer alleen deze specifieke punten en behoud de rest van de output.`
}
