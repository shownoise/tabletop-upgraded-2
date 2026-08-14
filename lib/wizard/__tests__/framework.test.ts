import { describe, it, expect } from "vitest"
import type {
  DecisionNodeData,
  InjectNodeData,
  RoundNodeData,
  ScenarioGraph,
  OutcomeVector,
} from "@/lib/graph/types"
import {
  ruleEveryDecisionHasSetupInject,
  ruleOptionsPerRoleMatchConfig,
  ruleNoDominantOption,
  ruleNoiseNeverCarriesOnlyPath,
  ruleRoundReferencesPrevRoundConsequence,
  ruleEveryDecisionMapsToDimension,
  ruleClassificationRatio,
  ruleSpecialConditionsAppear,
  ruleRegulatoryWindowPlaced,
  ruleFacilitatorGuidanceExists,
  validateFramework,
  FRAMEWORK_RULE_IDS,
} from "@/lib/wizard/framework"
import { defaultWizardConfig, type WizardConfig } from "@/lib/wizard/config"

// Framework fixtures.
//
// baseGraph() returns a MINIMAL scenario that passes all 10 rules with a
// baseConfig({...}). Individual tests then mutate one field to induce a
// single-rule failure and confirm exactly-that rule fails.

const AXES: Array<keyof OutcomeVector> = ['CONT', 'FOR', 'BC', 'JUR', 'VER', 'KOS']

function baseConfig(over: Partial<WizardConfig> = {}): WizardConfig {
  return {
    ...defaultWizardConfig(),
    clientName: 'Test',
    sector: 'zorg',
    itArrangement: 'uitbesteed',
    rounds: 2,
    injectsPerRound: 2,
    optionsPerRolePerRound: 2,
    factsNoiseRatio: 0.5,
    rolesIncluded: ['ceo', 'ciso'],
    specialConditions: [],
    ...over,
  }
}

function vec(axis: keyof OutcomeVector, val: number): OutcomeVector {
  const v: OutcomeVector = { CONT: 0, FOR: 0, BC: 0, JUR: 0, VER: 0, KOS: 0 }
  v[axis] = val
  return v
}

function baseGraph(): ScenarioGraph {
  const now = 1
  const round1Content = 'Er is een verdacht signaal gedetecteerd. Team moet reageren.'
  const round2Content = 'Team koos vorige ronde voor "Isoleer verdacht segment", nu blijkt de MSP-SLA geen incidentresponse te dekken.'
  const facilGoal = 'Test of het team situationele analyse doet.'

  const round1: RoundNodeData = {
    kind: 'round',
    title: 'R1',
    situation_update: round1Content,
    timerMinutes: 15,
    facilitatorNotes: { discussionGoal: facilGoal, keyQuestions: [], hints: [], expectedDecisions: [], redFlags: [] },
  }
  const round2: RoundNodeData = {
    kind: 'round',
    title: 'R2',
    situation_update: round2Content,
    timerMinutes: 15,
    facilitatorNotes: { discussionGoal: 'Bespreek de vervolgstappen.', keyQuestions: [], hints: [], expectedDecisions: [], redFlags: [] },
  }

  const decision1: DecisionNodeData = {
    kind: 'decision',
    prompt: 'Wat doen we?',
    measuredBy: 'participant_choice',
    perRole: true,
    options: [
      { id: 'o1', label: 'Isoleer verdacht segment', allowedRole: 'ciso', outcomeVector: vec('CONT', 2) },
      { id: 'o2', label: 'Wacht af',                allowedRole: 'ciso', outcomeVector: { CONT: -1, FOR: 0, BC: 1, JUR: 0, VER: 0, KOS: 0 } },
      { id: 'o3', label: 'Roep crisisstaat uit',    allowedRole: 'ceo',  outcomeVector: vec('VER', 2) },
      { id: 'o4', label: 'Wacht op meer info',      allowedRole: 'ceo',  outcomeVector: { CONT: 0, FOR: 0, BC: 1, JUR: 0, VER: -1, KOS: 0 } },
    ],
  }
  const decision2: DecisionNodeData = {
    kind: 'decision',
    prompt: 'Vervolgstappen?',
    measuredBy: 'participant_choice',
    perRole: true,
    options: [
      { id: 'p1', label: 'Betrek juristen', allowedRole: 'ciso', outcomeVector: vec('JUR', 2) },
      { id: 'p2', label: 'Ga zelfstandig verder', allowedRole: 'ciso', outcomeVector: { CONT: 1, FOR: 0, BC: 0, JUR: -1, VER: 0, KOS: 0 } },
      { id: 'p3', label: 'Informeer board',  allowedRole: 'ceo', outcomeVector: vec('VER', 1) },
      { id: 'p4', label: 'Wacht op advies',  allowedRole: 'ceo', outcomeVector: { CONT: 0, FOR: 0, BC: 1, JUR: 0, VER: -1, KOS: 0 } },
    ],
  }

  const inj1: InjectNodeData = {
    kind: 'inject',
    type: 'alert', urgency: 'high',
    title: 'SIEM meldt egress',
    content: 'Egress uit segment prod-01. AVG en NIS2 zijn mogelijk in scope.',
    classification: 'feit',
    setsUpDecisionNodeId: 'D1',
    triggersRegulatoryNotification: true,
  }
  const inj2: InjectNodeData = {
    kind: 'inject',
    type: 'social', urgency: 'medium',
    title: 'WhatsApp gerucht',
    content: 'Iemand claimt op WhatsApp dat het door insider komt — bron onbekend.',
    classification: 'aanname',
    setsUpDecisionNodeId: 'D2',
  }
  const inj3: InjectNodeData = {
    kind: 'inject',
    type: 'media', urgency: 'medium',
    title: 'Pers vraagt reactie',
    content: 'Journalist wil quote.',
    classification: 'feit',
    // Setup for D2 zodat rule 4 (elke decision heeft een feit-setup) slaagt.
    setsUpDecisionNodeId: 'D2',
  }
  const inj4: InjectNodeData = {
    kind: 'inject',
    type: 'internal', urgency: 'low',
    title: 'Roddel intern',
    content: 'Onbevestigd gerucht rondt intern.',
    classification: 'aanname',
  }

  return {
    id: 'g1', name: 'test', version: 1, scenarioType: 'ransomware_double_extortion',
    createdAt: now, updatedAt: now,
    nodes: [
      { id: 'start', type: 'start', position: { x: 0, y: 0 }, data: { kind: 'start' } },
      { id: 'R1', type: 'round', position: { x: 100, y: 0 }, data: round1 },
      { id: 'D1', type: 'decision', position: { x: 200, y: 0 }, data: decision1 },
      { id: 'R2', type: 'round', position: { x: 300, y: 0 }, data: round2 },
      { id: 'D2', type: 'decision', position: { x: 400, y: 0 }, data: decision2 },
      { id: 'OUT', type: 'outcome', position: { x: 500, y: 0 }, data: { kind: 'outcome', key: 'end', label: 'einde', narrative: '' } },
      { id: 'I1', type: 'inject', position: { x: 100, y: 100 }, data: inj1 },
      { id: 'I2', type: 'inject', position: { x: 100, y: 200 }, data: inj2 },
      { id: 'I3', type: 'inject', position: { x: 300, y: 100 }, data: inj3 },
      { id: 'I4', type: 'inject', position: { x: 300, y: 200 }, data: inj4 },
    ],
    edges: [
      { id: 'e1', source: 'start', target: 'R1', type: 'sequence' },
      { id: 'e2', source: 'R1', target: 'I1', type: 'inject' },
      { id: 'e3', source: 'R1', target: 'I2', type: 'inject' },
      { id: 'e4', source: 'R1', target: 'D1', type: 'sequence' },
      { id: 'e5', source: 'D1', target: 'R2', type: 'sequence' },
      { id: 'e6', source: 'R2', target: 'I3', type: 'inject' },
      { id: 'e7', source: 'R2', target: 'I4', type: 'inject' },
      { id: 'e8', source: 'R2', target: 'D2', type: 'sequence' },
      { id: 'e9', source: 'D2', target: 'OUT', type: 'sequence' },
    ],
    // Rule 11 — hidden weakness in de briefing van minstens één rol.
    roleBriefings: {
      ceo: { text: 'CEO-briefing.', playbookGaps: ['crisismandaat niet formeel vastgelegd'] },
    },
  }
}

describe("wizard framework — passing baseline", () => {
  it("baseGraph + baseConfig passes all 12 rules", () => {
    const graph = baseGraph()
    const config = baseConfig()
    const result = validateFramework(graph, config)
    if (!result.ok) {
      throw new Error(`baseline expected to pass but got: ${result.failures.map(f => f.ruleId + ': ' + f.violation).join(' | ')}`)
    }
    expect(result.ok).toBe(true)
    expect(FRAMEWORK_RULE_IDS.length).toBe(12)
  })
})

describe("rule 1 — every decision has a setup-inject", () => {
  it("passes when both decisions have setup injects", () => {
    expect(ruleEveryDecisionHasSetupInject(baseGraph()).ok).toBe(true)
  })
  it("fails when decision has no setup inject", () => {
    const g = baseGraph()
    // Detach D1's setup.
    const i1 = g.nodes.find(n => n.id === 'I1')!
    ;(i1.data as InjectNodeData).setsUpDecisionNodeId = undefined
    const res = ruleEveryDecisionHasSetupInject(g)
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.violation).toContain('D1')
  })
})

describe("rule 2 — options-per-role matches config", () => {
  it("passes with 2 options per role", () => {
    expect(ruleOptionsPerRoleMatchConfig(baseGraph(), baseConfig()).ok).toBe(true)
  })
  it("fails with off-by-one target", () => {
    const g = baseGraph()
    const c = baseConfig({ optionsPerRolePerRound: 3 })
    const res = ruleOptionsPerRoleMatchConfig(g, c)
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.violation).toMatch(/target 3/)
  })
})

describe("rule 3 — no dominant option", () => {
  it("passes when options trade off", () => {
    expect(ruleNoDominantOption(baseGraph()).ok).toBe(true)
  })
  it("fails when one option dominates another on every axis", () => {
    const g = baseGraph()
    const d = g.nodes.find(n => n.id === 'D1')!.data as DecisionNodeData
    // Make o1 dominate o2 on every axis.
    d.options[0].outcomeVector = { CONT: 2, FOR: 2, BC: 2, JUR: 2, VER: 2, KOS: 2 }
    d.options[1].outcomeVector = { CONT: 0, FOR: 0, BC: 0, JUR: 0, VER: 0, KOS: 0 }
    const res = ruleNoDominantOption(g)
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.violation).toContain('domineert')
  })
})

describe("rule 4 — geen decision op alleen misleidende setups", () => {
  it("passes on baseGraph (setups zijn feit/aanname, niet misleading)", () => {
    expect(ruleNoiseNeverCarriesOnlyPath(baseGraph()).ok).toBe(true)
  })
  it("fails when every setup for a decision is reliability=misleading", () => {
    const g = baseGraph()
    // Beide setup-injects (I1 → D1, I2 → D2) op misleading zetten
    // via ground truth. classification (publiek) mag hetzelfde blijven.
    for (const n of g.nodes) {
      if (n.type !== 'inject') continue
      const d = n.data as InjectNodeData
      if (d.setsUpDecisionNodeId) d.reliability = 'misleading'
    }
    const res = ruleNoiseNeverCarriesOnlyPath(g)
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.violation).toContain('misleidende')
  })
  it("passes when at least one setup per decision is fact/assumption", () => {
    const g = baseGraph()
    // Setup I3 op D1 (I1 blijft óók setup op D1 maar wordt misleading) —
    // I3 is 'fact' dus D1 heeft nog een truthful setup. I2 is aanname
    // (heeft geen reliability, maar rule 4 vereist enkel dat setups niet
    // ALLEMAAL misleading zijn — undefined is 'onbekend', geen misleiding).
    const i1 = g.nodes.find(n => n.id === 'I1')!.data as InjectNodeData
    const i3 = g.nodes.find(n => n.id === 'I3')!.data as InjectNodeData
    i1.reliability = 'misleading'
    i3.reliability = 'fact'
    i3.setsUpDecisionNodeId = 'D1'
    expect(ruleNoiseNeverCarriesOnlyPath(g).ok).toBe(true)
  })
})

describe("rule 5 — round 2 references round 1 consequence", () => {
  it("passes when round 2 mentions an option label from round 1", () => {
    expect(ruleRoundReferencesPrevRoundConsequence(baseGraph()).ok).toBe(true)
  })
  it("fails when round 2 does not reference round 1", () => {
    const g = baseGraph()
    const r2 = g.nodes.find(n => n.id === 'R2')!.data as RoundNodeData
    r2.situation_update = 'Compleet losstaand verhaal zonder terugkoppeling.'
    const res = ruleRoundReferencesPrevRoundConsequence(g)
    expect(res.ok).toBe(false)
  })
})

describe("rule 6 — every option maps to a dimension", () => {
  it("passes when every option moves at least one axis", () => {
    expect(ruleEveryDecisionMapsToDimension(baseGraph()).ok).toBe(true)
  })
  it("fails on an all-zero outcome vector", () => {
    const g = baseGraph()
    const d = g.nodes.find(n => n.id === 'D1')!.data as DecisionNodeData
    d.options[0].outcomeVector = { CONT: 0, FOR: 0, BC: 0, JUR: 0, VER: 0, KOS: 0 }
    const res = ruleEveryDecisionMapsToDimension(g)
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.violation).toContain('alle-nul')
    void AXES  // touch import
  })
})

describe("rule 7 — classification ratio ≈ target", () => {
  it("passes when facts fraction is near target", () => {
    // baseGraph: 2 feit + 2 aanname = 0.5 ratio; config target 0.5 → pass.
    expect(ruleClassificationRatio(baseGraph(), baseConfig()).ok).toBe(true)
  })
  it("fails when ratio far from target", () => {
    const g = baseGraph()
    // Flip all injects to aanname — feit-ratio becomes 0.
    for (const n of g.nodes) {
      if (n.type === 'inject') (n.data as InjectNodeData).classification = 'aanname'
    }
    const res = ruleClassificationRatio(g, baseConfig({ factsNoiseRatio: 0.9 }))
    expect(res.ok).toBe(false)
  })
})

describe("rule 8 — special conditions appear in required rounds", () => {
  it("passes when no special conditions are selected", () => {
    expect(ruleSpecialConditionsAppear(baseGraph(), baseConfig()).ok).toBe(true)
  })
  it("fails when a special condition is selected but not present in rounds", () => {
    const g = baseGraph()
    const c = baseConfig({ specialConditions: ['backups_untested'] })
    const res = ruleSpecialConditionsAppear(g, c)
    expect(res.ok).toBe(false)
  })
  it("passes when the condition phrase is in both rounds", () => {
    const g = baseGraph()
    // Inject the condition prompt into both rounds.
    const phrase = 'Bij herstelfase blijkt de back-up-restoretest jaren geleden voor het laatst gedraaid'
    const r1 = g.nodes.find(n => n.id === 'R1')!.data as RoundNodeData
    const r2 = g.nodes.find(n => n.id === 'R2')!.data as RoundNodeData
    r1.situation_update = `${r1.situation_update} ${phrase}`
    r2.situation_update = `${r2.situation_update} ${phrase}`
    const c = baseConfig({ specialConditions: ['backups_untested'] })
    expect(ruleSpecialConditionsAppear(g, c).ok).toBe(true)
  })
})

describe("rule 9 — regulatory notification placed with authority reference", () => {
  it("passes when an inject triggers notification and mentions AVG/NIS2", () => {
    expect(ruleRegulatoryWindowPlaced(baseGraph(), baseConfig()).ok).toBe(true)
  })
  it("fails when no inject has triggersRegulatoryNotification", () => {
    const g = baseGraph()
    for (const n of g.nodes) {
      if (n.type === 'inject') (n.data as InjectNodeData).triggersRegulatoryNotification = false
    }
    const res = ruleRegulatoryWindowPlaced(g, baseConfig())
    expect(res.ok).toBe(false)
  })
  it("fails when the trigger inject does not reference the authority", () => {
    const g = baseGraph()
    const i1 = g.nodes.find(n => n.id === 'I1')!.data as InjectNodeData
    i1.content = 'Iets is aan de hand.'
    i1.title = 'Signaal'
    const res = ruleRegulatoryWindowPlaced(g, baseConfig())
    expect(res.ok).toBe(false)
  })
})

describe("rule 10 — facilitator guidance grounded in round content", () => {
  it("passes when discussionGoal exists and doesn't invent facts", () => {
    expect(ruleFacilitatorGuidanceExists(baseGraph()).ok).toBe(true)
  })
  it("fails when a round has no discussionGoal", () => {
    const g = baseGraph()
    const r1 = g.nodes.find(n => n.id === 'R1')!.data as RoundNodeData
    r1.facilitatorNotes = { discussionGoal: '', keyQuestions: [], hints: [], expectedDecisions: [], redFlags: [] }
    const res = ruleFacilitatorGuidanceExists(g)
    expect(res.ok).toBe(false)
  })
  it("fails when discussionGoal contains numbers not in round content", () => {
    const g = baseGraph()
    const r1 = g.nodes.find(n => n.id === 'R1')!.data as RoundNodeData
    r1.facilitatorNotes = {
      discussionGoal: 'Bespreek de €500k losgeld-eis met het board.',
      keyQuestions: [], hints: [], expectedDecisions: [], redFlags: [],
    }
    const res = ruleFacilitatorGuidanceExists(g)
    expect(res.ok).toBe(false)
  })
})

describe("aggregate — validateFramework", () => {
  it("returns ok when everything passes", () => {
    const res = validateFramework(baseGraph(), baseConfig())
    expect(res.ok).toBe(true)
    expect(res.failures).toEqual([])
  })
  it("collects failures across independently-broken rules", () => {
    const g = baseGraph()
    // Break rule 1: detach setup-inject from D1.
    ;(g.nodes.find(n => n.id === 'I1')!.data as InjectNodeData).setsUpDecisionNodeId = undefined
    // Break rule 6: zero-vector option.
    const d1 = g.nodes.find(n => n.id === 'D1')!.data as DecisionNodeData
    d1.options[0].outcomeVector = { CONT: 0, FOR: 0, BC: 0, JUR: 0, VER: 0, KOS: 0 }
    const res = validateFramework(g, baseConfig())
    expect(res.ok).toBe(false)
    const ids = res.failures.map(f => f.ruleId)
    expect(ids).toContain('rule1_setup_inject')
    expect(ids).toContain('rule6_dimension_mapped')
  })
})
