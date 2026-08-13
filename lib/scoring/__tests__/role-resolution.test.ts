import { describe, expect, it } from 'vitest'
import { resolveRoles, effectiveRoleFor } from '../role-resolution'
import { DEFAULT_DOMAIN_OWNERSHIP, DOMAINS } from '../constants'
import type { ScenarioSpec } from '../types'

const emptyScenario: ScenarioSpec = { rounds: [], decisionPoints: [], injects: [] }

describe('roleResolution — Deel B §1', () => {
  it('golden 1: volledig team (8 rollen) → alle domeinen naar eerste-keus', () => {
    const roster = { presentRoles: ['LEGAL_DPO', 'FINANCE_PROC', 'IT_LEAD', 'SECURITY_LEAD', 'COMMS', 'HR', 'BUSINESS_OWNER', 'CRISIS_LEAD'] }
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

  it('phase-1: bij volledige bezetting resolven onderscheidbare domeinen naar onderscheidbare eigenaren (geen CRISIS_LEAD-collaps)', () => {
    // Regressie op de "elke domein → CRISIS_LEAD"-bug in de oude ScoringPanel.
    // Bij een volledig bezet team hoort een spreiding van effectiveOwners over
    // de rollen, niet één rol die alle domeinen absorbeert.
    const roster = { presentRoles: ['LEGAL_DPO', 'FINANCE_PROC', 'IT_LEAD', 'SECURITY_LEAD', 'COMMS', 'HR', 'BUSINESS_OWNER', 'CRISIS_LEAD'] }
    const r = resolveRoles(roster, emptyScenario)

    const ownersByDomain = r.effectiveOwners
    const uniqueOwners = new Set(Object.values(ownersByDomain))
    // Bij 10 domeinen en 8 aanwezige rollen verwachten we minstens 6 verschillende
    // eigenaren; anders is een gedeelde-fallback bug terug.
    expect(uniqueOwners.size).toBeGreaterThanOrEqual(6)

    // Specifieke assertions per domein zodat een silent collapse zichtbaar wordt.
    expect(ownersByDomain.JURIDISCH).toBe('LEGAL_DPO')
    expect(ownersByDomain.GELD).toBe('FINANCE_PROC')
    expect(ownersByDomain.EXTERNE_COMMS).toBe('COMMS')
    expect(ownersByDomain.PERSONEEL).toBe('HR')
    expect(ownersByDomain.BEDRIJFSPROCES).toBe('BUSINESS_OWNER')
    expect(ownersByDomain.CONTAINMENT).toBe('SECURITY_LEAD')
    expect(ownersByDomain.HERSTEL).toBe('IT_LEAD')
  })
})
