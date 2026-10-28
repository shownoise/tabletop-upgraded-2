import Link from "next/link"
import { notFound } from "next/navigation"
import { getState } from "@/lib/session-store"
import { migrateSessionClassifications } from "@/lib/classification"
import { sessionToScoringInput } from "@/lib/scoring/graph-adapter"
import { buildAssessmentReport, decisionReviewItems, scoreExercise } from "@/lib/scoring"
import { applyRegulatoryAdjustment } from "@/lib/regulatory/scoring-adjustment"
import { ROLE_META, type Role, type SessionState } from "@/lib/types"
import { AssessmentReportView } from "@/components/admin/assessment-report-view"

// Server component. `sessionId` is een echt id: 'current' en het id van de
// lopende sessie komen uit de store, elk ander id uit het sessie-archief.
export const dynamic = "force-dynamic"

export default async function AssessmentReportPage({
  params,
}: {
  params: Promise<{ sessionId: string }>
}) {
  const { sessionId } = await params
  const active = (await getState()).session

  // Drie ingangen, in deze volgorde: 'current', het id van de actieve sessie,
  // en anders het archief. Die derde stap ontbrak, waardoor het rapport van een
  // afgeronde oefening onbereikbaar werd zodra de facilitator een nieuwe
  // startte — terwijl de volledige SessionState wél in het archief stond.
  const fromStore = sessionId === "current" || (active !== null && sessionId === active.id)
  // Archief lui inladen: het rapport van de lopende sessie mag niet afhangen van
  // de opslaglaag van het archief. Zelfde reden als in session-store.
  const archived = fromStore
    ? null
    : await (await import("@/lib/admin/sessions-archive")).getSnapshot(sessionId)
  // readSession() migreert de classificaties bij élke read van de live sessie;
  // een snapshot komt daar niet langs. Dus hier dezelfde migratie, anders leest
  // een oud archief anders dan dezelfde sessie toen hij live was.
  const session: SessionState | null = fromStore
    ? active
    : archived
      ? migrateSessionClassifications(archived.snapshot)
      : null
  if (!session) notFound()

  // Geen vaste modus meesturen: sessionToScoringInput leidt hem af uit de
  // sessie. Met een hardgecodeerde 'ASSESSMENT' kregen de beslispunten in een
  // event-sessie plain node-id's terwijl de inzendingen `node::rol` dragen, dus
  // matchte geen enkele inzending. Het rapport zei dan "niets te scoren" en
  // 0 van 100, terwijl de facilitator en de deelnemer 64 van 200 zagen —
  // precies de inconsistentie die issue #105 verbiedt.
  const input = sessionToScoringInput(session)
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
  // Een sessie die via reset is gearchiveerd heeft geen 'session_ended' in de
  // timeline; dan is het archief-tijdstip het enige dat we hebben.
  const endedAt = endedTimelineEvent?.timestamp ?? archived?.endedAt

  return (
    <>
      {/* Eén regel bovenaan, zodat niemand een archiefrapport voor een lopende
          sessie aanziet. Staat buiten AssessmentReportView: die component is
          gedeeld met de live weergave. */}
      {archived && (
        <div className="border-b border-amber-500/40 bg-amber-500/10 px-6 py-2 text-center text-xs text-amber-800 dark:text-amber-300 print:border-0 print:bg-white print:text-black">
          Afgeronde oefening van{" "}
          {new Date(archived.endedAt ?? archived.startedAt).toLocaleDateString("nl-NL", {
            day: "2-digit", month: "long", year: "numeric",
          })}
          {" — "}dit is een archiefrapport, niet een lopende sessie.{" "}
          <Link href="/admin/sessions" className="no-print underline">Alle sessies</Link>
        </div>
      )}
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
          // Een archiefsessie kan een rol dragen die inmiddels uit ROLE_META is
          // verdwenen. Zonder deze terugval viel het hele rapport om op een
          // oude sessie, waar het juist voor bedoeld is.
          primaryLabel: r.primaryRole ? roleLabel(r.primaryRole) : "—",
          inheritedLabels: r.inheritedRoles.map(roleLabel),
          decisionsSubmitted: r.decisionsSubmitted,
          avgConfidence: r.avgConfidence,
        }))}
        report={report}
        scoring={scoring}
        reviewRounds={decisionReviewItems(session)}
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
    </>
  )
}

function roleLabel(role: Role): string {
  return ROLE_META[role]?.label ?? role
}
