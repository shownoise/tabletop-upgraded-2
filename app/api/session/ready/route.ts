import { NextResponse } from "next/server"
import { z } from "zod"
import { safeJson } from "@/lib/api-validation"
import { getSession } from "@/lib/session-store"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const ReadyBody = z.object({
  participantId: z.string().min(1).max(64),
})

export async function POST(req: Request) {
  const parsed = await safeJson(req, ReadyBody)
  if (!parsed.ok) return parsed.response

  const session = await getSession()
  if (!session) return NextResponse.json({ error: "No active session." }, { status: 404 })
  if (!session.participants.some(p => p.id === parsed.data.participantId)) {
    return NextResponse.json({ error: "Participant not in active session." }, { status: 401 })
  }

  const { markParticipantReady } = await import("@/lib/session-store")
  const result = await markParticipantReady(parsed.data.participantId)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json({ ok: true })
}
