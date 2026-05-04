import { NextResponse } from "next/server"
import type { ExerciseConfig, SimulationMode, AiIntensity, Scenario } from "@/lib/types"
export const dynamic = "force-dynamic"
export const runtime = "nodejs"

function buildContext(c: ExerciseConfig): string {
  const parts = [
    `sector=${c.sector}`,
    `size=${c.companySize}`,
    `type=${c.scenarioType}`,
    `systems=${c.criticalSystems}`,
    `crown=${c.crownJewels}`,
  ]
  if (c.itMaturity) parts.push(`it_maturity=${c.itMaturity}`)
  if (c.securityCapability) parts.push(`security_capability=${c.securityCapability}`)
  if (c.exerciseGoal) parts.push(`goal=${c.exerciseGoal}`)
  if (c.teamStructure) parts.push(`team_structure=${c.teamStructure}`)
  if (c.difficulty) parts.push(`difficulty=${c.difficulty}`)
  if (c.existingPlans?.length) parts.push(`existing_plans=${c.existingPlans.join(',')}`)
  parts.push(`duration=${c.duration}`)
  return parts.join(', ')
}

async function generateLean(config: ExerciseConfig, apiKey: string) {
  const roundCount = config.roundCount ?? 4
  const timerPerRound = config.timerPerRound ?? 15
  const irCtx = config.irTemplateText
    ? `\nIR plan excerpt:\n${config.irTemplateText.slice(0, 3000)}`
    : ""
  const prompt = `You are a cybersecurity exercise designer for MKB+ organizations. Generate a ${roundCount}-round ${config.scenarioType} scenario for: ${buildContext(config)}${irCtx}

Return ONLY valid JSON (no markdown):
{"scenario_title":"...","scenario_summary":"1-2 sentence summary","rounds":[{"round_number":1,"title":"...","situation_update":"2-3 sentence situation for facilitator","timerMinutes":${timerPerRound}},{"round_number":2,...}]}`

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: "claude-haiku-4-5",
      max_tokens: 800,
      messages: [{ role: "user", content: prompt }],
    }),
  })
  if (!res.ok) return null
  const data = await res.json() as { content: Array<{ type: string; text: string }> }
  const text = data.content?.find(b => b.type === "text")?.text ?? ""
  return JSON.parse(text.replace(/```json|```/g, "").trim())
}

async function generateFull(config: ExerciseConfig, apiKey: string) {
  const roundCount = config.roundCount ?? 4
  const timerPerRound = config.timerPerRound ?? 15
  const existingPlans = config.existingPlans?.length ? config.existingPlans.join(', ') : 'none documented'
  const irPlanContext = config.irTemplateText
    ? `\nClient IR plan:\n<ir_plan>\n${config.irTemplateText.slice(0, 6000)}\n</ir_plan>`
    : ""

  const secCapabilityNote = {
    no_soc: "This organization has NO internal SOC and no dedicated IR capability.",
    small_it: "This organization has a small IT team only, no dedicated security function.",
    outsourced_it: "This organization relies entirely on outsourced IT. Internal IT knowledge is limited.",
    it_mssp: "This organization has IT + MSSP. The MSSP handles monitoring and alerts.",
    it_ir_retainer: "This organization has IT + an external IR retainer on contract.",
  }[config.securityCapability ?? "small_it"] ?? ""

  const irAlignedNote = config.irTemplateText
    ? `- "irPlanAligned": true means the action is consistent with the uploaded IR plan above. false means it deviates from it.`
    : `- "irPlanAligned": true means the action follows industry best practice for this type of incident. false means it is objectively risky or inadvisable (e.g. paying ransom without authorization, resuming systems before forensics, making premature public statements). Do NOT reference a specific IR plan — no plan has been uploaded. Base this flag purely on recognized crisis-response best practice.`

  const prompt = `You are a senior IR exercise designer for MKB+ organizations. Generate a realistic, narrative-coherent ${config.scenarioType} incident scenario.

Organization profile:
- Sector: ${config.sector}, Size: ${config.companySize}, IT maturity: ${config.itMaturity ?? "medium"}
- Security capability: ${config.securityCapability ?? "small_it"}
- Exercise goal: ${config.exerciseGoal ?? "ransomware_tabletop"}, Difficulty: ${config.difficulty ?? "intermediate"}
- Team structure: ${config.teamStructure ?? "crisis_it"}
- Existing plans: ${existingPlans}
- Crown jewels: ${config.crownJewels}, Critical systems: ${config.criticalSystems}
${irPlanContext}

Important constraints:
- ${secCapabilityNote}
- The customer's role is: make decisions, escalate timely, approve actions, communicate, follow IR plan
- The IR retainer handles: investigation, containment, forensics, malware analysis
- Generate exactly ${roundCount} rounds with ${timerPerRound} minute timers
- Each round MUST build logically on the previous
- Round 1: Early warning signs / initial detection
- Round 2: Triage and uncertainty, business impact begins
- Round 3: Escalation, external stakeholder pressure
- Round ${roundCount}: Decision point — containment/recovery trade-off and consequences
- Every roleActions array MUST include a "do_nothing" option
- ${irAlignedNote}
- Do NOT hallucinate the contents of any plan. If no IR plan was provided, only mark irPlanAligned: false for clearly inadvisable actions.
- consequence: describe the realistic outcome of this action (neutral, not preachy). Never say "this violates the IR plan" unless an IR plan was provided.

Return ONLY valid JSON:
{
  "scenario_title": "...",
  "scenario_summary": "2-3 sentences",
  "rounds": [{
    "round_number": 1,
    "title": "...",
    "situation_update": "3-4 sentences for facilitator",
    "timerMinutes": ${timerPerRound},
    "facilitatorNotes": {
      "discussionGoal": "...",
      "keyQuestions": ["...", "..."],
      "hints": ["...", "..."],
      "expectedDecisions": ["...", "..."],
      "redFlags": ["...", "..."]
    },
    "injects": [{
      "id": "r1-i1",
      "type": "alert|intel|media|executive|technical|regulatory|social|internal",
      "channel": "whatsapp|slack|email|siem_alert|sms|phone|news_ticker|system_alert|raw",
      "title": "...",
      "content": "...",
      "urgency": "low|medium|high|critical",
      "source": "...",
      "senderName": "...",
      "senderHandle": "...",
      "timestamp": "HH:MM",
      "targetTeam": "all|crisis_management|technical_it",
      "nis2Relevant": false
    }],
    "roleActions": [{
      "id": "r1-a1",
      "label": "...",
      "description": "...",
      "allowedRoles": ["ciso", "it_manager"],
      "isRecommended": true,
      "irPlanAligned": true,
      "consequence": "..."
    }, {
      "id": "r1-do-nothing",
      "label": "Do nothing / wait for more information",
      "description": "Gather more facts before acting. Ask IR retainer for assessment.",
      "allowedRoles": [],
      "irPlanAligned": true,
      "consequence": "May be correct at this stage — avoids premature action. Risky if detection was already clear."
    }]
  }]
}`

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 4500,
      messages: [{ role: "user", content: prompt }],
    }),
  })
  if (!res.ok) return null
  const data = await res.json() as { content: Array<{ type: string; text: string }> }
  const text = data.content?.find(b => b.type === "text")?.text ?? ""
  return JSON.parse(text.replace(/```json|```/g, "").trim())
}

async function generateWithAI(config: ExerciseConfig): Promise<{ scenario: Scenario; intensity: AiIntensity } | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return null
  const intensity = config.aiIntensity ?? "full"
  if (intensity === "off") return null

  try {
    if (intensity === "lean") {
      const { generateScenario } = await import("@/lib/scenario-generator")
      const base = generateScenario(config)
      const aiMeta = await generateLean(config, apiKey)
      if (!aiMeta) return null
      const rounds = base.rounds.map((r, i) => {
        const aiRound = aiMeta.rounds?.[i] as { title?: string; situation_update?: string; timerMinutes?: number } | undefined
        return {
          ...r,
          title: aiRound?.title ?? r.title,
          situation_update: aiRound?.situation_update ?? r.situation_update,
          timerMinutes: aiRound?.timerMinutes ?? r.timerMinutes,
        }
      })
      return {
        scenario: { ...base, scenario_title: aiMeta.scenario_title ?? base.scenario_title, scenario_summary: aiMeta.scenario_summary ?? base.scenario_summary, rounds } as Scenario,
        intensity: "lean" as const,
      }
    }

    const scenario = await generateFull(config, apiKey) as Scenario | null
    if (!scenario) return null
    return { scenario, intensity: "full" as const }
  } catch {
    return null
  }
}

export async function POST(req: Request) {
  const body = (await req.json()) as Partial<ExerciseConfig> & { mode?: string }
  const config: ExerciseConfig = {
    sector: body.sector?.toString() ?? "",
    companySize: body.companySize?.toString() ?? "",
    criticalSystems: body.criticalSystems?.toString() ?? "",
    crownJewels: body.crownJewels?.toString() ?? "",
    irMaturity: body.irMaturity?.toString() ?? "",
    scenarioType: body.scenarioType?.toString() ?? "",
    duration: body.duration?.toString() ?? "",
    teams: body.teams?.toString() ?? "",
    irTemplateText: body.irTemplateText?.toString(),
    aiIntensity: (body.aiIntensity as AiIntensity | undefined) ?? "off",
    itMaturity: body.itMaturity,
    securityCapability: body.securityCapability,
    existingPlans: Array.isArray(body.existingPlans) ? body.existingPlans : undefined,
    exerciseGoal: body.exerciseGoal,
    teamStructure: body.teamStructure,
    teamCount: typeof body.teamCount === "number" ? body.teamCount : undefined,
    roundCount: typeof body.roundCount === "number" ? body.roundCount : undefined,
    timerPerRound: typeof body.timerPerRound === "number" ? body.timerPerRound : undefined,
    difficulty: body.difficulty,
    realism: body.realism,
    dynamicBranching: typeof body.dynamicBranching === "boolean" ? body.dynamicBranching : undefined,
  }
  const mode: SimulationMode = body.mode === "event" ? "event" : "training"

  const aiResult = await generateWithAI(config)
  let scenario = aiResult?.scenario ?? null
  if (!scenario) {
    const { generateScenario } = await import("@/lib/scenario-generator")
    scenario = generateScenario(config)
  }

  const { createSession } = await import("@/lib/session-store")
  const session = await createSession(config, scenario, mode)
  return NextResponse.json({
    ok: true,
    sessionId: session.id,
    joinCode: session.joinCode,
    aiGenerated: !!aiResult,
    aiIntensity: aiResult?.intensity ?? "off",
  })
}
