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
  outlineRetry?: string
  rounds: string[]        // one per round index
  roundRetries?: string[] // second response when the first round JSON is malformed
  // Closer is nu opgesplitst in 3 aparte calls.
  meta: string            // { name, scenarioType, irPlaybook, outcomes }
  briefings: string       // { roleBriefings }
  injects: string         // { injectLibrary }
  decisions?: string[]    // targeted retry when a round has no usable decision
  lessons?: string[]      // targeted cross-round text repair
  repair?: string         // response for repair passes
}

function buildStub(resp: StubResponses): { llm: (m: LlmMessage[]) => Promise<string>; calls: string[] } {
  const calls: string[] = []
  const roundCallCounts = new Map<number, number>()
  let outlineCalls = 0
  return {
    calls,
    async llm(messages) {
      const last = messages[messages.length - 1]?.content ?? ""
      calls.push(last.slice(0, 80))
      if (last.startsWith("Genereer ronde ")) {
        const match = last.match(/^Genereer ronde (\d+)/)
        const idx = match ? Math.max(0, Number(match[1]) - 1) : 0
        const count = roundCallCounts.get(idx) ?? 0
        roundCallCounts.set(idx, count + 1)
        if (count > 0 && resp.roundRetries?.[idx]) return resp.roundRetries[idx]
        return resp.rounds[idx] ?? resp.rounds[resp.rounds.length - 1]
      }
      if (last.startsWith("Genereer uitsluitend het keuzemoment voor ronde ")) {
        const match = last.match(/^Genereer uitsluitend het keuzemoment voor ronde (\d+)/)
        const idx = match ? Math.max(0, Number(match[1]) - 1) : 0
        return resp.decisions?.[idx] ?? ""
      }
      if (last.startsWith("Herstel uitsluitend de rondetekst voor ronde ")) {
        const match = last.match(/^Herstel uitsluitend de rondetekst voor ronde (\d+)/)
        const idx = match ? Math.max(0, Number(match[1]) - 1) : 0
        return resp.lessons?.[idx] ?? ""
      }
      if (last.startsWith("Genereer eerst een OUTLINE")) {
        outlineCalls += 1
        return outlineCalls > 1 && resp.outlineRetry ? resp.outlineRetry : resp.outline
      }
      if (last.startsWith("De vorige plan overtreedt")) return resp.repair ?? ""
      // Closer-splits: match op de meest onderscheidende key in de prompt.
      if (last.includes('"roleBriefings"')) return resp.briefings
      if (last.includes('"injectLibrary"')) return resp.injects
      if (last.includes('"outcomes"') || last.includes('"scenarioType"')) return resp.meta
      return ""
    },
  }
}

// Helper: bouw stub-responses uit een compleet plan.
function stubFromPlan(plan: WizardPlan): StubResponses {
  return {
    outline: JSON.stringify({ rounds: plan.rounds.map(r => ({ title: r.title, situation: r.situation })) }),
    rounds: plan.rounds.map((r, i) => JSON.stringify({ round: r, decision: plan.decisions?.[i] ?? null })),
    meta: JSON.stringify({ name: plan.name, scenarioType: plan.scenarioType, outcomes: plan.outcomes, irPlaybook: plan.irPlaybook }),
    briefings: JSON.stringify({ roleBriefings: plan.roleBriefings ?? {} }),
    injects: JSON.stringify({ injectLibrary: plan.injectLibrary ?? [] }),
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
            classification: 'aanname', deliverySeconds: 240,
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
            classification: 'aanname', deliverySeconds: 240,
          },
        ],
      },
    ],
    decisions: [
      {
        afterRoundIndex: 0,
        authorId: 'd1',
        prompt: 'Wat doen we — en wie legt dat besluit nu vast, met het beeld dat er is?',
        context: 'Wat er nu ligt is nog niet rond, en de klok loopt al. Deze keuze gaat over de eerste stap, niet over het herstel daarna. Kijk in je documenten wat jouw rol hier mag besluiten.',
        facilitatorRationale: 'De beste optie adresseert het dilemma terwijl de klok loopt; de tweede kiest een doel en laat een ander liggen.',
        perRole: true,
        options: [
          { label: 'Isoleer verdacht segment', allowedRole: 'ciso', outcomeVector: { CONT: 2, FOR: 0, BC: -1, JUR: 0, VER: 0, KOS: 0 }, qualityRank: 'best', description: 'Wat je bij deze optie concreet doet, en wat je daarmee bewust laat liggen voor deze ronde.', facilitatorCommentary: 'Vraag het team welk verlies zij hiermee bewust accepteren, en wie dat besluit neemt.' },
          { label: 'Wacht af',                 allowedRole: 'ciso', outcomeVector: { CONT: -1, FOR: 0, BC: 1, JUR: 0, VER: 0, KOS: 0 }, qualityRank: 'wrong', description: 'Wat je bij deze optie concreet doet, en wat je daarmee bewust laat liggen voor deze ronde.', facilitatorCommentary: 'Vraag het team welk verlies zij hiermee bewust accepteren, en wie dat besluit neemt.' },
          { label: 'Roep crisisstaat uit',     allowedRole: 'ceo',  outcomeVector: { CONT: 0, FOR: 0, BC: 0, JUR: 0, VER: 2, KOS: -1 }, qualityRank: 'best', description: 'Wat je bij deze optie concreet doet, en wat je daarmee bewust laat liggen voor deze ronde.', facilitatorCommentary: 'Vraag het team welk verlies zij hiermee bewust accepteren, en wie dat besluit neemt.' },
          { label: 'Wacht op meer info',       allowedRole: 'ceo',  outcomeVector: { CONT: 0, FOR: 0, BC: 1, JUR: 0, VER: -1, KOS: 0 }, qualityRank: 'wrong', description: 'Wat je bij deze optie concreet doet, en wat je daarmee bewust laat liggen voor deze ronde.', facilitatorCommentary: 'Vraag het team welk verlies zij hiermee bewust accepteren, en wie dat besluit neemt.' },
        ],
      },
      {
        afterRoundIndex: 1,
        authorId: 'd2',
        prompt: 'Vervolgstappen — en wie legt dat besluit nu vast, met het beeld dat er is?',
        context: 'Wat er nu ligt is nog niet rond, en de klok loopt al. Deze keuze gaat over de eerste stap, niet over het herstel daarna. Kijk in je documenten wat jouw rol hier mag besluiten.',
        facilitatorRationale: 'De beste optie adresseert het dilemma terwijl de klok loopt; de tweede kiest een doel en laat een ander liggen.',
        perRole: true,
        options: [
          { label: 'Betrek juristen',          allowedRole: 'ciso', outcomeVector: { CONT: 0, FOR: 0, BC: 0, JUR: 2, VER: 0, KOS: -1 }, qualityRank: 'best', description: 'Wat je bij deze optie concreet doet, en wat je daarmee bewust laat liggen voor deze ronde.', facilitatorCommentary: 'Vraag het team welk verlies zij hiermee bewust accepteren, en wie dat besluit neemt.' },
          { label: 'Ga zelfstandig verder',    allowedRole: 'ciso', outcomeVector: { CONT: 1, FOR: 0, BC: 0, JUR: -1, VER: 0, KOS: 0 }, qualityRank: 'wrong', description: 'Wat je bij deze optie concreet doet, en wat je daarmee bewust laat liggen voor deze ronde.', facilitatorCommentary: 'Vraag het team welk verlies zij hiermee bewust accepteren, en wie dat besluit neemt.' },
          { label: 'Informeer board',          allowedRole: 'ceo',  outcomeVector: { CONT: 0, FOR: 0, BC: 0, JUR: 0, VER: 1, KOS: -1 }, qualityRank: 'best', description: 'Wat je bij deze optie concreet doet, en wat je daarmee bewust laat liggen voor deze ronde.', facilitatorCommentary: 'Vraag het team welk verlies zij hiermee bewust accepteren, en wie dat besluit neemt.' },
          { label: 'Wacht op advies',          allowedRole: 'ceo',  outcomeVector: { CONT: 0, FOR: 0, BC: 1, JUR: 0, VER: -1, KOS: 0 }, qualityRank: 'wrong', description: 'Wat je bij deze optie concreet doet, en wat je daarmee bewust laat liggen voor deze ronde.', facilitatorCommentary: 'Vraag het team welk verlies zij hiermee bewust accepteren, en wie dat besluit neemt.' },
        ],
      },
    ],
    outcomes: [
      { key: 'excellent', label: 'Voorbeeldig', narrative: 'Alles goed', scoreRange: { min: 5 } },
      { key: 'middel',    label: 'Gemiddeld',   narrative: 'Redelijk', scoreRange: { min: -2, max: 4 } },
      { key: 'slecht',    label: 'Slecht',      narrative: 'Escalatie', scoreRange: { max: -3 } },
    ],
    // Rule 11 — hidden weakness in de briefing van minstens één rol.
    roleBriefings: {
      ceo: { text: 'CEO-briefing.', playbookGaps: ['crisismandaat niet vastgelegd'] },
    },
  }
}

describe("wizard pipeline — happy path", () => {
  it("produces a graph, records the seed, and returns an empty repair log when all rules pass", async () => {
    const plan = passingPlan()
    const stub = buildStub(stubFromPlan(plan))
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
    const stub1 = buildStub(stubFromPlan(plan))
    const stub2 = buildStub(stubFromPlan(plan))
    const r1 = await runWizardPipeline(testConfig(), { llm: stub1.llm, now: () => 42 })
    const r2 = await runWizardPipeline(testConfig(), { llm: stub2.llm, now: () => 42 })
    expect(JSON.stringify(r1.graph)).toBe(JSON.stringify(r2.graph))
  })
})

describe("wizard pipeline — repair loop", () => {
  it("returns a draft with warnings when only score dominance and round continuity fail", async () => {
    const plan = passingPlan()
    plan.rounds[1].situation = 'Een nieuwe escalatie zonder verwijzing naar de eerdere afweging.'
    plan.decisions![0].options[0].outcomeVector = { CONT: 2, FOR: 2, BC: 2, JUR: 2, VER: 2, KOS: 2 }
    const stub = buildStub({ ...stubFromPlan(plan), lessons: ['', '{}'] })

    const result = await runWizardPipeline(testConfig(), {
      llm: stub.llm,
      maxRepairAttempts: 1,
      now: () => 1,
    })

    expect(result.graph.publishStatus).toBe('draft')
    expect(result.warnings.map(warning => warning.ruleId)).toEqual(expect.arrayContaining([
      'rule3_no_dominant',
      'rule5_cross_round_lesson',
    ]))
    expect(stub.calls.some(call => call.startsWith('De vorige plan overtreedt'))).toBe(false)
  })

  it("keeps a draft when the optional round-text repair request fails", async () => {
    const plan = passingPlan()
    plan.rounds[1].situation = 'Een nieuwe escalatie zonder verwijzing naar de eerdere afweging.'
    const stub = buildStub(stubFromPlan(plan))

    const result = await runWizardPipeline(testConfig(), {
      llm: (messages, options) => {
        if (options?.stage?.startsWith('lesson-')) throw new Error('tekstherstel niet beschikbaar')
        return stub.llm(messages)
      },
      maxRepairAttempts: 0,
      now: () => 1,
    })

    expect(result.graph.publishStatus).toBe('draft')
    expect(result.warnings.map(warning => warning.ruleId)).toContain('rule5_cross_round_lesson')
  })

  it("keeps a missing six-dimensional score a hard failure", async () => {
    const plan = passingPlan()
    delete (plan.decisions![0].options[0].outcomeVector as { KOS?: number }).KOS
    const stub = buildStub(stubFromPlan(plan))

    await expect(runWizardPipeline(testConfig(), {
      llm: stub.llm,
      maxRepairAttempts: 0,
      now: () => 1,
    })).rejects.toMatchObject({
      name: 'WizardPipelineError',
      failures: expect.arrayContaining([expect.objectContaining({ ruleId: 'rule6_dimension_mapped' })]),
    })
  })

  it("rejects a broken choice-to-next-round connection", async () => {
    const plan = passingPlan()
    plan.decisions![0].options[0].leadsTo = 'round:99'
    const stub = buildStub(stubFromPlan(plan))

    await expect(runWizardPipeline(testConfig(), {
      llm: stub.llm,
      maxRepairAttempts: 0,
      now: () => 1,
    })).rejects.toMatchObject({
      name: 'WizardPipelineError',
      failures: [expect.objectContaining({ ruleId: 'graph_invalid' })],
    })
  })

  it("repairs cross-round text without regenerating scored choices", async () => {
    const plan = passingPlan()
    const broken = JSON.parse(JSON.stringify(plan)) as WizardPlan
    broken.rounds[1].situation = 'Een nieuwe escalatie zonder verwijzing naar de eerdere keuze.'
    const stub = buildStub({
      ...stubFromPlan(broken),
      lessons: ['', JSON.stringify({ situation: plan.rounds[1].situation })],
    })

    const result = await runWizardPipeline(testConfig(), {
      llm: stub.llm,
      maxRepairAttempts: 0,
      now: () => 1,
    })
    expect(result.graph.nodes.filter(node => node.type === 'decision')).toHaveLength(2)
    expect(result.repairLog).toEqual([])
    expect(stub.calls.some(call => call.startsWith('De vorige plan overtreedt'))).toBe(false)
  })

  it("preserves scored choices when a general repair omits them", async () => {
    const good = passingPlan()
    const broken = JSON.parse(JSON.stringify(good)) as WizardPlan
    for (const round of broken.rounds) {
      for (const inject of round.injects ?? []) inject.classification = undefined
    }
    const repair = { ...good, decisions: [] }
    const stub = buildStub({
      ...stubFromPlan(broken),
      repair: JSON.stringify(repair),
    })

    const result = await runWizardPipeline(testConfig(), {
      llm: stub.llm,
      maxRepairAttempts: 1,
      now: () => 1,
    })
    expect(result.graph.nodes.filter(node => node.type === 'decision')).toHaveLength(2)
  })

  it("generates missing decisions separately and links them to their setup injects", async () => {
    const plan = passingPlan()
    const base = stubFromPlan(plan)
    const roundsWithoutLinks = plan.rounds.map(round => ({
      ...round,
      injects: round.injects?.map(inject => ({ ...inject, setsUpDecisionNodeId: undefined })),
    }))
    const stub = buildStub({
      ...base,
      rounds: roundsWithoutLinks.map(round => JSON.stringify({ round, decision: null })),
      decisions: plan.decisions!.map((decision, index) => JSON.stringify({
        decision,
        setupInjectId: roundsWithoutLinks[index].injects![0].id,
      })),
    })

    const result = await runWizardPipeline(testConfig(), {
      llm: stub.llm,
      maxRepairAttempts: 0,
      now: () => 1,
    })
    expect(result.graph.nodes.filter(node => node.type === 'decision')).toHaveLength(2)
    expect(result.repairLog).toEqual([])
  })

  it("retries a decision with an incomplete option instead of crashing the graph compiler", async () => {
    const plan = passingPlan()
    const base = stubFromPlan(plan)
    const malformedDecision = JSON.parse(JSON.stringify(plan.decisions![0])) as NonNullable<WizardPlan['decisions']>[number]
    delete (malformedDecision.options[0] as { label?: string }).label
    const stub = buildStub({
      ...base,
      rounds: [JSON.stringify({ round: plan.rounds[0], decision: malformedDecision }), base.rounds[1]],
      decisions: [JSON.stringify({ decision: plan.decisions![0], setupInjectId: 'i1' })],
    })

    const result = await runWizardPipeline(testConfig(), { llm: stub.llm, maxRepairAttempts: 0, now: () => 1 })
    expect(result.graph.nodes.filter(node => node.type === 'decision')).toHaveLength(2)
    expect(stub.calls.some(call => call.startsWith('Genereer uitsluitend het keuzemoment voor ronde 1'))).toBe(true)
  })

  it("rejects an AI response with no choices instead of returning an unusable draft", async () => {
    const plan = passingPlan()
    const base = stubFromPlan(plan)
    const stub = buildStub({
      ...base,
      rounds: plan.rounds.map(round => JSON.stringify({ round, decision: null })),
    })

    await expect(runWizardPipeline(testConfig(), {
      llm: stub.llm,
      maxRepairAttempts: 0,
      now: () => 1,
    })).rejects.toMatchObject({
      name: 'WizardPipelineError',
      failures: [expect.objectContaining({ ruleId: 'rule0_decision_per_round' })],
    })
  })

  it("repairs missing choices before returning the draft", async () => {
    const plan = passingPlan()
    const base = stubFromPlan(plan)
    const stub = buildStub({
      ...base,
      rounds: plan.rounds.map(round => JSON.stringify({ round, decision: null })),
      repair: JSON.stringify(plan),
    })

    const result = await runWizardPipeline(testConfig(), {
      llm: stub.llm,
      maxRepairAttempts: 1,
      now: () => 1,
    })
    expect(result.repairLog.map(entry => entry.ruleId)).toContain('rule0_decision_per_round')
    expect(result.graph.nodes.filter(node => node.type === 'decision')).toHaveLength(2)
  })

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
    const goodStub = stubFromPlan(good)
    // First round response: broken plan for round 1 (setups removed, violates rule 1).
    const brokenRoundsRaw = [
      JSON.stringify({ round: broken.rounds[0], decision: broken.decisions![0] }),
      goodStub.rounds[1],
    ]
    // Repair response returns the good plan wholesale.
    const repairRaw = JSON.stringify(good)

    const stub = buildStub({
      ...goodStub,
      rounds: brokenRoundsRaw,
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
    const repairRaw = JSON.stringify(broken)  // repair also broken

    const stub = buildStub({
      ...stubFromPlan(broken),
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
    const stub = buildStub(stubFromPlan(plan))
    const result = await runWizardPipeline(testConfig({ seed: 'my-seed-xyz' }), { llm: stub.llm, now: () => 1 })
    expect(result.graph.publishStatus).toBe('draft')
    expect(result.graph.wizardSeed).toBe('my-seed-xyz')
    // Inject classification is preserved through compile.
    const inj = result.graph.nodes.find(n => n.type === 'inject')
    expect((inj?.data as InjectNodeData | undefined)?.classification).toBeTruthy()
  })
})

describe("wizard pipeline — defensive parsing", () => {
  it("retries malformed outline JSON before generating any rounds", async () => {
    const plan = passingPlan()
    const base = stubFromPlan(plan)
    const stub = buildStub({ ...base, outline: '{ "rounds": [ }', outlineRetry: base.outline })

    const result = await runWizardPipeline(testConfig(), { llm: stub.llm, maxRepairAttempts: 0, now: () => 1 })
    expect(result.graph.nodes.filter(node => node.type === 'round')).toHaveLength(2)
    expect(stub.calls.filter(call => call.startsWith('Genereer eerst een OUTLINE'))).toHaveLength(2)
  })

  it("retries malformed JSON from one round without restarting the whole wizard", async () => {
    const plan = passingPlan()
    const base = stubFromPlan(plan)
    const stub = buildStub({
      ...base,
      rounds: ['{ "round": { "title": "R1" "situation": "broken" } }', base.rounds[1]],
      roundRetries: [base.rounds[0]],
    })

    const result = await runWizardPipeline(testConfig(), { llm: stub.llm, maxRepairAttempts: 0, now: () => 1 })
    expect(result.graph.nodes.filter(node => node.type === 'decision')).toHaveLength(2)
    expect(stub.calls.filter(call => call.startsWith('Genereer ronde 1'))).toHaveLength(2)
  })

  it("does not crash with 'options.map' TypeError when decision.options is not an array", async () => {
    const plan = passingPlan()
    const base = stubFromPlan(plan)
    const round0Raw = JSON.stringify({
      round: plan.rounds[0],
      decision: {
        ...plan.decisions![0],
        options: { role1: "not-an-array" },
      },
    })
    const stub = buildStub({
      ...base,
      rounds: [round0Raw, base.rounds[1]],
      repair: JSON.stringify(plan),
    })
    let caught: unknown = null
    try { await runWizardPipeline(testConfig(), { llm: stub.llm, now: () => 1 }) }
    catch (e) { caught = e }
    const msg = caught instanceof Error ? caught.message : String(caught ?? "")
    expect(msg).not.toMatch(/options\.map is not a function/)
    expect(msg).not.toMatch(/Cannot read prop.*of undefined/)
  })

  it("does not crash when round.injects is not an array", async () => {
    const plan = passingPlan()
    const base = stubFromPlan(plan)
    const badRound = { ...plan.rounds[0], injects: null as unknown as typeof plan.rounds[0]['injects'] }
    const round0Raw = JSON.stringify({ round: badRound, decision: plan.decisions![0] })
    const stub = buildStub({
      ...base,
      rounds: [round0Raw, base.rounds[1]],
      repair: JSON.stringify(plan),
    })
    let caught: unknown = null
    try { await runWizardPipeline(testConfig(), { llm: stub.llm, now: () => 1 }) }
    catch (e) { caught = e }
    const msg = caught instanceof Error ? caught.message : String(caught ?? "")
    expect(msg).not.toMatch(/injects.*is not a function/)
    expect(msg).not.toMatch(/Cannot read prop.*of null/)
  })

  it("tolerates a closer-part that returns invalid JSON — no truncation crash bubbles up", async () => {
    const plan = passingPlan()
    const base = stubFromPlan(plan)
    // Simuleer dat de briefings-call kapotte output gaf (truncated).
    const stub = buildStub({
      ...base,
      briefings: '{"roleBriefings": {"ceo": "unterminated', // kapotte JSON
      repair: JSON.stringify(plan), // valid repair zodat framework OK wordt
    })
    // De crash die we voorheen zagen was "Unterminated string in JSON at position…"
    // uit de closer-parse zelf. Die crash mag niet meer bubbelen — de tolerante
    // parser vangt hem af. Andere fouten (repair, validate) zijn OK voor deze test.
    let caught: unknown = null
    try { await runWizardPipeline(testConfig(), { llm: stub.llm, now: () => 1 }) }
    catch (e) { caught = e }
    const msg = caught instanceof Error ? caught.message : String(caught ?? "")
    expect(msg).not.toMatch(/Unterminated string in JSON/)
  })
})
