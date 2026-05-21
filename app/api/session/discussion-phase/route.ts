import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(req: Request) {
  const body = await req.json() as {
    roundNumber: number
    phaseIndex: number
    action?: 'set' | 'extend'
  }

  if (typeof body.roundNumber !== "number" || typeof body.phaseIndex !== "number") {
    return NextResponse.json({ error: "roundNumber and phaseIndex are required" }, { status: 400 })
  }

  const { setDiscussionPhase } = await import("@/lib/session-store")
  const result = await setDiscussionPhase(body.roundNumber, body.phaseIndex, body.action ?? 'set')
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json({ ok: true })
}
