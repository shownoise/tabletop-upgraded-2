"use client"

import { useEffect, useState } from "react"
import { FileText, AlertTriangle, AlertCircle, CheckCircle, TrendingUp, Clock, BookOpen, Wrench, Target } from "lucide-react"
import type { SessionReport, GovernanceFlag, TimelineEvent, SessionState } from "@/lib/types"
import { ROLE_META } from "@/lib/types"
import { decisionReviewItems } from "@/lib/scoring/decision-review"
import { DecisionReviewCard } from "@/components/shared/decision-review-card"
import { api } from "@/lib/api-client"
import type { Lang } from "@/lib/i18n"
import { tr } from "@/lib/i18n"
import { GraphReportSection } from "./graph-report-section"
import { LessonsLearnedSection } from "./lessons-learned-section"
import { DimensionScoresSection } from "./dimension-scores-section"

function ScoreCard({ label, value, color }: { label: string; value: number; color: "primary" | "amber" | "destructive" }) {
  const colorClass = {
    primary: "text-primary border-primary/30 bg-primary/10",
    amber: "text-amber-600 border-amber-500/30 bg-amber-500/10",
    destructive: "text-destructive border-destructive/30 bg-destructive/10",
  }[color]
  return (
    <div className={`rounded-xl border p-5 flex flex-col gap-2 ${colorClass}`}>
      <span className="font-mono text-[10px] uppercase tracking-wider opacity-70">{label}</span>
      <span className="font-mono text-4xl font-bold">{value}%</span>
      <div className="h-1.5 bg-current/20 rounded-full overflow-hidden">
        <div className="h-full bg-current rounded-full transition-all duration-500" style={{ width: `${value}%` }} />
      </div>
    </div>
  )
}

function generateExecutiveSummary(report: SessionReport): string {
  const n = report.perRound.reduce((s, r) => s + r.decisions.length, 0)
  if (report.graphScoring) {
    return `Tijdens deze oefening zijn ${n} keuzes vastgelegd over ${report.totalRounds} rondes. ` +
      `${report.graphScoring.scored} van ${report.graphScoring.submitted} keuzes zijn aan een scorevector gekoppeld. ` +
      (report.graphScoring.scored < report.graphScoring.submitted || report.graphScoring.submitted === 0
        ? `De overige keuzes vragen om handmatige bespreking door de facilitator.`
        : `Bespreek de afweging per dimensie met de deelnemers.`)
  }
  const flags = report.topFlags
  const wrongRole = flags.filter(f => f.type === "wrong_role").length
  const irDev = flags.filter(f => f.type === "ir_plan_deviation").length

  const quality = report.scores.decisionQuality
  const process = report.scores.processAdherence
  const role = report.scores.roleCompliance

  const overall = quality >= 70 && process >= 70 && role >= 70
    ? "liep het team goed"
    : "liet het team gaten zien op belangrijke punten"
  const strengths: string[] = []
  const gaps: string[] = []

  if (quality >= 70) strengths.push("kwaliteit van de keuzes")
  else gaps.push("kwaliteit van de keuzes")
  if (process >= 70) strengths.push("naleving van het IR-plan")
  else gaps.push("naleving van het IR-plan")
  if (role >= 70) strengths.push("rolvastheid")
  else gaps.push("rolvastheid")

  let summary = `In deze ${report.mode === "event" ? "event" : "trainings"}oefening zijn ${n} keuzes vastgelegd over ${report.totalRounds} rondes. Over het geheel ${overall}.`
  if (strengths.length) summary += ` Sterke punten: ${strengths.join(", ")}.`
  if (gaps.length) summary += ` Belangrijkste gaten: ${gaps.join(", ")}.`
  if (wrongRole > 0) summary += ` ${wrongRole} ${wrongRole !== 1 ? "acties zijn" : "actie is"} buiten de bevoegde rol genomen.`
  if (irDev > 0) summary += ` ${irDev} ${irDev !== 1 ? "acties weken" : "actie week"} af van het IR-plan.`
  return summary
}

function generateImprovements(flags: GovernanceFlag[], graphScoring?: SessionReport['graphScoring']): string[] {
  const improvements: string[] = []
  const wrongRoleFlags = flags.filter(f => f.type === "wrong_role")
  const irDevFlags = flags.filter(f => f.type === "ir_plan_deviation")

  const isolationWrongRole = wrongRoleFlags.some(f => f.description.toLowerCase().includes("isolat"))
  if (isolationWrongRole) {
    improvements.push("Leg het mandaat vast: alleen de IT-manager mag isolatie van systemen goedkeuren.")
  }

  const commsIrDev = irDevFlags.some(f => f.description.toLowerCase().includes("communicat"))
  if (commsIrDev) {
    improvements.push("Leg een goedkeuringsroute voor communicatie vast — geen externe verklaring zonder akkoord van de communicatieverantwoordelijke.")
  }

  const ransomIrDev = irDevFlags.some(f =>
    f.description.toLowerCase().includes("ransom") ||
    f.description.toLowerCase().includes("negot") ||
    f.description.toLowerCase().includes("payment")
  )
  if (ransomIrDev) {
    improvements.push("Beschrijf vóór de volgende oefening een ransomware-besluitproces, met expliciet wie betaling mag autoriseren.")
  }

  if (!graphScoring && wrongRoleFlags.length === 0 && irDevFlags.length === 0) {
    improvements.push("Het team bleef binnen de rolgrenzen en volgde de goede praktijk — geen signalen vastgelegd.")
  }

  improvements.push("Plan over zes maanden een vervolgoefening om de verbeteringen en de bijgewerkte draaiboeken te toetsen.")
  return improvements
}

// Nederlandse omschrijving per tijdlijn-gebeurtenis. Onbekende types vallen
// terug op hun eigen naam; dat is beter dan een lege regel.
const TIMELINE_LABEL_NL: Record<string, string> = {
  session_created: "Sessie aangemaakt",
  session_started: "Sessie gestart",
  session_ended: "Sessie afgerond",
  phase_changed: "Fase gewijzigd",
  decision_submitted: "Keuze ingediend",
  participant_left: "Deelnemer vertrokken",
}

function formatTimelineLabel(ev: TimelineEvent): string {
  const data = ev.data as Record<string, unknown>
  if (ev.type === "participant_joined" && data.name) return `Deelnemer aangesloten — ${data.name}`
  if (ev.type === "round_changed" && typeof data.roundIndex === "number") return `Ronde ${(data.roundIndex as number) + 1} gestart`
  if (ev.type === "inject_pushed") {
    const inj = data.inject as { title?: string } | undefined
    return `Inject verstuurd${inj?.title ? ` — ${inj.title}` : ""}`
  }
  if (ev.type === "surprise_inject") {
    const inj = data.inject as { title?: string } | undefined
    return `Verrassingsinject${inj?.title ? ` — ${inj.title}` : ""}`
  }
  const fallback = ev.type.replace(/_/g, " ")
  return TIMELINE_LABEL_NL[ev.type] ?? fallback.charAt(0).toUpperCase() + fallback.slice(1)
}

interface Props {
  lang: Lang
}

export function ReportView({ lang }: Props) {
  const [report, setReport] = useState<SessionReport | null>(null)
  const [timeline, setTimeline] = useState<TimelineEvent[]>([])
  const [session, setSession] = useState<SessionState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.getReport(),
      fetch("/api/session/stream").then(() => null).catch(() => null),
    ])
      .then(([r]) => {
        setReport(r)
      })
      .catch(err => setError(err instanceof Error ? err.message : "Rapport kon niet worden geladen"))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetch("/api/session/state")
      .then(r => r.json())
      .then((data: { session?: SessionState }) => {
        if (data?.session) {
          setSession(data.session)
          setTimeline(data.session.timeline ?? [])
        }
      })
      .catch(() => {})
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground animate-pulse">Rapport laden…</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-6">
        <div className="flex items-center gap-2 mb-2">
          <AlertCircle className="size-4 text-destructive" />
          <span className="font-mono text-xs uppercase tracking-wider text-destructive">Fout</span>
        </div>
        <p className="text-sm text-muted-foreground">{error}</p>
      </div>
    )
  }

  if (!report) return null

  const scoreColor = (v: number): "primary" | "amber" | "destructive" =>
    v >= 70 ? "primary" : v >= 40 ? "amber" : "destructive"

  const scoringIncomplete = !!report.graphScoring &&
    (report.graphScoring.submitted === 0 || report.graphScoring.scored < report.graphScoring.submitted)
  const executiveSummary = generateExecutiveSummary(report)
  const improvements = generateImprovements(report.topFlags, report.graphScoring)
  const wrongRoleFlags = report.topFlags.filter(f => f.type === "wrong_role")
  const irDevFlags = report.topFlags.filter(f => f.type === "ir_plan_deviation")
  const sortedTimeline = [...timeline].sort((a, b) => a.timestamp - b.timestamp)
  // Dezelfde scorebespreking als het assessment-rapport en de deelnemer zien.
  const reviewRounds = session ? decisionReviewItems(session) : []

  return (
    <div className="flex flex-col gap-8 print:gap-6">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <FileText className="size-5 text-primary" />
            <h1 className="text-2xl font-semibold tracking-tight">{tr(lang, "reportTitle")}</h1>
          </div>
          <div className="flex items-center gap-2 print:hidden">
            <PrintReportButton />
            <DownloadReportButton />
          </div>
        </div>
        <p className="text-muted-foreground">{tr(lang, "reportSub")}</p>
        <div className="flex items-center gap-3 mt-1">
          <span className="font-mono text-xs text-muted-foreground">Sessie: {report.sessionId}</span>
          <span className="font-mono text-xs text-muted-foreground">Gegenereerd: {new Date(report.generatedAt).toLocaleString("nl-NL")}</span>
          <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-primary">
            {report.mode === "event" ? tr(lang, "mode_event") : tr(lang, "mode_training")}
          </span>
        </div>
      </div>

      {scoringIncomplete && (
        <div role="alert" className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-5 py-4 text-sm">
          <p className="font-semibold">Automatische score en uitkomst niet betrouwbaar</p>
          <p className="mt-1 text-muted-foreground">
            {report.graphScoring?.scored} van {report.graphScoring?.submitted} ingediende keuzes hebben een gekoppelde scorevector.
            Bespreek de afweging per dimensie handmatig; ontbrekende punten betekenen niet nul impact.
          </p>
        </div>
      )}

      {/* Scenario graph path (only when session was graph-driven) */}
      <GraphReportSection />

      {/* Per-dimensie bars + per-rol × ronde tabel + facilitator-commentary debrief */}
      <DimensionScoresSection />

      {/* Lessons learned aggregated by dimension */}
      <LessonsLearnedSection />

      {/* Executive Summary */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <BookOpen className="size-4 text-primary" />
          <h2 className="font-mono text-xs uppercase tracking-wider text-muted-foreground">{tr(lang, "report_executive_summary")}</h2>
        </div>
        <div className="rounded-xl border border-primary/20 bg-primary/5 px-5 py-4">
          <p className="text-sm leading-relaxed text-foreground">{executiveSummary}</p>
        </div>
      </section>

      {/* Score summary */}
      {!report.graphScoring && <section>
        <h2 className="font-mono text-xs uppercase tracking-wider text-muted-foreground mb-3">Samenvattende scores</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <ScoreCard label={tr(lang, "decisionQuality")} value={report.scores.decisionQuality} color={scoreColor(report.scores.decisionQuality)} />
          <ScoreCard label={tr(lang, "processAdherence")} value={report.scores.processAdherence} color={scoreColor(report.scores.processAdherence)} />
          <ScoreCard label={tr(lang, "roleCompliance")} value={report.scores.roleCompliance} color={scoreColor(report.scores.roleCompliance)} />
        </div>
        <div className="mt-3 grid grid-cols-3 gap-4 text-center">
          <p className="text-xs text-muted-foreground">% van de keuzes die een aanbevolen actie waren</p>
          <p className="text-xs text-muted-foreground">% van de keuzes die het IR-plan volgden</p>
          <p className="text-xs text-muted-foreground">% van de keuzes door een bevoegde rol</p>
        </div>
      </section>}

      {/* Learning Objectives */}
      {(report.perObjective?.length ?? 0) > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Target className="size-4 text-primary" />
            <h2 className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Leerdoelen</h2>
            <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-primary">
              {report.scores.objectivesAchieved}/{report.scores.objectivesTotal} behaald
            </span>
          </div>
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="flex flex-col divide-y divide-border">
              {report.perObjective.map((item, i) => (
                <div key={i} className="flex items-start gap-3 px-5 py-3">
                  <span className="font-mono text-[10px] text-muted-foreground shrink-0 mt-0.5 min-w-[24px]">R{item.roundIndex + 1}</span>
                  {item.achieved ? (
                    <CheckCircle className="size-4 text-primary shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="size-4 text-destructive shrink-0 mt-0.5" />
                  )}
                  <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                    <span className="text-sm text-foreground">{item.objective.description}</span>
                    <span className={`font-mono text-[10px] uppercase tracking-wider ${item.achieved ? "text-primary" : "text-destructive"}`}>
                      {item.achieved ? "Behaald" : "Niet behaald"}
                      {item.achievedAt && ` — ${new Date(item.achievedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Timeline */}
      {sortedTimeline.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Clock className="size-4 text-primary" />
            <h2 className="font-mono text-xs uppercase tracking-wider text-muted-foreground">{tr(lang, "report_timeline")}</h2>
          </div>
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="flex flex-col divide-y divide-border max-h-72 overflow-y-auto">
              {sortedTimeline.map(ev => (
                <div key={ev.id} className="flex items-start gap-3 px-4 py-2.5">
                  <span className="font-mono text-[10px] text-muted-foreground shrink-0 mt-0.5 min-w-[46px]">
                    {new Date(ev.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <span className={`size-1.5 rounded-full shrink-0 mt-1.5 ${
                    ev.type === "session_started" ? "bg-primary" :
                    ev.type === "session_ended" ? "bg-destructive" :
                    ev.type === "round_changed" ? "bg-amber-500" :
                    ev.type === "inject_pushed" || ev.type === "surprise_inject" ? "bg-orange-500" :
                    "bg-muted-foreground"
                  }`} />
                  <span className="text-xs text-muted-foreground leading-relaxed">{formatTimelineLabel(ev)}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Governance flags */}
      {(wrongRoleFlags.length > 0 || irDevFlags.length > 0) && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="size-4 text-amber-500" />
            <h2 className="font-mono text-xs uppercase tracking-wider text-muted-foreground">{tr(lang, "report_ir_alignment")}</h2>
          </div>
          <div className="rounded-xl border border-border bg-card p-5 flex flex-col gap-4">
            {wrongRoleFlags.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-sm text-muted-foreground">
                  <span className="font-semibold text-orange-600">{wrongRoleFlags.length} {wrongRoleFlags.length !== 1 ? "acties zijn" : "actie is"}</span> genomen door een rol zonder dat mandaat.
                </p>
                <div className="flex flex-col gap-1.5">
                  {wrongRoleFlags.slice(0, 3).map(f => (
                    <div key={f.id} className="flex items-start gap-2 rounded-lg border border-orange-500/20 bg-orange-500/5 px-3 py-2">
                      <AlertTriangle className="size-3.5 text-orange-500 shrink-0 mt-0.5" />
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs font-medium">{f.participantName} ({ROLE_META[f.role]?.label ?? f.role}) — R{f.roundIndex + 1}</span>
                        <span className="text-xs text-muted-foreground">{f.description}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {irDevFlags.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-sm text-muted-foreground">
                  <span className="font-semibold text-destructive">{irDevFlags.length} {irDevFlags.length !== 1 ? "acties weken" : "actie week"} af</span> van het IR-plan.
                </p>
                <div className="flex flex-col gap-1.5">
                  {irDevFlags.slice(0, 3).map(f => (
                    <div key={f.id} className="flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2">
                      <AlertCircle className="size-3.5 text-destructive shrink-0 mt-0.5" />
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs font-medium">{f.participantName} ({ROLE_META[f.role]?.label ?? f.role}) — R{f.roundIndex + 1}</span>
                        <span className="text-xs text-muted-foreground">{f.description}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Per-round breakdown */}
      <section>
        <h2 className="font-mono text-xs uppercase tracking-wider text-muted-foreground mb-3">{tr(lang, "perRoundBreakdown")}</h2>
        <div className="flex flex-col gap-4">
          {report.perRound.map(round => {
            const review = reviewRounds.find(r => r.round === round.roundIndex + 1)
            return (
            <div key={round.roundIndex} className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="border-b border-border px-5 py-3 flex items-center justify-between">
                <span className="font-mono text-xs text-foreground">R{round.roundIndex + 1} — {round.roundTitle}</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {round.decisions.length} {round.decisions.length === 1 ? "keuze" : "keuzes"}
                  </span>
                  {round.flags.length > 0 && (
                    <span className="rounded-full border border-destructive/40 bg-destructive/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-destructive">
                      {round.flags.length} {round.flags.length === 1 ? "signaal" : "signalen"}
                    </span>
                  )}
                </div>
              </div>
              {review && review.entries.length > 0 ? (
                <div className="p-5 flex flex-col gap-4">
                  {review.entries.map(entry => (
                    <div key={entry.key} className="flex flex-col gap-1.5">
                      {entry.submission && (entry.submission.isWrongRole || entry.submission.isIrDeviation) && (
                        <div className="flex flex-wrap items-center gap-2">
                          {entry.submission.isWrongRole && (
                            <span className="rounded-full border border-orange-500/40 bg-orange-500/10 px-1.5 py-px font-mono text-[9px] uppercase tracking-wider text-orange-600">
                              {tr(lang, "wrongRoleBadge")}
                            </span>
                          )}
                          {entry.submission.isIrDeviation && (
                            <span className="rounded-full border border-destructive/40 bg-destructive/10 px-1.5 py-px font-mono text-[9px] uppercase tracking-wider text-destructive">
                              {tr(lang, "irDeviationBadge")}
                            </span>
                          )}
                        </div>
                      )}
                      {entry.scored ? (
                        <DecisionReviewCard item={entry.item} />
                      ) : (
                        <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 px-4 py-3">
                          <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                            {entry.item.noDecision ? "Geen besluit" : "Gekozen"}
                          </p>
                          <p className="text-sm text-foreground">
                            {entry.item.noDecision ? "Geen besluit binnen de tijd" : entry.item.chosenLabel}
                          </p>
                          <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                            Punten niet vastgesteld — deze optie heeft geen scorevector. Bespreek de gevolgen op de zes dimensies met het team.
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : round.decisions.length === 0 ? (
                <p className="px-5 py-4 text-xs text-muted-foreground">{tr(lang, "noDecisions")}</p>
              ) : (
                <ul className="p-5 flex flex-col gap-1.5">
                  {round.decisions.map(d => (
                    <li key={`${d.participantId}-${d.roundIndex}-${d.actionId}`} className="text-sm">
                      <span className="font-medium">{d.participantName}</span>
                      <span className="text-muted-foreground"> ({ROLE_META[d.role]?.label ?? d.role}) — </span>
                      {d.actionLabel}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            )
          })}
        </div>
      </section>

      {/* Governance Flags */}
      <section>
        <h2 className="font-mono text-xs uppercase tracking-wider text-muted-foreground mb-3">{tr(lang, "governanceFlags")}</h2>
        {report.topFlags.length === 0 ? (
          <div className="rounded-xl border border-primary/20 bg-primary/5 px-5 py-4 flex items-center gap-2">
            <CheckCircle className="size-4 text-primary" />
            <p className="text-sm text-muted-foreground">{tr(lang, "noFlags")}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {report.topFlags.map(flag => (
              <div key={flag.id} className={`rounded-lg border px-4 py-3 flex items-start gap-3 ${
                flag.type === "wrong_role"
                  ? "border-orange-500/30 bg-orange-500/5"
                  : "border-destructive/30 bg-destructive/5"
              }`}>
                {flag.type === "wrong_role" ? (
                  <AlertTriangle className="size-4 text-orange-500 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="size-4 text-destructive shrink-0 mt-0.5" />
                )}
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{flag.participantName}</span>
                    <span className={`rounded-full border px-1.5 py-px font-mono text-[9px] uppercase tracking-wider ${
                      flag.type === "wrong_role"
                        ? "border-orange-500/40 text-orange-600"
                        : "border-destructive/40 text-destructive"
                    }`}>
                      {flag.type === "wrong_role" ? tr(lang, "wrongRoleBadge") : tr(lang, "irDeviationBadge")}
                    </span>
                    <span className="font-mono text-[9px] text-muted-foreground">R{flag.roundIndex + 1}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{flag.description}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Improvement Actions */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Wrench className="size-4 text-primary" />
          <h2 className="font-mono text-xs uppercase tracking-wider text-muted-foreground">{tr(lang, "report_improvements")}</h2>
        </div>
        <div className="flex flex-col gap-2">
          {improvements.map((imp, i) => (
            <div key={i} className="flex gap-3 rounded-lg border border-border bg-card px-4 py-3">
              <div className="flex size-5 shrink-0 items-center justify-center rounded-full border border-primary/40 bg-primary/10 mt-0.5">
                <TrendingUp className="size-3 text-primary" />
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">{imp}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Recommendations */}
      {report.recommendations.length > 0 && (
        <section>
          <h2 className="font-mono text-xs uppercase tracking-wider text-muted-foreground mb-3">{tr(lang, "recommendations")}</h2>
          <div className="flex flex-col gap-2">
            {report.recommendations.map((rec, i) => (
              <div key={i} className="flex gap-3 rounded-lg border border-border bg-card px-4 py-3">
                <div className="flex size-5 shrink-0 items-center justify-center rounded-full border border-primary/40 bg-primary/10 mt-0.5">
                  <TrendingUp className="size-3 text-primary" />
                </div>
                <p className="text-sm leading-relaxed text-muted-foreground">{rec}</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function PrintReportButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-md border border-border bg-card px-3 py-1.5 font-mono text-xs uppercase tracking-wider hover:border-primary/40 print:hidden"
      title="Print naar PDF (browser dialog)"
    >
      Print / PDF
    </button>
  )
}

function DownloadReportButton() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleDownload() {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch("/api/session/state", { cache: "no-store" })
      const data = await res.json() as { session?: import("@/lib/types").SessionState }
      if (!data.session) throw new Error("Geen sessiegegevens beschikbaar")
      const { downloadReport } = await import("@/lib/report/export")
      downloadReport(data.session)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleDownload}
        disabled={busy}
        className="rounded-md border border-primary bg-primary text-primary-foreground px-3 py-1.5 font-mono text-xs uppercase tracking-wider hover:opacity-90 disabled:opacity-50"
      >
        {busy ? "Exporteren…" : "Download rapport"}
      </button>
      {error && <span className="text-[10px] text-destructive">{error}</span>}
    </div>
  )
}
