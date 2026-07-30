"use client"

import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import type { ScenarioGraph } from "@/lib/graph/types"

// Dry-run dialog (Deel B §7.7). Genereert een deterministische simulatie op
// basis van de huidige graph via lib/scoring/dry-run.ts, en toont de scoring-
// output. Vier strategieën: best_option / worst_option / random_seed /
// no_decision (time-out simulatie).

interface DryRunResult {
  totalPoints: number
  processAggregate: number | null
  scoringVersion: string
  outcomes: Array<{ round: number; points: number; normalized: number }>
  rolCoverage: number
  distinctOwners: number
}

export function DryRunDialog({
  open,
  onOpenChange,
  graph,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  graph: ScenarioGraph
}) {
  const [strategy, setStrategy] = useState<"best_option" | "worst_option" | "random_seed" | "no_decision">("best_option")
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<DryRunResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) { setResult(null); setError(null) }
  }, [open])

  async function run() {
    setBusy(true)
    setError(null)
    try {
      // Client-side dynamic import om bundle-grootte laag te houden.
      const { graphToScenarioSpec } = await import("@/lib/scoring/graph-adapter")
      const { dryRunAndScore } = await import("@/lib/scoring")
      const scenario = graphToScenarioSpec(graph)
      // Bepaal simulatie-rollen: unieke designedOwners uit alle decisionPoints,
      // aangevuld met CRISIS_LEAD als sluitstuk zodat elk domein bezet is.
      const roles = new Set<string>()
      for (const dp of scenario.decisionPoints) roles.add(dp.designedOwner)
      roles.add("CRISIS_LEAD")
      const { output } = dryRunAndScore({
        scenario,
        simulatedRoles: [...roles],
        strategy,
        seed: 42,
      })
      setResult({
        totalPoints: output.totalPoints,
        processAggregate: output.processAggregate,
        scoringVersion: output.scoringVersion,
        outcomes: output.outcomes.map(o => ({ round: o.round, points: o.points, normalized: o.normalized })),
        rolCoverage: output.roleResolution.rolCoverage,
        distinctOwners: output.roleResolution.distinctOwners,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Dry-run — scenario sanity check</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Simuleert de huidige graph met een gekozen strategie. Handig om te zien of alle rondes lopen,
            elke optie ooit bereikbaar is, en de punten in een redelijke bandbreedte vallen.
          </p>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono">Strategie:</span>
            <select
              value={strategy}
              onChange={e => setStrategy(e.target.value as typeof strategy)}
              className="rounded border border-border bg-background px-2 py-1 text-xs font-mono"
            >
              <option value="best_option">Best-option (altijd hoogste vector-som)</option>
              <option value="worst_option">Worst-option (altijd laagste)</option>
              <option value="random_seed">Random (deterministisch, seed=42)</option>
              <option value="no_decision">No decision (alle time-outs)</option>
            </select>
            <Button size="sm" onClick={run} disabled={busy}>
              {busy && <Loader2 className="size-3.5 animate-spin mr-1" />}
              Run
            </Button>
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          {result && (
            <div className="space-y-3 border rounded p-3 bg-muted/30">
              <div className="grid grid-cols-4 gap-2 text-center">
                <div><div className="text-[9px] font-mono text-muted-foreground uppercase">Punten totaal</div><div className="text-xl font-bold text-primary">{result.totalPoints}</div></div>
                <div><div className="text-[9px] font-mono text-muted-foreground uppercase">Proces (√)</div><div className="text-xl font-bold">{result.processAggregate?.toFixed(2) ?? "—"}</div></div>
                <div><div className="text-[9px] font-mono text-muted-foreground uppercase">RolCoverage</div><div className="text-xl font-bold">{(result.rolCoverage * 100).toFixed(0)}%</div></div>
                <div><div className="text-[9px] font-mono text-muted-foreground uppercase">Owners</div><div className="text-xl font-bold">{result.distinctOwners}</div></div>
              </div>
              <div>
                <div className="text-[9px] font-mono text-muted-foreground uppercase mb-1">Per ronde</div>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-muted-foreground">
                      <th className="text-left py-1">Ronde</th>
                      <th className="text-right py-1">Punten</th>
                      <th className="text-right py-1">Normalized</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.outcomes.map(o => (
                      <tr key={o.round} className="border-t border-border">
                        <td className="py-1 font-mono">R{o.round}</td>
                        <td className="text-right py-1 font-mono">{o.points}</td>
                        <td className="text-right py-1 font-mono">{o.normalized.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[10px] font-mono text-muted-foreground">
                Scoring-versie: {result.scoringVersion}
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
