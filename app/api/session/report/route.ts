import { NextResponse } from "next/server"
import type { GovernanceFlag, LearningObjective, SessionReport, SessionState, SubmittedDecision } from "@/lib/types"
import { requireFacilitator } from "@/lib/auth-guard"
import { scoreCoverage, submissionsFromDecisions } from "@/lib/graph/outcome-selector"
import { migrateSessionClassifications } from "@/lib/classification"
export const dynamic = "force-dynamic"
export const runtime = "nodejs"

function generateRecommendations(flags: GovernanceFlag[], hasIrPlan: boolean, graphScoring?: SessionReport['graphScoring']): string[] {
  const recs: string[] = []
  if (graphScoring) {
    recs.push(graphScoring.submitted === 0 || graphScoring.scored < graphScoring.submitted
      ? "Niet alle ingediende keuzes zijn aan een scorevector gekoppeld. Bespreek deze keuzes handmatig; gebruik het automatische eindoordeel niet als beoordeling."
      : "Bespreek per keuze de effecten op containment, forensiek, bedrijfscontinuïteit, juridisch, verantwoording en kosten.")
    return recs
  }
  const wrongRoleCount = flags.filter(f => f.type === "wrong_role").length
  const irDeviationCount = flags.filter(f => f.type === "ir_plan_deviation").length

  if (wrongRoleCount > 0) {
    recs.push(
      `${wrongRoleCount} ${wrongRoleCount === 1 ? "actie is" : "acties zijn"} genomen door een rol zonder dat mandaat. Leg vóór de volgende oefening per IR-fase vast wie waarover beslist.`
    )
  }
  if (irDeviationCount > 0) {
    if (hasIrPlan) {
      recs.push(
        `${irDeviationCount} ${irDeviationCount === 1 ? "actie week" : "acties weken"} af van het IR-plan. Neem deze beslispunten expliciet in het plan op, of leg vooraf goedgekeurde escalatieroutes vast.`
      )
    } else {
      recs.push(
        `${irDeviationCount} ${irDeviationCount === 1 ? "actie week" : "acties weken"} af van de goede praktijk. Leg deze beslispunten vast in een IR-plan, zodat deelnemers in een echte crisis houvast hebben.`
      )
    }
  }
  if (wrongRoleCount === 0 && irDeviationCount === 0) {
    recs.push("Het team bleef binnen de rolgrenzen en volgde de goede praktijk — geen signalen vastgelegd.")
  }
  recs.push("Plan binnen 90 dagen een vervolgoefening om de lessen te toetsen.")
  recs.push("Wijs binnen vijf werkdagen een eigenaar aan voor elk gat uit de evaluatie.")
  return recs
}

export async function GET(req: Request) {
  const gate = await requireFacilitator()
  if (!gate.ok) return gate.response

  // `?sessionId=` lost op in dezelfde volgorde als de rapportpagina: geen
  // parameter of 'current' is de sessie uit de store, het id van de actieve
  // sessie wijst naar diezelfde, en elk ander id komt uit het sessie-archief.
  // Zonder die derde stap kon deze route alleen de actieve sessie opleveren en
  // was het rapport van een afgeronde oefening weg zodra er een nieuwe begon.
  const requested = new URL(req.url).searchParams.get("sessionId")
  const { getSession } = await import("@/lib/session-store")
  const active = await getSession()
  const fromStore = !requested || requested === "current" || requested === active?.id

  let session: SessionState | null = null
  if (fromStore) {
    session = active
    if (!session) {
      // Nederlandse foutteksten: report-view toont `error` rechtstreeks aan de
      // facilitator.
      return NextResponse.json({ error: "Geen actieve sessie." }, { status: 404 })
    }
    if (session.status !== "ended") {
      return NextResponse.json({ error: "Het rapport is pas beschikbaar nadat de sessie is afgerond." }, { status: 400 })
    }
  } else {
    const { getSnapshot } = await import("@/lib/admin/sessions-archive")
    const archived = await getSnapshot(requested)
    if (!archived) {
      return NextResponse.json({ error: "Deze sessie staat niet in het archief." }, { status: 404 })
    }
    // Een gearchiveerde sessie is per definitie niet meer aan de gang, ook als
    // hij bij het archiveren nog 'active' stond — dus geen afgerond-check hier.
    // readSession() migreert de classificaties van een live sessie bij elke
    // read; een snapshot komt daar niet langs, dus hier dezelfde migratie.
    session = migrateSessionClassifications(archived.snapshot)
  }

  const decisions: SubmittedDecision[] = session.submittedDecisions ?? []
  const flags: GovernanceFlag[] = session.governanceFlags ?? []
  const rounds = session.scenario.rounds
  const specialScores = session.specialScores ?? []

  const totalDecisions = decisions.length
  const graphScoring = session.graph
    ? scoreCoverage(session.graph, submissionsFromDecisions(decisions))
    : undefined
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

  // Learning objectives across all rounds
  const allObjectives: Array<{ roundIndex: number; objective: LearningObjective }> = []
  rounds.forEach((round, roundIndex) => {
    (round.learningObjectives ?? []).forEach(obj => {
      allObjectives.push({ roundIndex, objective: obj })
    })
  })
  const objectivesTotal = allObjectives.length
  const objectivesAchieved = allObjectives.filter(o => o.objective.achieved).length
  const perObjective = allObjectives.map(({ roundIndex, objective }) => ({
    roundIndex,
    objective,
    achieved: objective.achieved ?? false,
    achievedAt: objective.achievedAt,
  }))

  const perRound = rounds.map((round, roundIndex) => ({
    roundIndex,
    roundTitle: round.title,
    decisions: decisions.filter(d => d.roundIndex === roundIndex),
    flags: flags.filter(f => f.roundIndex === roundIndex),
  }))

  const hasIrPlan = !!(session.config.irTemplateText) || (session.config.existingPlans?.includes("ir_plan") ?? false)
  const topFlags = flags.slice(0, 10)
  const recommendations = generateRecommendations(flags, hasIrPlan, graphScoring)

  const report: SessionReport = {
    sessionId: session.id,
    generatedAt: new Date().toISOString(),
    mode: session.mode ?? "training",
    totalRounds: rounds.length,
    totalDecisions,
    graphScoring,
    scores: { decisionQuality, processAdherence, roleCompliance, objectivesAchieved, objectivesTotal },
    perRound,
    perObjective,
    topFlags,
    recommendations,
    specialScores,
  }

  return NextResponse.json(report)
}
