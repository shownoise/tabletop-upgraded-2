import { NextResponse } from "next/server"
import { requireFacilitator } from "@/lib/auth-guard"
import { loadScenarioGraph } from "@/lib/session-store"
import type { DecisionNodeData, RoundNodeData } from "@/lib/graph/types"
import { fetchWithTimeout } from "@/lib/fetch-with-timeout"
import { rateLimit } from "@/lib/rate-limit"
import { z } from "zod"

const SuggestOptionsSchema = z.object({
  options: z.array(z.object({ label: z.string().min(1).max(300) })).max(10),
})

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

interface Body {
  graphId?: string
  nodeId?: string
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
  if (!target || target.type !== "decision") {
    return NextResponse.json({ error: "Node is not a decision" }, { status: 400 })
  }

  const dd = target.data as DecisionNodeData
  const contextRound = findLastRoundBefore(graph, body.nodeId)

  const prompt = `Je bent een cyber-tabletop scenarioschrijver. Genereer 2-3 realistische beslisopties voor een crisisdecision-punt.

Scenario-type: ${graph.scenarioType}
Beslissingsprompt: ${dd.prompt || "(niet gespecificeerd)"}

${contextRound ? `Context (voorgaande ronde):\nTitel: ${contextRound.title}\nSituatie: ${contextRound.situation_update}` : ""}

Geef ALLEEN geldige JSON terug (geen markdown):
{
  "options": [
    { "label": "Korte, actie-georiënteerde optie in NL (max 12 woorden)" },
    { "label": "..." },
    { "label": "..." }
  ]
}

Zorg dat de opties duidelijk verschillen (bv. voorzichtig / offensief / afwachtend).`

  const res = await fetchWithTimeout("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
      messages: [{ role: "user", content: prompt }],
    }),
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => "")
    console.error("[ai-suggest-options] Anthropic error:", res.status, detail.slice(0, 500))
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
  const parsed = SuggestOptionsSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: "AI response did not match expected schema" }, { status: 502 })
  }
  const options = parsed.data.options.slice(0, 3).map(o => ({ label: o.label.trim() }))
  return NextResponse.json({ ok: true, options })
}

function findLastRoundBefore(graph: import("@/lib/graph/types").ScenarioGraph, nodeId: string): RoundNodeData | null {
  const seqIn = new Map<string, string>()
  for (const e of graph.edges) {
    if (e.type === "sequence") seqIn.set(e.target, e.source)
  }
  const nodeById = new Map(graph.nodes.map(n => [n.id, n]))
  let cursor: string | undefined = seqIn.get(nodeId)
  while (cursor) {
    const node = nodeById.get(cursor)
    if (node?.type === "round") return node.data as RoundNodeData
    cursor = seqIn.get(cursor)
  }
  return null
}
