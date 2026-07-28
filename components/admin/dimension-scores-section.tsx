"use client"

import { useEffect, useState } from "react"
import { TrendingUp } from "lucide-react"
import type { AssessmentDimensionKey, SessionState } from "@/lib/types"
import { ROLE_META } from "@/lib/types"
import type { ScenarioGraph, RoundNodeData, DecisionNodeData } from "@/lib/graph/types"
import { cumulativeScore, scoreByDimension, submissionsFromDecisions } from "@/lib/graph/outcome-selector"

// We laten maar een handjevol dimensies zien om het uitlegbaar te houden.
// De rest wordt gebundeld onder "overig" als ze scoren.
const DIM_LABEL: Partial<Record<AssessmentDimensionKey, string>> = {
  decision_speed: "Snelheid",
  decision_quality: "Kwaliteit",
  compliance_awareness: "Compliance",
  communication_clarity: "Communicatie",
}
const PRIMARY_DIMS: AssessmentDimensionKey[] = [
  'decision_speed', 'decision_quality', 'compliance_awareness', 'communication_clarity',
]

export function DimensionScoresSection() {
  const [session, setSession] = useState<SessionState | null>(null)
  useEffect(() => {
    fetch("/api/session/state").then(r => r.json()).then((d: { session?: SessionState }) => {
      if (d?.session) setSession(d.session)
    }).catch(() => {})
  }, [])

  if (!session?.graph || !session.submittedDecisions?.length) return null
  const graph = session.graph as ScenarioGraph
  const subs = submissionsFromDecisions(session.submittedDecisions)
  const total = cumulativeScore(graph, subs)
  const byDim = scoreByDimension(graph, subs)

  const scores = PRIMARY_DIMS.map(dim => ({
    dim,
    label: DIM_LABEL[dim] ?? dim,
    value: byDim[dim] ?? 0,
  }))
  const others = (Object.entries(byDim) as [AssessmentDimensionKey, number][])
    .filter(([d]) => !PRIMARY_DIMS.includes(d))
    .reduce((s, [_, v]) => s + v, 0)
  if (others !== 0) scores.push({ dim: 'framework_adherence' as AssessmentDimensionKey, label: 'Overig', value: others })

  const maxAbs = Math.max(1, ...scores.map(s => Math.abs(s.value)))

  // Per-rol × ronde matrix: welke rol koos welke actie in welke ronde en met welke dimensie-impacts.
  const perRole = groupPerRole(session, graph)

  return (
    <section className="flex flex-col gap-5">
      <div>
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="size-4 text-primary" />
          <h2 className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Score per dimensie</h2>
          <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-primary">
            totaal {total >= 0 ? `+${total}` : total}
          </span>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Elke keuze kan meerdere dimensies raken. Snelheid kan positief zijn maar tegelijk compliance-punten kosten — die trade-off zie je hieronder.
        </p>
        <div className="rounded-xl border border-border bg-card p-5 flex flex-col gap-3">
          {scores.map(s => (
            <DimBar key={s.dim} label={s.label} value={s.value} maxAbs={maxAbs} />
          ))}
        </div>
      </div>

      <div>
        <h2 className="font-mono text-xs uppercase tracking-wider text-muted-foreground mb-3">Per rol × ronde</h2>
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-card/50">
                <th className="px-4 py-2 text-left font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Rol</th>
                <th className="px-4 py-2 text-left font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Ronde</th>
                <th className="px-4 py-2 text-left font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Gekozen actie</th>
                <th className="px-4 py-2 text-left font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Impact</th>
                <th className="px-4 py-2 text-left font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Rank</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {perRole.map(row => (
                <tr key={`${row.role}-${row.roundIndex}-${row.actionId}`}>
                  <td className="px-4 py-2 font-mono text-[10px] uppercase tracking-wider">
                    {(ROLE_META as Record<string, { label: string } | undefined>)[row.role]?.label ?? row.role}
                  </td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">R{row.roundIndex + 1}</td>
                  <td className="px-4 py-2 text-sm">{row.actionLabel}</td>
                  <td className="px-4 py-2">
                    <div className="flex flex-wrap gap-1">
                      {row.impacts.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
                      {row.impacts.map(i => (
                        <span
                          key={i.dim}
                          className={`inline-flex items-center rounded-full px-1.5 py-0.5 font-mono text-[9px] ${
                            i.value > 0 ? "bg-emerald-500/10 text-emerald-600" : i.value < 0 ? "bg-red-500/10 text-red-600" : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {DIM_LABEL[i.dim] ?? i.dim} {i.value > 0 ? `+${i.value}` : i.value}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    {row.qualityRank ? (
                      <RankBadge rank={row.qualityRank} />
                    ) : <span className="text-xs text-muted-foreground">—</span>}
                  </td>
                </tr>
              ))}
              {perRole.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-xs text-muted-foreground">Geen keuzes met dimensie-impact geregistreerd.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {perRole.some(r => !!r.facilitatorCommentary) && (
        <div>
          <h2 className="font-mono text-xs uppercase tracking-wider text-muted-foreground mb-3">Facilitator debrief — IR-retainer perspectief</h2>
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-5 flex flex-col gap-3">
            {perRole.filter(r => !!r.facilitatorCommentary).map(row => (
              <div key={`${row.role}-${row.roundIndex}-${row.actionId}-c`} className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[9px] uppercase tracking-wider text-primary">R{row.roundIndex + 1} · {(ROLE_META as Record<string, { label: string } | undefined>)[row.role]?.label ?? row.role}</span>
                  {row.qualityRank && <RankBadge rank={row.qualityRank} />}
                </div>
                <p className="text-sm leading-relaxed text-foreground">{row.facilitatorCommentary}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

function DimBar({ label, value, maxAbs }: { label: string; value: number; maxAbs: number }) {
  const isPos = value >= 0
  const pct = Math.min(100, (Math.abs(value) / maxAbs) * 100)
  return (
    <div className="flex items-center gap-3">
      <span className="font-mono text-[10px] uppercase tracking-wider w-28 text-muted-foreground">{label}</span>
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden relative">
        <div className="absolute inset-y-0 left-1/2 w-px bg-border" />
        <div
          className={`absolute inset-y-0 ${isPos ? "left-1/2 bg-emerald-500" : "right-1/2 bg-red-500"} rounded-full`}
          style={{ width: `${pct / 2}%` }}
        />
      </div>
      <span className={`font-mono text-xs w-14 text-right ${value > 0 ? "text-emerald-600" : value < 0 ? "text-red-600" : "text-muted-foreground"}`}>
        {value > 0 ? `+${value}` : value}
      </span>
    </div>
  )
}

function RankBadge({ rank }: { rank: 'best' | 'good' | 'poor' | 'wrong' }) {
  const meta = {
    best:  { label: "Best",   className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" },
    good:  { label: "Goed",   className: "bg-sky-500/10 text-sky-600 border-sky-500/30" },
    poor:  { label: "Kon beter", className: "bg-amber-500/10 text-amber-600 border-amber-500/30" },
    wrong: { label: "Fout",   className: "bg-red-500/10 text-red-600 border-red-500/30" },
  }[rank]
  return (
    <span className={`inline-flex items-center rounded-full border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider ${meta.className}`}>
      {meta.label}
    </span>
  )
}

interface PerRoleRow {
  role: string
  roundIndex: number
  actionId: string
  actionLabel: string
  impacts: Array<{ dim: AssessmentDimensionKey; value: number }>
  qualityRank?: 'best' | 'good' | 'poor' | 'wrong'
  facilitatorCommentary?: string
}

function groupPerRole(session: SessionState, graph: ScenarioGraph): PerRoleRow[] {
  const rows: PerRoleRow[] = []
  const decisions = session.submittedDecisions ?? []
  for (const d of decisions) {
    // Find action definition in graph — could be in a RoundNode's roleActions
    // or referenced by a DecisionNode's option roleActionId.
    let impacts: PerRoleRow['impacts'] = []
    let qualityRank: PerRoleRow['qualityRank']
    let facilitatorCommentary: string | undefined
    for (const n of graph.nodes) {
      if (n.type === 'round') {
        const rd = n.data as RoundNodeData
        const a = rd.roleActions?.find(x => x.id === d.actionId)
        if (a) {
          impacts = mapImpactsFromAction(a)
          qualityRank = a.qualityRank
          facilitatorCommentary = a.facilitatorCommentary
          break
        }
      }
      if (n.type === 'decision') {
        const dd = n.data as DecisionNodeData
        const o = dd.options.find(x => x.roleActionId === d.actionId)
        if (o) {
          impacts = mapImpactsFromAction(o)
          qualityRank = o.qualityRank
          facilitatorCommentary = o.facilitatorCommentary
          break
        }
      }
    }
    rows.push({
      role: d.role,
      roundIndex: d.roundIndex,
      actionId: d.actionId,
      actionLabel: d.actionLabel,
      impacts,
      qualityRank,
      facilitatorCommentary,
    })
  }
  return rows.sort((a, b) => a.roundIndex - b.roundIndex || a.role.localeCompare(b.role))
}

function mapImpactsFromAction(a: { scoreImpact?: number; linkedDimension?: AssessmentDimensionKey; scoreImpacts?: Partial<Record<AssessmentDimensionKey, number>> }): Array<{ dim: AssessmentDimensionKey; value: number }> {
  if (a.scoreImpacts && Object.keys(a.scoreImpacts).length > 0) {
    return (Object.entries(a.scoreImpacts) as [AssessmentDimensionKey, number][])
      .filter(([, v]) => v !== 0 && v !== undefined && v !== null)
      .map(([dim, v]) => ({ dim, value: v as number }))
  }
  if (typeof a.scoreImpact === 'number' && a.linkedDimension) {
    return [{ dim: a.linkedDimension, value: a.scoreImpact }]
  }
  return []
}
