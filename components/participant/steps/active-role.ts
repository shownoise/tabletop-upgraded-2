// Welke rol de deelnemer nú draagt. Eén afleiding, met de serverstate bovenaan.
//
// Waarom dit bestand bestaat: `play-view.tsx` las de actieve rol uitsluitend uit
// `sessionStorage` (`ctt:activeRole`, regel 941) en bouwde daarop
// `effectiveRole` (regel 961) en `canSubmit = !!participantId && !!activeRole`
// (regel 697). Na een echte rolclaim had de server `participants[0].role` wél
// gevuld terwijl beide sessionStorage-sleutels `null` waren. Gevolg in hetzelfde
// scherm: de HUD toonde "CEO" en de team-console "Nog geen rol gekozen", en in
// de beslissingsfase verscheen geen keuzekaart (issue #105 §1).
//
// `sessionStorage` is per tab en overleeft een rolwissel door de facilitator
// niet. De opgeslagen voorkeur mag daarom alleen nog bepalen *welke* van
// meerdere eigen rollen actief is, en wordt genegeerd zodra de deelnemer die rol
// niet (meer) heeft.
//
// Puur en zonder React, zodat de afleiding zonder browser te testen is.

import type { Role, SessionState } from '@/lib/types'
import { rolesForParticipant, type ParticipantRoles } from '@/lib/session-roles'

// Alles wat `rolesForParticipant` nodig heeft — niet de hele sessie, zodat een
// test geen volledige SessionState hoeft op te tuigen.
export type RoleSessionShape = Pick<
  SessionState,
  'participants' | 'roleDistribution' | 'roleAssignmentOverrides'
>

export interface ActiveRoleView {
  roles: ParticipantRoles | null
  // Alle rollen die deze deelnemer draagt: geclaimd + overgenomen.
  all: Role[]
  // De zelf geclaimde rol. Ontbreekt alleen als er echt niets geclaimd is.
  primary?: Role
  inherited: Role[]
  // De rol waaronder deze deelnemer nu handelt.
  active?: Role
  // Handelt hij op dit moment namens een overgenomen rol? Het scherm moet dat
  // benoemen, want mandaat en perspectief zijn dan niet die van zijn eigen rol.
  activeIsInherited: boolean
  hasRole: boolean
  // De opgeslagen voorkeur hoorde niet (meer) bij deze deelnemer en is
  // genegeerd. Stil terugvallen was precies de verwarring van §1.
  preferenceDropped: boolean
}

const EMPTY: ActiveRoleView = {
  roles: null,
  all: [],
  inherited: [],
  activeIsInherited: false,
  hasRole: false,
  preferenceDropped: false,
}

export function activeRoleView(
  session: RoleSessionShape | null | undefined,
  participantId: string | null | undefined,
  preference?: Role | null,
): ActiveRoleView {
  if (!session || !participantId) return EMPTY
  const roles = rolesForParticipant(session, participantId)
  if (!roles) return EMPTY

  const wanted = preference ?? undefined
  const honoured = wanted && roles.all.includes(wanted) ? wanted : undefined
  // Geclaimde rol is de standaard. Heeft iemand niets geclaimd maar wel een rol
  // overgenomen, dan is die overgenomen rol de actieve — anders zou een
  // teamdevice zonder claim nooit kunnen indienen.
  const active = honoured ?? roles.primary ?? roles.all[0]

  return {
    roles,
    all: roles.all,
    primary: roles.primary,
    inherited: roles.inherited,
    active,
    activeIsInherited: !!active && roles.inherited.includes(active),
    hasRole: roles.all.length > 0,
    preferenceDropped: !!wanted && !honoured,
  }
}
