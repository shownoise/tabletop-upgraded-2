import { NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/auth"
import {
  deleteScenarioGraph,
  listScenarioGraphs,
  saveScenarioGraph,
} from "@/lib/session-store"
import type { ScenarioGraph } from "@/lib/graph/types"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const positionSchema = z.object({ x: z.number(), y: z.number() })

const nodeSchema = z.object({
  id: z.string().min(1),
  type: z.enum(["start", "round", "inject", "decision", "special", "outcome", "chaser"]),
  position: positionSchema,
  data: z.any(),
})

const edgeSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  sourceHandle: z.string().optional(),
  targetHandle: z.string().optional(),
  type: z.enum(["sequence", "branch", "outcome", "inject"]),
  label: z.string().optional(),
})

// passthrough() zodat velden zoals features / meldplicht / irRetainerProfile /
// irPlaybook mee-serialiseren zonder dat we ze hier moeten dupliceren.
const graphSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  version: z.number().int().nonnegative(),
  scenarioType: z.enum([
    "ransomware_double_extortion",
    "insider_threat",
    "bec_cfo_fraud",
    "supply_chain_compromise",
  ]),
  nodes: z.array(nodeSchema),
  edges: z.array(edgeSchema),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
}).passthrough()

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const graphs = await listScenarioGraphs()
  return NextResponse.json({ ok: true, graphs })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const body = await req.json()
  const parsed = graphSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid graph", issues: parsed.error.issues }, { status: 400 })
  }
  const graph = parsed.data as ScenarioGraph
  await saveScenarioGraph({ ...graph, updatedAt: Date.now() })
  return NextResponse.json({ ok: true, id: graph.id })
}

export async function DELETE(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const url = new URL(req.url)
  const id = url.searchParams.get("id")
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 })
  await deleteScenarioGraph(id)
  return NextResponse.json({ ok: true })
}
