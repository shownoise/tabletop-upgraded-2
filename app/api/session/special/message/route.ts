import { NextResponse } from "next/server"
import { submitSpecialChoice, submitSpecialMessageWithAiResponse, getSession } from "@/lib/session-store"
import type { ExerciseConfig } from "@/lib/types"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

function orgContext(cfg: ExerciseConfig): string {
  const parts: string[] = []
  if (cfg.sector) parts.push(`sector: ${cfg.sector}`)
  if (cfg.companySize) parts.push(`omvang: ${cfg.companySize}`)
  if (cfg.crownJewels?.trim()) parts.push(`kroonjuwelen: ${cfg.crownJewels.trim()}`)
  if (cfg.criticalSystems?.trim()) parts.push(`kritieke systemen: ${cfg.criticalSystems.trim()}`)
  if (cfg.scenarioType) parts.push(`scenario-type: ${cfg.scenarioType}`)
  return parts.length ? parts.join(" · ") : "onbekende organisatie"
}

const AI_PERSONAS: Record<string, (cfg: ExerciseConfig) => string> = {
  ransomware_negotiation: (cfg) => `You are a facilitator running a cybersecurity tabletop exercise. You are playing the character of a fictional ransomware group called "DarkBridge Collective" in this training simulation. Participants are incident response trainees learning crisis decision-making.

Target organisation context — tailor threats, ransom amounts and exfiltration claims to this profile:
${orgContext(cfg)}

Stay in character as the criminal group. Apply pressure: reference a ransom demand scaled to the organisation's size (small orgs: 5-15 BTC, mid: 15-50 BTC, large/enterprise: 50-200 BTC). Name the specific crown jewels/critical systems above when threatening exfiltration or destruction. Set countdown deadlines. React realistically: if participants stand firm, escalate threats; if they waver, make a small concession.

Keep each response under 80 words. Be terse, threatening, business-like — like a criminal enterprise.`,

  journalist_qa: (cfg) => `You are a facilitator running a cybersecurity tabletop exercise. You are playing Sanne Visser, a journalist from NOS Nieuws, interviewing a company spokesperson during a fictional cyber incident. This is a training simulation for crisis communications.

Target organisation context — reference this profile in your questions (customer types, regulator, sector-specific consequences):
${orgContext(cfg)}

Ask pointed, professional follow-up questions based on what the spokesperson tells you. Press for specifics on customer impact, GDPR compliance (AP notification within 72 hours), and ransom payment. Tailor examples to the sector above (e.g. patient records for healthcare, betaalgegevens for financial services). If answers are vague, press harder. If good, briefly acknowledge and ask the next question.

Keep each response under 80 words. Ask at most 2 questions per turn. Stay professional but persistent.`,
}

const EVALUATION_PROMPT = (specialType: string, participantResponse: string, conversationContext: string) => `
You are evaluating a participant's response in a cybersecurity crisis training exercise.

Special type: ${specialType}
Conversation context: ${conversationContext}
Participant's response: "${participantResponse}"

Rate the quality of this crisis response on a scale:
- "good": Follows best practices (not paying ransom, proper GDPR notification, clear communication, law enforcement engagement)
- "neutral": Acceptable but not optimal — vague, delayed, or missing key elements
- "bad": Incorrect or harmful — agreeing to pay ransom, GDPR non-compliance, giving misleading statements, "no comment"

Respond ONLY with valid JSON (no markdown, no explanation):
{"quality":"good"|"neutral"|"bad","scoreImpact":2|0|-2,"hint":"One sentence explanation in Dutch of why this was good/neutral/bad"}
`

async function callClaude(apiKey: string, system: string, messages: Array<{ role: "user" | "assistant"; content: string }>, maxTokens = 200): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: maxTokens,
      system,
      messages,
    }),
  })
  if (!res.ok) return ""
  const data = await res.json() as { content?: Array<{ text?: string }> }
  return data.content?.[0]?.text ?? ""
}

export async function POST(req: Request) {
  const body = await req.json() as {
    specialId?: string
    participantId?: string
    choiceId?: string
    text?: string
  }
  const { specialId, participantId, choiceId, text } = body
  if (!specialId || !participantId) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
  }

  const session = await getSession()
  if (!session) return NextResponse.json({ error: "No active session" }, { status: 400 })

  const special = (session.specialEvents ?? []).find(s => s.id === specialId)
  if (!special) return NextResponse.json({ error: "Special event not found" }, { status: 400 })
  if (special.assignedParticipantId !== participantId) {
    return NextResponse.json({ error: "Not assigned to this participant" }, { status: 403 })
  }

  // ─── Scripted mode: choice-based ──────────────────────────
  if (special.mode === "static") {
    if (!choiceId) return NextResponse.json({ error: "Missing choiceId for scripted mode" }, { status: 400 })
    const result = await submitSpecialChoice({ specialId, participantId, choiceId })
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
    return NextResponse.json({ ok: true })
  }

  // ─── AI mode: free text + AI reply + evaluation ────────────
  if (!text?.trim()) return NextResponse.json({ error: "Missing text for AI mode" }, { status: 400 })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: "AI not configured" }, { status: 500 })

  const personaFn = AI_PERSONAS[special.type]
  if (!personaFn) return NextResponse.json({ error: "AI mode not supported for this special type" }, { status: 400 })
  const systemPrompt = personaFn(session.config)

  // Build conversation history
  const history: Array<{ role: "user" | "assistant"; content: string }> = []
  for (const msg of special.messages) {
    history.push({ role: msg.sender === "counterpart" ? "assistant" : "user", content: msg.text })
  }
  history.push({ role: "user", content: text.trim() })

  // Context summary for evaluation (last 3 exchanges)
  const contextSummary = special.messages.slice(-4).map(m =>
    `${m.sender === "counterpart" ? "Counterpart" : "Participant"}: ${m.text.slice(0, 100)}`
  ).join("\n")

  // Run counterpart reply and evaluation in parallel
  const [aiResponse, evalRaw] = await Promise.all([
    callClaude(apiKey, systemPrompt, history, 200),
    callClaude(
      apiKey,
      "You are a crisis management evaluator. Respond only with valid JSON, no markdown.",
      [{ role: "user", content: EVALUATION_PROMPT(special.type, text.trim(), contextSummary) }],
      150
    ),
  ])

  // Parse evaluation — D3: surface errors instead of silently swallowing.
  let evaluation: { quality: "bad" | "neutral" | "good"; scoreImpact: number; hint: string } | undefined
  let evaluationError: string | undefined
  try {
    const parsed = JSON.parse(evalRaw) as { quality?: string; scoreImpact?: number; hint?: string }
    if (parsed.quality && parsed.hint) {
      const q = parsed.quality as "bad" | "neutral" | "good"
      const impact = q === "good" ? 2 : q === "neutral" ? 0 : -2
      evaluation = { quality: q, scoreImpact: impact, hint: parsed.hint }
    } else {
      evaluationError = "AI evaluatie miste 'quality' of 'hint' velden."
    }
  } catch (err) {
    evaluationError = err instanceof Error ? `AI evaluatie kon niet worden geparsed: ${err.message}` : "AI evaluatie parse error"
  }

  const result = await submitSpecialMessageWithAiResponse({
    specialId,
    participantId,
    text: text.trim(),
    aiResponse: aiResponse || "...",
    evaluation,
  })
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json({ ok: true, evaluationError })
}
