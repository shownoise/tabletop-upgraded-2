import { resolveRoles, type RoleResolution } from '@/lib/scoring'
import type { Inject, Role, SessionState } from '@/lib/types'
import type { TeamId } from '@/lib/team-roster'
import { APP_ROLE_TO_SPEC, domainFallbackAppRoles, domainsFor, toSpecRole } from './role-adapter'

// Deel B §1.3 — adaptieve inject-routing.
//
// Verschilt van `lib/inject-routing.ts` op één kernpunt: fallback verloopt niet
// per-rol (`ROLE_FALLBACK`, willekeurig gedefinieerd) maar per-*domein* via
// de spec-defaultketen. Onbezette rollen worden verzet naar de eerste bezette
// rol in de fallbackketen van hun primaire domein.
//
// Het bestaande `resolveInjectRecipients` blijft ongewijzigd. Deze functie is
// opt-in: session-store roept 'm alleen aan wanneer `session.roleResolution`
// gezet is (zie `computeAndStoreRoleResolution`).

export interface AdaptiveRoutingInput {
  inject: Inject
  presentRoles: Role[]
  teamRoles: Record<TeamId, Role[]>
  roleResolution: RoleResolution
}

export function resolveInjectRecipientsAdaptive(input: AdaptiveRoutingInput): Role[] {
  const { inject, presentRoles, teamRoles, roleResolution } = input
  if (presentRoles.length === 0) return []
  const present = new Set(presentRoles)

  if (inject.targetRoles?.length) {
    // Direct: elke target-rol die bezet is telt.
    const direct = inject.targetRoles.filter(r => present.has(r))
    if (direct.length > 0) return direct
    // Fallback: bepaal het primaire domein van elke onbezette target-rol,
    // haal de effectiveOwner van dat domein op, map spec-rol → app-rol.
    const viaDomain = new Set<Role>()
    for (const r of inject.targetRoles) {
      const domains = domainsFor(r)
      if (domains.length === 0) continue
      const primaryDomain = domains[0]
      const specOwner = roleResolution.effectiveOwners[primaryDomain]
      if (specOwner === 'NPC') continue
      // Vind app-rol die deze spec-rol invult én bezet is.
      const app = pickBezetAppRoleForSpec(specOwner, present)
      if (app) viaDomain.add(app)
    }
    if (viaDomain.size > 0) return [...viaDomain]
    // Uiterste vangnet: domein-fallbackketen als geheel doorlopen.
    for (const r of inject.targetRoles) {
      const domains = domainsFor(r)
      for (const d of domains) {
        for (const app of domainFallbackAppRoles(d)) {
          if (present.has(app)) return [app]
        }
      }
    }
  }

  const team = inject.targetTeam
  if (team && team !== 'all') {
    const inTeam = (teamRoles[team] ?? []).filter(r => present.has(r))
    if (inTeam.length > 0) return inTeam
  }

  // Laatste vangnet: stabiele hash-verdeling zoals het bestaande gedrag.
  const idx = stableHash(inject.id) % presentRoles.length
  return [presentRoles[idx]]
}

function pickBezetAppRoleForSpec(spec: string, present: Set<Role>): Role | null {
  for (const [app, s] of Object.entries(APP_ROLE_TO_SPEC) as Array<[Role, string]>) {
    if (s === spec && present.has(app)) return app
  }
  return null
}

function stableHash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

// Deel B §1.2 — bouw RoleResolution voor de app-Roster.
export function buildResolutionForSession(session: SessionState): RoleResolution {
  const specPresent = session.participants
    .map(p => (p.role ? toSpecRole(p.role) : undefined))
    .filter((s): s is string => !!s)
  return resolveRoles(
    { presentRoles: specPresent },
    { rounds: [], decisionPoints: [], injects: [] },
    Date.now(),
  )
}

// Deel B §1.4 — vergelijk actuele decider tegen effectiveOwner-in-app-terms.
// Retourneert `true` als de decider structureel correct is (identity of via
// gevallen fallback), `false` als ad-hoc buiten-mandaat.
export function isStructurallyCorrectDecider(
  actualDeciderRole: Role,
  domainOfDecision: import('@/lib/scoring').Domain,
  resolution: RoleResolution,
  presentRoles: Role[],
): boolean {
  const specDecider = toSpecRole(actualDeciderRole)
  const effOwner = resolution.effectiveOwners[domainOfDecision]
  if (effOwner === 'NPC') return true  // niemand ontworpen én niemand bezet → facilitator neemt
  if (specDecider === effOwner) return true
  // Ad-hoc: als effOwner in het app-rollen-model bezet is, was afwijken een keuze.
  const effOwnerAppRole = pickBezetAppRoleForSpec(effOwner, new Set(presentRoles))
  return effOwnerAppRole === null  // effOwner niet in app → geen structureel alternatief → decider is correct
}
