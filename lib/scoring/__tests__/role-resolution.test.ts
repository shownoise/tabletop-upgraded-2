import { describe, expect, it } from 'vitest'
import { resolveRoles, effectiveRoleFor, mandaatValue } from '../role-resolution'
import { DEFAULT_DOMAIN_OWNERSHIP, DOMAINS } from '../constants'
import type { ScenarioSpec } from '../types'

const emptyScenario: ScenarioSpec = { rounds: [], decisionPoints: [], injects: [] }

describe('roleResolution — Deel B §1', () => {
  it('golden 1: volledig team (9 rollen) → alle domeinen naar eerste-keus', () => {
    const roster = { presentRoles: ['LEGAL_DPO', 'FINANCE_PROC', 'IT_LEAD', 'SECURITY_LEAD', 'COMMS', 'HR', 'BUSINESS_OWNER', 'CRISIS_LEAD', 'RETAINER_LIAISON'] }
    const r = resolveRoles(roster, emptyScenario, 100)
    expect(r.effectiveOwners.JURIDISCH).toBe('LEGAL_DPO')
    expect(r.effectiveOwners.GELD).toBe('FINANCE_PROC')
    expect(r.effectiveOwners.HERSTEL).toBe('IT_LEAD')
    expect(r.effectiveOwners.CONTAINMENT).toBe('SECURITY_LEAD')
    expect(r.rolCoverage).toBe(1)
    expect(r.distinctOwners).toBeGreaterThanOrEqual(6)
  })

  it('golden 2: LEGAL_DPO afwezig → JURIDISCH valt naar CRISIS_LEAD', () => {
    const roster = { presentRoles: ['CRISIS_LEAD', 'IT_LEAD', 'SECURITY_LEAD', 'COMMS', 'HR', 'BUSINESS_OWNER', 'FINANCE_PROC'] }
    const r = resolveRoles(roster, emptyScenario)
    expect(r.effectiveOwners.JURIDISCH).toBe('CRISIS_LEAD')
    expect(r.rolCoverage).toBeLessThan(1)
  })

  it('golden 3: kleine team (3 rollen) → CRISIS_LEAD absorbeert veel domeinen', () => {
    const roster = { presentRoles: ['CRISIS_LEAD', 'IT_LEAD', 'LEGAL_DPO'] }
    const r = resolveRoles(roster, emptyScenario)
    // JURIDISCH → LEGAL_DPO, HERSTEL/CONTAINMENT → IT_LEAD (want SECURITY_LEAD onbezet),
    // rest → CRISIS_LEAD.
    expect(r.effectiveOwners.JURIDISCH).toBe('LEGAL_DPO')
    expect(r.effectiveOwners.HERSTEL).toBe('IT_LEAD')
    expect(r.effectiveOwners.CONTAINMENT).toBe('IT_LEAD')
    expect(r.effectiveOwners.EXTERNE_COMMS).toBe('CRISIS_LEAD')
    // distinctOwners bepaalt of MANDAAT meetbaar is.
    expect(r.distinctOwners).toBe(3)
  })

  it('golden 4: leeg team → alles NPC', () => {
    const roster = { presentRoles: [] }
    const r = resolveRoles(roster, emptyScenario)
    for (const d of DOMAINS) expect(r.effectiveOwners[d]).toBe('NPC')
    expect(r.rolCoverage).toBe(0)
    expect(r.distinctOwners).toBe(0)
  })

  it('golden 5: NPC-rol wordt niet als bezet gerekend (structureel delegatie)', () => {
    const roster = { presentRoles: ['LEGAL_DPO', 'IT_LEAD', 'CRISIS_LEAD'], npcRoles: ['LEGAL_DPO'] }
    const r = resolveRoles(roster, emptyScenario)
    expect(r.effectiveOwners.JURIDISCH).toBe('CRISIS_LEAD')  // LEGAL_DPO = NPC → val naar CRISIS_LEAD
  })

  it('effectiveRoleFor: onbezette rol → resolve via eerste domein', () => {
    const roster = { presentRoles: ['CRISIS_LEAD', 'IT_LEAD'] }
    const r = resolveRoles(roster, emptyScenario)
    // LEGAL_DPO onbezet → JURIDISCH-eerste domein → CRISIS_LEAD
    expect(effectiveRoleFor('LEGAL_DPO', r, emptyScenario)).toBe('CRISIS_LEAD')
    // IT_LEAD wél bezet → identity
    expect(effectiveRoleFor('IT_LEAD', r, emptyScenario)).toBe('IT_LEAD')
  })

  it('mandaatValue §7.2: 1.0 bij effectiveOwner, 0.5 bij onnodige escalatie, 0.0 elders', () => {
    const roster = { presentRoles: ['LEGAL_DPO', 'CRISIS_LEAD', 'IT_LEAD', 'SECURITY_LEAD'] }
    const r = resolveRoles(roster, emptyScenario)
    expect(mandaatValue('LEGAL_DPO', 'JURIDISCH', r)).toBe(1)
    expect(mandaatValue('IT_LEAD', 'JURIDISCH', r, { escalatedUnnecessarily: true })).toBe(0.5)
    expect(mandaatValue('CRISIS_LEAD', 'JURIDISCH', r)).toBe(0)
    expect(mandaatValue('CRISIS_LEAD', 'JURIDISCH', r, { outsideCrisisTeam: true })).toBe(0)
  })

  it('domainOwnership override wordt gebruikt', () => {
    const roster = { presentRoles: ['CFO', 'CRISIS_LEAD'] }
    const scenario: ScenarioSpec = {
      ...emptyScenario,
      domainOwnership: { GELD: ['CFO', 'CRISIS_LEAD'] },
    }
    const r = resolveRoles(roster, scenario)
    expect(r.effectiveOwners.GELD).toBe('CFO')
  })

  it('spec-invariant: CRISIS_LEAD is altijd in de defaultketen ergens aanwezig', () => {
    for (const d of DOMAINS) {
      expect(DEFAULT_DOMAIN_OWNERSHIP[d]).toContain('CRISIS_LEAD')
    }
  })
})
