import type { Domain, RoleId } from '@/lib/scoring'
import type { Role } from '@/lib/types'

// Bridge tussen de app-rol-enum (9 concrete rollen) en het abstracte rol/domein-
// model uit de spec (Deel A §4.1 + Deel B §1). De scoring-package blijft puur;
// deze module is app-side en mag `lib/types` importeren.

// Deel B §1.1 — app-role naar spec-RoleId. Waar de spec `CRISIS_LEAD` heeft,
// mapt de app `ceo` (crisis-lead in de huidige rolindeling).
export const APP_ROLE_TO_SPEC: Record<Role, RoleId> = {
  ceo:            'CRISIS_LEAD',
  ciso:           'SECURITY_LEAD',
  cfo:            'FINANCE_PROC',
  legal:          'LEGAL_DPO',
  head_of_comms:  'COMMS',
  hr_lead:        'HR',
  ops_manager:    'BUSINESS_OWNER',
  it_manager:     'IT_LEAD',
}

export function toSpecRole(role: Role): RoleId {
  return APP_ROLE_TO_SPEC[role]
}

// Reverse-mapping. Meerdere app-rollen kunnen naar dezelfde spec-rol mappen
// (IT_LEAD = it_manager + system_admin) — we geven ze allemaal terug in
// determinatie-volgorde.
export function fromSpecRole(spec: RoleId): Role[] {
  const out: Role[] = []
  for (const [app, s] of Object.entries(APP_ROLE_TO_SPEC) as Array<[Role, RoleId]>) {
    if (s === spec) out.push(app)
  }
  return out
}

// Domein-associaties per app-rol. Gebaseerd op ROLE_META.authorities in
// `lib/types.ts` en de tien spec-domeinen. Eén rol kan meerdere domeinen
// serveren; volgorde bepaalt "primaire" domein bij twijfel.
export const APP_ROLE_TO_DOMAINS: Record<Role, Domain[]> = {
  ceo:            ['EXTERNE_PARTIJEN', 'INTERNE_COMMS'],
  ciso:           ['CONTAINMENT', 'FORENSIEK', 'HERSTEL'],
  cfo:            ['GELD'],
  legal:          ['JURIDISCH'],
  head_of_comms:  ['EXTERNE_COMMS', 'INTERNE_COMMS'],
  hr_lead:        ['PERSONEEL', 'INTERNE_COMMS'],
  ops_manager:    ['BEDRIJFSPROCES', 'HERSTEL'],
  it_manager:     ['HERSTEL', 'CONTAINMENT', 'FORENSIEK'],
}

export function domainsFor(role: Role): Domain[] {
  return APP_ROLE_TO_DOMAINS[role] ?? []
}

// Deel B §1.1 — fallbackketen per domein in *app-role* terms, afgeleid uit
// de spec-defaults én de rol-mapping. Als het scoring-package een override
// heeft geregistreerd, gebruik die.
export function domainFallbackAppRoles(domain: Domain): Role[] {
  // Sequential mapping: doorloop de spec-keten (uit DEFAULT_DOMAIN_OWNERSHIP)
  // en zet elke spec-rol om naar app-rollen. `CRISIS_LEAD` als sluitstuk mapt
  // naar `ceo`. Meerdere app-rollen per spec-rol → alle naar de keten toevoegen.
  const specChain = SPEC_CHAINS[domain]
  const out: Role[] = []
  for (const spec of specChain) {
    for (const app of fromSpecRole(spec)) {
      if (!out.includes(app)) out.push(app)
    }
  }
  return out
}

// Spiegel van DEFAULT_DOMAIN_OWNERSHIP maar geïmporteerd voor lokale mapping.
// Los gehouden om circular imports te vermijden.
const SPEC_CHAINS: Record<Domain, readonly RoleId[]> = {
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
