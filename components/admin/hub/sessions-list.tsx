"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Play, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "./toast"
import type { SessionSnapshot } from "@/lib/admin/sessions-archive"

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString("nl-NL", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
}

export function SessionsList() {
  const [snapshots, setSnapshots] = useState<SessionSnapshot[]>([])
  const [loading, setLoading] = useState(true)
  const toast = useToast()

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/sessions")
      const data = await res.json() as { snapshots: SessionSnapshot[] }
      setSnapshots(data.snapshots)
    } catch (e) {
      toast.push("error", `Laden mislukt: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { void reload() }, [reload])

  async function del(s: SessionSnapshot) {
    if (!confirm(`Sessie-snapshot van ${formatDate(s.startedAt)} verwijderen?`)) return
    try {
      const res = await fetch(`/api/admin/sessions?id=${encodeURIComponent(s.id)}`, { method: "DELETE" })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      toast.push("success", "Verwijderd")
      await reload()
    } catch (e) {
      toast.push("error", `Verwijderen mislukt: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  return (
    <section className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Sessies</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Snapshot per sessie — datum, klant, scenario, modus, deelnemers, uitkomst.
          Nieuwe sessie starten via een klant of scenario, of via <Link href="/admin/prepare" className="text-primary hover:underline">Sessie starten</Link>.
        </p>
        <p className="text-xs text-amber-700 dark:text-amber-500 mt-2">
          Opslag is bewust simpel — één snapshot per sessie in KV, geen relationeel model. Ontstaat automatisch bij het resetten of eindigen van een live sessie.
        </p>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Laden…</p>}

      {!loading && snapshots.length === 0 && (
        <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">Nog geen sessies gedraaid.</p>
          <p className="text-xs text-muted-foreground mt-1">
            Start een sessie via <Link href="/admin/prepare" className="text-primary hover:underline">Sessie starten</Link>. Na afloop verschijnt hij hier automatisch.
          </p>
        </div>
      )}

      {!loading && snapshots.length > 0 && (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 border-b border-border">
              <tr>
                <th className="px-4 py-2 text-left font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Datum</th>
                <th className="px-4 py-2 text-left font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Klant</th>
                <th className="px-4 py-2 text-left font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Scenario</th>
                <th className="px-4 py-2 text-left font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Modus</th>
                <th className="px-4 py-2 text-right font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Deelnemers</th>
                <th className="px-4 py-2 text-left font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Status</th>
                <th className="px-4 py-2 text-left font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Uitkomst</th>
                <th className="px-4 py-2 text-right"></th>
              </tr>
            </thead>
            <tbody>
              {snapshots.map(s => (
                <tr key={s.id} className="border-t border-border hover:bg-muted/20">
                  <td className="px-4 py-2">
                    <Link href={`/admin/sessions/${encodeURIComponent(s.id)}`} className="text-primary hover:underline">
                      {formatDate(s.startedAt)}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">{s.clientName ?? "—"}</td>
                  <td className="px-4 py-2">{s.scenarioName}</td>
                  <td className="px-4 py-2 font-mono text-xs">{s.mode}</td>
                  <td className="px-4 py-2 text-right font-mono">{s.participantCount}</td>
                  <td className="px-4 py-2">
                    <span className={`font-mono text-[10px] uppercase tracking-wider ${
                      s.status === "ended" ? "text-emerald-600 dark:text-emerald-400" :
                      s.status === "active" ? "text-primary" :
                      "text-muted-foreground"
                    }`}>{s.status}</span>
                  </td>
                  <td className="px-4 py-2 text-xs">{s.finalOutcomeLabel ?? "—"}</td>
                  <td className="px-4 py-2 text-right">
                    <Button size="sm" variant="ghost" className="h-8 px-2 hover:text-destructive" onClick={() => del(s)}>
                      <Trash2 className="size-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
