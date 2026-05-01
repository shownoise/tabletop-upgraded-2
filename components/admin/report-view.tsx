"use client"

import { useEffect, useState } from "react"
import { FileText, AlertTriangle, AlertCircle, CheckCircle, TrendingUp } from "lucide-react"
import type { SessionReport } from "@/lib/types"
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

interface Props {
  lang: Lang
}

export function ReportView({ lang }: Props) {
  const [report, setReport] = useState<SessionReport | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getReport()
      .then(setReport)
      .catch(err => setError(err instanceof Error ? err.message : "Failed to load report"))
      .finally(() => setLoading(false))
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

      {/* Recommendations */}
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
    </div>
  )
}
