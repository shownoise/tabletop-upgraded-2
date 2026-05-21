import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST() {
  const { getSession } = await import("@/lib/session-store")
  const session = await getSession()

  if (!session) {
    return NextResponse.json({ error: "No active session" }, { status: 404 })
  }
  if (!session.config.goalId) {
    return NextResponse.json({ error: "Session has no goalId — debrief requires a platform goal" }, { status: 400 })
  }

  const { buildSessionAssessment } = await import("@/lib/engine/assessment")
  const { generateDebriefAdvice } = await import("@/lib/engine/debrief")

  const assessment = buildSessionAssessment(
    session.id,
    session.config.goalId,
    session.assessmentEvents ?? [],
  )

  assessment.advice = await generateDebriefAdvice(session, assessment)

  return NextResponse.json({ assessment })
}
