"use client"

import { useEffect, useState } from "react"
import { FileText, AlertTriangle, AlertCircle, CheckCircle, TrendingUp, Clock, BookOpen, Wrench, Target } from "lucide-react"
import type { SessionReport, GovernanceFlag, TimelineEvent } from "@/lib/types"
import { ROLE_META } from "@/lib/types"
import { api } from "@/lib/api-client"
import type { Lang } from "@/lib/i18n"
import { tr } from "@/lib/i18n"

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
  const flags = report.topFlags
  const wrongRole = flags.filter(f => f.type === "wrong_role").length
  const irDev = flags.filter(f => f.type === "ir_plan_deviation").length

  const quality = report.scores.decisionQuality
  const process = report.scores.processAdherence
  const role = report.scores.roleCompliance

  const overall = quality >= 70 && process >= 70 && role >= 70 ? "performed well" : "showed gaps in key areas"
  const strengths: string[] = []
  const gaps: string[] = []

  if (quality >= 70) strengths.push("decision quality")
  else gaps.push("decision quality")
  if (process >= 70) strengths.push("IR plan adherence")
  else gaps.push("IR plan adherence")
  if (role >= 70) strengths.push("role compliance")
  else gaps.push("role compliance")

  let summary = `During this ${report.mode === "event" ? "event" : "training"} exercise, ${n} decisions were recorded across ${report.totalRounds} rounds. Overall, the team ${overall}.`
  if (strengths.length) summary += ` Main strengths: ${strengths.join(", ")}.`
  if (gaps.length) summary += ` Key gaps: ${gaps.join(", ")}.`
  if (wrongRole > 0) summary += ` ${wrongRole} action${wrongRole !== 1 ? "s were" : " was"} taken outside authorized roles.`
  if (irDev > 0) summary += ` ${irDev} action${irDev !== 1 ? "s deviated" : " deviated"} from the IR plan.`
  return summary
}

function generateImprovements(flags: GovernanceFlag[]): string[] {
  const improvements: string[] = []
  const wrongRoleFlags = flags.filter(f => f.type === "wrong_role")
  const irDevFlags = flags.filter(f => f.type === "ir_plan_deviation")

  const isolationWrongRole = wrongRoleFlags.some(f => f.description.toLowerCase().includes("isolat"))
  if (isolationWrongRole) {
    improvements.push("Define clear authority: only IT Manager / System Administrator may approve system isolation actions.")
  }

  const commsIrDev = irDevFlags.some(f => f.description.toLowerCase().includes("communicat"))
  if (commsIrDev) {
    improvements.push("Define a communication approval workflow — require sign-off from Head of Communications before any external statements are issued.")
  }

  const ransomIrDev = irDevFlags.some(f =>
    f.description.toLowerCase().includes("ransom") ||
    f.description.toLowerCase().includes("negot") ||
    f.description.toLowerCase().includes("payment")
  )
  if (ransomIrDev) {
    improvements.push("Document a ransomware decision process with clear role responsibilities for payment authorization before the next exercise.")
  }

  if (wrongRoleFlags.length === 0 && irDevFlags.length === 0) {
    improvements.push("Team correctly followed role boundaries and best practice — no governance flags recorded. Excellent exercise discipline.")
  }

  improvements.push("Schedule a follow-up exercise in 6 months to validate improvements and test updated runbooks.")
  return improvements
}

function formatTimelineLabel(ev: TimelineEvent): string {
  const type = ev.type.replace(/_/g, " ")
  const data = ev.data as Record<string, unknown>
  if (ev.type === "participant_joined" && data.name) return `Participant joined — ${data.name}`
  if (ev.type === "round_changed" && typeof data.roundIndex === "number") return `Round ${(data.roundIndex as number) + 1} started`
  if (ev.type === "inject_pushed") {
    const inj = data.inject as { title?: string } | undefined
    return `Inject pushed${inj?.title ? ` — ${inj.title}` : ""}`
  }
  if (ev.type === "surprise_inject") {
    const inj = data.inject as { title?: string } | undefined
    return `Surprise inject${inj?.title ? ` — ${inj.title}` : ""}`
  }
  return type.charAt(0).toUpperCase() + type.slice(1)
}

interface Props {
  lang: Lang
}

export function ReportView({ lang }: Props) {
  const [report, setReport] = useState<SessionReport | null>(null)
  const [timeline, setTimeline] = useState<TimelineEvent[]>([])
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
      .catch(err => setError(err instanceof Error ? err.message : "Failed to load report"))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetch("/api/session/state")
      .then(r => r.json())
      .then((data: { session?: { timeline?: TimelineEvent[] } }) => {
        if (data?.session?.timeline) setTimeline(data.session.timeline)
      })
      .catch(() => {})
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground animate-pulse">Loading report…</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-6">
        <div className="flex items-center gap-2 mb-2">
          <AlertCircle className="size-4 text-destructive" />
          <span className="font-mono text-xs uppercase tracking-wider text-destructive">Error</span>
        </div>
        <p className="text-sm text-muted-foreground">{error}</p>
      </div>
    )
  }

  if (!report) return null

  const scoreColor = (v: number): "primary" | "amber" | "destructive" =>
    v >= 70 ? "primary" : v >= 40 ? "amber" : "destructive"

  const executiveSummary = generateExecutiveSummary(report)
  const improvements = generateImprovements(report.topFlags)
  const wrongRoleFlags = report.topFlags.filter(f => f.type === "wrong_role")
  const irDevFlags = report.topFlags.filter(f => f.type === "ir_plan_deviation")
  const sortedTimeline = [...timeline].sort((a, b) => a.timestamp - b.timestamp)

  return (
    <div className="flex flex-col gap-8 print:gap-6">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <FileText className="size-5 text-primary" />
          <h1 className="text-2xl font-semibold tracking-tight">{tr(lang, "reportTitle")}</h1>
        </div>
        <p className="text-muted-foreground">{tr(lang, "reportSub")}</p>
        <div className="flex items-center gap-3 mt-1">
          <span className="font-mono text-xs text-muted-foreground">Session: {report.sessionId}</span>
          <span className="font-mono text-xs text-muted-foreground">Generated: {new Date(report.generatedAt).toLocaleString()}</span>
          <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-primary">
            {report.mode === "event" ? tr(lang, "mode_event") : tr(lang, "mode_training")}
          </span>
        </div>
      </div>

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
      <section>
        <h2 className="font-mono text-xs uppercase tracking-wider text-muted-foreground mb-3">Summary Scores</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <ScoreCard label={tr(lang, "decisionQuality")} value={report.scores.decisionQuality} color={scoreColor(report.scores.decisionQuality)} />
          <ScoreCard label={tr(lang, "processAdherence")} value={report.scores.processAdherence} color={scoreColor(report.scores.processAdherence)} />
          <ScoreCard label={tr(lang, "roleCompliance")} value={report.scores.roleCompliance} color={scoreColor(report.scores.roleCompliance)} />
        </div>
        <div className="mt-3 grid grid-cols-3 gap-4 text-center">
          <p className="text-xs text-muted-foreground">% of decisions that were recommended actions</p>
          <p className="text-xs text-muted-foreground">% of decisions aligned with IR plan</p>
          <p className="text-xs text-muted-foreground">% of decisions by authorized role</p>
        </div>
      </section>

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
                  <span className="font-semibold text-orange-600">{wrongRoleFlags.length} action{wrongRoleFlags.length !== 1 ? "s were" : " was"} taken</span> by unauthorized roles.
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
                  <span className="font-semibold text-destructive">{irDevFlags.length} action{irDevFlags.length !== 1 ? "s deviated" : " deviated"}</span> from the IR plan.
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
          {report.perRound.map(round => (
            <div key={round.roundIndex} className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="border-b border-border px-5 py-3 flex items-center justify-between">
                <span className="font-mono text-xs text-foreground">R{round.roundIndex + 1} — {round.roundTitle}</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] text-muted-foreground">{round.decisions.length} decisions</span>
                  {round.flags.length > 0 && (
                    <span className="rounded-full border border-destructive/40 bg-destructive/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-destructive">
                      {round.flags.length} flag{round.flags.length !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>
              </div>
              {round.decisions.length === 0 ? (
                <p className="px-5 py-4 text-xs text-muted-foreground">{tr(lang, "noDecisions")}</p>
              ) : (
                <div className="p-5">
                  <div className="flex flex-col gap-2">
                    {round.decisions.map(d => (
                      <div key={`${d.participantId}-${d.roundIndex}`} className={`flex items-start gap-3 rounded-lg p-3 ${d.isWrongRole || d.isIrDeviation ? "border border-destructive/20 bg-destructive/5" : "border border-border bg-background/50"}`}>
                        <div className="size-6 rounded-full border border-border bg-background font-mono text-[8px] uppercase text-muted-foreground flex items-center justify-center shrink-0">
                          {d.participantName.slice(0, 2)}
                        </div>
                        <div className="flex flex-col gap-1 flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm">{d.participantName}</span>
                            <span className="rounded-full border border-primary/30 bg-primary/10 px-1.5 py-px font-mono text-[9px] uppercase tracking-wider text-primary">
                              {ROLE_META[d.role]?.label ?? d.role}
                            </span>
                            {d.isWrongRole && (
                              <span className="rounded-full border border-orange-500/40 bg-orange-500/10 px-1.5 py-px font-mono text-[9px] uppercase tracking-wider text-orange-600">
                                {tr(lang, "wrongRoleBadge")}
                              </span>
                            )}
                            {d.isIrDeviation && (
                              <span className="rounded-full border border-destructive/40 bg-destructive/10 px-1.5 py-px font-mono text-[9px] uppercase tracking-wider text-destructive">
                                {tr(lang, "irDeviationBadge")}
                              </span>
                            )}
                          </div>
                          <span className="text-sm text-foreground">{d.actionLabel}</span>
                          {d.reasoning && <span className="text-xs text-muted-foreground italic">"{d.reasoning}"</span>}
                        </div>
                        {!d.isWrongRole && !d.isIrDeviation && (
                          <CheckCircle className="size-4 text-primary shrink-0 mt-0.5" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
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
