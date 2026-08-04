import { NextResponse } from "next/server"
import { z } from "zod"
import { safeJson } from "@/lib/api-validation"
import { getSession } from "@/lib/session-store"
import type { Role } from "@/lib/types"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const MAX_REASONING = 2000

const VALID_ROLES = ["it_manager", "ciso", "head_of_comms", "legal", "ceo", "cfo", "it_manager", "hr_lead", "ops_manager"] as const

const SubmitDecisionBody = z.object({
  participantId: z.string().min(1).max(64),
  participantName: z.string().max(100).optional(),
  roundIndex: z.number().int().min(0).max(50),
  actionId: z.string().min(1).max(200),
  reasoning: z.string().max(MAX_REASONING).optional(),
  confidence: z.number().int().min(1).max(5).optional(),
  // Event-mode team-device: explicit role the team is submitting AS.
  activeRole: z.enum(VALID_ROLES).optional(),
})

export async function POST(req: Request) {
  const parsed = await safeJson(req, SubmitDecisionBody)
  if (!parsed.ok) return parsed.response
  const body = parsed.data

  const session = await getSession()
  if (!session) return NextResponse.json({ ok: false, error: "No active session." }, { status: 404 })
  if (!session.participants.some(p => p.id === body.participantId)) {
    return NextResponse.json({ ok: false, error: "Participant not in active session." }, { status: 401 })
  }

  const { submitDecision } = await import("@/lib/session-store")
  const result = await submitDecision({
    participantId: body.participantId,
    participantName: (body.participantName ?? "").trim(),
    roundIndex: body.roundIndex,
    actionId: body.actionId,
    reasoning: body.reasoning ?? "",
    confidence: body.confidence as 1 | 2 | 3 | 4 | 5 | undefined,
    activeRole: body.activeRole as Role | undefined,
  })
  if (!result.ok) return NextResponse.json(result, { status: 400 })
  return NextResponse.json(result)
}
