"use client"

import { useEffect, useState } from "react"
import type { AssessmentReport } from "@/lib/scoring"
import type { SessionState, Role } from "@/lib/types"
import { ROLE_META } from "@/lib/types"
import { effectiveRolesForParticipant } from "@/lib/engine/distribute-roles"

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

  // Trend: only render outcomes for rounds that have actually completed
  // (round.round <= currentRound). Never pre-fill future rounds.
  const completedOutcomes = report?.outcomes.filter(o => o.round <= currentRound) ?? []

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
                          <span className={`font-mono text-sm font-bold ${positive ? "text-emerald-600" : "text-rose-600"}`}>
                            {positive ? "+" : ""}{value.toFixed(1)} — {positive ? "positief" : "negatief"}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-snug">{dim.hint}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5 italic">{dim.direction}</p>
                      </div>
                    )
                  })}
                </div>
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
