"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Loader2, Save, Trash2, Sparkles, Play, FolderKanban } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { useToast, saveStatusText, type SaveState } from "./toast"
import { ROLE_META, ROLE_ORDER, type Role } from "@/lib/types"
import { newClientId, type AdminClient } from "@/lib/admin/clients"
import type { ScenarioGraph } from "@/lib/graph/types"
import type { SessionSnapshot } from "@/lib/admin/sessions-archive"

function emptyClient(): AdminClient {
  return {
    id: newClientId(),
    name: "",
    sector: "",
    employees: 0,
    itArrangement: "",
    crownJewels: "",
    crisisTeamRoles: [],
    regimeId: "nl_avg_nis2",
    isTestClient: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
}

export function ClientDetail({ id }: { id: string }) {
  const router = useRouter()
  const toast = useToast()
  const isNew = id === "new"
  const [client, setClient] = useState<AdminClient | null>(null)
  const [loading, setLoading] = useState(true)
  const [saveState, setSaveState] = useState<SaveState>("idle")
  const [scenarios, setScenarios] = useState<ScenarioGraph[]>([])
  const [sessions, setSessions] = useState<SessionSnapshot[]>([])
  // Snapshot van de laatst-opgeslagen client. Voorkomt dat autosave triggert
  // door alleen re-fetch (array-referenties zijn dan nieuw maar inhoud gelijk).
  const lastSavedSnapshotRef = useRef<string | null>(null)

  function clientSnapshot(c: AdminClient): string {
    // updatedAt weglaten — die verandert bij elke save.
    return JSON.stringify({ ...c, updatedAt: 0 })
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      if (isNew) {
        setClient(emptyClient())
      } else {
        const res = await fetch("/api/admin/clients")
        const data = await res.json() as { clients: AdminClient[] }
        const c = data.clients.find(x => x.id === id)
        if (!c) { toast.push("error", "Klant niet gevonden"); router.push("/admin/clients"); return }
        setClient(c)
        lastSavedSnapshotRef.current = clientSnapshot(c)
        // Bijbehorende scenario's ophalen — matcht via clientName in de graph metadata.
        const sres = await fetch("/api/scenario-graph")
        if (sres.ok) {
          const sdata = await sres.json() as { graphs: ScenarioGraph[] }
          setScenarios(sdata.graphs.filter(g => (g as unknown as { clientId?: string }).clientId === c.id))
        }
        const xres = await fetch("/api/admin/sessions")
        if (xres.ok) {
          const xdata = await xres.json() as { snapshots: SessionSnapshot[] }
          setSessions(xdata.snapshots.filter(s => s.clientId === c.id))
        }
      }
    } catch (e) {
      toast.push("error", `Laden mislukt: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setLoading(false)
    }
  }, [id, isNew, router, toast])

  useEffect(() => { void load() }, [load])

  async function save(next: AdminClient) {
    setSaveState("saving")
    try {
      const res = await fetch("/api/admin/clients", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ client: next }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      lastSavedSnapshotRef.current = clientSnapshot(next)
      setSaveState("saved")
      if (isNew) {
        toast.push("success", "Klant aangemaakt")
        router.push(`/admin/clients/${next.id}`)
      } else {
        // Bewuste stille save — geen toast bij elke autosave-tik, alleen
        // status-label in de header ("Opgeslagen"). Toast bij expliciete
        // acties (aanmaken, verwijderen) blijft.
      }
    } catch (e) {
      setSaveState("error")
      toast.push("error", `Opslaan mislukt: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  // Autosave debounce — na 800ms van geen wijzigingen automatisch opslaan.
  // Alleen voor bestaande klanten; new-klant wordt met explicit knop opgeslagen.
  // Skip als de huidige client identiek is aan wat we het laatst hebben opgeslagen —
  // voorkomt een save/reload loop bij re-fetch (nieuwe array-referenties, gelijke inhoud).
  useEffect(() => {
    if (!client || isNew) return
    if (saveState === "saving") return
    const snapshot = clientSnapshot(client)
    if (lastSavedSnapshotRef.current === snapshot) return
    const t = setTimeout(() => { void save({ ...client, updatedAt: Date.now() }) }, 800)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client?.name, client?.sector, client?.employees, client?.itArrangement, client?.crownJewels, client?.crisisTeamRoles, client?.regimeId, client?.isTestClient, client?.notes])

  async function del() {
    if (!client || isNew) return
    if (!confirm(`"${client.name}" verwijderen?`)) return
    try {
      const res = await fetch(`/api/admin/clients?id=${encodeURIComponent(client.id)}`, { method: "DELETE" })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      toast.push("success", "Klant verwijderd")
      router.push("/admin/clients")
    } catch (e) {
      toast.push("error", `Verwijderen mislukt: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  const status = useMemo(() => saveStatusText(saveState), [saveState])

  if (loading || !client) return <p className="text-sm text-muted-foreground">Laden…</p>

  function update<K extends keyof AdminClient>(key: K, value: AdminClient[K]) {
    setClient(prev => prev ? { ...prev, [key]: value } : prev)
  }

  function toggleRole(r: Role) {
    setClient(prev => {
      if (!prev) return prev
      const has = prev.crisisTeamRoles.includes(r)
      return { ...prev, crisisTeamRoles: has ? prev.crisisTeamRoles.filter(x => x !== r) : [...prev.crisisTeamRoles, r] }
    })
  }

  return (
    <section className="flex flex-col gap-6">
      <div className="flex items-baseline justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">{isNew ? "Nieuwe klant" : (client.name || "Klant zonder naam")}</h2>
          {!isNew && <p className="text-sm text-muted-foreground mt-1">{client.sector}</p>}
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-xs ${status.className}`}>{status.label}</span>
          {isNew ? (
            <Button size="sm" onClick={() => save(client)} disabled={!client.name} className="gap-1.5">
              <Save className="size-3.5" /> Aanmaken
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={del} className="gap-1.5 text-destructive hover:bg-destructive/10">
              <Trash2 className="size-3.5" /> Verwijderen
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left col — form */}
        <div className="md:col-span-2 flex flex-col gap-4">
          <div className="rounded-lg border border-border bg-card p-5 flex flex-col gap-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Naam</Label>
                <Input value={client.name} onChange={e => update("name", e.target.value)} placeholder="Bijv. GGZ De Waterhof" />
              </div>
              <div>
                <Label className="text-xs">Sector</Label>
                <Input value={client.sector} onChange={e => update("sector", e.target.value)} placeholder="Bijv. ambulante GGZ" />
              </div>
              <div>
                <Label className="text-xs">Aantal medewerkers</Label>
                <Input type="number" min={0} value={client.employees} onChange={e => update("employees", Number(e.target.value))} />
              </div>
              <div>
                <Label className="text-xs">Regime</Label>
                <select
                  value={client.regimeId}
                  onChange={e => update("regimeId", e.target.value)}
                  className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
                >
                  <option value="nl_avg_nis2">NL AVG + NIS2 (default)</option>
                </select>
              </div>
            </div>
            <div>
              <Label className="text-xs">IT-inrichting</Label>
              <Textarea rows={3} value={client.itArrangement} onChange={e => update("itArrangement", e.target.value)} placeholder="Cloud vs on-prem, MSP, kritieke koppelingen…" />
            </div>
            <div>
              <Label className="text-xs">Kroonjuwelen</Label>
              <Textarea rows={2} value={client.crownJewels} onChange={e => update("crownJewels", e.target.value)} placeholder="Wat mag deze klant absoluut niet kwijt raken?" />
            </div>
            <div>
              <Label className="text-xs">Crisisteam — bezette rollen</Label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5 mt-1">
                {ROLE_ORDER.map(r => {
                  const on = client.crisisTeamRoles.includes(r)
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => toggleRole(r)}
                      className={`rounded border px-2 py-1.5 text-xs text-left transition-colors ${
                        on ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40"
                      }`}
                    >
                      {ROLE_META[r].label}
                    </button>
                  )
                })}
              </div>
            </div>
            <div>
              <Label className="text-xs">Notities</Label>
              <Textarea rows={2} value={client.notes ?? ""} onChange={e => update("notes", e.target.value)} placeholder="Vrij tekstveld — dingen die je wil onthouden over deze klant" />
            </div>
            <label className="flex items-center gap-2 text-sm mt-1">
              <input
                type="checkbox"
                checked={client.isTestClient}
                onChange={e => update("isTestClient", e.target.checked)}
                className="size-4"
              />
              <span>Testklant (kwaliteitsborging — niet echt)</span>
            </label>
          </div>
        </div>

        {/* Right col — related */}
        <div className="flex flex-col gap-3">
          {!isNew && (
            <>
              <div className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium text-sm">Scenario's</h3>
                  <span className="font-mono text-[10px] text-muted-foreground">{scenarios.length}</span>
                </div>
                {scenarios.length === 0 ? (
                  <div className="text-xs text-muted-foreground py-2">
                    Nog geen scenario's voor deze klant.
                  </div>
                ) : (
                  <ul className="flex flex-col gap-1">
                    {scenarios.slice(0, 5).map(s => (
                      <li key={s.id}>
                        <Link href={`/admin/builder?id=${encodeURIComponent(s.id)}`} className="text-xs text-primary hover:underline flex items-center gap-1.5">
                          <FolderKanban className="size-3" /> {s.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
                <Link href={`/admin/builder?wizard=1&clientId=${encodeURIComponent(client.id)}`} className="mt-3 block">
                  <Button size="sm" variant="outline" className="w-full gap-1.5">
                    <Sparkles className="size-3.5" /> Nieuw scenario via wizard
                  </Button>
                </Link>
              </div>

              <div className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium text-sm">Sessies</h3>
                  <span className="font-mono text-[10px] text-muted-foreground">{sessions.length}</span>
                </div>
                {sessions.length === 0 ? (
                  <div className="text-xs text-muted-foreground py-2">Geen sessies gedraaid met deze klant.</div>
                ) : (
                  <ul className="flex flex-col gap-1">
                    {sessions.slice(0, 5).map(s => (
                      <li key={s.id}>
                        <Link href={`/admin/sessions/${encodeURIComponent(s.id)}`} className="text-xs text-primary hover:underline flex items-center gap-1.5">
                          <Play className="size-3" /> {s.scenarioName} · {new Date(s.startedAt).toLocaleDateString("nl-NL")}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  )
}
