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
  ruleRoleSetupInject,
  validateFramework,
  FRAMEWORK_RULE_IDS,
} from "@/lib/wizard/framework"
import { defaultWizardConfig, type WizardConfig } from "@/lib/wizard/config"
import type { Role } from "@/lib/types"

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

  // De velden voor rule14 (kwaliteitsverdeling) en rule15 (genoeg toelichting)
  // staan hier expliciet in: met twee opties per rol hoort er precies één
  // `best` te zijn en geen `good`.
  const TOELICHTING = 'Wat je bij deze optie concreet doet, en wat je daarmee bewust laat liggen voor deze ronde.'
  const COMMENTAAR = 'Vraag het team welk verlies zij hiermee bewust accepteren, en wie dat besluit neemt.'
  const CONTEXT = "Wat er nu ligt is nog niet rond en de klok loopt al. Deze keuze gaat over de eerste stap, niet over het herstel daarna."
  const RATIONALE = 'De beste optie pakt de besmetting aan terwijl de klok loopt; de andere koopt rust die je later betaalt.'

  const decision1: DecisionNodeData = {
    kind: 'decision',
    prompt: 'Classificeren we dit signaal als incident, en wie legt dat besluit nu vast?',
    context: CONTEXT,
    facilitatorRationale: RATIONALE,
    measuredBy: 'participant_choice',
    perRole: true,
    options: [
      { id: 'o1', label: 'Isoleer verdacht segment', allowedRole: 'ciso', outcomeVector: vec('CONT', 2), qualityRank: 'best',  description: TOELICHTING, facilitatorCommentary: COMMENTAAR },
      { id: 'o2', label: 'Wacht af',                allowedRole: 'ciso', outcomeVector: { CONT: -1, FOR: 0, BC: 1, JUR: 0, VER: 0, KOS: 0 }, qualityRank: 'wrong', description: TOELICHTING, facilitatorCommentary: COMMENTAAR },
      { id: 'o3', label: 'Roep crisisstaat uit',    allowedRole: 'ceo',  outcomeVector: vec('VER', 2), qualityRank: 'best',  description: TOELICHTING, facilitatorCommentary: COMMENTAAR },
      { id: 'o4', label: 'Wacht op meer info',      allowedRole: 'ceo',  outcomeVector: { CONT: 0, FOR: 0, BC: 1, JUR: 0, VER: -1, KOS: 0 }, qualityRank: 'wrong', description: TOELICHTING, facilitatorCommentary: COMMENTAAR },
    ],
  }
  const decision2: DecisionNodeData = {
    kind: 'decision',
    prompt: 'Welke vervolgstap zetten we nu, en welk spoor laten we daarmee liggen?',
    context: CONTEXT,
    facilitatorRationale: RATIONALE,
    measuredBy: 'participant_choice',
    perRole: true,
    options: [
      { id: 'p1', label: 'Betrek juristen', allowedRole: 'ciso', outcomeVector: vec('JUR', 2), qualityRank: 'best',  description: TOELICHTING, facilitatorCommentary: COMMENTAAR },
      { id: 'p2', label: 'Ga zelfstandig verder', allowedRole: 'ciso', outcomeVector: { CONT: 1, FOR: 0, BC: 0, JUR: -1, VER: 0, KOS: 0 }, qualityRank: 'wrong', description: TOELICHTING, facilitatorCommentary: COMMENTAAR },
      { id: 'p3', label: 'Informeer board',  allowedRole: 'ceo', outcomeVector: vec('VER', 1), qualityRank: 'best',  description: TOELICHTING, facilitatorCommentary: COMMENTAAR },
      { id: 'p4', label: 'Wacht op advies',  allowedRole: 'ceo', outcomeVector: { CONT: 0, FOR: 0, BC: 1, JUR: 0, VER: -1, KOS: 0 }, qualityRank: 'wrong', description: TOELICHTING, facilitatorCommentary: COMMENTAAR },
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
    classification: 'aanname', deliverySeconds: 240,
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
    classification: 'aanname', deliverySeconds: 240,
  }

  // Rol-injects (rule17): elke rol die een optie bezit krijgt zijn vraag als
  // eigen bericht. Zonder deze vier zakt de baseline op rule17 en zouden alle
  // andere regeltests onder een falende basis draaien.
  function rolInject(
    rol: Role,
    decision: string,
    afzender: string,
    vraag: string,
    seconden: number,
    classification: 'feit' | 'aanname',
  ): InjectNodeData {
    return {
      kind: 'inject',
      type: 'internal', urgency: 'high',
      title: `${afzender} vraagt jou om een keuze`,
      senderName: afzender,
      content: `${afzender} aan de lijn over het segment prod-01. ${vraag}`,
      classification,
      targetRoles: [rol],
      setsUpDecisionNodeId: decision,
      deliverySeconds: seconden,
    }
  }
  // Twee feiten en twee aannames, zodat de baseline op de 0,50-ratio van
  // rule7 blijft staan.
  const rol1a = rolInject('ciso', 'D1', 'SOC-analist', 'Noem jij dit een incident?', 30, 'feit')
  const rol1b = rolInject('ceo', 'D1', 'Directiesecretaris', 'Wat autoriseer jij nu?', 60, 'aanname')
  const rol2a = rolInject('ciso', 'D2', 'SOC-analist', 'Welke stap zet ik eerst?', 30, 'feit')
  const rol2b = rolInject('ceo', 'D2', 'Directiesecretaris', 'Wat houd je nog tegen?', 60, 'aanname')

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
      { id: 'I1A', type: 'inject', position: { x: 100, y: 300 }, data: rol1a },
      { id: 'I1B', type: 'inject', position: { x: 100, y: 400 }, data: rol1b },
      { id: 'I2A', type: 'inject', position: { x: 300, y: 300 }, data: rol2a },
      { id: 'I2B', type: 'inject', position: { x: 300, y: 400 }, data: rol2b },
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
      { id: 'e10', source: 'R1', target: 'I1A', type: 'inject' },
      { id: 'e11', source: 'R1', target: 'I1B', type: 'inject' },
      { id: 'e12', source: 'R2', target: 'I2A', type: 'inject' },
      { id: 'e13', source: 'R2', target: 'I2B', type: 'inject' },
    ],
    // Rule 11 — hidden weakness in de briefing van minstens één rol.
    roleBriefings: {
      ceo: { text: 'CEO-briefing.', playbookGaps: ['crisismandaat niet formeel vastgelegd'] },
    },
  }
}

describe("wizard framework — passing baseline", () => {
  it("baseGraph + baseConfig passes all 18 rules", () => {
    const graph = baseGraph()
    const config = baseConfig()
    const result = validateFramework(graph, config)
    if (!result.ok) {
      throw new Error(`baseline expected to pass but got: ${result.failures.map(f => f.ruleId + ': ' + f.violation).join(' | ')}`)
    }
    expect(result.ok).toBe(true)
    expect(FRAMEWORK_RULE_IDS.length).toBe(18)
  })
})

describe("rule 1 — every decision has a setup-inject", () => {
  it("passes when both decisions have setup injects", () => {
    expect(ruleEveryDecisionHasSetupInject(baseGraph()).ok).toBe(true)
  })
  it("fails when decision has no setup inject", () => {
    const g = baseGraph()
    // Álle verwijzingen naar D1 losknippen, ook die van de rol-injects: die
    // zijn sinds rule17 óók setup-injects, dus alleen I1 losmaken laat D1 met
    // een setup achter en dan toetst deze test niets meer.
    for (const node of g.nodes) {
      if (node.type !== 'inject') continue
      const data = node.data as InjectNodeData
      if (data.setsUpDecisionNodeId === 'D1') data.setsUpDecisionNodeId = undefined
    }
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

describe("rule 4 — elke decision heeft een geclassificeerde setup", () => {
  it("passes on baseGraph (setups hebben classification feit/aanname)", () => {
    expect(ruleNoiseNeverCarriesOnlyPath(baseGraph()).ok).toBe(true)
  })
  it("fails when no setup for a decision carries a classification", () => {
    const g = baseGraph()
    for (const n of g.nodes) {
      if (n.type !== 'inject') continue
      const d = n.data as InjectNodeData
      if (d.setsUpDecisionNodeId) d.classification = undefined
    }
    const res = ruleNoiseNeverCarriesOnlyPath(g)
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.violation).toContain('geclassificeerde setup')
  })
  it("passes when a decision deliberately rests on a single aanname", () => {
    const g = baseGraph()
    for (const n of g.nodes) {
      if (n.type !== 'inject') continue
      const d = n.data as InjectNodeData
      if (d.setsUpDecisionNodeId) d.classification = 'aanname'
    }
    expect(ruleNoiseNeverCarriesOnlyPath(g).ok).toBe(true)
  })
  it("passes when one of several setups is classified", () => {
    const g = baseGraph()
    const i1 = g.nodes.find(n => n.id === 'I1')!.data as InjectNodeData
    const i3 = g.nodes.find(n => n.id === 'I3')!.data as InjectNodeData
    i1.classification = undefined
    i3.classification = 'feit'
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
  it("fails when a score vector omits a dimension", () => {
    const g = baseGraph()
    const d = g.nodes.find(n => n.id === 'D1')!.data as DecisionNodeData
    d.options[0].outcomeVector = { CONT: 2 } as OutcomeVector
    const res = ruleEveryDecisionMapsToDimension(g)
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.violation).toContain('FOR')
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
    // Break rule 1: alle setups van D1 losknippen, inclusief de rol-injects.
    for (const node of g.nodes) {
      if (node.type !== 'inject') continue
      const data = node.data as InjectNodeData
      if (data.setsUpDecisionNodeId === 'D1') data.setsUpDecisionNodeId = undefined
    }
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

describe("rule 17 — elke rol krijgt zijn beslisvraag als eigen inject", () => {
  it("slaagt op baseGraph: CISO en CEO hebben elk een eigen bericht", () => {
    expect(ruleRoleSetupInject(baseGraph()).ok).toBe(true)
  })

  it("faalt als een rol wel een optie bezit maar geen eigen bericht", () => {
    const g = baseGraph()
    // Het bericht aan de CEO van D1 weghalen; de CISO houdt het zijne.
    g.nodes = g.nodes.filter(n => n.id !== 'I1B')
    const res = ruleRoleSetupInject(g)
    expect(res.ok).toBe(false)
    if (!res.ok) {
      expect(res.violation).toContain('D1')
      expect(res.violation).toContain('ceo')
      expect(res.violation).not.toContain('D2')
    }
  })

  it("faalt als het rol-bericht een mededeling is in plaats van een vraag", () => {
    const g = baseGraph()
    const bericht = g.nodes.find(n => n.id === 'I1A')!.data as InjectNodeData
    bericht.content = 'De dienstdoende analist laat weten dat hij niets gaat doen.'
    const res = ruleRoleSetupInject(g)
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.violation).toContain('ciso')
  })

  it("rekent een gedeeld bericht niet mee als rol-bericht", () => {
    const g = baseGraph()
    // targetRoles weghalen: de tekst blijft, maar hij komt bij iedereen binnen
    // en is dus niet de vraag áán die rol.
    const bericht = g.nodes.find(n => n.id === 'I1A')!.data as InjectNodeData
    bericht.targetRoles = undefined
    const res = ruleRoleSetupInject(g)
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.violation).toContain('ciso')
  })

  it("negeert de impliciete 'geen besluit'-optie bij het bepalen van mandaat", () => {
    const g = baseGraph()
    const d1 = g.nodes.find(n => n.id === 'D1')!.data as DecisionNodeData
    d1.options.push({
      id: 'p-geen', label: 'Geen besluit binnen de tijd', allowedRole: 'legal', implicit: true,
    })
    // Legal bezit alleen een impliciete optie en heeft dus geen mandaat — er
    // hoeft geen bericht aan Legal te zijn.
    expect(ruleRoleSetupInject(g).ok).toBe(true)
  })
})
