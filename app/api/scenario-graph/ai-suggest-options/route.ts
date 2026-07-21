import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { loadScenarioGraph } from "@/lib/session-store"
import type { DecisionNodeData, RoundNodeData } from "@/lib/graph/types"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

interface Body {
  graphId?: string
  nodeId?: string
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

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

  const res = await fetch("https://api.anthropic.com/v1/messages", {
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
    const text = await res.text().catch(() => "")
    return NextResponse.json({ error: `AI call failed: ${text.slice(0, 200)}` }, { status: 502 })
  }

  const data = await res.json() as { content: Array<{ type: string; text: string }> }
  const text = data.content?.find(b => b.type === "text")?.text ?? ""

  try {
    const parsed = JSON.parse(text.replace(/```json|```/g, "").trim()) as { options?: Array<{ label?: string }> }
    const options = (parsed.options ?? [])
      .filter(o => typeof o.label === "string" && o.label.trim().length > 0)
      .slice(0, 3)
      .map(o => ({ label: (o.label as string).trim() }))
    return NextResponse.json({ ok: true, options })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `Failed to parse AI response: ${msg}` }, { status: 502 })
  }
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
