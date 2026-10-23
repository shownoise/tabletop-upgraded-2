import { beforeEach, describe, expect, it } from 'vitest'
import type { ScenarioGraph } from '@/lib/graph/types'
import type { Participant, Role, SessionState } from '@/lib/types'

// Issue #105 — de vier live gereproduceerde gevallen, vastgepind.
//
// De rode draad: `roleDistribution` werd alléén bij sessiestart berekend. Wie
// daarna joinde en een rol claimde had geen entry, dus dekte voor het systeem
// niets. Alle vier symptomen komen daaruit, en alle vier zitten op een andere
// plek in de keten: de verdeling zelf, de "nog wachten op"-teller, de
// facilitator-knop en het mandaat bij indienen.

const vector = { CONT: 0, FOR: 0, BC: 0, JUR: 0, VER: 0, KOS: 0 }

// Eén beslispunt met opties voor vier rollen. Dat is het aantal uit de live
// reproductie: de facilitator zag "Nog wachten op 4 beslissingen" met één
// deelnemer aan tafel.
const graph: ScenarioGraph = {
  id: 'cov', name: 'Dekking', version: 1,
  scenarioType: 'ransomware_double_extortion', createdAt: 0, updatedAt: 0,
  nodes: [
    { id: 'start', type: 'start', position: { x: 0, y: 0 }, data: { kind: 'start' } },
    { id: 'r1', type: 'round', position: { x: 100, y: 0 }, data: { kind: 'round', title: 'R1', situation_update: '' } },
    { id: 'd1', type: 'decision', position: { x: 200, y: 0 }, data: {
      kind: 'decision', prompt: 'Kies per rol', measuredBy: 'participant_choice', perRole: true,
      options: [
        { id: 'ceo-a', label: 'CEO keuze', allowedRole: 'ceo', outcomeVector: vector },
        { id: 'ciso-a', label: 'CISO keuze', allowedRole: 'ciso', outcomeVector: vector },
        { id: 'legal-a', label: 'Legal keuze', allowedRole: 'legal', outcomeVector: vector },
        { id: 'it-a', label: 'IT keuze', allowedRole: 'it_manager', outcomeVector: vector },
        { id: 'implicit-a', label: 'Geen besluit', implicit: true, outcomeVector: vector },
      ],
    } },
    { id: 'r2', type: 'round', position: { x: 300, y: 0 }, data: { kind: 'round', title: 'R2', situation_update: '' } },
  ],
  edges: [
    { id: 'e1', source: 'start', target: 'r1', type: 'sequence' },
    { id: 'e2', source: 'r1', target: 'd1', type: 'sequence' },
    { id: 'e3', source: 'd1', target: 'r2', type: 'sequence' },
  ],
}

const scenario = {
  scenario_title: 'Dekking', scenario_summary: '',
  rounds: [{ round_number: 1, title: 'R1', situation_update: '', injects: [], roleActions: [] }],
}

async function freshSession(mode: 'training' | 'event' = 'training') {
  const { resetSession, createSession } = await import('@/lib/session-store')
  await resetSession()
  await createSession(
    { sector: 'test', companySize: 's', criticalSystems: '', crownJewels: '', scenarioType: 'ransomware_double_extortion', duration: '1h' },
    scenario, mode, [], graph,
  )
}

// Zet het rooster neer zoals het live stond: deelnemers met een claim, maar een
// `roleDistribution` van vóór die claim. Precies de stand waarin de bug zich
// voordeed, dus de assertions hieronder pinnen het échte geval.
async function withRoster(patch: Partial<SessionState> & { participants: Participant[] }) {
  const { dbGetSession, dbSetSession } = await import('@/lib/db')
  const s = await dbGetSession()
  if (!s) throw new Error('No session')
  await dbSetSession({
    ...s,
    status: 'active', currentRound: 0, roundPhase: 'decision',
    graphState: { currentNodeId: 'r1', pathHistory: ['start', 'r1'], branchLog: [] },
    ...patch,
  })
  const next = await dbGetSession()
  if (!next) throw new Error('No session')
  return next
}

function person(id: string, role?: Role): Participant {
  return { id, name: id.toUpperCase(), joinedAt: 0, role }
}

// ── §1 — een late join bestaat wél ───────────────────────────────────────
// Oude code: `withRoleDistribution` liep alleen in startSession. Faalde op
// `entries` (leeg) en op `coverage` (0) — de deelnemer bestond niet.

describe('#105 §1 — rolverdeling na een late join', () => {
  beforeEach(async () => { await freshSession() })

  it('neemt een deelnemer die na de start joint en ceo claimt op in de verdeling', async () => {
    const { startSession, joinSession, assignRole, getSession } = await import('@/lib/session-store')

    expect((await startSession()).ok).toBe(true)
    const empty = await getSession()
    expect(empty?.roleDistribution?.entries).toEqual([])
    expect(empty?.roleDistribution?.coverage).toBe(0)

    const joined = await joinSession({ name: 'Laatkomer', joinCode: empty!.joinCode })
    expect(joined.ok).toBe(true)
    const participantId = joined.ok ? joined.participantId : ''
    expect((await assignRole({ participantId, role: 'ceo' })).ok).toBe(true)

    const after = await getSession()
    const entry = after?.roleDistribution?.entries.find(e => e.participantId === participantId)
    expect(entry?.primaryRole).toBe('ceo')
    expect(after!.roleDistribution!.coverage).toBeGreaterThan(0)
  })

  it('weigert een rol die al geclaimd is, zodat niemand uit de verdeling valt', async () => {
    const { startSession, joinSession, assignRole, getSession } = await import('@/lib/session-store')
    expect((await startSession()).ok).toBe(true)
    const code = (await getSession())!.joinCode

    const first = await joinSession({ name: 'Een', joinCode: code })
    expect(first.ok).toBe(true)
    await assignRole({ participantId: first.ok ? first.participantId : '', role: 'ceo' })

    const second = await joinSession({ name: 'Twee', joinCode: code, role: 'ceo' })
    expect(second.ok).toBe(false)
    expect((await getSession())!.participants).toHaveLength(1)
  })
})

// ── §2 — een onbezette rol blokkeert niets ───────────────────────────────
// Oude code: missingDecisionRoles() nam élke rol die een optie bezat. Faalde
// hier op het aantal: ['ceo','ciso','legal','it_manager'] in plaats van ['ceo'].

describe('#105 §2 — onbezette rollen houden de beslisfase niet op', () => {
  beforeEach(async () => { await freshSession() })

  it('noemt alleen de rollen die iemand dekt', async () => {
    const { missingDecisionRoles } = await import('@/lib/session-next-action')
    const session = await withRoster({
      participants: [person('p1', 'ceo')],
      // Snapshot van vóór de claim: de deelnemer heeft geen entry, dus dekt
      // alleen zijn eigen geclaimde rol.
      roleDistribution: { computedAt: 0, entries: [], unassignedRoles: [], coverage: 0 },
      submittedDecisions: [],
    })
    expect(missingDecisionRoles(session)).toEqual(['ceo'])
  })

  it('legt per onbezette rol vast waarom er geen besluit is', async () => {
    const { unsubmittedDecisionAssignments } = await import('@/lib/session-next-action')
    const session = await withRoster({
      participants: [person('p1', 'ceo')],
      roleDistribution: { computedAt: 0, entries: [], unassignedRoles: [], coverage: 0 },
      submittedDecisions: [],
    })
    const byRole = new Map(unsubmittedDecisionAssignments(session).map(a => [a.role, a.reason]))
    expect(byRole.get('ceo')).toBe('niet_ingediend')
    expect(byRole.get('ciso')).toBe('onbezet')
    expect(byRole.get('legal')).toBe('onbezet')
    expect(byRole.get('it_manager')).toBe('onbezet')
  })

  it('sluit onbezette rollen af met een herkenbare reden in reasoning', async () => {
    const { finalizeDecision, getSession } = await import('@/lib/session-store')
    await withRoster({
      participants: [person('p1', 'ceo')],
      roleDistribution: { computedAt: 0, entries: [], unassignedRoles: [], coverage: 0 },
      submittedDecisions: [],
    })
    expect((await finalizeDecision()).ok).toBe(true)
    const rows = (await getSession())?.submittedDecisions ?? []
    expect(rows.every(r => r.participantId === 'IMPLICIT')).toBe(true)
    expect(rows.find(r => r.role === 'ciso')?.reasoning).toContain('onbezet')
    expect(rows.find(r => r.role === 'ceo')?.reasoning).toContain('binnen de tijd')
  })

  it('doet hetzelfde in event-modus zodra iemand een rol heeft geclaimd', async () => {
    await freshSession('event')
    const { missingDecisionRoles } = await import('@/lib/session-next-action')
    const session = await withRoster({
      participants: [{ ...person('p1', 'ceo'), groupId: 'g1' }],
      groups: [{ id: 'g1', name: 'Team', createdAt: 0 }],
      roleDistribution: { computedAt: 0, entries: [], unassignedRoles: [], coverage: 0 },
      submittedDecisions: [],
    })
    expect(missingDecisionRoles(session)).toEqual(['ceo'])
  })
})

// ── §3 — de CEO-stoel is herverdeelbaar ──────────────────────────────────
// Oude code: `if (role === 'ceo') continue` in distributeRoles. Faalde op
// `unassignedRoles` (bevatte 'ceo') en op `inheritedRoles` (bevatte 'ceo' niet).

describe('#105 §3 — een afwezige CEO wordt overgenomen', () => {
  beforeEach(async () => { await freshSession() })

  it('wijst de CEO-stoel toe aan een aanwezige deelnemer', async () => {
    const { distributeRoles, computeAuthoredWorkload } = await import('@/lib/engine/distribute-roles')
    const snapshot = distributeRoles({
      authoredRoles: ['ceo', 'ciso', 'legal', 'it_manager'],
      workloads: computeAuthoredWorkload(graph),
      presentParticipants: [person('p1', 'ciso')],
    })
    expect(snapshot.unassignedRoles).not.toContain('ceo')
    expect(snapshot.entries[0].inheritedRoles).toContain('ceo')
    expect(snapshot.coverage).toBe(1)
  })

  it('houdt de CEO-keuze speelbaar: de overnemer heeft er mandaat op', async () => {
    const { decisionMandate } = await import('@/lib/session-roles')
    const session = await withRoster({
      participants: [person('p1', 'ciso')],
      roleDistribution: {
        computedAt: 0, coverage: 1, unassignedRoles: [],
        entries: [{ participantId: 'p1', participantName: 'P1', primaryRole: 'ciso', inheritedRoles: ['ceo', 'legal', 'it_manager'], workload: 4 }],
      },
      submittedDecisions: [],
    })
    const decision = session.graph!.nodes.find(n => n.id === 'd1')!.data as Parameters<typeof decisionMandate>[1]
    const mandate = decisionMandate(session, decision, 'p1')
    expect(mandate.options.find(o => o.optionId === 'ceo-a')).toMatchObject({ canSubmit: true, viaInheritance: true })
    expect(mandate.unoccupiedMandates).toEqual([])
  })

  it('blokkeert de ronde niet als de CEO-keuze door niemand gedekt is', async () => {
    const { describeNextAction } = await import('@/lib/session-next-action')
    const session = await withRoster({
      participants: [person('p1', 'ciso')],
      // Geen entries: p1 dekt alleen 'ciso'. De CEO-keuze is dus onbezet.
      roleDistribution: { computedAt: 0, entries: [], unassignedRoles: [], coverage: 0 },
      submittedDecisions: [{
        participantId: 'p1', participantName: 'P1', role: 'ciso', roundIndex: 0,
        actionId: 'ciso-a', actionLabel: 'CISO keuze', reasoning: '',
        submittedAt: new Date(0).toISOString(), isWrongRole: false, isIrDeviation: false,
      }],
    })
    const next = describeNextAction(session)
    expect(next.action).not.toBe('blocked')
    expect(next.blockedReason).toBeUndefined()
  })
})

// ── §4 — mandaat op de server ────────────────────────────────────────────
// Oude code: de route controleerde alleen of de deelnemer in de sessie zat.
// Faalde op de weigering (status was 200 en de inzending landde als echte
// beslissing in de review).

describe('#105 §4 — submit-decision controleert het mandaat', () => {
  beforeEach(async () => {
    await freshSession()
    await withRoster({
      participants: [person('p1', 'ciso'), person('p2', 'legal'), person('p3')],
      roleDistribution: {
        computedAt: 0, coverage: 1, unassignedRoles: [],
        entries: [
          { participantId: 'p1', participantName: 'P1', primaryRole: 'ciso', inheritedRoles: ['ceo'], workload: 2 },
          { participantId: 'p2', participantName: 'P2', primaryRole: 'legal', inheritedRoles: ['it_manager'], workload: 2 },
        ],
      },
      submittedDecisions: [],
    })
  })

  async function post(body: Record<string, unknown>) {
    const { POST } = await import('@/app/api/session/submit-decision/route')
    const res = await POST(new Request('http://test/api/session/submit-decision', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ roundIndex: 0, reasoning: '', ...body }),
    }))
    return { status: res.status, body: await res.json() as { ok?: boolean; error?: string } }
  }

  it('accepteert een inzending onder een overgenomen rol', async () => {
    const res = await post({ participantId: 'p1', actionId: 'ceo-a', activeRole: 'ceo' })
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    const { getSession } = await import('@/lib/session-store')
    expect((await getSession())?.submittedDecisions?.map(d => d.role)).toEqual(['ceo'])
  })

  it('weigert een inzending onder een rol die de deelnemer niet speelt', async () => {
    const res = await post({ participantId: 'p2', actionId: 'ceo-a', activeRole: 'ceo' })
    expect(res.status).toBe(403)
    expect(res.body.error).toContain('hoort bij CEO')
    expect(res.body.error).toContain('Jij speelt')
    const { getSession } = await import('@/lib/session-store')
    expect((await getSession())?.submittedDecisions ?? []).toEqual([])
  })

  it('weigert een deelnemer zonder rol met een begrijpelijke melding', async () => {
    const res = await post({ participantId: 'p3', actionId: 'ceo-a' })
    expect(res.status).toBe(403)
    expect(res.body.error).toContain('nog geen rol')
  })

  it('weigert een activeRole die niet bij de optie hoort', async () => {
    const res = await post({ participantId: 'p1', actionId: 'ceo-a', activeRole: 'ciso' })
    expect(res.status).toBe(403)
    expect(res.body.error).toContain('niet bij')
  })

  it('weigert een impliciete optie: die rondt de facilitator af', async () => {
    const res = await post({ participantId: 'p1', actionId: 'implicit-a' })
    expect(res.status).toBe(403)
    expect(res.body.error).toContain('facilitator')
  })
})

// ── §6 — de invariant van een herberekening ──────────────────────────────

describe('#105 §6 — herberekening raakt geen claim aan en blijft deterministisch', () => {
  it('laat elke geclaimde rol primair bij de claimer, ongeacht de invoerorde', async () => {
    const { distributeRoles, computeAuthoredWorkload } = await import('@/lib/engine/distribute-roles')
    const workloads = computeAuthoredWorkload(graph)
    const roster = [person('p3', 'legal'), person('p1', 'ciso'), person('p2', 'ceo')]
    const run = (participants: Participant[]) => distributeRoles({
      authoredRoles: ['ceo', 'ciso', 'legal', 'it_manager'], workloads, presentParticipants: participants,
    })

    const a = run(roster)
    const b = run([...roster].reverse())
    expect(b).toEqual(a)
    for (const p of roster) {
      const entry = a.entries.find(e => e.participantId === p.id)
      expect(entry?.primaryRole).toBe(p.role)
      // Niemand anders krijgt die rol erbij.
      expect(a.entries.filter(e => e.inheritedRoles.includes(p.role!))).toEqual([])
    }
  })

  it('levert bij een ongewijzigd rooster dezelfde snapshot op, op computedAt na', async () => {
    await freshSession()
    const { startSession, joinSession, assignRole, markParticipantReady, getSession } = await import('@/lib/session-store')
    expect((await startSession()).ok).toBe(true)
    const joined = await joinSession({ name: 'Anna', joinCode: (await getSession())!.joinCode })
    const participantId = joined.ok ? joined.participantId : ''
    await assignRole({ participantId, role: 'ciso' })

    const before = (await getSession())!.roleDistribution!
    // markParticipantReady herberekent óók; het rooster is niet gewijzigd.
    await markParticipantReady(participantId)
    const after = (await getSession())!.roleDistribution!

    expect({ ...after, computedAt: 0 }).toEqual({ ...before, computedAt: 0 })
    expect(after.entries.find(e => e.participantId === participantId)?.primaryRole).toBe('ciso')
  })
})
