"use client"

// Live-overzicht tijdens een ronde. Eén vraag staat voorop: waar wacht ik op?
//
// Waarom deze ordening: de facilitator keek naar zes blokken kleine
// mono-kapitalen van gelijk gewicht (#105 §7). Nu is de voortgang van deze
// ronde het enige grote element, staat secundaire status als chip met icoon en
// kleur, en zit alles wat je alleen soms nodig hebt achter een uitklap.
//
// De zes dimensies komen uit DimensionImpactList — dezelfde component als de
// scorebespreking van deelnemer en rapport. Geen balkjes met afkortingen meer:
// issue #105 §6 verbiedt dat expliciet.

import { useMemo } from "react"
import { Activity, FileCheck2, Hourglass, LifeBuoy, ShieldAlert, type LucideIcon } from "lucide-react"
import type { SessionState, TimelineEvent } from "@/lib/types"
import { ROLE_META, ROUND_PHASE_LABELS_NL } from "@/lib/types"
import { analyzeGraph } from "@/lib/graph/analyze"
import { sessionToScoringInput } from "@/lib/scoring/graph-adapter"
import { scoreExercise, OUTCOME_DIMENSIONS, type OutcomeDimension } from "@/lib/scoring"
import { DimensionImpactList } from "@/components/shared/decision-review-card"
import { rolesForParticipant } from "@/lib/session-roles"
import { roundSubmissionProgress } from "./facilitator/round-submission-progress"

type Tone = "ok" | "warn" | "bad" | "muted"

const TONE_CLASS: Record<Tone, string> = {
  ok: "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400",
  warn: "border-amber-500/40 bg-amber-500/5 text-amber-700 dark:text-amber-400",
  bad: "border-red-500/30 bg-red-500/5 text-red-700 dark:text-red-400",
  muted: "border-border bg-muted/20 text-muted-foreground",
}

// Dense, single-glance facilitator overview. Refreshes on every SSE tick because
// it is driven by the SessionState prop passed from the control-dashboard. All
// scoring is computed inline via a useMemo — no /api/session/score call.
export function LiveOverviewPanel({ session }: { session: SessionState }) {
  // scenario.rounds only holds the rounds played so far; the graph carries the total.
  const totalRounds = session.graph
    ? analyzeGraph(session.graph).roundCount
    : session.scenario.rounds.length
  const currentIndex = session.currentRound
  const phase = session.roundPhase ?? "inject"

  // Cumulatieve uitkomst over de áfgeronde rondes. Een ronde telt mee als hij
  // achter ons ligt, of als de scorebespreking van de huidige ronde loopt —
  // dan staan de keuzes vast. Daarvóór stonden hier zes nullen die niets
  // betekenden, en dat was precies de klacht.
  const cumulative = useMemo(() => {
    const input = sessionToScoringInput(session, { mode: "ASSESSMENT" })
    if (!input) {
      return { perDim: emptyVector(), completedRounds: 0, hasAny: false }
    }
    const output = scoreExercise(input)
    const acc = emptyVector()
    let completed = 0
    let anyReal = false
    const lastClosedRound = phase === "review" ? currentIndex + 1 : currentIndex
    for (const o of output.outcomes) {
      if (o.round > lastClosedRound) continue
      if (o.hasSubmissions) {
        anyReal = true
        completed++
        for (const dim of OUTCOME_DIMENSIONS) acc[dim] += o.perDimension[dim]
      }
    }
    return { perDim: acc, completedRounds: completed, hasAny: anyReal }
  }, [session, currentIndex, phase])

  // Voortgang van deze ronde — dezelfde afleiding als de metriek bovenaan de
  // rondestap, zodat teller en noemer daar en hier gelijk zijn.
  const progress = roundSubmissionProgress(session)
  const progressPct = progress.expected && progress.expected > 0
    ? Math.min(100, Math.round((progress.submitted / progress.expected) * 100))
    : 0
  const missingLabels = progress.missingRoles.map(r => ROLE_META[r]?.label ?? r)
  // Deelnemers zonder gekozen rol. distributeRoles() slaat die over, dus zij
  // krijgen geen enkele optie te zien — en dat is onzichtbaar als je alleen
  // naar de inzendingen kijkt.
  const zonderRol = session.participants.filter(p => !p.role).map(p => p.name)

  const submissions = session.submittedDecisions ?? []
  const currentRoundSubs = submissions.filter(d => d.roundIndex === currentIndex)
  const pending = session.activeDecision?.pendingByParticipant
  const missingSet = new Set(progress.missingRoles)

  const rows = session.participants.map(p => {
    const roles = rolesForParticipant(session, p.id)
    const submitted = currentRoundSubs.filter(d => d.participantId === p.id).length
    // De store houdt alleen tijdens de beslisfase een eigen totaal bij. Valt
    // dat weg, dan is het verschuldigde aantal: wat deze deelnemer al indiende
    // plus zijn eigen rollen die nog open staan. Een harde 1 gaf eerder
    // "7/1 ingediend" bij iemand die zeven stoelen had overgenomen.
    const stillOwed = (roles?.all ?? []).filter(r => missingSet.has(r)).length
    const expected = pending?.[p.id]?.total ?? ((submitted + stillOwed) || null)
    const inherited = roles?.inherited ?? []
    return {
      id: p.id,
      name: p.name,
      primaryLabel: roles?.primary ? ROLE_META[roles.primary]?.label ?? roles.primary : null,
      inheritedCount: inherited.length,
      inheritedLabels: inherited.map(r => ROLE_META[r]?.label ?? r),
      submitted,
      expected,
    }
  })

  const regulatory = describeRegulatoryStatus(session)
  const retainer = session.retainerActivation
    ? {
        tone: "ok" as Tone,
        text: `Retainer: geactiveerd in ronde ${session.retainerActivation.activatedAtRound}`,
      }
    : { tone: "muted" as Tone, text: "Retainer: niet geactiveerd" }

  // Latest 3 timeline events.
  const latest = [...(session.timeline ?? [])]
    .reverse()
    .filter(e => TRACKED_TYPES.has(e.type))
    .slice(0, 3)

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
      {/* 1. Waar staan we — ronde, fase, live. */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Activity className="size-3.5 text-primary" aria-hidden />
          <span className="font-mono text-[10px] uppercase tracking-wider text-primary">
            Ronde {currentIndex + 1} van {totalRounds} — fase: {ROUND_PHASE_LABELS_NL[phase].toLowerCase()}
          </span>
        </div>
        <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-primary">
          <span className="pulse-ring size-1.5 rounded-full bg-primary" />
          live
        </div>
      </div>

      {/* 2. Het enige grote cijfer op deze kaart: voortgang van deze ronde. */}
      <div className="flex flex-col gap-2 rounded-lg border border-border bg-card px-3 py-2.5">
        <p className="leading-none">
          <span className="font-mono text-2xl font-bold tabular-nums text-foreground">
            {progress.expected != null ? `${progress.submitted} van ${progress.expected}` : `${progress.submitted}`}
          </span>{" "}
          <span className="text-sm text-muted-foreground">ingediend</span>
        </p>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${progressPct}%` }} />
        </div>
        {missingLabels.length > 0 ? (
          <p className="flex items-start gap-1.5 text-[11px] leading-snug text-amber-700 dark:text-amber-400">
            <Hourglass className="mt-px size-3 shrink-0" aria-hidden />
            <span>
              Nog wachten op{" "}
              {missingLabels.length > 3
                ? `${missingLabels.slice(0, 3).join(", ")} en ${missingLabels.length - 3} andere`
                : missingLabels.join(", ")}
            </span>
          </p>
        ) : zonderRol.length > 0 ? (
          /* Hier stond "Geen rol houdt deze ronde nog tegen", ook als niemand
             een rol had gekozen. Dat las als "alles loopt" terwijl er juist
             niets kón lopen: de rolverdeling slaat deelnemers zonder gekozen
             rol over, dus die krijgen geen enkele keuze te zien. Nu staat er
             wat er aan de hand is én wat je eraan doet. */
          <p className="flex items-start gap-1.5 text-[11px] leading-snug text-amber-700 dark:text-amber-400">
            <Hourglass className="mt-px size-3 shrink-0" aria-hidden />
            <span>
              {zonderRol.length === 1
                ? `${zonderRol[0]} heeft nog geen rol gekozen en krijgt daardoor niets te beslissen.`
                : `${zonderRol.length} deelnemers hebben nog geen rol gekozen en krijgen daardoor niets te beslissen.`}
              {" "}Laat ze hun rol kiezen op hun eerste stap, of wijs er een toe bij Gereedschap.
            </span>
          </p>
        ) : (
          <p className="text-[11px] leading-snug text-muted-foreground">
            Geen rol houdt deze ronde nog tegen.
          </p>
        )}
      </div>

      {/* 3. Per deelnemer: eigen rol voluit, overgenomen rollen samengevat. */}
      <div className="flex flex-col gap-1">
        <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
          Per deelnemer
        </span>
        {rows.length === 0 ? (
          <p className="text-[11px] italic text-muted-foreground">Geen deelnemers</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {rows.map(r => {
              const state = r.submitted === 0
                ? "none"
                : r.expected != null && r.submitted >= r.expected
                  ? "full"
                  : "partial"
              const dotClass =
                state === "full" ? "bg-emerald-500"
                : state === "partial" ? "bg-amber-500"
                : "bg-rose-500"
              return (
                <li key={r.id} className="flex items-center gap-2 text-[11px]">
                  <span
                    className={`size-2 shrink-0 rounded-full ${dotClass}`}
                    aria-hidden
                  />
                  <span className="truncate text-foreground">{r.name}</span>
                  <span className="shrink-0 text-muted-foreground">
                    · {r.primaryLabel ?? "geen eigen rol"}
                  </span>
                  {r.inheritedCount > 0 && (
                    <span
                      className="shrink-0 rounded-full border border-dashed border-border px-1.5 font-mono text-[9px] text-muted-foreground"
                      title={`Overgenomen rollen: ${r.inheritedLabels.join(", ")}`}
                    >
                      +{r.inheritedCount} overgenomen
                    </span>
                  )}
                  <span className="ml-auto shrink-0 font-mono text-muted-foreground">
                    {r.expected != null
                      ? `${r.submitted} van ${r.expected} ingediend`
                      : `${r.submitted} ingediend`}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* 4. Secundaire status — icoon en kleur in plaats van nog een kopregel. */}
      <div className="grid grid-cols-1 gap-2 border-t border-primary/20 pt-3 sm:grid-cols-2">
        <StatusChip
          icon={regulatory.tone === "ok" ? FileCheck2 : ShieldAlert}
          label="Meldplicht"
          value={regulatory.text}
          tone={regulatory.tone}
        />
        <StatusChip icon={LifeBuoy} label="IR-retainer" value={retainer.text} tone={retainer.tone} />
      </div>

      {/* 5. De zes dimensies — pas als er een ronde met inzending is afgerond. */}
      {cumulative.hasAny ? (
        <details className="group rounded-lg border border-border bg-card">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2">
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Cumulatieve uitkomst na {cumulative.completedRounds}{" "}
              {cumulative.completedRounds === 1 ? "afgeronde ronde" : "afgeronde rondes"}
            </span>
            <span className="text-[8px] text-muted-foreground opacity-60 group-open:hidden">▶</span>
            <span className="hidden text-[8px] text-muted-foreground opacity-60 group-open:inline">▼</span>
          </summary>
          <div className="px-3 pb-3">
            <DimensionImpactList vector={cumulative.perDim} />
          </div>
        </details>
      ) : (
        <p className="text-[11px] leading-snug text-muted-foreground">
          Nog geen afgeronde ronde met een inzending — de gevolgen per dimensie verschijnen daarna.
        </p>
      )}

      {/* 6. Laatste gebeurtenissen — alleen nodig als je terugkijkt. */}
      <details className="group rounded-lg border border-border bg-card">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2">
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Laatste gebeurtenissen ({latest.length})
          </span>
          <span className="text-[8px] text-muted-foreground opacity-60 group-open:hidden">▶</span>
          <span className="hidden text-[8px] text-muted-foreground opacity-60 group-open:inline">▼</span>
        </summary>
        <div className="px-3 pb-3">
          {latest.length === 0 ? (
            <p className="text-[11px] italic text-muted-foreground">Geen gebeurtenissen</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {latest.map(ev => (
                <li key={ev.id} className="flex items-start gap-2 text-[11px]">
                  <span className="mt-0.5 shrink-0 font-mono text-[9px] text-muted-foreground">
                    {new Date(ev.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <span className="leading-snug text-foreground">{summariseEvent(ev)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </details>
    </section>
  )
}

// ─── helpers ────────────────────────────────────────────────────────────

function StatusChip({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: LucideIcon
  label: string
  value: string
  tone: Tone
}) {
  return (
    <div className={`flex min-w-0 items-start gap-2 rounded-md border px-2.5 py-1.5 ${TONE_CLASS[tone]}`}>
      <Icon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      <span className="min-w-0">
        <span className="block font-mono text-[9px] uppercase tracking-wider opacity-70">{label}</span>
        <span className="block text-[11px] leading-snug">{value}</span>
      </span>
    </div>
  )
}

function emptyVector(): Record<OutcomeDimension, number> {
  return { CONT: 0, FOR: 0, BC: 0, JUR: 0, VER: 0, KOS: 0 }
}

function describeRegulatoryStatus(session: SessionState): { tone: Tone; text: string } {
  const regime = session.regulatoryRegime
  const obligations = session.regulatoryObligations ?? []
  if (!regime || obligations.length === 0) {
    return { tone: "muted", text: "Geen open verplichting" }
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
    return {
      // Minder dan een kwart van de termijn over: dan is dit het blok waar de
      // facilitator naar moet kijken.
      tone: hoursLeft <= (milestone?.deadlineHours ?? 0) / 4 ? "bad" : "warn",
      text: `Open · ${label} · ${(milestone?.deadlineHours ?? 0)}u deadline (nog ${hoursLeft.toFixed(1)}u)`,
    }
  }
  const filed = obligations.find(o => o.status === "filed")
  if (filed) {
    const milestone = regime.milestones.find(m => m.id === filed.milestoneId)
    const deadlineHour = filed.openedAtHour + (milestone?.deadlineHours ?? 0)
    const onTime = filed.filedAtHour !== undefined && filed.filedAtHour <= deadlineHour
    return {
      tone: onTime ? "ok" : "warn",
      text: `Ingediend in R${filed.filedAtRound ?? "?"} (${onTime ? "op tijd" : "te laat"})`,
    }
  }
  const expired = obligations.find(o => o.status === "expired")
  if (expired) {
    return { tone: "bad", text: "Vervallen — niet ingediend" }
  }
  return { tone: "muted", text: "Geen open verplichting" }
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
