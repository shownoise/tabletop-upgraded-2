import { NextResponse } from "next/server"
import type { ExerciseConfig } from "@/lib/types"
export const dynamic = "force-dynamic"
export const runtime = "nodejs"

async function generateWithAI(config: ExerciseConfig) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return null
  const irContext = config.irTemplateText ? `\n\nClient IR plan:\n<ir_plan>\n${config.irTemplateText.slice(0, 8000)}\n</ir_plan>` : ""
  const prompt = `You are a senior cybersecurity tabletop exercise designer. Generate a realistic scenario as JSON.\n\nConfig: sector=${config.sector}, size=${config.companySize}, type=${config.scenarioType}, systems=${config.criticalSystems}, crown=${config.crownJewels}, maturity=${config.irMaturity}, teams=${config.teams}, duration=${config.duration}${irContext}\n\nReturn ONLY valid JSON with: scenario_title, scenario_summary, rounds[]{round_number,title,situation_update,timerMinutes,facilitatorNotes{discussionGoal,keyQuestions[],hints[],expectedDecisions[],redFlags[]},injects[]{id,type,channel,title,content,urgency,source,senderName,senderHandle,timestamp}}\n\n4 rounds, 3-5 injects each, channels: whatsapp/slack/email/siem_alert/sms/phone/news_ticker/system_alert/raw`
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 4000, messages: [{ role: "user", content: prompt }] }),
    })
    if (!res.ok) return null
    const data = await res.json() as { content: Array<{ type: string; text: string }> }
    const text = data.content?.find(b => b.type === "text")?.text ?? ""
    return JSON.parse(text.replace(/```json|```/g, "").trim())
  } catch { return null }
}

export async function POST(req: Request) {
  const body = (await req.json()) as Partial<ExerciseConfig>
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
  }
  let scenario = null
  let aiGenerated = false
  try { scenario = await generateWithAI(config); if (scenario) aiGenerated = true } catch {}
  if (!scenario) { const { generateScenario } = await import("@/lib/scenario-generator"); scenario = generateScenario(config) }
  const { createSession } = await import("@/lib/session-store")
  const session = await createSession(config, scenario)
  return NextResponse.json({ ok: true, sessionId: session.id, joinCode: session.joinCode, aiGenerated })
}
