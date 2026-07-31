import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// POST /api/session/group/join { participantId, groupId }
export async function POST(req: Request) {
  const body = (await req.json()) as { participantId?: string; groupId?: string }
  if (!body.participantId || !body.groupId) {
    return NextResponse.json({ ok: false, error: "participantId and groupId required" }, { status: 400 })
  }
  const { joinGroup } = await import("@/lib/session-store")
  const result = await joinGroup({ participantId: body.participantId, groupId: body.groupId })
  if (!result.ok) return NextResponse.json(result, { status: 400 })
  return NextResponse.json(result)
}
