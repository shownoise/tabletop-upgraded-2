import { notFound } from "next/navigation"
import { getState } from "@/lib/session-store"
import { sessionToScoringInput } from "@/lib/scoring/graph-adapter"
import { buildAssessmentReport, scoreExercise } from "@/lib/scoring"
import { applyRegulatoryAdjustment } from "@/lib/regulatory/scoring-adjustment"
import { ROLE_META } from "@/lib/types"
import { AssessmentReportView } from "@/components/admin/assessment-report-view"

// Server component. `sessionId` acts like an id, but only 'current' is actually
// resolvable today because the store persists a single active session. If we
// later add multi-session persistence, this route already accepts a real id.
export const dynamic = "force-dynamic"

export default async function AssessmentReportPage({
  params,
}: {
  params: Promise<{ sessionId: string }>
}) {
  const { sessionId } = await params
  if (sessionId !== "current") {
    // Multi-session persistence not implemented yet — anything other than
    // 'current' is a 404 for now.
    notFound()
  }

  const state = await getState()
  const session = state.session
  if (!session) notFound()

  const input = sessionToScoringInput(session, { mode: "ASSESSMENT" })
  if (!input) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-xl font-bold">Rapport niet beschikbaar</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Deze sessie heeft geen scenario-graph — scoring vereist een graph-gebaseerd scenario.
        </p>
      </div>
    )
  }

  const scoring = scoreExercise(input)
  const report = applyRegulatoryAdjustment(session, buildAssessmentReport(input))

  // Timing narrative — regulatory + retainer state pulled directly from the session.
  const regime = session.regulatoryRegime ?? null
  const obligations = session.regulatoryObligations ?? []
  const retainerActivation = session.retainerActivation ?? null

  // Participant summary — decisions submitted + average confidence.
  const submitted = session.submittedDecisions ?? []
  const participantRows = session.participants.map(p => {
    const mine = submitted.filter(d => d.participantId === p.id)
    const confidences: number[] = mine
      .map(d => d.confidence)
      .filter((c): c is 1 | 2 | 3 | 4 | 5 => typeof c === "number")
    const avg = confidences.length > 0
      ? confidences.reduce((s, c) => s + c, 0) / confidences.length
      : null
    const distEntry = session.roleDistribution?.entries.find(e => e.participantId === p.id)
    return {
      id: p.id,
      name: p.name,
      primaryRole: p.role,
      inheritedRoles: distEntry?.inheritedRoles ?? [],
      decisionsSubmitted: mine.length,
      avgConfidence: avg,
    }
  })

  const startedAt = session.startedAt ?? session.createdAt
  const endedTimelineEvent = [...session.timeline].reverse().find(e => e.type === "session_ended")
  const endedAt = endedTimelineEvent?.timestamp

  return (
    <AssessmentReportView
      sessionMeta={{
        scenarioTitle: session.scenario.scenario_title,
        sessionTitle: session.config.sector || "Cybercrisis-oefening",
        startedAt,
        endedAt,
        status: session.status,
        totalRounds: session.scenario.rounds.length,
      }}
      participants={participantRows.map(r => ({
        id: r.id,
        name: r.name,
        primaryLabel: r.primaryRole ? ROLE_META[r.primaryRole].label : "—",
        inheritedLabels: r.inheritedRoles.map(rr => ROLE_META[rr].label),
        decisionsSubmitted: r.decisionsSubmitted,
        avgConfidence: r.avgConfidence,
      }))}
      report={report}
      scoring={scoring}
      regulatory={{
        regime: regime ? {
          authorityLabel: regime.authorityLabel,
          obligation: regime.obligation,
        } : null,
        obligations: obligations.map(o => {
          const ms = regime?.milestones.find(m => m.id === o.milestoneId)
          const deadlineHour = o.openedAtHour + (ms?.deadlineHours ?? 0)
          const onTime = o.filedAtHour !== undefined && o.filedAtHour <= deadlineHour
          return {
            milestoneLabel: ms?.label ?? o.milestoneId,
            status: o.status,
            openedAtRound: o.openedAtRound,
            filedAtRound: o.filedAtRound,
            onTime,
          }
        }),
      }}
      retainer={retainerActivation ? {
        activatedAtRound: retainerActivation.activatedAtRound,
      } : null}
    />
  )
}
