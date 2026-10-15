import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ScenarioGraph } from '@/lib/graph/types'

const vector = { CONT: 0, FOR: 0, BC: 0, JUR: 0, VER: 0, KOS: 0 }
const graph: ScenarioGraph = {
  id: 'event-flow', name: 'Event flow', version: 1,
  scenarioType: 'ransomware_double_extortion', createdAt: 0, updatedAt: 0,
  nodes: [
    { id: 'start', type: 'start', position: { x: 0, y: 0 }, data: { kind: 'start' } },
    { id: 'r1', type: 'round', position: { x: 100, y: 0 }, data: {
      kind: 'round', title: 'R1', situation_update: '',
      roleActions: [{ id: 'legacy-a', label: 'Oude ronde-actie', description: '', allowedRoles: ['ceo'], irPlanAligned: true }],
    } },
    { id: 'd1', type: 'decision', position: { x: 200, y: 0 }, data: {
      kind: 'decision', prompt: 'Kies per rol', measuredBy: 'participant_choice', perRole: true,
      options: [
        { id: 'ceo-a', label: 'CEO keuze', allowedRole: 'ceo', consumesOptionAfterUse: true, outcomeVector: vector },
        { id: 'ciso-a', label: 'CISO keuze', allowedRole: 'ciso', outcomeVector: vector },
        { id: 'implicit-a', label: 'Geen besluit', implicit: true, outcomeVector: vector },
      ],
    } },
    { id: 'r2', type: 'round', position: { x: 300, y: 0 }, data: { kind: 'round', title: 'R2', situation_update: '' } },
    { id: 'd2', type: 'decision', position: { x: 400, y: 0 }, data: {
      kind: 'decision', prompt: 'Volgende ronde', measuredBy: 'participant_choice', perRole: true,
      options: [
        { id: 'r2-ceo-a', label: 'CEO keuze R2', allowedRole: 'ceo', outcomeVector: vector },
        { id: 'r2-implicit', label: 'Geen besluit R2', implicit: true, outcomeVector: vector },
      ],
    } },
  ],
  edges: [
    { id: 'e1', source: 'start', target: 'r1', type: 'sequence' },
    { id: 'e2', source: 'r1', target: 'd1', type: 'sequence' },
    { id: 'e3', source: 'd1', target: 'r2', type: 'sequence' },
    { id: 'e4', source: 'r2', target: 'd2', type: 'sequence' },
  ],
}

describe('Event decision flow', () => {
  beforeEach(async () => {
    const { resetSession, createSession } = await import('@/lib/session-store')
    const { dbGetSession, dbSetSession } = await import('@/lib/db')
    await resetSession()
    await createSession(
      { sector: 'test', companySize: 's', criticalSystems: '', crownJewels: '', scenarioType: 'ransomware_double_extortion', duration: '1h' },
      { scenario_title: 'Event', scenario_summary: '', rounds: [{ round_number: 1, title: 'R1', situation_update: '', injects: [], roleActions: [{ id: 'legacy-a', label: 'Oude ronde-actie', description: '', allowedRoles: ['ceo'], irPlanAligned: true }] }] },
      'event', [], graph,
    )
    const s = await dbGetSession()
    if (!s) throw new Error('No session')
    await dbSetSession({
      ...s, status: 'active', currentRound: 0, roundPhase: 'decision',
      participants: [{ id: 'p1', name: 'Solo', joinedAt: s.createdAt, groupId: 'g1' }],
      groups: [{ id: 'g1', name: 'Team', createdAt: s.createdAt }],
      graphState: { currentNodeId: 'r1', pathHistory: ['start', 'r1'], branchLog: [] },
    })
  })

  it('does not leave decision after the first role while another role is still owed', async () => {
    const { submitDecision, getSession, setPhase } = await import('@/lib/session-store')
    const first = await submitDecision({ participantId: 'p1', participantName: 'Solo', roundIndex: 0, actionId: 'ceo-a', reasoning: '', activeRole: 'ceo' })
    expect(first.ok).toBe(true)
    expect((await getSession())?.roundPhase).toBe('decision')
    expect((await setPhase('review')).ok).toBe(false)

    const second = await submitDecision({ participantId: 'p1', participantName: 'Solo', roundIndex: 0, actionId: 'ciso-a', reasoning: '', activeRole: 'ciso' })
    expect(second.ok).toBe(true)
    expect((await getSession())?.roundPhase).toBe('review')
  })

  it('projects the scored graph choices for an event participant without a fixed role', async () => {
    const { getSession, toParticipantState } = await import('@/lib/session-store')
    const session = await getSession()
    if (!session) throw new Error('No session')
    const projected = toParticipantState(session, 'p1')
    expect(projected.activeDecision?.nodeId).toBe('d1')
    expect(projected.activeDecision?.options.map(option => option.optionId)).toEqual(['ceo-a', 'ciso-a'])
  })

  it('keeps a shared choice available to another group after the first group submits', async () => {
    const { dbGetSession, dbSetSession } = await import('@/lib/db')
    const { submitDecision, getSession, toParticipantState } = await import('@/lib/session-store')
    const session = await dbGetSession()
    if (!session) throw new Error('No session')
    const second = { id: 'p2', name: 'Andere deelnemer', joinedAt: session.createdAt, groupId: 'g2' }
    await dbSetSession({
      ...session,
      participants: [...session.participants, second],
      groups: [...(session.groups ?? []), { id: 'g2', name: 'Team 2', createdAt: session.createdAt }],
    })
    expect((await submitDecision({ participantId: 'p1', participantName: 'Solo', roundIndex: 0, actionId: 'ceo-a', reasoning: '', activeRole: 'ceo' })).ok).toBe(true)
    const updated = await getSession()
    if (!updated) throw new Error('No session')
    expect(updated.roundPhase).toBe('decision')
    expect(toParticipantState(updated, 'p2').activeDecision?.options.map(option => option.optionId)).toContain('ceo-a')
    expect(toParticipantState(updated, 'p2').submittedDecisions).toEqual([])
  })

  it('allows only one choice per role and team, even with two participant devices', async () => {
    const { dbGetSession, dbSetSession } = await import('@/lib/db')
    const { submitDecision, getSession } = await import('@/lib/session-store')
    const session = await dbGetSession()
    if (!session) throw new Error('No session')
    await dbSetSession({
      ...session,
      participants: [...session.participants, { id: 'p2', name: 'Teamgenoot', joinedAt: session.createdAt, groupId: 'g1' }],
    })
    expect((await submitDecision({ participantId: 'p1', participantName: 'Solo', roundIndex: 0, actionId: 'ceo-a', reasoning: '', activeRole: 'ceo' })).ok).toBe(true)
    expect((await submitDecision({ participantId: 'p2', participantName: 'Teamgenoot', roundIndex: 0, actionId: 'ceo-a', reasoning: '', activeRole: 'ceo' })).ok).toBe(false)
    expect((await getSession())?.submittedDecisions).toHaveLength(1)
  })

  it('rejects an unscored round-action and graph choices outside the decision phase', async () => {
    const { submitDecision, getSession } = await import('@/lib/session-store')
    const { dbGetSession, dbSetSession } = await import('@/lib/db')
    const legacy = await submitDecision({ participantId: 'p1', participantName: 'Solo', roundIndex: 0, actionId: 'legacy-a', reasoning: '', activeRole: 'ceo' })
    expect(legacy.ok).toBe(false)
    expect((await getSession())?.submittedDecisions).toHaveLength(0)
    const session = await dbGetSession()
    if (!session) throw new Error('No session')
    await dbSetSession({ ...session, roundPhase: 'discussion' })
    const early = await submitDecision({ participantId: 'p1', participantName: 'Solo', roundIndex: 0, actionId: 'ceo-a', reasoning: '', activeRole: 'ceo' })
    expect(early.ok).toBe(false)
  })

  it('one next-round action from review traverses the completed collection node', async () => {
    const { submitDecision, getSession, goToNextRound } = await import('@/lib/session-store')
    for (const [role, actionId] of [['ceo', 'ceo-a'], ['ciso', 'ciso-a']] as const) {
      await submitDecision({ participantId: 'p1', participantName: 'Solo', roundIndex: 0, actionId, reasoning: '', activeRole: role })
    }
    expect((await getSession())?.roundPhase).toBe('review')
    expect((await goToNextRound()).ok).toBe(true)
    const next = await getSession()
    expect(next?.currentRound).toBe(1)
    expect(next?.graphState?.currentNodeId).toBe('r2')
  })

  it('force-finalize fills only missing roles of the active decision, not future nodes', async () => {
    const { submitDecision, getSession, finalizeDecision } = await import('@/lib/session-store')
    await submitDecision({ participantId: 'p1', participantName: 'Solo', roundIndex: 0, actionId: 'ceo-a', reasoning: '', activeRole: 'ceo' })
    expect((await finalizeDecision()).ok).toBe(true)
    const session = await getSession()
    expect(session?.roundPhase).toBe('review')
    expect(session?.submittedDecisions?.map(d => [d.actionId, d.role])).toEqual([
      ['ceo-a', 'ceo'], ['implicit-a', 'ciso'],
    ])
  })

  // Issue #58 — settleAndGetState() (called on every participant/facilitator poll)
  // used to read-modify-write the session without the shared session lock that
  // mutate() uses. A poll's stale read could land between a facilitator's
  // setPhase() read and write, overwriting the new phase with a tick computed
  // from the old one — the "discussion reappears after review" bug. Fix:
  // settleAndGetState() must go through the same withSessionLock as mutate().
  it('runs settleAndGetState through the shared session lock, like mutate()', async () => {
    const db = await import('@/lib/db')
    const lockSpy = vi.spyOn(db, 'withSessionLock')
    const { settleAndGetState } = await import('@/lib/session-store')

    await settleAndGetState()

    expect(lockSpy).toHaveBeenCalled()
    lockSpy.mockRestore()
  })
})
