import { NextResponse } from "next/server"
import { z } from "zod"
import { safeJson } from "@/lib/api-validation"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const FeedbackBody = z.object({
  participantId: z.string().min(1).max(100),
  roundIndex: z.number().int().min(0).max(100),
  worked: z.string().max(2000).optional(),
  didnt: z.string().max(2000).optional(),
  gap: z.string().max(2000).optional(),
})

// POST /api/session/feedback — inter-round reflection from a participant.
// Any staffed role can call. The store re-checks that participantId belongs to
// a participant with a role in the live session before anything is persisted.
export async function POST(req: Request) {
  const parsed = await safeJson(req, FeedbackBody)
  if (!parsed.ok) return parsed.response

  const { submitParticipantFeedback } = await import("@/lib/session-store")
  const result = await submitParticipantFeedback(parsed.data)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json({ ok: true })
}
