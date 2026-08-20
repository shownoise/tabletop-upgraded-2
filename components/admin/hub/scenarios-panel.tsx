"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Plus, Sparkles, Copy, Pencil, Trash2, ExternalLink, Loader2, Search, Archive, ArchiveRestore, Play } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "./toast"
import type { ScenarioGraph } from "@/lib/graph/types"
import type { AdminClient } from "@/lib/admin/clients"

function newId(): string {
  return `sg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function formatWhen(ts: number): string {
  const now = Date.now()
  const diffMin = Math.floor((now - ts) / 60000)
  if (diffMin < 1) return "zojuist"
  if (diffMin < 60) return `${diffMin} min geleden`
  if (diffMin < 24 * 60) return `${Math.floor(diffMin / 60)}u geleden`
  return new Date(ts).toLocaleDateString("nl-NL")
}

interface GraphWithMeta extends ScenarioGraph {
  clientId?: string
  clientName?: string
  sector?: string
  archived?: boolean
}

export function ScenariosPanel() {
  const [graphs, setGraphs] = useState<GraphWithMeta[]>([])
  const [clients, setClients] = useState<AdminClient[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [clientFilter, setClientFilter] = useState("")
  const [sectorFilter, setSectorFilter] = useState("")
  const [sortBy, setSortBy] = useState<"updated" | "name" | "rounds">("updated")
  const [showArchived, setShowArchived] = useState(false)
  const [renaming, setRenaming] = useState<string | null>(null)
  const [renameVal, setRenameVal] = useState("")
  const [duplicating, setDuplicating] = useState<GraphWithMeta | null>(null)
  const [dupClientId, setDupClientId] = useState("")
  const [dupName, setDupName] = useState("")
  const toast = useToast()

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const [gRes, cRes] = await Promise.all([
        fetch("/api/scenario-graph"),
        fetch("/api/admin/clients"),
      ])
      const gData = gRes.ok ? await gRes.json() as { graphs: GraphWithMeta[] } : { graphs: [] }
      const cData = cRes.ok ? await cRes.json() as { clients: AdminClient[] } : { clients: [] }
      setGraphs(gData.graphs)
      setClients(cData.clients)
    } catch (e) {
      toast.push("error", `Laden mislukt: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { void reload() }, [reload])

  const sectors = useMemo(() => {
    const s = new Set<string>()
    for (const g of graphs) if (g.sector) s.add(g.sector)
    return [...s].sort()
  }, [graphs])

  const filtered = useMemo(() => {
    let out = graphs
    if (!showArchived) out = out.filter(g => !g.archived)
    if (clientFilter) out = out.filter(g => g.clientId === clientFilter)
    if (sectorFilter) out = out.filter(g => g.sector === sectorFilter)
    if (search) {
      const q = search.toLowerCase()
      out = out.filter(g => g.name.toLowerCase().includes(q))
    }
    if (sortBy === "name") out = [...out].sort((a, b) => a.name.localeCompare(b.name))
    else if (sortBy === "rounds") out = [...out].sort((a, b) => b.nodes.filter(n => n.type === "round").length - a.nodes.filter(n => n.type === "round").length)
    else out = [...out].sort((a, b) => b.updatedAt - a.updatedAt)
    return out
  }, [graphs, clientFilter, sectorFilter, search, showArchived, sortBy])

  async function saveGraph(g: ScenarioGraph) {
    const res = await fetch("/api/scenario-graph", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(g),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
  }

  async function duplicate() {
    if (!duplicating) return
    setBusy(duplicating.id)
    try {
      const targetClient = clients.find(c => c.id === dupClientId)
      const copy: GraphWithMeta = {
        ...duplicating,
        id: newId(),
        name: dupName.trim() || `${duplicating.name} (kopie)`,
        clientId: dupClientId || undefined,
        clientName: targetClient?.name,
        sector: targetClient?.sector ?? duplicating.sector,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      await saveGraph(copy)
      toast.push("success", `Gedupliceerd${targetClient ? ` voor ${targetClient.name}` : ""}`)
      setDuplicating(null); setDupClientId(""); setDupName("")
      await reload()
    } catch (e) {
      toast.push("error", `Dupliceren mislukt: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setBusy(null)
    }
  }

  async function rename(g: GraphWithMeta, newName: string) {
    const trimmed = newName.trim()
    if (!trimmed || trimmed === g.name) { setRenaming(null); return }
    setBusy(g.id)
    try {
      await saveGraph({ ...g, name: trimmed, updatedAt: Date.now() })
      toast.push("success", "Hernoemd")
      setRenaming(null)
      await reload()
    } catch (e) {
      toast.push("error", `Hernoemen mislukt: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setBusy(null)
    }
  }

  async function del(g: GraphWithMeta) {
    if (!confirm(`Scenario "${g.name}" verwijderen? Dit is definitief.`)) return
    setBusy(g.id)
    try {
      const res = await fetch(`/api/scenario-graph?id=${encodeURIComponent(g.id)}`, { method: "DELETE" })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      toast.push("success", "Verwijderd")
      await reload()
    } catch (e) {
      toast.push("error", `Verwijderen mislukt: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setBusy(null)
    }
  }

  async function toggleArchive(g: GraphWithMeta) {
    setBusy(g.id)
    try {
      const patched: GraphWithMeta = { ...g, archived: !g.archived, updatedAt: Date.now() }
      await saveGraph(patched)
      toast.push("success", patched.archived ? "Gearchiveerd" : "Uit archief")
      await reload()
    } catch (e) {
      toast.push("error", `Archiveren mislukt: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="flex flex-col gap-6">
      <div className="flex items-baseline justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Scenario's</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {graphs.filter(g => !g.archived).length} actief · {graphs.filter(g => g.archived).length} gearchiveerd
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/builder?wizard=1">
            <Button size="sm" className="gap-1.5">
              <Sparkles className="size-3.5" /> AI-wizard
            </Button>
          </Link>
          <Link href="/admin/builder">
            <Button size="sm" variant="outline" className="gap-1.5">
              <Plus className="size-3.5" /> Leeg scenario
            </Button>
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-lg border border-border bg-card p-3 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <Search className="size-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Zoek op naam…" className="h-8 border-0 shadow-none focus-visible:ring-0 px-0" />
        </div>
        <select value={clientFilter} onChange={e => setClientFilter(e.target.value)} className="h-8 rounded border border-border bg-background px-2 text-sm">
          <option value="">Alle klanten</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={sectorFilter} onChange={e => setSectorFilter(e.target.value)} className="h-8 rounded border border-border bg-background px-2 text-sm">
          <option value="">Alle sectoren</option>
          {sectors.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={sortBy} onChange={e => setSortBy(e.target.value as "updated" | "name" | "rounds")} className="h-8 rounded border border-border bg-background px-2 text-sm">
          <option value="updated">Sorteer: recent</option>
          <option value="name">Sorteer: naam</option>
          <option value="rounds">Sorteer: rondes</option>
        </select>
        <label className="flex items-center gap-1.5 text-xs cursor-pointer">
          <input type="checkbox" checked={showArchived} onChange={e => setShowArchived(e.target.checked)} className="size-3.5" />
          Toon gearchiveerd
        </label>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Laden…</p>}

      {!loading && filtered.length === 0 && (
        <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">
            {graphs.length === 0 ? "Nog geen scenario's." : "Geen scenario's die aan de filters voldoen."}
          </p>
          {graphs.length === 0 && (
            <div className="mt-3 flex gap-2 justify-center">
              <Link href="/admin/builder?wizard=1">
                <Button size="sm" className="gap-1.5"><Sparkles className="size-3.5" /> Start met de wizard</Button>
              </Link>
            </div>
          )}
        </div>
      )}

      {!loading && filtered.length > 0 && (
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
              {filtered.map(g => {
                const rounds = g.nodes.filter(n => n.type === "round").length
                const isRenaming = renaming === g.id
                const isBusy = busy === g.id
                return (
                  <tr key={g.id} className={`border-t border-border hover:bg-muted/20 ${g.archived ? "opacity-60" : ""}`}>
                    <td className="px-4 py-2">
                      {isRenaming ? (
                        <form onSubmit={e => { e.preventDefault(); void rename(g, renameVal) }} className="flex gap-2">
                          <Input value={renameVal} onChange={e => setRenameVal(e.target.value)} autoFocus className="h-8" />
                          <Button type="submit" size="sm" className="h-8">Save</Button>
                          <Button type="button" size="sm" variant="ghost" className="h-8" onClick={() => setRenaming(null)}>×</Button>
                        </form>
                      ) : (
                        <Link href={`/admin/builder?id=${encodeURIComponent(g.id)}`} className="font-medium hover:underline">
                          {g.name}
                          {g.archived && <span className="ml-2 font-mono text-[9px] uppercase text-muted-foreground">gearchiveerd</span>}
                        </Link>
                      )}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">{g.clientName ?? "—"}</td>
                    <td className="px-4 py-2 text-muted-foreground">{g.sector ?? "—"}</td>
                    <td className="px-4 py-2 text-right font-mono">{rounds}</td>
                    <td className="px-4 py-2 text-muted-foreground">{formatWhen(g.updatedAt)}</td>
                    <td className="px-4 py-2">
                      <div className="flex items-center justify-end gap-1">
                        <Link href={`/admin/prepare?graphId=${encodeURIComponent(g.id)}`}>
                          <Button size="sm" variant="default" title="Sessie starten met dit scenario" className="h-8 px-2 gap-1">
                            <Play className="size-3.5" />
                          </Button>
                        </Link>
                        <Link href={`/admin/builder?id=${encodeURIComponent(g.id)}`}>
                          <Button size="sm" variant="ghost" title="Openen in builder" className="h-8 px-2">
                            <ExternalLink className="size-3.5" />
                          </Button>
                        </Link>
                        <Button size="sm" variant="ghost" title="Dupliceren" className="h-8 px-2" disabled={isBusy} onClick={() => { setDuplicating(g); setDupClientId(g.clientId ?? ""); setDupName(`${g.name} (kopie)`) }}>
                          {isBusy ? <Loader2 className="size-3.5 animate-spin" /> : <Copy className="size-3.5" />}
                        </Button>
                        <Button size="sm" variant="ghost" title="Hernoemen" className="h-8 px-2" disabled={isBusy} onClick={() => { setRenaming(g.id); setRenameVal(g.name) }}>
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" title={g.archived ? "Uit archief" : "Archiveren"} className="h-8 px-2" disabled={isBusy} onClick={() => toggleArchive(g)}>
                          {g.archived ? <ArchiveRestore className="size-3.5" /> : <Archive className="size-3.5" />}
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

      {/* Duplicate modal */}
      {duplicating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-lg">
            <h3 className="font-semibold text-lg mb-1">Scenario dupliceren</h3>
            <p className="text-sm text-muted-foreground mb-4">Kies eventueel een andere klant om aan te koppelen.</p>
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs">Nieuwe naam</label>
                <Input value={dupName} onChange={e => setDupName(e.target.value)} />
              </div>
              <div>
                <label className="text-xs">Klant</label>
                <select value={dupClientId} onChange={e => setDupClientId(e.target.value)} className="w-full h-9 rounded border border-border bg-background px-2 text-sm">
                  <option value="">— geen (loskoppelen)</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="flex justify-end gap-2 mt-2">
                <Button size="sm" variant="ghost" onClick={() => setDuplicating(null)}>Annuleren</Button>
                <Button size="sm" onClick={duplicate}>Dupliceren</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
