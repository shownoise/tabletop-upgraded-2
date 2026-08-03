import { NextResponse } from "next/server"
import { requireFacilitator } from "@/lib/auth-guard"
import { rateLimit } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST() {
  const gate = await requireFacilitator()
  if (!gate.ok) return gate.response

  const userId = (gate.session?.user as { id?: string } | undefined)?.id ?? "unknown"
  const rl = await rateLimit(`ai:${userId}`, 10, 60)
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many AI requests. Please wait a minute." }, {
      status: 429,
      headers: { "Retry-After": String(rl.resetSeconds) },
    })
  }

  const { getSession } = await import("@/lib/session-store")
  const session = await getSession()

  if (!session) {
    return NextResponse.json({ error: "No active session" }, { status: 404 })
  }
  if (!session.config.goalId) {
    return NextResponse.json({ error: "Session has no goalId — debrief requires a platform goal" }, { status: 400 })
  }

  const { buildSessionAssessment } = await import("@/lib/engine/assessment")
  const { generateDebriefAdvice, DebriefAdviceError } = await import("@/lib/engine/debrief")

  const assessment = buildSessionAssessment(
    session.id,
    session.config.goalId,
    session.assessmentEvents ?? [],
  )

  let adviceError: { reason: string; message: string } | undefined
  try {
    assessment.advice = await generateDebriefAdvice(session, assessment)
  } catch (err) {
    if (err instanceof DebriefAdviceError) {
      adviceError = { reason: err.reason, message: err.message }
    } else {
      adviceError = { reason: 'unknown', message: err instanceof Error ? err.message : 'Unknown error' }
    }
    assessment.advice = []
  }

  return NextResponse.json({ assessment, adviceError })
}
