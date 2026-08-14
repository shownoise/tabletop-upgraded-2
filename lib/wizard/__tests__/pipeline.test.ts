import { describe, it, expect } from "vitest"
import { runWizardPipeline, WizardPipelineError, type LlmMessage } from "@/lib/wizard/pipeline"
import { defaultWizardConfig, type WizardConfig } from "@/lib/wizard/config"
import type { WizardPlan } from "@/lib/graph/wizard-plan"
import type { InjectNodeData } from "@/lib/graph/types"

// Pipeline tests use a stubbed LLM whose responses are deterministic. Each
// message the pipeline sends is routed to a canned response based on the last
// user-message content — the stub does string matching on well-known prompt
// fragments.

interface StubResponses {
  outline: string
  rounds: string[]        // one per round index
  closer: string
  repair?: string         // response for repair passes
}

function buildStub(resp: StubResponses): { llm: (m: LlmMessage[]) => Promise<string>; calls: string[] } {
  const calls: string[] = []
  let roundIdx = 0
  return {
    calls,
    async llm(messages) {
      const last = messages[messages.length - 1]?.content ?? ""
      calls.push(last.slice(0, 80))
      if (last.includes("outline") || last.startsWith("Genereer eerst een OUTLINE")) return resp.outline
      if (last.startsWith("Genereer ronde ")) {
        const out = resp.rounds[roundIdx] ?? resp.rounds[resp.rounds.length - 1]
        roundIdx += 1
        return out
      }
      if (last.startsWith("Geef nu als JSON")) return resp.closer
      if (last.startsWith("De vorige plan overtreedt")) return resp.repair ?? ""
      return ""
    },
  }
}

function testConfig(over: Partial<WizardConfig> = {}): WizardConfig {
  return {
    ...defaultWizardConfig(),
    clientName: 'Test-klant',
    sector: 'zorg',
    itArrangement: 'eigen IT',
    rounds: 2,
    injectsPerRound: 2,
    optionsPerRolePerRound: 2,
    factsNoiseRatio: 0.5,
    rolesIncluded: ['ceo', 'ciso'],
    specialConditions: [],
    seed: 'fixed-seed',
    ...over,
  }
}

// A valid plan that passes ALL 10 framework rules. We use author-ids so
// planToGraph can resolve setsUpDecisionNodeId to the real decision node id.
function passingPlan(): WizardPlan {
  return {
    name: 'Test-scenario',
    scenarioType: 'ransomware_double_extortion',
    rounds: [
      {
        title: 'R1',
        situation: 'Een verdacht signaal is gemeld. Team moet reageren op AVG en NIS2.',
        discussionGoal: 'Test of het team feit van aanname scheidt.',
        injects: [
          {
            id: 'i1', type: 'alert', urgency: 'high', title: 'SIEM meldt egress',
            content: 'Egress gedetecteerd. AVG en NIS2 mogelijk in scope.',
            classification: 'feit',
            setsUpDecisionNodeId: 'd1',
            triggersRegulatoryNotification: true,
          },
          {
            id: 'i2', type: 'social', urgency: 'medium', title: 'WhatsApp gerucht',
            content: 'Iemand claimt insider — bron onbekend.',
            classification: 'aanname',
            setsUpDecisionNodeId: 'd2',
          },
        ],
      },
      {
        title: 'R2',
        situation: 'Team koos vorige ronde voor "Isoleer verdacht segment" — nu volgt escalatie.',
        discussionGoal: 'Bespreek escalatie.',
        injects: [
          {
            id: 'i3', type: 'media', urgency: 'medium', title: 'Pers vraagt',
            content: 'Journalist wil quote.',
            classification: 'feit',
          },
          {
            id: 'i4', type: 'internal', urgency: 'low', title: 'Roddel',
            content: 'Onbevestigd gerucht.',
            classification: 'aanname',
          },
        ],
      },
    ],
    decisions: [
      {
        afterRoundIndex: 0,
        authorId: 'd1',
        prompt: 'Wat doen we?',
        perRole: true,
        options: [
          { label: 'Isoleer verdacht segment', allowedRole: 'ciso', outcomeVector: { CONT: 2, FOR: 0, BC: -1, JUR: 0, VER: 0, KOS: 0 } },
          { label: 'Wacht af',                 allowedRole: 'ciso', outcomeVector: { CONT: -1, FOR: 0, BC: 1, JUR: 0, VER: 0, KOS: 0 } },
          { label: 'Roep crisisstaat uit',     allowedRole: 'ceo',  outcomeVector: { CONT: 0, FOR: 0, BC: 0, JUR: 0, VER: 2, KOS: -1 } },
          { label: 'Wacht op meer info',       allowedRole: 'ceo',  outcomeVector: { CONT: 0, FOR: 0, BC: 1, JUR: 0, VER: -1, KOS: 0 } },
        ],
      },
      {
        afterRoundIndex: 1,
        authorId: 'd2',
        prompt: 'Vervolgstappen?',
        perRole: true,
        options: [
          { label: 'Betrek juristen',          allowedRole: 'ciso', outcomeVector: { CONT: 0, FOR: 0, BC: 0, JUR: 2, VER: 0, KOS: -1 } },
          { label: 'Ga zelfstandig verder',    allowedRole: 'ciso', outcomeVector: { CONT: 1, FOR: 0, BC: 0, JUR: -1, VER: 0, KOS: 0 } },
          { label: 'Informeer board',          allowedRole: 'ceo',  outcomeVector: { CONT: 0, FOR: 0, BC: 0, JUR: 0, VER: 1, KOS: -1 } },
          { label: 'Wacht op advies',          allowedRole: 'ceo',  outcomeVector: { CONT: 0, FOR: 0, BC: 1, JUR: 0, VER: -1, KOS: 0 } },
        ],
      },
    ],
    outcomes: [
      { key: 'excellent', label: 'Voorbeeldig', narrative: 'Alles goed', scoreRange: { min: 5 } },
      { key: 'middel',    label: 'Gemiddeld',   narrative: 'Redelijk', scoreRange: { min: -2, max: 4 } },
      { key: 'slecht',    label: 'Slecht',      narrative: 'Escalatie', scoreRange: { max: -3 } },
    ],
  }
}

describe("wizard pipeline — happy path", () => {
  it("produces a graph, records the seed, and returns an empty repair log when all rules pass", async () => {
    const plan = passingPlan()
    const stub = buildStub({
      outline: JSON.stringify({ rounds: plan.rounds.map(r => ({ title: r.title, situation: r.situation })) }),
      rounds: plan.rounds.map((r, i) => JSON.stringify({ round: r, decision: plan.decisions![i] })),
      closer: JSON.stringify({
        name: plan.name,
        scenarioType: plan.scenarioType,
        outcomes: plan.outcomes,
      }),
    })
    const result = await runWizardPipeline(testConfig(), { llm: stub.llm, now: () => 1_700_000_000 })
    expect(result.seed).toBe('fixed-seed')
    expect(result.repairLog).toEqual([])
    expect(result.graph.wizardSeed).toBe('fixed-seed')
    expect(result.graph.publishStatus).toBe('draft')
    // Basic sanity: exactly 2 rounds and 2 decisions.
    expect(result.graph.nodes.filter(n => n.type === 'round').length).toBe(2)
    expect(result.graph.nodes.filter(n => n.type === 'decision').length).toBe(2)
  })

  it("reproduces byte-identical graphs for the same seed + same LLM output", async () => {
    const plan = passingPlan()
    const stub1 = buildStub({
      outline: JSON.stringify({ rounds: plan.rounds.map(r => ({ title: r.title, situation: r.situation })) }),
      rounds: plan.rounds.map((r, i) => JSON.stringify({ round: r, decision: plan.decisions![i] })),
      closer: JSON.stringify({ name: plan.name, scenarioType: plan.scenarioType, outcomes: plan.outcomes }),
    })
    const stub2 = buildStub({
      outline: JSON.stringify({ rounds: plan.rounds.map(r => ({ title: r.title, situation: r.situation })) }),
      rounds: plan.rounds.map((r, i) => JSON.stringify({ round: r, decision: plan.decisions![i] })),
      closer: JSON.stringify({ name: plan.name, scenarioType: plan.scenarioType, outcomes: plan.outcomes }),
    })
    const r1 = await runWizardPipeline(testConfig(), { llm: stub1.llm, now: () => 42 })
    const r2 = await runWizardPipeline(testConfig(), { llm: stub2.llm, now: () => 42 })
    expect(JSON.stringify(r1.graph)).toBe(JSON.stringify(r2.graph))
  })
})

describe("wizard pipeline — repair loop", () => {
  it("records a repair log entry and returns a passing graph when the second attempt fixes the failure", async () => {
    const good = passingPlan()
    // First response — deliberately broken: verwijder alle setup-links op de
    // eerste-ronde injects zodat rule 1 (elke decision heeft een setup-inject)
    // faalt en de repair-loop moet aanslaan.
    const broken = JSON.parse(JSON.stringify(good)) as WizardPlan
    for (const inj of broken.rounds[0].injects ?? []) {
      inj.setsUpDecisionNodeId = undefined
    }
    // Also break rule 1 (setup-inject) by clearing i2 to make sure only one rule fails
    // per repair attempt is not required — multiple failing rules on first pass is fine.
    const roundsRaw = good.rounds.map((r, i) => JSON.stringify({ round: r, decision: good.decisions![i] }))
    const outlineRaw = JSON.stringify({ rounds: good.rounds.map(r => ({ title: r.title, situation: r.situation })) })
    const closerRaw = JSON.stringify({ name: good.name, scenarioType: good.scenarioType, outcomes: good.outcomes })

    // First round response: broken plan for round 1 (setups removed, violates rule 1).
    const brokenRoundsRaw = [
      JSON.stringify({ round: broken.rounds[0], decision: broken.decisions![0] }),
      roundsRaw[1],
    ]
    // Repair response returns the good plan wholesale.
    const repairRaw = JSON.stringify(good)

    const stub = buildStub({
      outline: outlineRaw,
      rounds: brokenRoundsRaw,
      closer: closerRaw,
      repair: repairRaw,
    })

    const result = await runWizardPipeline(testConfig(), {
      llm: stub.llm,
      maxRepairAttempts: 2,
      now: () => 100,
    })
    expect(result.repairLog.length).toBeGreaterThanOrEqual(1)
    // We removed the setup-links → rule 1 (setup-inject required) triggers.
    expect(result.repairLog.map(r => r.ruleId)).toContain('rule1_setup_inject')
    // Final graph passes — the pipeline only returns on ok.
    expect(result.graph.publishStatus).toBe('draft')
  })

  it("throws WizardPipelineError after exhausting repair attempts", async () => {
    const broken = passingPlan()
    // Make broken irrepairable: strip all classifications so rule 7 always fails.
    for (const r of broken.rounds) {
      for (const inj of r.injects!) inj.classification = undefined
    }
    const outlineRaw = JSON.stringify({ rounds: broken.rounds.map(r => ({ title: r.title, situation: r.situation })) })
    const roundsRaw = broken.rounds.map((r, i) => JSON.stringify({ round: r, decision: broken.decisions![i] }))
    const closerRaw = JSON.stringify({ name: broken.name, scenarioType: broken.scenarioType, outcomes: broken.outcomes })
    const repairRaw = JSON.stringify(broken)  // repair also broken

    const stub = buildStub({
      outline: outlineRaw,
      rounds: roundsRaw,
      closer: closerRaw,
      repair: repairRaw,
    })

    await expect(runWizardPipeline(testConfig(), {
      llm: stub.llm,
      maxRepairAttempts: 1,
      now: () => 0,
    })).rejects.toBeInstanceOf(WizardPipelineError)
  })
})

describe("wizard pipeline — draft status + seed on graph", () => {
  it("sets publishStatus='draft' and stamps wizardSeed on the returned graph", async () => {
    const plan = passingPlan()
    const stub = buildStub({
      outline: JSON.stringify({ rounds: plan.rounds.map(r => ({ title: r.title, situation: r.situation })) }),
      rounds: plan.rounds.map((r, i) => JSON.stringify({ round: r, decision: plan.decisions![i] })),
      closer: JSON.stringify({ name: plan.name, scenarioType: plan.scenarioType, outcomes: plan.outcomes }),
    })
    const result = await runWizardPipeline(testConfig({ seed: 'my-seed-xyz' }), { llm: stub.llm, now: () => 1 })
    expect(result.graph.publishStatus).toBe('draft')
    expect(result.graph.wizardSeed).toBe('my-seed-xyz')
    // Inject classification is preserved through compile.
    const inj = result.graph.nodes.find(n => n.type === 'inject')
    expect((inj?.data as InjectNodeData | undefined)?.classification).toBeTruthy()
  })
})
