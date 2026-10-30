"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Building2, Loader2, Plus, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { AdminClient } from "@/lib/admin/clients"
import { EIGEN_ORGANISATIE_SEED, EYE_SECURITY_CLIENT_ID } from "@/lib/admin/seed-clients"
import { ROLE_META } from "@/lib/types"

async function fetchClients(): Promise<AdminClient[]> {
  const res = await fetch("/api/admin/clients")
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = await res.json() as { clients: AdminClient[] }
  return data.clients
}

export function ClientsList() {
  const [clients, setClients] = useState<AdminClient[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [bezig, setBezig] = useState(false)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const list = await fetchClients()
      setClients(list)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void reload() }, [reload])

  // Seed-endpoint, niet het gewone aanmaken: dat slaat bestaande id's over,
  // dus twee keer klikken maakt geen tweede Eye Security.
  async function maakEigenOrganisatie() {
    setBezig(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seed: EIGEN_ORGANISATIE_SEED }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      await reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBezig(false)
    }
  }

  const realClients = clients.filter(c => !c.isTestClient)
  const filtered = realClients.filter(c => {
    if (!search) return true
    const q = search.toLowerCase()
    return c.name.toLowerCase().includes(q) || c.sector.toLowerCase().includes(q)
  })

  return (
    <section className="flex flex-col gap-6">
      <div className="flex items-baseline justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Klanten</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {realClients.length} klant{realClients.length === 1 ? "" : "en"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* De eigen organisatie met één klik, want de gegevens zijn bekend en
              het Eye Security-scenario hangt aan dit klant-id. Verschijnt alleen
              zolang hij er niet staat. */}
          {!loading && !clients.some(c => c.id === EYE_SECURITY_CLIENT_ID) && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              disabled={bezig}
              onClick={() => void maakEigenOrganisatie()}
            >
              {bezig ? <Loader2 className="size-3.5 animate-spin" /> : <Building2 className="size-3.5" />}
              Eye Security aanmaken
            </Button>
          )}
          <Link href="/admin/clients/new">
            <Button size="sm" className="gap-1.5">
              <Plus className="size-3.5" /> Nieuwe klant
            </Button>
          </Link>
        </div>
      </div>

      {realClients.length > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-card p-3">
          <Search className="size-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Zoek op naam of sector…"
            className="h-8 border-0 shadow-none focus-visible:ring-0 px-0"
          />
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
      {loading && <p className="text-sm text-muted-foreground">Laden…</p>}

      {!loading && realClients.length === 0 && !error && (
        <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center flex flex-col items-center gap-3">
          <p className="text-sm">Nog geen klanten aangemaakt.</p>
          <Link href="/admin/clients/new">
            <Button size="sm" className="gap-1.5">
              <Plus className="size-3.5" /> Nieuwe klant
            </Button>
          </Link>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map(c => (
            <Link
              key={c.id}
              href={`/admin/clients/${encodeURIComponent(c.id)}`}
              className="rounded-lg border border-border bg-card p-4 hover:border-primary/40 transition-colors"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="font-medium leading-tight">{c.name}</h3>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2">{c.sector}</p>
              <div className="mt-3 flex items-center gap-3 text-[11px] text-muted-foreground">
                <span>{c.employees} medewerkers</span>
                <span>·</span>
                <span>{c.crisisTeamRoles.length} rollen bezet</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {c.crisisTeamRoles.slice(0, 5).map(r => (
                  <span key={r} className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                    {ROLE_META[r]?.label ?? r}
                  </span>
                ))}
                {c.crisisTeamRoles.length > 5 && (
                  <span className="font-mono text-[9px] px-1.5 py-0.5 text-muted-foreground">+{c.crisisTeamRoles.length - 5}</span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  )
}
