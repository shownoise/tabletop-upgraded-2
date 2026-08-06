"use client"

import { useMemo } from "react"
import { Activity } from "lucide-react"
import type { SessionState, TimelineEvent } from "@/lib/types"
import { ROLE_META, ROUND_PHASE_LABELS_NL } from "@/lib/types"
import { sessionToScoringInput } from "@/lib/scoring/graph-adapter"
import { scoreExercise, OUTCOME_DIMENSIONS, type OutcomeDimension } from "@/lib/scoring"

// Dutch axis labels — used for the mini 6-axis bar chart.
const DIM_LABEL: Record<OutcomeDimension, string> = {
  CONT: "CONT",
  FOR:  "FOR",
  BC:   "BC",
  JUR:  "JUR",
  VER:  "VER",
  KOS:  "KOS",
}

// Dense, single-glance facilitator overview. Refreshes on every SSE tick because
// it is driven by the SessionState prop passed from the control-dashboard. All
// scoring is computed inline via a useMemo — no /api/session/score call.
export function LiveOverviewPanel({ session }: { session: SessionState }) {
  const totalRounds = session.scenario.rounds.length
  const currentIndex = session.currentRound
  const phase = session.roundPhase ?? "inject"

  // Cumulative 6-axis outcome across all completed rounds. Computed inline.
  const cumulative = useMemo(() => {
    const input = sessionToScoringInput(session, { mode: "ASSESSMENT" })
    if (!input) {
      return { perDim: emptyVector(), completedRounds: 0, hasAny: false }
    }
    const output = scoreExercise(input)
    const acc = emptyVector()
    let completed = 0
    let anyReal = false
    for (const o of output.outcomes) {
      if (o.round > currentIndex + 1) continue
      if (o.hasSubmissions) {
        anyReal = true
        completed++
        for (const dim of OUTCOME_DIMENSIONS) acc[dim] += o.perDimension[dim]
      }
    }
    return { perDim: acc, completedRounds: completed, hasAny: anyReal }
  }, [session, currentIndex])

  // Per-participant submission progress for the current round. Expected count
  // is derived from pendingByParticipant when present (per-role decisions),
  // else defaults to 1 (one decision per person per round).
  const submissions = session.submittedDecisions ?? []
  const currentRoundSubs = submissions.filter(d => d.roundIndex === currentIndex)
  const pending = session.activeDecision?.pendingByParticipant

  const rows = session.participants.map(p => {
    const expected = pending?.[p.id]?.total ?? 1
    const submitted = currentRoundSubs.filter(d => d.participantId === p.id).length
    const distEntry = session.roleDistribution?.entries.find(e => e.participantId === p.id)
    const inheritedRoles = distEntry?.inheritedRoles ?? []
    return {
      id: p.id,
      name: p.name,
      primaryRole: p.role,
      inheritedRoles,
      submitted,
      expected,
    }
  })

  // Regulatory status — pick the most recent obligation (initial has priority
  // while still open, else closing).
  const regStatus = describeRegulatoryStatus(session)

  // Retainer activation status.
  const retainer = session.retainerActivation
    ? `Retainer: geactiveerd in ronde ${retainer_round(session)}`
    : "Retainer: niet geactiveerd"

  // Latest 3 timeline events.
  const latest = [...(session.timeline ?? [])]
    .reverse()
    .filter(e => TRACKED_TYPES.has(e.type))
    .slice(0, 3)

  return (
    <section className="rounded-xl border border-primary/30 bg-primary/5 p-4 flex flex-col gap-3">
      {/* 1. Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="size-3.5 text-primary" />
          <span className="font-mono text-[10px] uppercase tracking-wider text-primary">
            Ronde {currentIndex + 1} van {totalRounds} — fase: {ROUND_PHASE_LABELS_NL[phase].toLowerCase()}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-primary">
          <span className="size-1.5 rounded-full bg-primary pulse-ring" />
          live
        </div>
      </div>

      {/* 2. Submission progress per participant */}
      <div className="flex flex-col gap-1">
        <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
          Inzendingen deze ronde
        </span>
        {rows.length === 0 ? (
          <p className="text-[11px] text-muted-foreground italic">Geen deelnemers</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {rows.map(r => {
              const state = r.submitted === 0
                ? "none"
                : r.submitted >= r.expected ? "full" : "partial"
              const dotClass =
                state === "full" ? "bg-emerald-500"
                : state === "partial" ? "bg-amber-500"
                : "bg-rose-500"
              const rolesText = r.primaryRole
                ? [ROLE_META[r.primaryRole].label, ...r.inheritedRoles.map(rl => ROLE_META[rl].label)].join(" + ")
                : "—"
              return (
                <li key={r.id} className="flex items-center gap-2 text-[11px]">
                  <span className={`size-2 rounded-full shrink-0 ${dotClass}`} />
                  <span className="text-foreground truncate">{r.name}</span>
                  <span className="text-muted-foreground truncate">· {rolesText}</span>
                  <span className="ml-auto font-mono text-muted-foreground shrink-0">
                    {r.submitted}/{r.expected} ingediend
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* 3. Cumulative outcome preview — 6-axis mini bar chart */}
      <div className="flex flex-col gap-1">
        <div className="flex items-baseline justify-between">
          <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
            Cumulatieve uitkomst (na {cumulative.completedRounds} rondes)
          </span>
        </div>
        <MiniBarChart values={cumulative.perDim} muted={!cumulative.hasAny} />
      </div>

      {/* 4. Regulatory status */}
      <div className="flex flex-col gap-0.5 border-t border-primary/20 pt-2">
        <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Meldplicht</span>
        <p className="text-[11px] text-foreground">{regStatus}</p>
      </div>

      {/* 5. IR-retainer status */}
      <div className="flex flex-col gap-0.5">
        <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">IR-retainer</span>
        <p className="text-[11px] text-foreground">{retainer}</p>
      </div>

      {/* 6. Latest 3 timeline events */}
      <div className="flex flex-col gap-1 border-t border-primary/20 pt-2">
        <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Laatste gebeurtenissen</span>
        {latest.length === 0 ? (
          <p className="text-[11px] text-muted-foreground italic">Geen gebeurtenissen</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {latest.map(ev => (
              <li key={ev.id} className="flex items-start gap-2 text-[11px]">
                <span className="font-mono text-[9px] text-muted-foreground shrink-0 mt-0.5">
                  {new Date(ev.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
                <span className="text-foreground leading-snug">{summariseEvent(ev)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

// ─── helpers ────────────────────────────────────────────────────────────

function emptyVector(): Record<OutcomeDimension, number> {
  return { CONT: 0, FOR: 0, BC: 0, JUR: 0, VER: 0, KOS: 0 }
}

function MiniBarChart({
  values,
  muted,
}: {
  values: Record<OutcomeDimension, number>
  muted: boolean
}) {
  // Cumulative can exceed ±1 (it's a sum across rounds). Auto-scale so the
  // longest bar fills the row while keeping the zero-line stable.
  const magnitudes = OUTCOME_DIMENSIONS.map(d => Math.abs(values[d]))
  const max = Math.max(1, ...magnitudes)
  return (
    <ul className="grid grid-cols-6 gap-1">
      {OUTCOME_DIMENSIONS.map(dim => {
        const v = values[dim]
        const pct = Math.round((Math.abs(v) / max) * 100)
        const positive = v >= 0
        const barColor = muted
          ? "bg-muted-foreground/30"
          : positive
            ? "bg-primary"
            : "bg-rose-500"
        return (
          <li key={dim} className="flex flex-col items-center gap-1">
            <div className="relative h-10 w-full flex flex-col justify-center">
              {/* Zero baseline */}
              <div className="absolute inset-x-0 top-1/2 h-px bg-border" />
              {/* Bar */}
              <div
                className={`absolute inset-x-1 rounded-sm ${barColor}`}
                style={{
                  height: `${pct / 2}%`,
                  top: positive ? `${50 - pct / 2}%` : "50%",
                }}
              />
            </div>
            <span className="font-mono text-[8px] uppercase tracking-wider text-muted-foreground">
              {DIM_LABEL[dim]}
            </span>
            <span className={`font-mono text-[9px] tabular-nums ${muted ? "text-muted-foreground/60" : "text-foreground"}`}>
              {v >= 0 ? "+" : ""}{v.toFixed(1)}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

function describeRegulatoryStatus(session: SessionState): string {
  const regime = session.regulatoryRegime
  const obligations = session.regulatoryObligations ?? []
  if (!regime || obligations.length === 0) {
    return "Geen open verplichting"
  }
  // Prefer open > filed > expired for the summary line.
  const open = obligations.find(o => o.status === "open")
  if (open) {
    const milestone = regime.milestones.find(m => m.id === open.milestoneId)
    const deadlineHour = open.openedAtHour + (milestone?.deadlineHours ?? 0)
    const anchor = session.incidentDetectedAt ?? session.startedAt ?? session.createdAt
    const nowHour = (Date.now() - anchor) / (60 * 60 * 1000)
    const hoursLeft = Math.max(0, deadlineHour - nowHour)
    const label = (milestone?.label ?? open.milestoneId).toLowerCase()
    return `Open · ${label} · ${(milestone?.deadlineHours ?? 0)}u deadline (nog ${hoursLeft.toFixed(1)}u)`
  }
  const filed = obligations.find(o => o.status === "filed")
  if (filed) {
    const milestone = regime.milestones.find(m => m.id === filed.milestoneId)
    const deadlineHour = filed.openedAtHour + (milestone?.deadlineHours ?? 0)
    const onTime = filed.filedAtHour !== undefined && filed.filedAtHour <= deadlineHour
    return `Ingediend in R${filed.filedAtRound ?? "?"} (${onTime ? "op tijd" : "te laat"})`
  }
  const expired = obligations.find(o => o.status === "expired")
  if (expired) {
    return `Vervallen — niet ingediend`
  }
  return "Geen open verplichting"
}

function retainer_round(session: SessionState): string {
  return String(session.retainerActivation?.activatedAtRound ?? "?")
}

const TRACKED_TYPES = new Set<string>([
  "session_started",
  "session_ended",
  "round_changed",
  "phase_changed",
  "inject_pushed",
  "surprise_inject",
  "melding_filed",
  "regulatory_obligation_opened",
  "regulatory_obligation_filed",
  "regulatory_obligation_expired",
])

function summariseEvent(ev: TimelineEvent): string {
  const data = ev.data as Record<string, unknown>
  switch (ev.type) {
    case "session_started":
      return "Sessie gestart"
    case "session_ended":
      return "Sessie afgerond"
    case "round_changed":
      return `Ronde gewijzigd → R${((data.roundIndex as number | undefined) ?? 0) + 1}`
    case "phase_changed":
      return `Fase → ${String(data.to ?? "")}`
    case "inject_pushed":
      return `Inject gepusht${data.title ? ` — ${String(data.title)}` : ""}`
    case "surprise_inject":
      return `Verrassings-inject${data.title ? ` — ${String(data.title)}` : ""}`
    case "melding_filed":
      return `Melding ingediend${data.recipient ? ` (${String(data.recipient)})` : ""}`
    case "regulatory_obligation_opened":
      return "Meldplicht geopend"
    case "regulatory_obligation_filed":
      return "Meldplicht ingediend"
    case "regulatory_obligation_expired":
      return "Meldplicht vervallen"
    default:
      return ev.type.replace(/_/g, " ")
  }
}
