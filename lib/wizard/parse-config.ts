import { sanitizeForPrompt, PROMPT_FIELD_CAPS } from "@/lib/scenario/sanitize"
import {
  defaultWizardConfig,
  ALL_WIZARD_ROLES,
  SPECIAL_CONDITIONS,
  DEFAULT_REGULATORY_REGIME_ID,
  WIZARD_LIMITS,
  type CompanySize,
  type WizardConfig,
} from "./config"
import type { Role } from "@/lib/types"

// Parse-time coercion: de body is pas te vertrouwen nadat elk veld geklemd en
// geschoond is. Vrije-tekstvelden gaan door sanitizeForPrompt.
//
// WAAROM hier en niet in de route: zowel het LLM-pad
// (app/api/scenario-graph/ai-wizard) als het conceptpad
// (app/api/scenario-graph/draft) leest exact dezelfde body. Eén parser houdt de
// twee paden op dezelfde config, ook als er later een veld bij komt.
export function parseWizardConfigFromBody(body: unknown): WizardConfig {
  const base = defaultWizardConfig()
  if (!body || typeof body !== 'object') return base
  const b = body as Record<string, unknown>

  const clientName    = sanitizeForPrompt(typeof b.clientName === 'string' ? b.clientName : "", 200) || ""
  const sector        = sanitizeForPrompt(typeof b.sector === 'string' ? b.sector : "", PROMPT_FIELD_CAPS.sector) || ""
  const itArrangement = sanitizeForPrompt(typeof b.itArrangement === 'string' ? b.itArrangement : "", 400) || ""
  const importantContext = typeof b.importantContext === 'string'
    ? (sanitizeForPrompt(b.importantContext, 2000) || undefined)
    : undefined

  const companySize: CompanySize = (['small', 'mkbplus', 'enterprise'] as const).includes(b.companySize as CompanySize)
    ? (b.companySize as CompanySize)
    : base.companySize

  const clamp = (v: unknown, min: number, max: number, dflt: number) => {
    const n = Number(v)
    if (!Number.isFinite(n)) return dflt
    return Math.max(min, Math.min(max, n))
  }

  const rounds = clamp(b.rounds, WIZARD_LIMITS.rounds.min, WIZARD_LIMITS.rounds.max, base.rounds)
  const injectsPerRound = clamp(b.injectsPerRound, WIZARD_LIMITS.injectsPerRound.min, WIZARD_LIMITS.injectsPerRound.max, base.injectsPerRound)
  const optionsPerRolePerRound = clamp(b.optionsPerRolePerRound, WIZARD_LIMITS.optionsPerRolePerRound.min, WIZARD_LIMITS.optionsPerRolePerRound.max, base.optionsPerRolePerRound)
  const factsNoiseRatio = clamp(b.factsNoiseRatio, 0, 1, base.factsNoiseRatio)

  const rolesIncluded: Role[] = Array.isArray(b.rolesIncluded)
    ? (b.rolesIncluded.filter((r): r is Role => (ALL_WIZARD_ROLES as readonly string[]).includes(r as string)))
    : base.rolesIncluded

  const regulatoryRegimeId = typeof b.regulatoryRegimeId === 'string' && b.regulatoryRegimeId
    ? b.regulatoryRegimeId
    : DEFAULT_REGULATORY_REGIME_ID

  const knownIds = new Set(SPECIAL_CONDITIONS.map(s => s.id))
  const specialConditions: string[] = Array.isArray(b.specialConditions)
    ? b.specialConditions.filter((s): s is string => typeof s === 'string' && knownIds.has(s))
    : []

  const seed = typeof b.seed === 'string' && b.seed.trim().length > 0 ? b.seed.trim().slice(0, 64) : undefined

  return {
    clientName,
    sector,
    companySize,
    itArrangement,
    importantContext,
    rounds,
    injectsPerRound,
    optionsPerRolePerRound,
    factsNoiseRatio,
    rolesIncluded: rolesIncluded.length > 0 ? rolesIncluded : base.rolesIncluded,
    regulatoryRegimeId,
    specialConditions,
    seed,
  }
}
