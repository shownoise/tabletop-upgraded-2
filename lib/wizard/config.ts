import type { Role } from "@/lib/types"

// Phase 9 — WizardConfig.
//
// The complete, author-visible configuration for a wizard generation. Every
// field on this type has a corresponding control in ai-wizard-dialog.tsx and
// is echoed into both the generation prompt AND the framework validation. If
// the two get out of sync the pipeline will keep repairing, so keep them
// aligned.
//
// Reproducibility: given the same WizardConfig (including seed) AND the same
// LLM output the pipeline must produce a byte-identical ScenarioGraph. Every
// id-generator in the compile path derives from the seed — no Math.random,
// no Date.now.

export type CompanySize = 'small' | 'mkbplus' | 'enterprise'

export interface WizardConfig {
  // ── Narrative ──────────────────────────────────────────────────────────
  clientName: string
  sector: string                      // free text — e.g. "onderwijs — middelbare scholen"
  companySize: CompanySize
  itArrangement: string               // free text — e.g. "ICT deels uitbesteed aan regionale MSP"
  importantContext?: string           // legacy freeText — kept optional

  // ── Structure ──────────────────────────────────────────────────────────
  rounds: number                      // 4..8
  injectsPerRound: number             // 3..5
  optionsPerRolePerRound: number      // 2..6 (drives generation AND framework validation)
  factsNoiseRatio: number             // 0..1  (0 = pure noise, 1 = pure facts)

  // ── Roles + scoring ────────────────────────────────────────────────────
  rolesIncluded: Role[]               // subset of the 8 roles
  regulatoryRegimeId: string          // default 'nl_avg_nis2'

  // ── Special conditions ─────────────────────────────────────────────────
  specialConditions: string[]         // ids from SPECIAL_CONDITIONS registry

  // ── Reproducibility ────────────────────────────────────────────────────
  seed?: string
}

// Field-level constraints exposed so the UI and the server-side validator agree
// on ranges without either drifting.
export const WIZARD_LIMITS = {
  rounds:               { min: 4, max: 8, default: 5 },
  injectsPerRound:      { min: 3, max: 5, default: 4 },
  optionsPerRolePerRound: { min: 3, max: 6, default: 4 },
  factsNoiseRatio:      { min: 0, max: 1, default: 0.7 },
} as const

export const DEFAULT_REGULATORY_REGIME_ID = 'nl_avg_nis2'

export const ALL_WIZARD_ROLES: readonly Role[] = [
  'ceo', 'ciso', 'cfo', 'legal', 'head_of_comms', 'hr_lead', 'ops_manager', 'it_manager',
] as const

// A single "special condition" — a scenario twist that the LLM is asked to
// weave into at least `roundsRequired` distinct rounds. Data-driven: adding a
// new condition is a data edit here, no consumer changes required.
export interface SpecialCondition {
  id: string
  label: string             // Dutch — shown in the UI
  narrativePrompt: string   // one-line prompt inserted into the LLM system prompt
  roundsRequired: number    // in how many distinct rounds must the phrase appear (default 2)
}

export const SPECIAL_CONDITIONS: SpecialCondition[] = [
  {
    id: 'backups_untested',
    label: 'Back-ups nooit volledig hersteld getest',
    narrativePrompt:
      'Bij herstelfase blijkt de back-up-restoretest jaren geleden voor het laatst gedraaid en werkt niet vlekkeloos.',
    roundsRequired: 2,
  },
  {
    id: 'single_knowledge_holder',
    label: 'Kritische kennis bij één persoon — onbereikbaar',
    narrativePrompt:
      'De enige persoon met kennis van een cruciaal systeem is met vakantie/onbereikbaar en dit blokkeert de herstelinspanning.',
    roundsRequired: 2,
  },
  {
    id: 'outsourced_it_thin_sla',
    label: 'IT uitbesteed, SLA dekt dit niet',
    narrativePrompt:
      'De MSP-SLA dekt geen incidentresponse op dit niveau; opschaling kost tijd en geld.',
    roundsRequired: 2,
  },
  {
    id: 'no_tested_crisis_plan',
    label: 'Crisis-plan bestaat maar is nooit geoefend',
    narrativePrompt:
      'Het bestaande IR-plan is theoretisch; niemand heeft het ooit geoefend.',
    roundsRequired: 2,
  },
  {
    id: 'unclear_insurance',
    label: 'Cyberverzekering onduidelijk',
    narrativePrompt:
      'De verzekeringspolis heeft uitzonderingen die niemand ooit heeft gelezen.',
    roundsRequired: 2,
  },
  {
    id: 'ot_production_dependency',
    label: 'OT-/productiesysteem afhankelijkheid',
    narrativePrompt:
      'Een productie- of OT-systeem is direct afhankelijk van de aangetaste omgeving.',
    roundsRequired: 2,
  },
  {
    id: 'supplier_concentration',
    label: 'Leveranciersconcentratie',
    narrativePrompt:
      'Eén leverancier draagt kritische diensten; failure cascade is een reëel risico.',
    roundsRequired: 2,
  },
]

export function specialConditionById(id: string): SpecialCondition | undefined {
  return SPECIAL_CONDITIONS.find(s => s.id === id)
}

// Sane default config for a first-time author. UI seeds all fields from this.
export function defaultWizardConfig(): WizardConfig {
  return {
    clientName: '',
    sector: '',
    companySize: 'mkbplus',
    itArrangement: '',
    rounds: WIZARD_LIMITS.rounds.default,
    injectsPerRound: WIZARD_LIMITS.injectsPerRound.default,
    optionsPerRolePerRound: WIZARD_LIMITS.optionsPerRolePerRound.default,
    factsNoiseRatio: WIZARD_LIMITS.factsNoiseRatio.default,
    rolesIncluded: [...ALL_WIZARD_ROLES],
    regulatoryRegimeId: DEFAULT_REGULATORY_REGIME_ID,
    specialConditions: [],
  }
}

// Server-side validation. Same shape as GraphIssue but constrained to wizard
// fields. Returns [] when the config is acceptable to pass to runWizardPipeline.
export function validateWizardConfig(config: WizardConfig): string[] {
  const errs: string[] = []
  if (!config.clientName?.trim()) errs.push('clientName is verplicht')
  if (!config.sector?.trim()) errs.push('sector is verplicht')
  if (config.rounds < WIZARD_LIMITS.rounds.min || config.rounds > WIZARD_LIMITS.rounds.max) {
    errs.push(`rounds moet tussen ${WIZARD_LIMITS.rounds.min} en ${WIZARD_LIMITS.rounds.max} zijn`)
  }
  if (config.injectsPerRound < WIZARD_LIMITS.injectsPerRound.min || config.injectsPerRound > WIZARD_LIMITS.injectsPerRound.max) {
    errs.push(`injectsPerRound moet tussen ${WIZARD_LIMITS.injectsPerRound.min} en ${WIZARD_LIMITS.injectsPerRound.max} zijn`)
  }
  if (config.optionsPerRolePerRound < WIZARD_LIMITS.optionsPerRolePerRound.min || config.optionsPerRolePerRound > WIZARD_LIMITS.optionsPerRolePerRound.max) {
    errs.push(`optionsPerRolePerRound moet tussen ${WIZARD_LIMITS.optionsPerRolePerRound.min} en ${WIZARD_LIMITS.optionsPerRolePerRound.max} zijn`)
  }
  if (config.factsNoiseRatio < 0 || config.factsNoiseRatio > 1) {
    errs.push('factsNoiseRatio moet tussen 0 en 1 zijn')
  }
  if (config.rolesIncluded.length === 0) {
    errs.push('minstens één rol moet meedoen')
  }
  for (const s of config.specialConditions) {
    if (!specialConditionById(s)) errs.push(`onbekende specialCondition: ${s}`)
  }
  return errs
}
