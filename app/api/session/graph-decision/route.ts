import { NextResponse } from "next/server"
import { facilitatorPickGraphOption } from "@/lib/session-store"
import { requireFacilitator } from "@/lib/auth-guard"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(req: Request) {
  const gate = await requireFacilitator()
  if (!gate.ok) return gate.response
  const body = await req.json() as { nodeId?: string; optionId?: string }
  if (!body.nodeId || !body.optionId) {
    return NextResponse.json({ ok: false, error: "Missing nodeId or optionId" }, { status: 400 })
  }
  const result = await facilitatorPickGraphOption({ nodeId: body.nodeId, optionId: body.optionId })
  if (!result.ok) return NextResponse.json(result, { status: 400 })
  return NextResponse.json(result)
}
