import { NextResponse } from "next/server"
import { requireFacilitator } from "@/lib/auth-guard"
export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(req: Request) {
  const gate = await requireFacilitator()
  if (!gate.ok) return gate.response
  const body = await req.json() as { roundIndex: number; score: -1 | 0 | 1 }
  if (typeof body.roundIndex !== "number" || ![-1, 0, 1].includes(body.score)) {
    return NextResponse.json({ error: "Invalid input." }, { status: 400 })
  }
  const { submitFacilitatorRoundScore } = await import("@/lib/session-store")
  const result = await submitFacilitatorRoundScore(body.roundIndex, body.score)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json({ ok: true })
}
