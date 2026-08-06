import { NextResponse } from "next/server"
import { updateParticipantView, type ParticipantViewPatch } from "@/lib/session-store"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(req: Request) {
  const body = (await req.json()) as { participantId?: string; patch?: ParticipantViewPatch }
  if (typeof body.participantId !== "string" || body.patch === undefined || body.patch === null || typeof body.patch !== "object") {
    return NextResponse.json({ ok: false, error: "Invalid payload" }, { status: 400 })
  }
  const result = await updateParticipantView({ participantId: body.participantId, patch: body.patch })
  if (!result.ok) return NextResponse.json(result, { status: 400 })
  return NextResponse.json(result)
}
