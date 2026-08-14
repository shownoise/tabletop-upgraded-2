"use client"

import { useEffect, useState } from "react"
import type { AssessmentReport } from "@/lib/scoring"
import type { RegulatoryObligationState, RegulatoryRegime, SessionState, Role } from "@/lib/types"
import { ROLE_META } from "@/lib/types"
import type { DecisionNodeData, GraphNode, ScenarioGraph } from "@/lib/graph/types"
import { effectiveRolesForParticipant } from "@/lib/engine/distribute-roles"
import { retainerAdvice } from "@/lib/scoring/retainer-advice"
import { vectorOverrideFor, type OutcomeVector } from "@/lib/scoring/vector-overrides"

// REVIEW-fase reveal — Dutch labels, no abbreviations, explicit direction per axis.
// Trend only renders completed rounds. Version + coverage moved to facilitator-only debug panel.

// 6 outcome dimensions with a Dutch label, a one-line hint, and an explicit
// "hoger = beter"/"lager = slechter" reading so participants aren't confused by
// a negative number.
const DIMS = [
  { key: "CONT", label: "Containment",                  hint: "Snelheid en zekerheid waarmee de dreiging is ingedamd.", direction: "Hoger = beter ingedamd" },
  { key: "FOR",  label: "Forensische positie",          hint: "Behoud van bewijs en mogelijkheden tot attributie.",     direction: "Hoger = betere forensische positie" },
  { key: "BC",   label: "Bedrijfscontinuïteit",         hint: "Doorlopen van primaire processen ondanks incident.",      direction: "Hoger = minder verstoring" },
  { key: "JUR",  label: "Juridisch & meldplicht",       hint: "Naleving AVG, NIS2 en contractuele verplichtingen.",      direction: "Hoger = beter afgedekt" },
  { key: "VER",  label: "Verantwoording & communicatie", hint: "Transparantie richting medewerkers, klanten, media, board.", direction: "Hoger = duidelijker verantwoord" },
  { key: "KOS",  label: "Kosten & schade",              hint: "Directe kosten, herstelkosten, reputatieschade.",         directionReverse: true, direction: "Hoger = lagere schade" },
] as const

export function RevealPanel({
  visible = true,
  currentRound,
  session,
}: {
  visible?: boolean
  currentRound: number
  session?: SessionState
}) {
  const [report, setReport] = useState<AssessmentReport | null>(null)
  const [error, setError] = useState<string | null>(null)
  const isFacilitator = typeof window !== "undefined" && window.location.pathname.startsWith("/admin")

  useEffect(() => {
    if (!visible) return
    let cancelled = false
    async function fetchReport() {
      try {
        const res = await fetch("/api/session/score?format=report")
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          if (!cancelled) setError(data.error ?? `HTTP ${res.status}`)
          return
        }
        const data = (await res.json()) as AssessmentReport
        if (!cancelled) { setReport(data); setError(null) }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err))
      }
    }
    fetchReport()
    return () => { cancelled = true }
  }, [visible, currentRound])

  if (!visible) return null

  // Trend: only render outcomes for rounds that have real submissions.
  // "Rounds we passed through with no data" collapse into a distinct empty state
  // upstream — the trend never shows a fallback vector as a real value.
  const completedOutcomes = report?.outcomes.filter(o => o.round <= currentRound && o.hasSubmissions) ?? []

  return (
    <div className="rounded-xl border-2 border-primary/40 bg-primary/5 p-4">
      <div className="flex items-center gap-3 mb-3">
        <span className="font-mono text-[10px] uppercase tracking-wider text-primary font-bold">Review — Ronde {currentRound}</span>
      </div>

      {error && <p className="text-xs text-destructive">Kon rapport niet ophalen: {error}</p>}
      {!error && !report && <p className="text-xs text-muted-foreground">Review wordt berekend…</p>}

      {report && (
        <div className="space-y-5">
          {/* 1. Uitkomst deze ronde — full Dutch labels, no abbreviations */}
          {(() => {
            const round = report.outcomes.find(o => o.round === currentRound)
            if (!round) return (
              <p className="text-xs text-muted-foreground">Deze ronde is nog niet afgerond — geen beslissingen om te tonen.</p>
            )
            return (
              <div>
                <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
                  Uitkomst deze ronde
                </div>
                <div className="flex flex-col gap-2">
                  {DIMS.map(dim => {
                    const value = round.perDimension[dim.key]
                    const positive = value >= 0
                    return (
                      <div key={dim.key} className="rounded border border-border bg-background p-2">
                        <div className="flex items-baseline justify-between mb-1">
                          <span className="text-sm font-semibold">{dim.label}</span>
                          {round.hasSubmissions ? (
                            <span className={`font-mono text-sm font-bold ${positive ? "text-emerald-600" : "text-rose-600"}`}>
                              {positive ? "+" : ""}{value.toFixed(1)} — {positive ? "positief" : "negatief"}
                            </span>
                          ) : (
                            <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-500 bg-amber-100/60 dark:bg-amber-900/30 px-2 py-0.5 rounded">
                              nog niet gemeten
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-snug">{dim.hint}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5 italic">{dim.direction}</p>
                      </div>
                    )
                  })}
                </div>
                {!round.hasSubmissions && (
                  <p className="mt-2 text-[11px] text-muted-foreground italic">
                    In deze ronde zijn nog geen beslissingen ingediend. Zodra iemand een keuze maakt, verschijnen hier waarden.
                  </p>
                )}
                {session?.regulatoryRegime && (() => {
                  const advice = regulatoryAdviceForRound(
                    session.regulatoryObligations ?? [],
                    session.regulatoryRegime,
                    currentRound,
                    session.status === 'ended',
                  )
                  if (!advice) return null
                  return (
                    <p className={`mt-3 text-xs italic ${
                      advice.tone === 'good'
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : advice.tone === 'warn'
                          ? 'text-amber-700 dark:text-amber-400'
                          : 'text-rose-700 dark:text-rose-400'
                    }`}>{advice.text}</p>
                  )
                })()}
                {session && (() => {
                  const advice = retainerAdvice(session)
                  return (
                    <p className={`mt-2 text-xs italic ${
                      advice.tone === 'good'
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : advice.tone === 'warn'
                          ? 'text-amber-700 dark:text-amber-400'
                          : 'text-rose-700 dark:text-rose-400'
                    }`}>{advice.text}</p>
                  )
                })()}
              </div>
            )
          })()}

          {/* 2. Trend — only completed rounds */}
          {completedOutcomes.length > 0 && (
            <div>
              <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
                Trend over afgeronde rondes
              </div>
              <div className="flex gap-1 items-end">
                {completedOutcomes.map(o => {
                  const totalRaw = DIMS.reduce((s, d) => s + o.perDimension[d.key], 0)
                  return (
                    <div key={o.round} className="flex-1 flex flex-col items-center gap-1">
                      <div className="w-full h-16 flex items-end">
                        <div
                          className={`w-full rounded-t ${o.round === currentRound ? "bg-primary" : "bg-muted-foreground/40"}`}
                          style={{ height: `${Math.max(4, Math.abs(totalRaw) * 4 + 8)}px` }}
                          title={`Ronde ${o.round}: som ${totalRaw >= 0 ? "+" : ""}${totalRaw.toFixed(1)}`}
                        />
                      </div>
                      <span className="font-mono text-[10px] text-muted-foreground">R{o.round}</span>
                      <span className={`font-mono text-[11px] font-bold ${totalRaw >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                        {totalRaw >= 0 ? "+" : ""}{totalRaw.toFixed(1)}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* 2b. Keuzes per rol — deze ronde */}
          {session?.graph && session.submittedDecisions !== undefined && (
            <DecisionsPerRole
              graph={session.graph}
              submissions={session.submittedDecisions ?? []}
              roundIndex={currentRound - 1}
            />
          )}

          {/* 3. Rolverdeling — Dutch labels + participant names */}
          {session?.roleDistribution && session.roleDistribution.entries.length > 0 && (
            <div>
              <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
                Rolverdeling deze sessie
              </div>
              <div className="flex flex-col gap-1 text-[12px]">
                {session.roleDistribution.entries.map(entry => {
                  const roles = effectiveRolesForParticipant(entry, session.roleAssignmentOverrides?.[entry.participantId])
                  return (
                    <div key={entry.participantId} className="flex items-baseline justify-between">
                      <span className="font-medium">{entry.participantName}</span>
                      <span className="text-muted-foreground">
                        {roles.map(r => ROLE_META[r]?.label ?? r).join(' + ')}
                      </span>
                    </div>
                  )
                })}
                {session.roleDistribution.unassignedRoles.length > 0 && (
                  <div className="text-amber-700 mt-1 text-[11px]">
                    Niet ingevuld: {session.roleDistribution.unassignedRoles.map(r => ROLE_META[r as Role]?.label ?? r).join(', ')}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Facilitator-only debug footer (participants never see this) */}
          {isFacilitator && (
            <div className="pt-2 border-t border-border text-[10px] text-muted-foreground font-mono">
              Scoring v{report.meta.scoringVersion} · Coverage {(report.meta.rolCoverage * 100).toFixed(0)}%
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Decisions per role — deze ronde ─────────────────────────────────────
// Per beslissing in de huidige ronde: welke rol koos wat, met alternatieven en
// hun scoring-vector. Vectors komen uit lib/scoring/vector-overrides.ts (single
// source of truth); inline outcomeVector op de scenario-optie is fallback.

const DIM_KEYS = ["CONT", "FOR", "BC", "JUR", "VER", "KOS"] as const

function DecisionsPerRole({
  graph,
  submissions,
  roundIndex,
}: {
  graph: ScenarioGraph
  submissions: import("@/lib/types").SubmittedDecision[]
  roundIndex: number
}) {
  const decisionsInRound = decisionNodesForRound(graph, roundIndex)
  if (decisionsInRound.length === 0) return null
  const roundSubs = submissions.filter(s => s.roundIndex === roundIndex)

  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
        Keuzes per rol — deze ronde
      </div>
      <div className="flex flex-col gap-3">
        {decisionsInRound.map(dn => {
          const dd = dn.data as DecisionNodeData
          // Group options by allowed role. Options zonder allowedRole vallen onder 'any'.
          const roles = Array.from(new Set(
            dd.options.map(o => o.allowedRole ?? "any"),
          ))
          return (
            <div key={dn.id} className="rounded border border-border bg-background p-2">
              <div className="text-sm font-semibold mb-2">{dd.prompt}</div>
              {roles.map(role => {
                const roleOptions = dd.options.filter(o => (o.allowedRole ?? "any") === role)
                const submission = roundSubs.find(s =>
                  s.role === role
                  && roleOptions.some(o => o.id === s.actionId),
                )
                const chosen = submission
                  ? roleOptions.find(o => o.id === submission.actionId)
                  : null
                const alternatives = chosen
                  ? roleOptions.filter(o => o.id !== chosen.id)
                  : roleOptions
                const roleLabel = role === "any" ? "Alle rollen" : (ROLE_META[role as Role]?.label ?? role)
                return (
                  <div key={role} className="mt-2 first:mt-0">
                    <div className="flex items-baseline justify-between mb-1">
                      <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">{roleLabel}</span>
                      {submission ? (
                        <span className="text-[11px] text-muted-foreground">door {submission.participantName}</span>
                      ) : (
                        <span className="text-[11px] italic text-amber-700 dark:text-amber-500">geen inzending</span>
                      )}
                    </div>
                    {chosen && (
                      <div className="rounded border-2 border-primary/50 bg-primary/5 p-2 mb-1">
                        <div className="text-xs font-medium mb-1">✓ Gekozen: {chosen.label}</div>
                        <VectorRow option={chosen} allowedRole={role} />
                        {submission?.reasoning && (
                          <div className="text-[11px] italic text-muted-foreground mt-1">"{submission.reasoning}"</div>
                        )}
                      </div>
                    )}
                    {alternatives.length > 0 && (
                      <details className="text-[11px]">
                        <summary className="cursor-pointer text-muted-foreground hover:text-foreground select-none">
                          {chosen ? `Alternatieven (${alternatives.length})` : `Beschikbare opties (${alternatives.length})`}
                        </summary>
                        <div className="flex flex-col gap-1 mt-1 pl-2 border-l-2 border-border">
                          {alternatives.map(alt => (
                            <div key={alt.id} className="py-1">
                              <div className="text-xs">{alt.label}</div>
                              <VectorRow option={alt} allowedRole={role} />
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function VectorRow({
  option,
  allowedRole,
}: {
  option: DecisionNodeData['options'][number]
  allowedRole: string
}) {
  const vector = resolveVector(option, allowedRole)
  return (
    <div className="flex gap-1.5 flex-wrap">
      {DIM_KEYS.map(dim => {
        const v = vector[dim]
        const color = v > 0
          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
          : v < 0
            ? "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30"
            : "bg-muted-foreground/10 text-muted-foreground border-border"
        return (
          <span
            key={dim}
            className={`font-mono text-[10px] px-1.5 py-0.5 rounded border ${color}`}
            title={`${dim}: ${v > 0 ? "+" : ""}${v}`}
          >
            {dim} {v > 0 ? "+" : ""}{v}
          </span>
        )
      })}
    </div>
  )
}

function resolveVector(
  option: DecisionNodeData['options'][number],
  allowedRole: string,
): OutcomeVector {
  const role = allowedRole === "any" ? undefined : allowedRole
  const override = vectorOverrideFor(role, option.label)
  if (override) return override
  if (option.outcomeVector) return option.outcomeVector as OutcomeVector
  return { CONT: 0, FOR: 0, BC: 0, JUR: 0, VER: 0, KOS: 0 }
}

// Round-number toewijzing via sequence-edges vanaf start. Node → 0-based round index.
// undefined = geen ronde (start-node zelf, of onbereikbaar).
function numberRoundsFromStart(graph: ScenarioGraph): Map<string, number> {
  const out = new Map<string, number>()
  const start = graph.nodes.find(n => n.type === "start")
  if (!start) return out
  const sequenceOut = new Map<string, string[]>()
  for (const e of graph.edges) {
    if (e.type !== "sequence") continue
    const list = sequenceOut.get(e.source) ?? []
    list.push(e.target)
    sequenceOut.set(e.source, list)
  }
  // BFS from start, incrementing round-counter on each new round-node encounter.
  const queue: Array<{ id: string; roundIdx: number }> = [{ id: start.id, roundIdx: -1 }]
  const seen = new Set<string>([start.id])
  const nodeById = new Map(graph.nodes.map(n => [n.id, n]))
  while (queue.length > 0) {
    const item = queue.shift()!
    const node = nodeById.get(item.id)
    let idx = item.roundIdx
    if (node?.type === "round") { idx = idx + 1; out.set(item.id, idx) }
    else if (idx >= 0) out.set(item.id, idx)
    for (const next of sequenceOut.get(item.id) ?? []) {
      if (seen.has(next)) continue
      seen.add(next)
      queue.push({ id: next, roundIdx: idx })
    }
  }
  return out
}

function decisionNodesForRound(graph: ScenarioGraph, roundIndex: number): GraphNode[] {
  const map = numberRoundsFromStart(graph)
  return graph.nodes.filter(n => n.type === "decision" && map.get(n.id) === roundIndex)
}

// Build the Dutch advice sentence for the current review round.
// - filed on-time / late in this exact round → concrete outcome
// - filed on-time / late in a previous round → reminder still relevant
// - still open past deadline (session ended)  → escalating "omitted" finding
// - still open, within deadline               → reminder (soft tone)
function regulatoryAdviceForRound(
  obligations: RegulatoryObligationState[],
  regime: RegulatoryRegime,
  currentRound: number,
  sessionEnded: boolean,
): { text: string; tone: 'good' | 'warn' | 'bad' } | null {
  if (obligations.length === 0) return null
  // Concrete filing this round?
  for (const o of obligations) {
    if (o.filedAtRound === currentRound && o.status === 'filed') {
      const ms = regime.milestones.find(m => m.id === o.milestoneId)
      if (!ms) continue
      const deadlineHour = o.openedAtHour + ms.deadlineHours
      const onTime = (o.filedAtHour ?? Number.POSITIVE_INFINITY) <= deadlineHour
      return onTime
        ? { text: `Meldplicht: op tijd ingediend in ronde ${o.filedAtRound}.`, tone: 'good' }
        : { text: `Meldplicht: te laat ingediend in ronde ${o.filedAtRound} — na de wettelijke termijn.`, tone: 'bad' }
    }
    if (o.expiredAtRound === currentRound || (sessionEnded && o.status === 'expired')) {
      const ms = regime.milestones.find(m => m.id === o.milestoneId)
      const label = ms?.label ?? o.milestoneId
      return { text: `Meldplicht: ${label} is niet ingediend — expliciete bevinding in de nabespreking.`, tone: 'bad' }
    }
  }
  // Still-open, deadline not yet reached — surface as reminder.
  const openStill = obligations.find(o => o.status === 'open')
  if (openStill) {
    const ms = regime.milestones.find(m => m.id === openStill.milestoneId)
    if (ms) return {
      text: `Meldplicht: ${ms.label.toLowerCase()} staat nog open — deadline binnen ${ms.deadlineHours} uur na bekendwording.`,
      tone: 'warn',
    }
  }
  return null
}
