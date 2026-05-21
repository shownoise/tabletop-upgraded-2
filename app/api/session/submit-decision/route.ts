import { NextResponse } from "next/server"
export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const MAX_REASONING = 2000

export async function POST(req: Request) {
  const body = (await req.json()) as {
    participantId?: string
    participantName?: string
    roundIndex?: number
    actionId?: string
    reasoning?: string
  }
  if (!body.participantId || typeof body.participantId !== "string" ||
      !body.actionId    || typeof body.actionId    !== "string" ||
      typeof body.roundIndex !== "number") {
    return NextResponse.json({ ok: false, error: "Missing required fields." }, { status: 400 })
  }
  const { submitDecision } = await import("@/lib/session-store")
  const result = await submitDecision({
    participantId: body.participantId,
    participantName: typeof body.participantName === "string" ? body.participantName.trim().slice(0, 100) : "",
    roundIndex: body.roundIndex,
    actionId: body.actionId,
    reasoning: (body.reasoning ?? "").slice(0, MAX_REASONING),
  })
  if (!result.ok) return NextResponse.json(result, { status: 400 })
  return NextResponse.json(result)
}
