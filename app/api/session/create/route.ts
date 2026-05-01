import { NextResponse } from "next/server"
import type { ExerciseConfig, SimulationMode, AiIntensity } from "@/lib/types"
export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const CTX = (c: ExerciseConfig) =>
  `sector=${c.sector}, size=${c.companySize}, type=${c.scenarioType}, systems=${c.criticalSystems}, crown=${c.crownJewels}, maturity=${c.irMaturity}, duration=${c.duration}`

async function generateLean(config: ExerciseConfig, apiKey: string) {
  const irCtx = config.irTemplateText
    ? `\nIR plan excerpt:\n${config.irTemplateText.slice(0, 3000)}`
    : ""
  const prompt = `You are a cybersecurity exercise designer. Generate a 4-round ${config.scenarioType} scenario for: ${CTX(config)}${irCtx}

Return ONLY valid JSON (no markdown):
{"scenario_title":"...","scenario_summary":"1-2 sentence summary","rounds":[{"round_number":1,"title":"...","situation_update":"2-3 sentence situation for facilitator","timerMinutes":15},{"round_number":2,...},{"round_number":3,...},{"round_number":4,...}]}`

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: "claude-haiku-4-5",
      max_tokens: 600,
      messages: [{ role: "user", content: prompt }],
    }),
  })
  if (!res.ok) return null
  const data = await res.json() as { content: Array<{ type: string; text: string }> }
  const text = data.content?.find(b => b.type === "text")?.text ?? ""
  return JSON.parse(text.replace(/```json|```/g, "").trim())
}

async function generateFull(config: ExerciseConfig, apiKey: string) {
  const irCtx = config.irTemplateText
    ? `\nClient IR plan:\n<ir_plan>\n${config.irTemplateText.slice(0, 6000)}\n</ir_plan>`
    : ""
  const prompt = `You are a senior cybersecurity tabletop exercise designer. Generate a realistic scenario as JSON.

Config: ${CTX(config)}${irCtx}

Return ONLY valid JSON:
{"scenario_title":"...","scenario_summary":"...","rounds":[{"round_number":1,"title":"...","situation_update":"...","timerMinutes":15,"facilitatorNotes":{"discussionGoal":"...","keyQuestions":["..."],"hints":["..."],"expectedDecisions":["..."],"redFlags":["..."]},"injects":[{"id":"r1-i1","type":"alert","channel":"siem_alert","title":"...","content":"...","urgency":"high","source":"...","senderName":"...","timestamp":"09:00"}]},...]}

4 rounds, 3-4 injects each. Channels: whatsapp/slack/email/siem_alert/sms/phone/news_ticker/system_alert. Urgency: low/medium/high/critical.`

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 3500,
      messages: [{ role: "user", content: prompt }],
    }),
  })
  if (!res.ok) return null
  const data = await res.json() as { content: Array<{ type: string; text: string }> }
  const text = data.content?.find(b => b.type === "text")?.text ?? ""
  return JSON.parse(text.replace(/```json|```/g, "").trim())
}

// Lean: AI provides titles/narrative; mock generator provides injects & role actions
async function generateWithAI(config: ExerciseConfig): Promise<{ scenario: object; intensity: AiIntensity } | null> {
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
      // Overlay AI titles/situation updates onto mock-generated rounds
      const rounds = (base.rounds as Array<Record<string, unknown>>).map((r, i) => {
        const aiRound = aiMeta.rounds?.[i]
        return {
          ...r,
          title: aiRound?.title ?? r.title,
          situation_update: aiRound?.situation_update ?? r.situation_update,
          timerMinutes: aiRound?.timerMinutes ?? r.timerMinutes,
        }
      })
      return {
        scenario: { ...base, scenario_title: aiMeta.scenario_title ?? base.scenario_title, scenario_summary: aiMeta.scenario_summary ?? base.scenario_summary, rounds },
        intensity: "lean",
      }
    }

    // full
    const scenario = await generateFull(config, apiKey)
    if (!scenario) return null
    return { scenario, intensity: "full" }
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
