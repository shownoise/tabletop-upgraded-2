import { describe, expect, it } from 'vitest'
import { graphToScenarioSpec, sessionToEvents, sessionToScoringInput } from '../graph-adapter'
import { scoreExercise } from '../score-exercise'
import { simpleStoryExample as meldplichtPressureExample } from '@/lib/graph/examples-simple-story'
import type { SessionState } from '@/lib/types'

describe('graph-adapter — bridge tussen ScenarioGraph en scoring input', () => {
  const graph = meldplichtPressureExample()

  it('graphToScenarioSpec: elke round-node wordt een RoundSpec, genummerd 1..N', () => {
    const scenario = graphToScenarioSpec(graph)
    expect(scenario.rounds.length).toBeGreaterThan(0)
    for (let i = 0; i < scenario.rounds.length; i++) {
      expect(scenario.rounds[i].number).toBe(i + 1)
    }
  })

  it('graphToScenarioSpec: elke inject-node wordt een InjectSpec', () => {
    const scenario = graphToScenarioSpec(graph)
    const injectCount = graph.nodes.filter((n: { type: string }) => n.type === 'inject').length
    // Chasers voegen ook injects toe — dus totaal ≥ inject-nodes.
    expect(scenario.injects.length).toBeGreaterThanOrEqual(injectCount)
  })

  it('graphToScenarioSpec: elke option krijgt outcomeVector (uit qualityRank fallback)', () => {
    const scenario = graphToScenarioSpec(graph)
    for (const dp of scenario.decisionPoints) {
      for (const opt of dp.options) {
        expect(opt.outcomeVector).toBeDefined()
        expect(Object.keys(opt.outcomeVector)).toHaveLength(6)
      }
    }
  })

  it('graphToScenarioSpec: nis2Relevant injects → importance=crucial', () => {
    const scenario = graphToScenarioSpec(graph)
    const crucialCount = scenario.injects.filter(i => i.importance === 'crucial').length
    expect(crucialCount).toBeGreaterThan(0)  // meldplicht-example heeft nis2Relevant injects
  })

  it('sessionToEvents: minimale session → session_start event', () => {
    const session: Partial<SessionState> = {
      startedAt: 12345,
      createdAt: 1000,
      timeline: [],
      submittedDecisions: [],
    }
    const events = sessionToEvents(session as SessionState)
    expect(events[0]).toEqual({ kind: 'session_start', t: 12345 })
  })

  it('sessionToScoringInput: session zonder graph → null', () => {
    const session: Partial<SessionState> = {
      startedAt: 100, createdAt: 50, timeline: [], submittedDecisions: [], participants: [],
    }
    expect(sessionToScoringInput(session as SessionState)).toBeNull()
  })

  it('sessionToScoringInput + scoreExercise: full pipeline op meldplicht-example', () => {
    const session: Partial<SessionState> = {
      graph,
      startedAt: 1_000_000,
      createdAt: 0,
      timeline: [],
      submittedDecisions: [],
      participants: [
        { id: 'p1', name: 'Alice', role: 'legal', joinedAt: 0 },
        { id: 'p2', name: 'Bob',   role: 'ceo',   joinedAt: 0 },
        { id: 'p3', name: 'Carol', role: 'ciso',  joinedAt: 0 },
      ],
    }
    const input = sessionToScoringInput(session as SessionState)
    expect(input).not.toBeNull()
    const output = scoreExercise(input!)
    expect(output.scoringVersion).toBeTruthy()
    expect(output.roleResolution.distinctOwners).toBeGreaterThanOrEqual(3)
  })

  it('sessionToEvents: submitted decision krijgt correcte timestamp + spec-rol', () => {
    const session: Partial<SessionState> = {
      startedAt: 1_000_000, createdAt: 0, timeline: [], participants: [],
      submittedDecisions: [{
        participantId: 'p1', participantName: 'A', role: 'legal', roundIndex: 0,
        actionId: 'r1-jur', actionLabel: 'Melding', reasoning: 'test',
        submittedAt: new Date(1_000_500).toISOString(),
        isWrongRole: false, isIrDeviation: false,
      }],
    }
    const events = sessionToEvents(session as SessionState)
    const submit = events.find(e => e.kind === 'decision_submitted')
    expect(submit).toBeDefined()
    expect(submit && submit.kind === 'decision_submitted' && submit.by).toBe('LEGAL_DPO')
  })

  it('sessionToEvents: notifications worden external_party_activated', () => {
    const session: Partial<SessionState> = {
      startedAt: 1_000_000, createdAt: 0, timeline: [], submittedDecisions: [], participants: [],
      notifications: [{
        id: 'n1', type: 'ncsc_24h', createdBy: 'p1', createdAt: 100,
        submittedAt: 5000, content: {},
      }],
    }
    const events = sessionToEvents(session as SessionState)
    const ext = events.find(e => e.kind === 'external_party_activated')
    expect(ext).toBeDefined()
    expect(ext && ext.kind === 'external_party_activated' && ext.partyId).toBe('ncsc_24h')
  })

  it('sessionToEvents: retainer activation wordt external_party_activated', () => {
    const session: Partial<SessionState> = {
      startedAt: 1_000_000, createdAt: 0, timeline: [], submittedDecisions: [], participants: [],
      retainerState: {
        dialedAt: 3000, chosenActivator: 'CISO', chosenActivatorAuthorized: true, updatedAt: 3000,
      },
    }
    const events = sessionToEvents(session as SessionState)
    const ext = events.find(e => e.kind === 'external_party_activated' && e.partyId === 'retainer')
    expect(ext).toBeDefined()
    expect(ext && ext.kind === 'external_party_activated' && ext.actionable).toBe(1)
  })

  it('events zijn chronologisch gesorteerd', () => {
    const session: Partial<SessionState> = {
      startedAt: 1_000_000, createdAt: 0,
      participants: [],
      timeline: [
        { id: 't1', timestamp: 5000, type: 'round_changed', data: { roundIndex: 0 } },
        { id: 't2', timestamp: 3000, type: 'round_changed', data: { roundIndex: 0 } },
      ],
      submittedDecisions: [],
    }
    const events = sessionToEvents(session as SessionState)
    for (let i = 1; i < events.length; i++) {
      expect(events[i].t).toBeGreaterThanOrEqual(events[i - 1].t)
    }
  })
})
