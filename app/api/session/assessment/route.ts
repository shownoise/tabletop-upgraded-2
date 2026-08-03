import { NextResponse } from "next/server"
import type { AssessmentDimensionId } from "@/lib/engine/types"
import { requireFacilitator } from "@/lib/auth-guard"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(req: Request) {
  const gate = await requireFacilitator()
  if (!gate.ok) return gate.response
  const body = await req.json() as {
    dimensionId: AssessmentDimensionId
    roundNumber: number
    value: number
    source?: 'facilitator' | 'system' | 'participant_vote'
    note?: string
  }

  if (!body.dimensionId || typeof body.roundNumber !== "number" || typeof body.value !== "number") {
    return NextResponse.json({ error: "dimensionId, roundNumber, and value are required" }, { status: 400 })
  }

  const { addAssessmentEvent } = await import("@/lib/session-store")
  const result = await addAssessmentEvent({
    dimensionId: body.dimensionId,
    roundNumber: body.roundNumber,
    value: body.value,
    source: body.source ?? "facilitator",
    note: body.note,
  })

  return NextResponse.json(result)
}
