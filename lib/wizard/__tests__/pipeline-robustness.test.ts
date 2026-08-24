import { describe, it, expect } from "vitest"
import { runWizardPipeline, type LlmMessage } from "@/lib/wizard/pipeline"
import { defaultWizardConfig, type WizardConfig } from "@/lib/wizard/config"
import type { WizardPlan } from "@/lib/graph/wizard-plan"

// End-to-end robustness harness voor de wizard-pipeline.
//
// Doel: voor elke MANIER waarop de LLM broken/afwijkende output kan geven, moet
// de pipeline een leesbare fout OF een geldige graph produceren — nooit een
// cryptische crash zoals "e.outcomes is not iterable".
//
// Deze harness draait de ECHTE pipeline (planToGraph, validateFramework,
// normalizePlan) tegen een LLM-stub die verschillende failure modes simuleert.

// ── Realistic base plan ────────────────────────────────────────────────
// Een compleet, valid plan dat door alle 12 framework-regels heen komt.
// Wordt gebruikt als "goede LLM output" waarin we specifieke velden
// corrupt maken om robustness te testen.
function basePlan(): WizardPlan {
  return {
    name: "Test-scenario",
    scenarioType: "ransomware_double_extortion",
    rounds: [
      {
        title: "R1",
        situation: "Een verdacht signaal is gemeld. Team moet reageren op AVG en NIS2.",
        discussionGoal: "Test of het team feit van aanname scheidt.",
        injects: [
          {
            id: "i1", type: "alert", urgency: "high", title: "SIEM meldt egress",
            content: "Egress gedetecteerd. AVG en NIS2 mogelijk in scope.",
            classification: "feit",
            setsUpDecisionNodeId: "d1",
            triggersRegulatoryNotification: true,
          },
          {
            id: "i2", type: "social", urgency: "medium", title: "WhatsApp gerucht",
            content: "Iemand claimt insider — bron onbekend.",
            classification: "aanname",
            setsUpDecisionNodeId: "d2",
          },
        ],
      },
      {
        title: "R2",
        situation: "Team koos vorige ronde voor 'Isoleer verdacht segment' — nu volgt escalatie.",
        discussionGoal: "Bespreek escalatie.",
        injects: [
          {
            id: "i3", type: "media", urgency: "medium", title: "Pers vraagt",
            content: "Journalist wil quote.",
            classification: "feit",
          },
          {
            id: "i4", type: "internal", urgency: "low", title: "Roddel",
            content: "Onbevestigd gerucht.",
            classification: "aanname",
          },
        ],
      },
    ],
    decisions: [
      {
        afterRoundIndex: 0,
        authorId: "d1",
        prompt: "Wat doen we?",
        perRole: true,
        options: [
          { label: "Isoleer verdacht segment", allowedRole: "ciso", outcomeVector: { CONT: 2, FOR: 0, BC: -1, JUR: 0, VER: 0, KOS: 0 } },
          { label: "Wacht af", allowedRole: "ciso", outcomeVector: { CONT: -1, FOR: 0, BC: 1, JUR: 0, VER: 0, KOS: 0 } },
          { label: "Roep crisisstaat uit", allowedRole: "ceo", outcomeVector: { CONT: 0, FOR: 0, BC: 0, JUR: 0, VER: 2, KOS: -1 } },
          { label: "Wacht op meer info", allowedRole: "ceo", outcomeVector: { CONT: 0, FOR: 0, BC: 1, JUR: 0, VER: -1, KOS: 0 } },
        ],
      },
      {
        afterRoundIndex: 1,
        authorId: "d2",
        prompt: "Vervolgstappen?",
        perRole: true,
        options: [
          { label: "Betrek juristen", allowedRole: "ciso", outcomeVector: { CONT: 0, FOR: 0, BC: 0, JUR: 2, VER: 0, KOS: -1 } },
          { label: "Ga zelfstandig verder", allowedRole: "ciso", outcomeVector: { CONT: 1, FOR: 0, BC: 0, JUR: -1, VER: 0, KOS: 0 } },
          { label: "Informeer board", allowedRole: "ceo", outcomeVector: { CONT: 0, FOR: 0, BC: 0, JUR: 0, VER: 1, KOS: -1 } },
          { label: "Wacht op advies", allowedRole: "ceo", outcomeVector: { CONT: 0, FOR: 0, BC: 1, JUR: 0, VER: -1, KOS: 0 } },
        ],
      },
    ],
    outcomes: [
      { key: "excellent", label: "Voorbeeldig", narrative: "Alles goed", scoreRange: { min: 5 } },
      { key: "middel", label: "Gemiddeld", narrative: "Redelijk", scoreRange: { min: -2, max: 4 } },
      { key: "slecht", label: "Slecht", narrative: "Escalatie", scoreRange: { max: -3 } },
    ],
    roleBriefings: {
      ceo: { text: "CEO-briefing.", playbookGaps: ["crisismandaat niet vastgelegd"] },
    },
  }
}

// ── LLM stub builder ────────────────────────────────────────────────
// Kernidee: bouw stub-responses uit een plan, en laat de test specifieke
// closer-parts of repair-response overriden om broken output te simuleren.
interface StubOverrides {
  outline?: string
  rounds?: string[]         // per-round raw response, index-matched
  meta?: string             // { name, scenarioType, irPlaybook, outcomes }
  briefings?: string        // { roleBriefings }
  injects?: string          // { injectLibrary }
  repair?: string           // repair-pass response
}

function stubLlm(plan: WizardPlan, overrides: StubOverrides = {}) {
  const defaults: Required<StubOverrides> = {
    outline: JSON.stringify({ rounds: plan.rounds.map(r => ({ title: r.title, situation: r.situation })) }),
    rounds: plan.rounds.map((r, i) => JSON.stringify({ round: r, decision: plan.decisions?.[i] ?? null })),
    meta: JSON.stringify({ name: plan.name, scenarioType: plan.scenarioType, outcomes: plan.outcomes, irPlaybook: plan.irPlaybook }),
    briefings: JSON.stringify({ roleBriefings: plan.roleBriefings ?? {} }),
    injects: JSON.stringify({ injectLibrary: plan.injectLibrary ?? [] }),
    repair: JSON.stringify(plan),
  }
  const resp = { ...defaults, ...overrides }
  return async (messages: LlmMessage[]) => {
    const last = messages[messages.length - 1]?.content ?? ""
    if (last.startsWith("Genereer ronde ")) {
      const match = last.match(/^Genereer ronde (\d+)/)
      const idx = match ? Math.max(0, Number(match[1]) - 1) : 0
      return resp.rounds[idx] ?? resp.rounds[resp.rounds.length - 1] ?? ""
    }
    if (last.startsWith("Genereer eerst een OUTLINE")) return resp.outline
    if (last.startsWith("De vorige plan overtreedt")) return resp.repair
    if (last.includes('"roleBriefings"')) return resp.briefings
    if (last.includes('"injectLibrary"')) return resp.injects
    if (last.includes('"outcomes"') || last.includes('"scenarioType"')) return resp.meta
    return ""
  }
}

function testConfig(over: Partial<WizardConfig> = {}): WizardConfig {
  return {
    ...defaultWizardConfig(),
    clientName: "Test-klant",
    sector: "zorg",
    itArrangement: "eigen IT",
    rounds: 2,
    injectsPerRound: 2,
    optionsPerRolePerRound: 2,
    factsNoiseRatio: 0.5,
    rolesIncluded: ["ceo", "ciso"],
    specialConditions: [],
    seed: "fixed-seed",
    ...over,
  }
}

// Helper: run pipeline, return either graph or the thrown error message.
async function runOrCatch(config: WizardConfig, llm: ReturnType<typeof stubLlm>): Promise<{ ok: true; msg: string } | { ok: false; msg: string }> {
  try {
    const r = await runWizardPipeline(config, { llm, now: () => 1, maxRepairAttempts: 1 })
    return { ok: true, msg: `graph with ${r.graph.nodes.length} nodes` }
  } catch (err) {
    return { ok: false, msg: err instanceof Error ? err.message : String(err) }
  }
}

// ── Test scenarios ───────────────────────────────────────────────────
describe("wizard pipeline — robust against broken LLM output", () => {

  it("repair-pass returns plan with outcomes:null — should not crash with 'not iterable'", async () => {
    // Simuleer: eerste plan faalt validate; repair-pass geeft plan terug
    // waarin de LLM 'outcomes' als null teruggaf. Dit was de crash uit ref
    // 260190c3.
    const broken = basePlan()
    // Break rule 1 (setup) so validate fails and repair triggers.
    for (const inj of broken.rounds[0].injects ?? []) {
      inj.setsUpDecisionNodeId = undefined
    }
    const repairWithNullOutcomes = { ...(JSON.parse(JSON.stringify(basePlan())) as WizardPlan), outcomes: null as unknown as WizardPlan['outcomes'] }

    const llm = stubLlm(broken, { repair: JSON.stringify(repairWithNullOutcomes) })
    const r = await runOrCatch(testConfig(), llm)
    expect(r.msg).not.toMatch(/is not iterable/)
    expect(r.msg).not.toMatch(/Cannot read prop.*of null/)
  })

  it("repair-pass returns plan with outcomes missing entirely — no crash", async () => {
    const broken = basePlan()
    for (const inj of broken.rounds[0].injects ?? []) inj.setsUpDecisionNodeId = undefined
    const repairNoOutcomes = JSON.parse(JSON.stringify(basePlan())) as Partial<WizardPlan>
    delete repairNoOutcomes.outcomes

    const llm = stubLlm(broken, { repair: JSON.stringify(repairNoOutcomes) })
    const r = await runOrCatch(testConfig(), llm)
    expect(r.msg).not.toMatch(/is not iterable/)
    expect(r.msg).not.toMatch(/Cannot read prop/)
  })

  it("repair-pass returns plan with decisions:null — no crash", async () => {
    const broken = basePlan()
    for (const inj of broken.rounds[0].injects ?? []) inj.setsUpDecisionNodeId = undefined
    const repair = { ...(JSON.parse(JSON.stringify(basePlan())) as WizardPlan), decisions: null as unknown as WizardPlan['decisions'] }

    const llm = stubLlm(broken, { repair: JSON.stringify(repair) })
    const r = await runOrCatch(testConfig(), llm)
    expect(r.msg).not.toMatch(/is not iterable/)
    expect(r.msg).not.toMatch(/Cannot read prop/)
  })

  it("repair-pass returns plan with injectLibrary:null — no crash", async () => {
    const broken = basePlan()
    for (const inj of broken.rounds[0].injects ?? []) inj.setsUpDecisionNodeId = undefined
    const repair = { ...(JSON.parse(JSON.stringify(basePlan())) as WizardPlan), injectLibrary: null as unknown as WizardPlan['injectLibrary'] }

    const llm = stubLlm(broken, { repair: JSON.stringify(repair) })
    const r = await runOrCatch(testConfig(), llm)
    expect(r.msg).not.toMatch(/is not iterable/)
    expect(r.msg).not.toMatch(/Cannot read prop/)
  })

  it("meta closer-part returns outcomes:null — no crash on first planToGraph", async () => {
    const plan = basePlan()
    const brokenMeta = JSON.stringify({ name: plan.name, scenarioType: plan.scenarioType, outcomes: null, irPlaybook: plan.irPlaybook })
    const llm = stubLlm(plan, { meta: brokenMeta })
    const r = await runOrCatch(testConfig(), llm)
    expect(r.msg).not.toMatch(/is not iterable/)
  })

  it("round-response returns decision.options as object (not array) — no crash", async () => {
    const plan = basePlan()
    const brokenRound = JSON.stringify({
      round: plan.rounds[0],
      decision: { ...plan.decisions![0], options: { role_1: "not-an-array" } },
    })
    const rounds = [brokenRound, JSON.stringify({ round: plan.rounds[1], decision: plan.decisions![1] })]
    const llm = stubLlm(plan, { rounds })
    const r = await runOrCatch(testConfig(), llm)
    expect(r.msg).not.toMatch(/options\.map is not a function/)
    expect(r.msg).not.toMatch(/is not iterable/)
  })

  it("outline pass returns wrong number of rounds — throws readable error", async () => {
    const plan = basePlan()
    const badOutline = JSON.stringify({ rounds: [{ title: "R1", situation: "s" }] })  // only 1 round for config asking 2
    const llm = stubLlm(plan, { outline: badOutline })
    const r = await runOrCatch(testConfig(), llm)
    expect(r.ok).toBe(false)
    expect(r.msg).toMatch(/Outline pass produced/)
    expect(r.msg).not.toMatch(/is not iterable/)
  })

  it("per-round response returns malformed JSON — throws readable error", async () => {
    const plan = basePlan()
    const llm = stubLlm(plan, { rounds: ["{unterminated", JSON.stringify({ round: plan.rounds[1], decision: plan.decisions![1] })] })
    const r = await runOrCatch(testConfig(), llm)
    expect(r.ok).toBe(false)
    // Any parse-error is OK; what we don't want is an unhandled TypeError.
    expect(r.msg).not.toMatch(/is not iterable/)
    expect(r.msg).not.toMatch(/Cannot read prop.*of undefined/)
  })

  it("repair-pass returns rounds:null — no crash", async () => {
    const broken = basePlan()
    for (const inj of broken.rounds[0].injects ?? []) inj.setsUpDecisionNodeId = undefined
    const repair = { ...(JSON.parse(JSON.stringify(basePlan())) as WizardPlan), rounds: null as unknown as WizardPlan['rounds'] }

    const llm = stubLlm(broken, { repair: JSON.stringify(repair) })
    const r = await runOrCatch(testConfig(), llm)
    expect(r.msg).not.toMatch(/is not iterable/)
    expect(r.msg).not.toMatch(/Cannot read prop/)
  })

  it("happy path completes with valid plan (baseline sanity)", async () => {
    const plan = basePlan()
    const llm = stubLlm(plan)
    const r = await runOrCatch(testConfig(), llm)
    expect(r.ok).toBe(true)
  })
})
