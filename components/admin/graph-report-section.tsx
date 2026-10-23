"use client"

import { useEffect, useState } from "react"
import { GitBranch } from "lucide-react"
import type { GraphBranchLogEntry, GraphRuntimeState, SessionState } from "@/lib/types"
import { scoreCoverage, submissionsFromDecisions } from "@/lib/graph/outcome-selector"

interface Props {
  lang?: string
}

// Waarom hier een vertaling van de trigger: de branchLog bewaart codes, en een
// facilitator leest geen "participant_decision" in een Nederlands rapport.
const TRIGGER_NL: Record<GraphBranchLogEntry["trigger"], string> = {
  participant_decision: "keuze deelnemer",
  facilitator_manual: "handmatig door facilitator",
  special_score: "score speciale gebeurtenis",
}

export function GraphReportSection({}: Props) {
  const [session, setSession] = useState<SessionState | null>(null)

  useEffect(() => {
    fetch("/api/session/state")
      .then(r => r.json())
      .then((data: { session?: SessionState }) => {
        if (data?.session) setSession(data.session)
      })
      .catch(() => {})
  }, [])

  if (!session?.graph || !session.graphState) return null

  const graph = session.graph
  const state = session.graphState as GraphRuntimeState
  const coverage = scoreCoverage(graph, submissionsFromDecisions(session.submittedDecisions ?? []))
  const outcomeUnreliable = coverage.submitted === 0 || coverage.scored < coverage.submitted
  const nodeById = new Map(graph.nodes.map(n => [n.id, n]))

  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <GitBranch className="size-4 text-primary" />
        <h2 className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Pad door het scenario</h2>
      </div>
      <div className="rounded-xl border border-primary/20 bg-primary/5 px-5 py-4 flex flex-col gap-4">
        {state.finalOutcome && outcomeUnreliable && (
          <div role="status" className="rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
            Automatische uitkomst verborgen: niet alle ingediende keuzes zijn gescoord. De facilitator beoordeelt de effecten handmatig.
          </div>
        )}
        {state.finalOutcome && !outcomeUnreliable && (
          <div className="rounded-md border border-primary/40 bg-primary/10 px-4 py-3">
            <span className="font-mono text-[10px] uppercase tracking-wider text-primary">Eindafloop</span>
            <p className="mt-1 text-base font-semibold">{state.finalOutcome.label}</p>
            {typeof state.finalOutcome.scoreImpact === "number" && (
              <p className="mt-1 font-mono text-xs text-muted-foreground">
                Score-effect: {state.finalOutcome.scoreImpact > 0 ? "+" : ""}{state.finalOutcome.scoreImpact}
              </p>
            )}
            {state.finalOutcome.narrative && (
              <p className="mt-2 text-sm leading-relaxed">{state.finalOutcome.narrative}</p>
            )}
          </div>
        )}

        <div>
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Afgelegd pad</span>
          <ol className="mt-2 flex flex-wrap items-center gap-1 text-[11px]">
            {state.pathHistory.map((id, i) => {
              const node = nodeById.get(id)
              const label = describe(node?.type, node?.data)
              return (
                <li key={`${id}-${i}`} className="flex items-center gap-1">
                  <span className="rounded border border-border bg-background px-1.5 py-0.5 font-mono">{label}</span>
                  {i < state.pathHistory.length - 1 && <span className="text-muted-foreground">›</span>}
                </li>
              )
            })}
          </ol>
        </div>

        {state.branchLog.length > 0 && (
          <div>
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Afslagen</span>
            <ul className="mt-2 flex flex-col gap-1 text-xs">
              {state.branchLog.map((entry: GraphBranchLogEntry, i) => {
                const node = nodeById.get(entry.nodeId)
                const nodeLabel = describe(node?.type, node?.data)
                return (
                  <li key={i} className="flex items-center gap-2">
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {new Date(entry.triggeredAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <span className="font-mono text-[11px]">{nodeLabel}</span>
                    <span className="text-muted-foreground">→</span>
                    <span className="font-mono text-[11px]">{entry.choseHandle}</span>
                    <span className="ml-auto font-mono text-[10px] text-muted-foreground uppercase">
                      {TRIGGER_NL[entry.trigger]}
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </div>
    </section>
  )
}

function describe(type: string | undefined, data: unknown): string {
  if (!type) return "?"
  const d = data as { title?: string; label?: string; type?: string; prompt?: string }
  if (type === "start") return "Start"
  if (type === "round") return `Ronde · ${d.title ?? ""}`.trim()
  if (type === "decision") return `Beslisvraag · ${d.prompt?.slice(0, 24) ?? ""}`.trim()
  if (type === "special") return `Speciale gebeurtenis · ${d.type ?? ""}`
  if (type === "outcome") return `Afloop · ${d.label ?? ""}`.trim()
  return type
}
