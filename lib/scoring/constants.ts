// Bumped on every formula tweak. Every scoring output carries this string.
// SemVer: major = dimension added/removed, minor = weights changed, patch = formula fix.
export const SCORING_VERSION = '1.0.0'

// Deel A §7.8 — default gewichten voor de geometrisch-gemiddelde PROCES-aggregatie.
// Configureerbaar per oefening; deze default staat opgeschreven in de spec.
export const DEFAULT_PROCESS_WEIGHTS = {
  BESLUIT: 0.18,
  MANDAAT: 0.18,
  AANNAME: 0.13,
  ADAPT: 0.13,
  EXTERN: 0.18,
  VOLHOUD: 0.08,
  DELEN: 0.12,
} as const

// De zes uitkomstdimensies (Deel A §5). Vast, nooit per klant aanpassen.
export const OUTCOME_DIMENSIONS = ['CONT', 'FOR', 'BC', 'JUR', 'VER', 'KOS'] as const
export type OutcomeDimension = typeof OUTCOME_DIMENSIONS[number]

// De zeven procesdimensies (Deel A §7).
export const PROCESS_DIMENSIONS = [
  'BESLUIT', 'MANDAAT', 'AANNAME', 'ADAPT', 'EXTERN', 'VOLHOUD', 'DELEN',
] as const
export type ProcessDimension = typeof PROCESS_DIMENSIONS[number]

// De tien domeinen (Deel A §4.1).
export const DOMAINS = [
  'CONTAINMENT', 'FORENSIEK', 'HERSTEL', 'JURIDISCH', 'EXTERNE_COMMS',
  'INTERNE_COMMS', 'PERSONEEL', 'BEDRIJFSPROCES', 'GELD', 'EXTERNE_PARTIJEN',
] as const
export type Domain = typeof DOMAINS[number]

// Deel B §1.1 — fallbackketen per domein. `CRISIS_LEAD` is altijd het sluitstuk.
// Aanpasbaar per klant/oefening via `ExerciseInput.domainOwnership` override.
export const DEFAULT_DOMAIN_OWNERSHIP: Record<Domain, readonly string[]> = {
  JURIDISCH:        ['LEGAL_DPO', 'CRISIS_LEAD'],
  GELD:             ['FINANCE_PROC', 'BUSINESS_OWNER', 'CRISIS_LEAD'],
  HERSTEL:          ['IT_LEAD', 'SECURITY_LEAD', 'CRISIS_LEAD'],
  CONTAINMENT:      ['SECURITY_LEAD', 'IT_LEAD', 'CRISIS_LEAD'],
  FORENSIEK:        ['SECURITY_LEAD', 'RETAINER_LIAISON', 'IT_LEAD', 'CRISIS_LEAD'],
  EXTERNE_COMMS:    ['COMMS', 'CRISIS_LEAD'],
  INTERNE_COMMS:    ['COMMS', 'HR', 'CRISIS_LEAD'],
  PERSONEEL:        ['HR', 'BUSINESS_OWNER', 'CRISIS_LEAD'],
  BEDRIJFSPROCES:   ['BUSINESS_OWNER', 'CRISIS_LEAD'],
  EXTERNE_PARTIJEN: ['CRISIS_LEAD', 'RETAINER_LIAISON'],
} as const

// Deel B §1.5 — drempels waaronder MANDAAT/DELEN als "niet meetbaar" (null) worden gerapporteerd.
export const MANDATE_MIN_DISTINCT_OWNERS = 3
export const SHARE_MIN_ROL_COVERAGE = 0.4

// Deel A §7.1 — Tempo-formule σ in log-ruimte. Spec: 0,6.
export const TEMPO_SIGMA = 0.6

// Deel A §7.7 — deel-vertragingsconstante κ_deel in minuten. Spec: ≈10.
export const KAPPA_SHARE_MIN = 10

// Deel A §7.4 — window na materieel event waarin herziening 100% telt (voor tijd-correctie).
// Zonder een spec-getal: default 30 min. Configureerbaar per exercise.
export const REVISION_WINDOW_MIN = 30

// Deel B §7.1 — fallback-vector wanneer geen impliciete "geen besluit"-optie gedefinieerd is.
export const NO_DECISION_FALLBACK_VECTOR: Record<OutcomeDimension, number> = {
  CONT: -1, FOR: 0, BC: -1, JUR: -1, VER: 0, KOS: 0,
}
