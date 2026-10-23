// Wie speelt welke rol, en wie mag wat beslissen. Eén bron voor de
// deelnemersconsole, de deelnemerslijst van de facilitator en de scoring.
//
// Waarom dit bestand bestaat: issue #105 §1 reproduceerde dat de facilitator
// "CEO" zag terwijl de deelnemer zelf "Nog geen rol gekozen" las. Dat kwam
// doordat elke plek zijn eigen afleiding had — de één las `participant.role`,
// de ander een sessionStorage-sleutel, de derde `roleDistribution`. Alles leest
// nu hier, en hier staat de serverstate altijd bovenaan de keten.
//
// Client-safe en puur: geen DB, geen crypto, geen fs. Mag in elke bundle.

import type { DecisionNodeData, ScenarioGraph } from './graph/types'
import type { Participant, Role, SessionState } from './types'
import { ROLE_META } from './types'
import { effectiveRolesForParticipant } from './engine/distribute-roles'

export interface ParticipantRoles {
  participantId: string
  participantName: string
  // De rol die deze deelnemer zelf heeft geclaimd. Undefined zolang er niets
  // geclaimd is — dat is de enige situatie waarin "nog geen rol" waar is.
  primary?: Role
  // Rollen die niemand bezet en die aan deze deelnemer zijn toegewezen.
  inherited: Role[]
  // primary + inherited, zonder duplicaten. Hier hangt de UI aan.
  all: Role[]
}

// Afleiding met de server bovenaan: `participant.role` is wat de deelnemer
// heeft geclaimd en wat de facilitator ziet, dus dat is leidend. De
// roleDistribution voegt daar alleen overgenomen rollen aan toe. Een snapshot
// die ouder is dan de claim mag de claim nooit wissen — dat was precies de bug.
export function rolesForParticipant(
  session: Pick<SessionState, 'participants' | 'roleDistribution' | 'roleAssignmentOverrides'>,
  participantId: string | null | undefined,
): ParticipantRoles | null {
  if (!participantId) return null
  const participant = session.participants.find(p => p.id === participantId)
  if (!participant) return null
  return rolesForParticipantEntry(session, participant)
}

function rolesForParticipantEntry(
  session: Pick<SessionState, 'roleDistribution' | 'roleAssignmentOverrides'>,
  participant: Participant,
): ParticipantRoles {
  const entry = session.roleDistribution?.entries.find(e => e.participantId === participant.id)
  const override = session.roleAssignmentOverrides?.[participant.id]
  let inherited: Role[] = []
  if (entry) {
    const all = effectiveRolesForParticipant(entry, override)
    inherited = all.filter(r => r !== participant.role && r !== entry.primaryRole)
    // Een snapshot die van vóór de rolclaim is, kan een andere primary noemen.
    // De claim wint; de oude primary wordt dan een overgenomen rol.
    if (entry.primaryRole !== participant.role && participant.role) inherited = [entry.primaryRole, ...inherited]
  } else if (override) {
    inherited = override.filter(r => r !== participant.role)
  }
  const primary = participant.role
  const all = [...new Set([...(primary ? [primary] : []), ...inherited])]
  return { participantId: participant.id, participantName: participant.name, primary, inherited, all }
}

export function allParticipantRoles(
  session: Pick<SessionState, 'participants' | 'roleDistribution' | 'roleAssignmentOverrides'>,
): ParticipantRoles[] {
  return session.participants.map(p => rolesForParticipantEntry(session, p))
}

// ── Welke rollen heeft het scenario nodig ──────────────────────────────

// Inclusief de rollen die alleen als eigenaar van een keuze-optie voorkomen.
// `withRoleDistribution` keek daar niet naar, waardoor een rol die uitsluitend
// een beslissing bezit nooit werd herverdeeld en de ronde kon blokkeren.
export function authoredRolesFromGraph(graph: ScenarioGraph): Role[] {
  const roles = new Set<Role>()
  for (const node of graph.nodes) {
    if (node.type === 'round') {
      const rd = node.data as { roleActions?: Array<{ allowedRoles: Role[] }> }
      for (const action of rd.roleActions ?? []) for (const r of action.allowedRoles) roles.add(r)
    } else if (node.type === 'inject') {
      const id = node.data as { targetRoles?: Role[] }
      for (const r of id.targetRoles ?? []) roles.add(r)
    } else if (node.type === 'decision') {
      const dd = node.data as DecisionNodeData
      for (const option of dd.options) if (option.allowedRole) roles.add(option.allowedRole)
      if (dd.triggerRole) roles.add(dd.triggerRole)
    }
  }
  for (const briefingRole of Object.keys(graph.roleBriefings ?? {})) roles.add(briefingRole as Role)
  return [...roles]
}

export function authoredRolesForSession(
  session: Pick<SessionState, 'graph' | 'scenario' | 'participants'>,
): Role[] {
  const roles = new Set<Role>()
  if (session.graph) {
    for (const r of authoredRolesFromGraph(session.graph)) roles.add(r)
  } else {
    for (const round of session.scenario?.rounds ?? []) {
      for (const action of round.roleActions ?? []) for (const r of action.allowedRoles) roles.add(r)
      for (const inject of round.injects) for (const r of inject.targetRoles ?? []) roles.add(r)
    }
  }
  // Een geclaimde rol hoort er altijd bij, ook als het scenario er niets voor
  // heeft geschreven — anders verdwijnt de deelnemer uit de verdeling.
  for (const p of session.participants) if (p.role) roles.add(p.role)
  return [...roles]
}

// ── Dekking per rol ────────────────────────────────────────────────────

export interface RoleCoverage {
  role: Role
  label: string
  // 'bezet'      — iemand heeft deze rol zelf geclaimd
  // 'overgenomen' — niemand claimde hem; een aanwezige deelnemer speelt hem erbij
  // 'onbezet'    — niemand dekt hem. De keuze van deze rol mag dan niet blokkeren.
  status: 'bezet' | 'overgenomen' | 'onbezet'
  participantId?: string
  participantName?: string
}

export function roleCoverage(
  session: Pick<SessionState, 'participants' | 'roleDistribution' | 'roleAssignmentOverrides' | 'graph' | 'scenario'>,
): RoleCoverage[] {
  const everyone = allParticipantRoles(session)
  const byPrimary = new Map<Role, ParticipantRoles>()
  const byInherited = new Map<Role, ParticipantRoles>()
  for (const person of everyone) {
    if (person.primary && !byPrimary.has(person.primary)) byPrimary.set(person.primary, person)
    for (const r of person.inherited) if (!byInherited.has(r)) byInherited.set(r, person)
  }
  return authoredRolesForSession(session).map(role => {
    const owner = byPrimary.get(role)
    if (owner) {
      return {
        role, label: ROLE_META[role]?.label ?? role, status: 'bezet' as const,
        participantId: owner.participantId, participantName: owner.participantName,
      }
    }
    const stand_in = byInherited.get(role)
    if (stand_in) {
      return {
        role, label: ROLE_META[role]?.label ?? role, status: 'overgenomen' as const,
        participantId: stand_in.participantId, participantName: stand_in.participantName,
      }
    }
    return { role, label: ROLE_META[role]?.label ?? role, status: 'onbezet' as const }
  })
}

export function unoccupiedRoles(
  session: Parameters<typeof roleCoverage>[0],
): Role[] {
  return roleCoverage(session).filter(c => c.status === 'onbezet').map(c => c.role)
}

// Elke rol die door iemand wordt gedekt — primair of overgenomen. Alleen deze
// rollen kunnen een beslissing indienen, dus alleen deze mogen een ronde
// tegenhouden.
export function coveredRoles(
  session: Parameters<typeof roleCoverage>[0],
): Set<Role> {
  const covered = new Set<Role>()
  for (const c of roleCoverage(session)) if (c.status !== 'onbezet') covered.add(c.role)
  return covered
}

// ── Mandaat op een beslismoment ────────────────────────────────────────

export interface OptionMandate {
  optionId: string
  // De deelnemer mag deze optie indienen.
  canSubmit: boolean
  // De rol waaronder dat gebeurt. Bij een overgenomen rol is dit niet de
  // primaire rol van de deelnemer — de UI moet dat benoemen.
  asRole?: Role
  viaInheritance: boolean
}

export interface DecisionMandate {
  // Rollen die een keuze bezitten en die door iemand gedekt worden.
  mandatedRoles: Role[]
  // Rollen die een keuze bezitten en die niemand dekt. Deze blokkeren niet.
  unoccupiedMandates: Role[]
  options: OptionMandate[]
  // De rollen die déze deelnemer op dit beslismoment mag indienen.
  myRoles: Role[]
}

// Welke opties mag wie indienen. Een optie zonder `allowedRole` is van
// iedereen; een optie met een rol die deze deelnemer heeft overgenomen is óók
// van deze deelnemer — dat is de hele reden dat er een verdeling is.
export function decisionMandate(
  session: Parameters<typeof roleCoverage>[0] & Pick<SessionState, 'flags'>,
  decision: DecisionNodeData,
  participantId: string | null | undefined,
): DecisionMandate {
  const mine = rolesForParticipant(session, participantId)
  const myRoleSet = new Set(mine?.all ?? [])
  const inheritedSet = new Set(mine?.inherited ?? [])
  const covered = coveredRoles(session)

  const owning = new Set<Role>()
  for (const option of decision.options) {
    if (option.implicit) continue
    if (option.requiresCapability && !session.flags?.[option.requiresCapability]) continue
    if (option.allowedRole) owning.add(option.allowedRole)
  }

  const options: OptionMandate[] = decision.options.map(option => {
    const selectable = !option.implicit
      && (!option.requiresCapability || !!session.flags?.[option.requiresCapability])
    if (!selectable) return { optionId: option.id, canSubmit: false, viaInheritance: false }
    if (!option.allowedRole) {
      return { optionId: option.id, canSubmit: !!participantId, asRole: mine?.primary, viaInheritance: false }
    }
    const canSubmit = myRoleSet.has(option.allowedRole)
    return {
      optionId: option.id,
      canSubmit,
      asRole: canSubmit ? option.allowedRole : undefined,
      viaInheritance: canSubmit && inheritedSet.has(option.allowedRole),
    }
  })

  return {
    mandatedRoles: [...owning].filter(r => covered.has(r)),
    unoccupiedMandates: [...owning].filter(r => !covered.has(r)),
    options,
    myRoles: [...owning].filter(r => myRoleSet.has(r)),
  }
}
