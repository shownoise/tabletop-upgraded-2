// De regressietest bij issue #105 §1: de facilitator zag "CEO" terwijl de
// deelnemer "Nog geen rol gekozen" las, omdat de actieve rol alleen uit
// sessionStorage kwam en die sleutel leeg was.

import { describe, expect, it } from 'vitest'
import type { Participant, Role, RoleDistributionSnapshot } from '@/lib/types'
import { activeRoleView, type RoleSessionShape } from '@/components/participant/steps/active-role'

function session(
  participants: Participant[],
  roleDistribution?: RoleDistributionSnapshot,
  roleAssignmentOverrides?: Record<string, Role[]>,
): RoleSessionShape {
  return { participants, roleDistribution, roleAssignmentOverrides }
}

function person(id: string, role?: Role): Participant {
  return { id, name: id.toUpperCase(), joinedAt: 1, ...(role ? { role } : {}) }
}

function distribution(
  entries: Array<{ participantId: string; primaryRole: Role; inheritedRoles?: Role[] }>,
): RoleDistributionSnapshot {
  return {
    computedAt: 1,
    entries: entries.map(e => ({
      participantId: e.participantId,
      participantName: e.participantId.toUpperCase(),
      primaryRole: e.primaryRole,
      inheritedRoles: e.inheritedRoles ?? [],
      workload: 1,
    })),
    unassignedRoles: [],
    coverage: 1,
  }
}

describe('activeRoleView', () => {
  it('neemt de geclaimde rol van de server, ook als er geen voorkeur opgeslagen is', () => {
    // Exact de live gemeten situatie: server heeft role "ceo", beide
    // sessionStorage-sleutels zijn null.
    const view = activeRoleView(session([person('p1', 'ceo')]), 'p1', null)
    expect(view.active).toBe('ceo')
    expect(view.hasRole).toBe(true)
    expect(view.activeIsInherited).toBe(false)
    expect(view.preferenceDropped).toBe(false)
  })

  it('negeert een opgeslagen voorkeur voor een rol die de deelnemer niet heeft', () => {
    const view = activeRoleView(session([person('p1', 'ceo')]), 'p1', 'legal')
    expect(view.active).toBe('ceo')
    expect(view.preferenceDropped).toBe(true)
  })

  it('laat de voorkeur wel kiezen tussen rollen die de deelnemer wél draagt', () => {
    const view = activeRoleView(
      session([person('p1', 'ceo')], distribution([{ participantId: 'p1', primaryRole: 'ceo', inheritedRoles: ['legal'] }])),
      'p1',
      'legal',
    )
    expect(view.active).toBe('legal')
    expect(view.activeIsInherited).toBe(true)
    expect(view.preferenceDropped).toBe(false)
    expect(view.all).toEqual(['ceo', 'legal'])
  })

  it('maakt een overgenomen rol actief wanneer er niets geclaimd is', () => {
    const view = activeRoleView(session([person('p1')], undefined, { p1: ['ciso'] }), 'p1', null)
    expect(view.primary).toBeUndefined()
    expect(view.active).toBe('ciso')
    expect(view.activeIsInherited).toBe(true)
    expect(view.hasRole).toBe(true)
  })

  it('laat een oudere rolverdeling de verse claim niet overschrijven', () => {
    // De snapshot is van vóór de claim en noemt een andere primary. De claim
    // wint; de oude primary wordt een overgenomen rol.
    const view = activeRoleView(
      session([person('p1', 'ceo')], distribution([{ participantId: 'p1', primaryRole: 'cfo' }])),
      'p1',
      null,
    )
    expect(view.active).toBe('ceo')
    expect(view.inherited).toContain('cfo')
  })

  it('geeft geen rol terug zonder deelnemer of zonder sessie', () => {
    expect(activeRoleView(session([person('p1', 'ceo')]), null, null).hasRole).toBe(false)
    expect(activeRoleView(null, 'p1', null).hasRole).toBe(false)
    expect(activeRoleView(session([]), 'p1', null).hasRole).toBe(false)
  })
})
