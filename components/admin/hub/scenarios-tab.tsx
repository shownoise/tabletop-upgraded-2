"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Plus, Sparkles, Copy, Pencil, Trash2, ExternalLink, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { ScenarioGraph } from "@/lib/graph/types"

interface ScenarioRow {
  id: string
  name: string
  clientName?: string
  sector?: string
  rounds: number
  updatedAt: number
}

function summarize(g: ScenarioGraph): ScenarioRow {
  const rounds = g.nodes.filter(n => n.type === "round").length
  // Prefer wizard-config-driven fields waar aanwezig; anders derived uit briefings/graph.
  const clientName = (g as unknown as { clientName?: string }).clientName
  const sector = (g as unknown as { sector?: string }).sector
  return {
    id: g.id,
    name: g.name,
    clientName,
    sector,
    rounds,
    updatedAt: g.updatedAt,
  }
}

async function fetchList(): Promise<ScenarioGraph[]> {
  const res = await fetch("/api/scenario-graph")
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = await res.json() as { graphs: ScenarioGraph[] }
  return data.graphs
}

async function saveGraph(g: ScenarioGraph): Promise<void> {
  const res = await fetch("/api/scenario-graph", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(g),
  })
  if (!res.ok) throw new Error(`Save failed: HTTP ${res.status}`)
}

async function deleteGraph(id: string): Promise<void> {
  const res = await fetch(`/api/scenario-graph?id=${encodeURIComponent(id)}`, { method: "DELETE" })
  if (!res.ok) throw new Error(`Delete failed: HTTP ${res.status}`)
}

function newId(): string {
  return `sg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function formatWhen(ts: number): string {
  const d = new Date(ts)
  const now = Date.now()
  const diffMin = Math.floor((now - ts) / 60000)
  if (diffMin < 1) return "zojuist"
  if (diffMin < 60) return `${diffMin} min geleden`
  if (diffMin < 24 * 60) return `${Math.floor(diffMin / 60)}u geleden`
  return d.toLocaleDateString("nl-NL")
}

export function ScenariosTab() {
  const [graphs, setGraphs] = useState<ScenarioGraph[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [renaming, setRenaming] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState("")
  const [busy, setBusy] = useState<string | null>(null)

  async function refresh() {
    setLoading(true)
    try {
      const list = await fetchList()
      list.sort((a, b) => b.updatedAt - a.updatedAt)
      setGraphs(list)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void refresh() }, [])

  async function duplicate(g: ScenarioGraph) {
    setBusy(g.id)
    try {
      const copy: ScenarioGraph = {
        ...g,
        id: newId(),
        name: `${g.name} (kopie)`,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      await saveGraph(copy)
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(null)
    }
  }

  async function rename(g: ScenarioGraph, newName: string) {
    const trimmed = newName.trim()
    if (!trimmed || trimmed === g.name) { setRenaming(null); return }
    setBusy(g.id)
    try {
      await saveGraph({ ...g, name: trimmed, updatedAt: Date.now() })
      setRenaming(null)
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(null)
    }
  }

  async function del(g: ScenarioGraph) {
    if (!confirm(`Scenario "${g.name}" verwijderen? Deze actie is definitief.`)) return
    setBusy(g.id)
    try {
      await deleteGraph(g.id)
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="flex flex-col gap-6">
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Scenario's</h2>
          <p className="text-sm text-muted-foreground mt-1">Bibliotheek van scenario-graphs. Nieuw via AI-wizard, hergebruiken via duplicaat.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/builder?wizard=1">
            <Button size="sm" variant="default" className="gap-1.5">
              <Sparkles className="size-3.5" /> AI-wizard
            </Button>
          </Link>
          <Link href="/admin/builder">
            <Button size="sm" variant="outline" className="gap-1.5">
              <Plus className="size-3.5" /> Nieuw scenario
            </Button>
          </Link>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {loading && <p className="text-sm text-muted-foreground">Laden…</p>}

      {!loading && graphs.length === 0 && !error && (
        <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">Nog geen scenario's.</p>
          <p className="text-xs text-muted-foreground mt-1">Start met de AI-wizard of maak een leeg scenario aan.</p>
        </div>
      )}

      {!loading && graphs.length > 0 && (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 border-b border-border">
              <tr>
                <th className="px-4 py-2 text-left font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Naam</th>
                <th className="px-4 py-2 text-left font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Klant</th>
                <th className="px-4 py-2 text-left font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Sector</th>
                <th className="px-4 py-2 text-right font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Rondes</th>
                <th className="px-4 py-2 text-left font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Gewijzigd</th>
                <th className="px-4 py-2 text-right font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Acties</th>
              </tr>
            </thead>
            <tbody>
              {graphs.map(g => {
                const row = summarize(g)
                const isBusy = busy === g.id
                const isRenaming = renaming === g.id
                return (
                  <tr key={g.id} className="border-t border-border hover:bg-muted/20">
                    <td className="px-4 py-2">
                      {isRenaming ? (
                        <form
                          onSubmit={e => { e.preventDefault(); void rename(g, renameValue) }}
                          className="flex gap-2"
                        >
                          <Input
                            value={renameValue}
                            onChange={e => setRenameValue(e.target.value)}
                            autoFocus
                            className="h-8"
                          />
                          <Button type="submit" size="sm" className="h-8">Save</Button>
                          <Button type="button" size="sm" variant="ghost" className="h-8" onClick={() => setRenaming(null)}>×</Button>
                        </form>
                      ) : (
                        <span className="font-medium">{row.name}</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">{row.clientName ?? "—"}</td>
                    <td className="px-4 py-2 text-muted-foreground">{row.sector ?? "—"}</td>
                    <td className="px-4 py-2 text-right font-mono">{row.rounds}</td>
                    <td className="px-4 py-2 text-muted-foreground">{formatWhen(row.updatedAt)}</td>
                    <td className="px-4 py-2">
                      <div className="flex items-center justify-end gap-1">
                        <Link href={`/admin/builder?id=${encodeURIComponent(g.id)}`}>
                          <Button size="sm" variant="ghost" title="Openen in builder" className="h-8 px-2">
                            <ExternalLink className="size-3.5" />
                          </Button>
                        </Link>
                        <Button size="sm" variant="ghost" title="Dupliceren" className="h-8 px-2" disabled={isBusy} onClick={() => duplicate(g)}>
                          {isBusy ? <Loader2 className="size-3.5 animate-spin" /> : <Copy className="size-3.5" />}
                        </Button>
                        <Button size="sm" variant="ghost" title="Hernoemen" className="h-8 px-2" disabled={isBusy} onClick={() => { setRenaming(g.id); setRenameValue(g.name) }}>
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" title="Verwijderen" className="h-8 px-2 hover:text-destructive" disabled={isBusy} onClick={() => del(g)}>
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
