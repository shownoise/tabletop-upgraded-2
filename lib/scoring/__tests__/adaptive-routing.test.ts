import { describe, expect, it } from 'vitest'
import { resolveInjectRecipientsAdaptive, buildResolutionForSession, isStructurallyCorrectDecider } from '@/lib/graph/adaptive-routing'
import { toSpecRole, domainsFor, APP_ROLE_TO_SPEC } from '@/lib/graph/role-adapter'
import { resolveRoles } from '@/lib/scoring'
import type { Inject, Role, SessionState } from '@/lib/types'
import type { TeamId } from '@/lib/team-roster'

// Fase 2 — Deel B §8: rolresolutie + adaptieve routering met testcases voor
// rosters van 3, 5 en 9 rollen. Doel: laten zien dat een klein team niet wordt
// afgestraft doordat informatie stilletjes verdwijnt.

const teamRoles: Record<TeamId, Role[]> = {
  crisis_management: ['ceo', 'ciso', 'cfo', 'legal', 'head_of_comms', 'hr_lead', 'ops_manager'],
  technical_it:      ['it_manager', 'it_manager'],
}

const inject = (id: string, opts: Partial<Inject> = {}): Inject => ({
  id, type: 'alert', title: `Inject ${id}`, content: 'x', urgency: 'medium', ...opts,
})

function toSpecPresent(present: Role[]) {
  return present.map(toSpecRole)
}

function reso(present: Role[]) {
  return resolveRoles({ presentRoles: toSpecPresent(present) }, { rounds: [], decisionPoints: [], injects: [] })
}

describe('adaptive routing — 3/5/9 rosters (Fase 2)', () => {

  // ── 9 rollen: volledige bezetting ────────────────────────────────────
  describe('9-rol volledig team', () => {
    const present: Role[] = ['ceo', 'ciso', 'cfo', 'legal', 'head_of_comms', 'hr_lead', 'ops_manager', 'it_manager', 'it_manager']
    const roleResolution = reso(present)

    it('directe route naar bezette rol werkt (identity)', () => {
      const routed = resolveInjectRecipientsAdaptive({
        inject: inject('legal-1', { targetRoles: ['legal'] }),
        presentRoles: present, teamRoles, roleResolution,
      })
      expect(routed).toEqual(['legal'])
    })

    it('rolCoverage = 1.0, alle 10 domeinen bezet', () => {
      expect(roleResolution.rolCoverage).toBe(1)
      expect(Object.values(roleResolution.effectiveOwners).every(r => r !== 'NPC')).toBe(true)
    })

    it('distinctOwners ≥ 6 → MANDAAT en DELEN meetbaar', () => {
      expect(roleResolution.distinctOwners).toBeGreaterThanOrEqual(6)
    })
  })

  // ── 5 rollen: middengroot ─────────────────────────────────────────────
  describe('5-rol team (crisis-core + IT)', () => {
    const present: Role[] = ['ceo', 'ciso', 'legal', 'cfo', 'it_manager']
    const roleResolution = reso(present)

    it('journalist belt HR-lijn (misroute) → HR onbezet → doorrouteren naar COMMS-fallback → COMMS onbezet → CRISIS_LEAD (ceo)', () => {
      // HR heeft primair domein PERSONEEL; fallbackketen PERSONEEL = HR → BUSINESS_OWNER → CRISIS_LEAD.
      // Geen HR, geen ops_manager (BUSINESS_OWNER) → landt op CRISIS_LEAD = ceo.
      const routed = resolveInjectRecipientsAdaptive({
        inject: inject('journalist-belt-hr', { targetRoles: ['hr_lead'] }),
        presentRoles: present, teamRoles, roleResolution,
      })
      expect(routed).toEqual(['ceo'])
    })

    it('inject naar system_admin → onbezet → FORENSIEK-fallback → SECURITY_LEAD (ciso)', () => {
      const routed = resolveInjectRecipientsAdaptive({
        inject: inject('forensic-log', { targetRoles: ['it_manager'] }),
        presentRoles: present, teamRoles, roleResolution,
      })
      expect(routed).toEqual(['ciso'])
    })

    it('inject naar ops_manager → onbezet → BEDRIJFSPROCES-fallback → CRISIS_LEAD (ceo)', () => {
      const routed = resolveInjectRecipientsAdaptive({
        inject: inject('bcp', { targetRoles: ['ops_manager'] }),
        presentRoles: present, teamRoles, roleResolution,
      })
      expect(routed).toEqual(['ceo'])
    })

    it('geen informatie mag stilletjes verdwijnen — elke inject krijgt een geadresseerde', () => {
      for (const roleAsTarget of ['hr_lead', 'ops_manager', 'it_manager', 'head_of_comms'] as Role[]) {
        const routed = resolveInjectRecipientsAdaptive({
          inject: inject(`x-${roleAsTarget}`, { targetRoles: [roleAsTarget] }),
          presentRoles: present, teamRoles, roleResolution,
        })
        expect(routed.length).toBeGreaterThan(0)
        expect(routed.every(r => present.includes(r))).toBe(true)
      }
    })

    it('effectiveOwners: JURIDISCH=LEGAL_DPO, GELD=FINANCE_PROC, HERSTEL=IT_LEAD, CONTAINMENT=SECURITY_LEAD, rest → CRISIS_LEAD', () => {
      expect(roleResolution.effectiveOwners.JURIDISCH).toBe('LEGAL_DPO')
      expect(roleResolution.effectiveOwners.GELD).toBe('FINANCE_PROC')
      expect(roleResolution.effectiveOwners.HERSTEL).toBe('IT_LEAD')
      expect(roleResolution.effectiveOwners.CONTAINMENT).toBe('SECURITY_LEAD')
      expect(roleResolution.effectiveOwners.EXTERNE_COMMS).toBe('CRISIS_LEAD')
      expect(roleResolution.effectiveOwners.PERSONEEL).toBe('CRISIS_LEAD')
      expect(roleResolution.effectiveOwners.BEDRIJFSPROCES).toBe('CRISIS_LEAD')
    })
  })

  // ── 3 rollen: minimaal ────────────────────────────────────────────────
  describe('3-rol team (crisis-lead + IT + Legal)', () => {
    const present: Role[] = ['ceo', 'it_manager', 'legal']
    const roleResolution = reso(present)

    it('CRISIS_LEAD absorbeert veel domeinen', () => {
      const eff = roleResolution.effectiveOwners
      expect(eff.JURIDISCH).toBe('LEGAL_DPO')
      expect(eff.HERSTEL).toBe('IT_LEAD')
      expect(eff.CONTAINMENT).toBe('IT_LEAD')      // via SECURITY_LEAD-fallback naar IT_LEAD
      expect(eff.EXTERNE_COMMS).toBe('CRISIS_LEAD')
      expect(eff.GELD).toBe('CRISIS_LEAD')
      expect(eff.PERSONEEL).toBe('CRISIS_LEAD')
    })

    it('rolCoverage < 1 (te weinig eerste-keus dekking)', () => {
      expect(roleResolution.rolCoverage).toBeLessThan(1)
    })

    it('inject naar cfo (onbezet) → GELD-fallback → BUSINESS_OWNER onbezet → CRISIS_LEAD (ceo)', () => {
      const routed = resolveInjectRecipientsAdaptive({
        inject: inject('invoice-fraud', { targetRoles: ['cfo'] }),
        presentRoles: present, teamRoles, roleResolution,
      })
      expect(routed).toEqual(['ceo'])
    })

    it('inject naar ciso (onbezet) → CONTAINMENT-fallback → IT_LEAD (it_manager)', () => {
      const routed = resolveInjectRecipientsAdaptive({
        inject: inject('containment', { targetRoles: ['ciso'] }),
        presentRoles: present, teamRoles, roleResolution,
      })
      expect(routed).toEqual(['it_manager'])
    })

    it('distinctOwners = 3 → MANDAAT wél meetbaar (op de grens)', () => {
      expect(roleResolution.distinctOwners).toBe(3)
    })
  })

  // ── Buitengevallen ────────────────────────────────────────────────────
  describe('edge cases', () => {
    it('leeg team → geen ontvangers', () => {
      const routed = resolveInjectRecipientsAdaptive({
        inject: inject('x', { targetRoles: ['legal'] }),
        presentRoles: [], teamRoles, roleResolution: reso([]),
      })
      expect(routed).toEqual([])
    })

    it('geen targetRoles + targetTeam=crisis_management → alle bezette crisis-rollen', () => {
      const present: Role[] = ['ceo', 'legal', 'it_manager']
      const routed = resolveInjectRecipientsAdaptive({
        inject: inject('all-crisis', { targetTeam: 'crisis_management' }),
        presentRoles: present, teamRoles, roleResolution: reso(present),
      })
      expect(routed).toContain('ceo')
      expect(routed).toContain('legal')
      expect(routed).not.toContain('it_manager')  // IT valt buiten crisis_management
    })

    it('geen targetRoles + geen targetTeam → stable hash-verdeling (single recipient)', () => {
      const present: Role[] = ['ceo', 'legal', 'it_manager']
      const routed = resolveInjectRecipientsAdaptive({
        inject: inject('any'),
        presentRoles: present, teamRoles, roleResolution: reso(present),
      })
      expect(routed).toHaveLength(1)
      expect(present).toContain(routed[0])
    })
  })

  // ── Structurele delegatie vs. ad-hoc ─────────────────────────────────
  describe('structurele delegatie (Deel B §1.4)', () => {
    it('CEO neemt JURIDISCH als LEGAL onbezet → structureel correct (m=1)', () => {
      const present: Role[] = ['ceo', 'it_manager']
      const r = reso(present)
      expect(isStructurallyCorrectDecider('ceo', 'JURIDISCH', r, present)).toBe(true)
    })

    it('IT neemt JURIDISCH terwijl LEGAL wél bezet is → ad-hoc, incorrect (m=0)', () => {
      const present: Role[] = ['ceo', 'it_manager', 'legal']
      const r = reso(present)
      expect(isStructurallyCorrectDecider('it_manager', 'JURIDISCH', r, present)).toBe(false)
    })

    it('LEGAL neemt JURIDISCH → altijd correct (identity)', () => {
      const present: Role[] = ['ceo', 'legal']
      const r = reso(present)
      expect(isStructurallyCorrectDecider('legal', 'JURIDISCH', r, present)).toBe(true)
    })
  })

  // ── Session-integration ──────────────────────────────────────────────
  describe('buildResolutionForSession', () => {
    it('leest participants uit SessionState en mapt naar spec-rollen', () => {
      const session = {
        participants: [
          { id: 'a', name: 'A', role: 'legal', joinedAt: 0 },
          { id: 'b', name: 'B', role: 'ceo', joinedAt: 0 },
          { id: 'c', name: 'C', role: 'ciso', joinedAt: 0 },
        ],
      } as unknown as SessionState
      const r = buildResolutionForSession(session)
      expect(r.effectiveOwners.JURIDISCH).toBe('LEGAL_DPO')
      expect(r.effectiveOwners.CONTAINMENT).toBe('SECURITY_LEAD')
      expect(r.effectiveOwners.EXTERNE_COMMS).toBe('CRISIS_LEAD')
      expect(r.distinctOwners).toBe(3)
    })

    it('participant zonder role wordt overgeslagen', () => {
      const session = {
        participants: [
          { id: 'a', name: 'A', role: 'legal', joinedAt: 0 },
          { id: 'b', name: 'B', joinedAt: 0 },  // geen rol
        ],
      } as unknown as SessionState
      const r = buildResolutionForSession(session)
      expect(r.effectiveOwners.JURIDISCH).toBe('LEGAL_DPO')
      expect(r.distinctOwners).toBe(1)
    })
  })

  // ── Adapter-integriteit ──────────────────────────────────────────────
  describe('role adapter integriteit', () => {
    it('elke app-rol mapt naar een spec-rol', () => {
      for (const r of Object.keys(APP_ROLE_TO_SPEC) as Role[]) {
        expect(APP_ROLE_TO_SPEC[r]).toBeTruthy()
      }
    })

    it('elke app-rol heeft minstens één domein', () => {
      for (const r of Object.keys(APP_ROLE_TO_SPEC) as Role[]) {
        expect(domainsFor(r).length).toBeGreaterThan(0)
      }
    })

    it('CRISIS_LEAD dekking = ceo — dat is de crisis-lead in de huidige app', () => {
      expect(APP_ROLE_TO_SPEC.ceo).toBe('CRISIS_LEAD')
    })
  })
})
