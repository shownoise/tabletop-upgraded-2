import { NextResponse } from "next/server"
import type { GovernanceFlag, SessionReport, SubmittedDecision } from "@/lib/types"
export const dynamic = "force-dynamic"
export const runtime = "nodejs"

function generateRecommendations(flags: GovernanceFlag[]): string[] {
  const recs: string[] = []
  const wrongRoleCount = flags.filter(f => f.type === "wrong_role").length
  const irDeviationCount = flags.filter(f => f.type === "ir_plan_deviation").length

  if (wrongRoleCount > 0) {
    recs.push(
      `${wrongRoleCount} action(s) were taken by participants outside their authorized role. Review and clarify RACI ownership for each IR phase before the next exercise.`
    )
  }
  if (irDeviationCount > 0) {
    recs.push(
      `${irDeviationCount} action(s) deviated from the IR plan. Update the IR plan to include explicit guidance on these decision points, or provide pre-authorized escalation paths.`
    )
  }
  if (wrongRoleCount === 0 && irDeviationCount === 0) {
    recs.push("Excellent governance observed. All decisions were taken by authorized roles and aligned with the IR plan.")
  }
  recs.push("Schedule a follow-up tabletop exercise within 90 days to reinforce lessons learned.")
  recs.push("Assign owners to each gap identified in the post-incident review within 5 business days.")
  return recs
}

export async function GET() {
  const { getSession } = await import("@/lib/session-store")
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: "No active session." }, { status: 404 })
  }
  if (session.status !== "ended") {
    return NextResponse.json({ error: "Report is only available after the session has ended." }, { status: 400 })
  }

  const decisions: SubmittedDecision[] = session.submittedDecisions ?? []
  const flags: GovernanceFlag[] = session.governanceFlags ?? []
  const rounds = session.scenario.rounds

  const totalDecisions = decisions.length
  const recommendedCount = decisions.filter(d => {
    const round = rounds[d.roundIndex]
    const action = round?.roleActions?.find(a => a.id === d.actionId)
    return action?.isRecommended === true
  }).length
  const irAlignedCount = decisions.filter(d => !d.isIrDeviation).length
  const roleCompliantCount = decisions.filter(d => !d.isWrongRole).length

  const decisionQuality = totalDecisions > 0 ? Math.round((recommendedCount / totalDecisions) * 100) : 0
  const processAdherence = totalDecisions > 0 ? Math.round((irAlignedCount / totalDecisions) * 100) : 0
  const roleCompliance = totalDecisions > 0 ? Math.round((roleCompliantCount / totalDecisions) * 100) : 0

  const perRound = rounds.map((round, roundIndex) => ({
    roundIndex,
    roundTitle: round.title,
    decisions: decisions.filter(d => d.roundIndex === roundIndex),
    flags: flags.filter(f => f.roundIndex === roundIndex),
  }))

  const topFlags = flags.slice(0, 10)
  const recommendations = generateRecommendations(flags)

  const report: SessionReport = {
    sessionId: session.id,
    generatedAt: new Date().toISOString(),
    mode: session.mode ?? "training",
    totalRounds: rounds.length,
    totalDecisions,
    scores: { decisionQuality, processAdherence, roleCompliance },
    perRound,
    topFlags,
    recommendations,
  }

  return NextResponse.json(report)
}
