"use client"

import { useEffect, useState } from "react"
import type { ScoringOutput } from "@/lib/scoring"

// Live scoring-panel voor de facilitator. Polt /api/session/score elke 5s
// zolang de sessie actief is en toont de resultaten uit `@exercise/scoring`.
//
// Toont per (proces-)dimensie de score + dataQuality, per ronde de outcome
// (points + normalized), en de rolresolutie in de kop. Verschijnt collapsed
// om het dashboard schoon te houden — klap open voor volledig beeld.

const DIM_LABELS: Record<string, string> = {
  BESLUIT: "Besluitvorming",
  MANDAAT: "Mandaat & escalatie",
  AANNAME: "Aannames expliciet",
  ADAPT:   "Adaptiviteit",
  EXTERN:  "Coördinatie externen",
  VOLHOUD: "Volhoudbaarheid",
  DELEN:   "Informatiedeling",
}

interface PerGroupResponse {
  perGroup: Record<string, ScoringOutput>
  groupNames: Record<string, string>
}

export function ScoringPanel({
  visible = true,
  pollMs = 5000,
  mode = "ASSESSMENT",
}: {
  visible?: boolean
  pollMs?: number
  mode?: "ASSESSMENT" | "EVENT"
}) {
  const [scoring, setScoring] = useState<ScoringOutput | null>(null)
  const [perGroup, setPerGroup] = useState<PerGroupResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!visible) return
    let cancelled = false
    async function tick() {
      try {
        // In EVENT-mode fetch we én de aggregate én per-groep.
        const [aggRes, groupRes] = await Promise.all([
          fetch(`/api/session/score?mode=${mode}`),
          mode === "EVENT" ? fetch(`/api/session/score?mode=EVENT&byGroup=true`) : Promise.resolve(null),
        ])
        if (!aggRes.ok) {
          const data = await aggRes.json().catch(() => ({}))
          if (!cancelled) setError(data.error ?? `HTTP ${aggRes.status}`)
          return
        }
        const agg = (await aggRes.json()) as ScoringOutput
        let groups: PerGroupResponse | null = null
        if (groupRes?.ok) {
          groups = (await groupRes.json()) as PerGroupResponse
        }
        if (!cancelled) { setScoring(agg); setPerGroup(groups); setError(null) }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err))
      }
    }
    tick()
    const id = setInterval(tick, pollMs)
    return () => { cancelled = true; clearInterval(id) }
  }, [visible, pollMs, mode])

  if (!visible) return null

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Scoring (@exercise/scoring)</span>
          {scoring && (
            <span className="font-mono text-[10px] text-muted-foreground">
              v{scoring.scoringVersion} · rolCov {(scoring.roleResolution.rolCoverage * 100).toFixed(0)}% · {scoring.roleResolution.distinctOwners} owners
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          {open ? "Inklappen ▲" : "Uitklappen ▼"}
        </button>
      </div>

      {error && (
        <p className="mt-2 text-xs text-destructive">Scoring niet beschikbaar: {error}</p>
      )}

      {!error && !scoring && (
        <p className="mt-2 text-xs text-muted-foreground">Laden…</p>
      )}

      {scoring && (
        <div className="mt-3">
          {/* Compact: totalPoints + processAggregate altijd zichtbaar */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded border border-border p-2">
              <div className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Punten totaal</div>
              <div className="text-2xl font-bold text-primary">{scoring.totalPoints}</div>
            </div>
            <div className="rounded border border-border p-2">
              <div className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Proces (√)</div>
              <div className="text-2xl font-bold">{scoring.processAggregate?.toFixed(2) ?? "—"}</div>
            </div>
            <div className="rounded border border-border p-2">
              <div className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Kalibratie</div>
              <div className="text-2xl font-bold">{scoring.calibration?.toFixed(2) ?? "—"}</div>
            </div>
          </div>

          {/* Per-groep leaderboard — alleen EVENT-mode */}
          {perGroup && Object.keys(perGroup.perGroup).length > 0 && (
            <div className="mt-4">
              <div className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground mb-1.5">Leaderboard per groep</div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-muted-foreground text-[10px] font-mono uppercase">
                    <th className="text-left px-2 py-1">#</th>
                    <th className="text-left px-2 py-1">Groep</th>
                    <th className="text-right px-2 py-1">Punten</th>
                    <th className="text-right px-2 py-1">Proces</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(perGroup.perGroup)
                    .map(([gid, out]) => ({ gid, name: perGroup.groupNames[gid] ?? gid, out }))
                    .sort((a, b) => b.out.totalPoints - a.out.totalPoints)
                    .map((e, i) => (
                      <tr key={e.gid} className={`border-t border-border ${i === 0 ? "bg-primary/5" : ""}`}>
                        <td className="px-2 py-1 font-mono font-bold">{i + 1}</td>
                        <td className="px-2 py-1">{e.name}</td>
                        <td className="px-2 py-1 text-right font-mono font-bold text-primary">{e.out.totalPoints}</td>
                        <td className="px-2 py-1 text-right font-mono">{e.out.processAggregate?.toFixed(2) ?? "—"}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}

          {open && (
            <div className="mt-4 space-y-4">
              {/* Procesdimensies */}
              <div>
                <div className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground mb-1.5">7 procesdimensies</div>
                <div className="grid grid-cols-1 gap-1 text-xs">
                  {Object.entries(scoring.dimensions).map(([key, dim]) => (
                    <div key={key} className="flex items-center justify-between rounded border border-border px-2 py-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] w-16 shrink-0">{key}</span>
                        <span className="text-muted-foreground">{DIM_LABELS[key] ?? key}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`font-mono text-[10px] px-1.5 rounded ${
                          dim.dataQuality === "measured" ? "bg-primary/10 text-primary" :
                          dim.dataQuality === "observation" ? "bg-amber-500/10 text-amber-700 dark:text-amber-400" :
                          "bg-muted text-muted-foreground"
                        }`}>
                          {dim.dataQuality === "measured" ? "meting" : dim.dataQuality === "observation" ? "obs" : "—"}
                        </span>
                        <span className="font-mono text-sm font-bold w-10 text-right">
                          {dim.value === null ? "—" : dim.value.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Uitkomst per ronde */}
              {scoring.outcomes.length > 0 && (
                <div>
                  <div className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground mb-1.5">Uitkomst per ronde</div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-muted-foreground text-[10px] font-mono uppercase">
                          <th className="text-left px-2 py-1">Ronde</th>
                          <th className="text-right px-2 py-1">Punten</th>
                          <th className="text-right px-2 py-1">Norm.</th>
                          <th className="text-right px-2 py-1">CONT</th>
                          <th className="text-right px-2 py-1">FOR</th>
                          <th className="text-right px-2 py-1">BC</th>
                          <th className="text-right px-2 py-1">JUR</th>
                          <th className="text-right px-2 py-1">VER</th>
                          <th className="text-right px-2 py-1">KOS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {scoring.outcomes.map(o => (
                          <tr key={o.round} className="border-t border-border">
                            <td className="px-2 py-1 font-mono">{o.round}</td>
                            <td className="px-2 py-1 text-right font-mono">{o.points}</td>
                            <td className="px-2 py-1 text-right font-mono">{o.normalized.toFixed(2)}</td>
                            {(['CONT','FOR','BC','JUR','VER','KOS'] as const).map(d => (
                              <td key={d} className="px-2 py-1 text-right font-mono text-muted-foreground">
                                {o.perDimension[d].toFixed(1)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Rolresolutie */}
              <div>
                <div className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground mb-1.5">Rolresolutie (effectiveOwner per domein)</div>
                <div className="grid grid-cols-2 gap-1 text-xs">
                  {Object.entries(scoring.roleResolution.effectiveOwners).map(([domain, owner]) => (
                    <div key={domain} className="flex justify-between px-2 py-0.5">
                      <span className="text-muted-foreground">{domain}</span>
                      <span className={`font-mono text-[10px] ${owner === "NPC" ? "text-amber-600" : ""}`}>{owner}</span>
                    </div>
                  ))}
                </div>
              </div>

              {scoring.droppedOptionalDecisions.length > 0 && (
                <p className="text-[11px] text-amber-700 dark:text-amber-400">
                  Verkorte versie: {scoring.droppedOptionalDecisions.length} optionele beslispunten overgeslagen (te weinig rolscheiding).
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
