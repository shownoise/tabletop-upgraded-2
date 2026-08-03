import { NextResponse } from "next/server"
import { requireFacilitator } from "@/lib/auth-guard"
import { loadScenarioGraph } from "@/lib/session-store"
import type { InjectNodeData, RoundNodeData } from "@/lib/graph/types"
import { fetchWithTimeout } from "@/lib/fetch-with-timeout"
import { rateLimit } from "@/lib/rate-limit"
import { z } from "zod"

const AiFillSchema = z.object({
  title: z.string().max(300).optional(),
  situation_update: z.string().max(4000).optional(),
  timerMinutes: z.number().int().min(1).max(120).optional(),
})

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

interface Body {
  graphId?: string
  nodeId?: string
  hint?: string
}

export async function POST(req: Request) {
  const gate = await requireFacilitator()
  if (!gate.ok) return gate.response

  const userId = (gate.session?.user as { id?: string } | undefined)?.id ?? "unknown"
  const rl = await rateLimit(`ai:${userId}`, 10, 60)
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many AI requests. Please wait a minute." }, {
      status: 429,
      headers: { "Retry-After": String(rl.resetSeconds) },
    })
  }

  const body = await req.json() as Body
  if (!body.graphId || !body.nodeId) {
    return NextResponse.json({ error: "Missing graphId or nodeId" }, { status: 400 })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY is not set" }, { status: 500 })
  }

  const graph = await loadScenarioGraph(body.graphId)
  if (!graph) return NextResponse.json({ error: "Graph not found" }, { status: 404 })

  const target = graph.nodes.find(n => n.id === body.nodeId)
  if (!target || target.type !== "round") {
    return NextResponse.json({ error: "Node is not a round" }, { status: 400 })
  }

  const priorRounds = describeRoundsBefore(graph, body.nodeId)
  const injectSiblings = graph.edges
    .filter(e => e.source === body.nodeId && e.type === "inject")
    .map(e => graph.nodes.find(n => n.id === e.target))
    .filter((n): n is (typeof graph.nodes)[number] => !!n)
    .map(n => (n.data as InjectNodeData))

  const prompt = `Je bent een cyber-tabletop scenarioschrijver. Genereer content in het Nederlands voor één ronde in een crisisscenario.

Scenario-type: ${graph.scenarioType}
Scenario-naam: ${graph.name}

${priorRounds.length ? `Voorgaande rondes in dit scenario:\n${priorRounds}\n` : "Dit is de eerste ronde."}

${injectSiblings.length ? `Deze ronde heeft al ${injectSiblings.length} inject(s):\n${injectSiblings.map(i => `- ${i.title}: ${i.content?.slice(0, 100) ?? ""}`).join("\n")}` : ""}

${body.hint ? `Hint van de facilitator: ${body.hint}` : ""}

Geef ALLEEN geldige JSON terug (geen markdown, geen uitleg):
{
  "title": "Korte, prikkelende titel (max 8 woorden)",
  "situation_update": "3-4 zinnen die de situatie voor de facilitator beschrijven",
  "timerMinutes": 15
}`

  const res = await fetchWithTimeout("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 800,
      messages: [{ role: "user", content: prompt }],
    }),
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => "")
    console.error("[ai-fill] Anthropic error:", res.status, detail.slice(0, 500))
    return NextResponse.json({ error: "AI request failed" }, { status: 502 })
  }

  const data = await res.json() as { content: Array<{ type: string; text: string }> }
  const text = data.content?.find(b => b.type === "text")?.text ?? ""

  let raw: unknown
  try {
    raw = JSON.parse(text.replace(/```json|```/g, "").trim())
  } catch {
    return NextResponse.json({ error: "AI response was not valid JSON" }, { status: 502 })
  }
  const parsed = AiFillSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: "AI response did not match expected schema" }, { status: 502 })
  }
  const filled: RoundNodeData = {
    ...(target.data as RoundNodeData),
    kind: "round",
    title: parsed.data.title ?? (target.data as RoundNodeData).title,
    situation_update: parsed.data.situation_update ?? (target.data as RoundNodeData).situation_update,
    timerMinutes: parsed.data.timerMinutes ?? (target.data as RoundNodeData).timerMinutes,
  }
  return NextResponse.json({ ok: true, data: filled })
}

function describeRoundsBefore(graph: import("@/lib/graph/types").ScenarioGraph, nodeId: string): string {
  const seqOut = new Map<string, string>()
  for (const e of graph.edges) {
    if (e.type === "sequence") seqOut.set(e.source, e.target)
  }
  const start = graph.nodes.find(n => n.type === "start")
  if (!start) return ""

  const nodeById = new Map(graph.nodes.map(n => [n.id, n]))
  const chain: string[] = []
  let cursor: string | undefined = start.id
  while (cursor && cursor !== nodeId) {
    const node = nodeById.get(cursor)
    if (node?.type === "round") {
      const rd = node.data as RoundNodeData
      chain.push(`- ${rd.title}: ${(rd.situation_update ?? "").slice(0, 200)}`)
    }
    cursor = seqOut.get(cursor)
    if (chain.length > 10) break
  }
  return chain.join("\n")
}
