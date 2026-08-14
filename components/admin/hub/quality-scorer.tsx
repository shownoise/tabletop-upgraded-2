"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Loader2, Save, Sparkles, TestTube2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { useToast } from "./toast"
import type { AdminClient } from "@/lib/admin/clients"
import type { RubricScoreEntry, RubricScorePerPoint } from "@/lib/admin/rubric-scores"
import { RUBRIC_POINTS, newRubricEntryId } from "@/lib/admin/rubric-scores"

// Kwaliteit — testklant kiezen, scenario genereren (of naam invullen van een
// bestaande run), en tegen de 10-punts rubric scoren. Elke score wordt bewaard
// met promptVersion, datum en klant zodat je trends kunt tracen.

interface ScoreDraft {
  clientId: string
  clientName: string
  scenarioName: string
  scenarioGraphId?: string
  promptVersion: string
  scores: Record<number, RubricScorePerPoint>
  notes: Record<number, string>
  observations: string
  promptImprovements: string
}

function emptyDraft(): ScoreDraft {
  return {
    clientId: "",
    clientName: "",
    scenarioName: "",
    scenarioGraphId: undefined,
    promptVersion: "",
    scores: {},
    notes: {},
    observations: "",
    promptImprovements: "",
  }
}

export function QualityScorer() {
  const toast = useToast()
  const [clients, setClients] = useState<AdminClient[]>([])
  const [scoreHistory, setScoreHistory] = useState<RubricScoreEntry[]>([])
  const [draft, setDraft] = useState<ScoreDraft>(emptyDraft())
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const [cRes, sRes, pRes] = await Promise.all([
        fetch("/api/admin/clients"),
        fetch("/api/admin/rubric-scores"),
        fetch("/api/admin/wizard-prompt"),
      ])
      const cData = cRes.ok ? await cRes.json() as { clients: AdminClient[] } : { clients: [] }
      const sData = sRes.ok ? await sRes.json() as { scores: RubricScoreEntry[] } : { scores: [] }
      const pData = pRes.ok ? await pRes.json() as { override: { version?: string } | null } : { override: null }
      setClients(cData.clients)
      setScoreHistory(sData.scores)
      setDraft(d => ({ ...d, promptVersion: d.promptVersion || pData.override?.version || "v0" }))
    } catch (e) {
      toast.push("error", `Laden mislukt: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { void reload() }, [reload])

  function setPoint(n: number, s: RubricScorePerPoint) {
    setDraft(d => ({ ...d, scores: { ...d.scores, [n]: s } }))
  }
  function setNote(n: number, note: string) {
    setDraft(d => ({ ...d, notes: { ...d.notes, [n]: note } }))
  }

  const total = Object.values(draft.scores).reduce<number>((a, b) => a + b, 0)
  const scoredCount = Object.keys(draft.scores).length
  const isComplete = scoredCount === RUBRIC_POINTS.length && draft.clientId && draft.scenarioName

  async function save() {
    if (!isComplete) { toast.push("error", "Vul klant + scenario in en scoor alle 10 punten"); return }
    setSaving(true)
    try {
      const entry: RubricScoreEntry = {
        id: newRubricEntryId(),
        createdAt: Date.now(),
        clientId: draft.clientId,
        clientName: draft.clientName,
        scenarioGraphId: draft.scenarioGraphId,
        scenarioName: draft.scenarioName,
        promptVersion: draft.promptVersion,
        scores: RUBRIC_POINTS.map(p => ({
          pointNumber: p.n,
          pointTitle: p.title,
          score: draft.scores[p.n],
          note: draft.notes[p.n] || undefined,
        })),
        total,
        observations: draft.observations || undefined,
        promptImprovements: draft.promptImprovements || undefined,
      }
      const res = await fetch("/api/admin/rubric-scores", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(entry),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      toast.push("success", `Score ${total}/20 opgeslagen`)
      setDraft(emptyDraft())
      await reload()
    } catch (e) {
      toast.push("error", `Opslaan mislukt: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setSaving(false)
    }
  }

  const testClients = clients.filter(c => c.isTestClient)

  if (loading) return <p className="text-sm text-muted-foreground">Laden…</p>

  return (
    <section className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Kwaliteit</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Scoor een gegenereerd scenario tegen de 10-punts rubric uit <code className="font-mono text-xs">docs/kwaliteit/rubric.md</code>.
          Scores worden per prompt-versie bewaard — zie of de wizard beter of slechter wordt.
        </p>
      </div>

      {testClients.length === 0 && (
        <div className="rounded-lg border border-dashed border-border bg-card p-6">
          <p className="text-sm">Geen testklanten aanwezig.</p>
          <p className="text-xs text-muted-foreground mt-1">
            Ga naar <Link href="/admin/clients" className="text-primary hover:underline">Klanten</Link> en klik "Testklanten inladen".
          </p>
        </div>
      )}

      {/* Setup */}
      <div className="rounded-lg border border-border bg-card p-5 flex flex-col gap-3">
        <h3 className="font-medium">Setup</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Testklant</label>
            <select
              value={draft.clientId}
              onChange={e => {
                const id = e.target.value
                const c = clients.find(x => x.id === id)
                setDraft(d => ({ ...d, clientId: id, clientName: c?.name ?? "" }))
              }}
              className="w-full h-9 mt-1 rounded border border-border bg-background px-2 text-sm"
            >
              <option value="">— kies —</option>
              {testClients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              {clients.filter(c => !c.isTestClient).length > 0 && (
                <optgroup label="Echte klanten">
                  {clients.filter(c => !c.isTestClient).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </optgroup>
              )}
            </select>
          </div>
          <div>
            <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Scenario-naam</label>
            <Input
              value={draft.scenarioName}
              onChange={e => setDraft(d => ({ ...d, scenarioName: e.target.value }))}
              placeholder="Bijv. Waterhof — ransomware EPD-verlies"
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Prompt-versie</label>
            <Input
              value={draft.promptVersion}
              onChange={e => setDraft(d => ({ ...d, promptVersion: e.target.value }))}
              placeholder="v0"
              className="mt-1"
            />
          </div>
        </div>
        <div className="flex items-center gap-3 pt-2 border-t border-border/60">
          <Link href={`/admin/builder?wizard=1${draft.clientId ? `&clientId=${encodeURIComponent(draft.clientId)}` : ""}`}>
            <Button size="sm" variant="outline" disabled={!draft.clientId} className="gap-1.5">
              <Sparkles className="size-3.5" /> Genereer via wizard
            </Button>
          </Link>
          <span className="text-xs text-muted-foreground">
            Draai de wizard voor deze klant, kom dan hier terug en scoor het resultaat.
          </span>
        </div>
      </div>

      {/* Rubric */}
      <div className="rounded-lg border border-border bg-card p-5 flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <h3 className="font-medium">10-punts rubric</h3>
          <span className="font-mono text-sm">
            {scoredCount}/{RUBRIC_POINTS.length} · totaal <span className="font-bold text-lg">{total}</span>/20
          </span>
        </div>
        <div className="flex flex-col gap-2">
          {RUBRIC_POINTS.map(p => (
            <div key={p.n} className="rounded border border-border p-3 flex flex-col gap-2">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm">
                  <span className="font-mono text-[10px] text-muted-foreground mr-2">P{p.n}</span>
                  <span className="font-medium">{p.title}</span>
                </span>
                <div className="flex gap-1 shrink-0">
                  {[0, 1, 2].map(s => {
                    const on = draft.scores[p.n] === s
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setPoint(p.n, s as RubricScorePerPoint)}
                        className={`w-8 h-8 rounded border font-mono text-sm transition-colors ${
                          on
                            ? s === 0 ? "border-red-500 bg-red-500/10 text-red-700 dark:text-red-400"
                            : s === 1 ? "border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-400"
                            : "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                            : "border-border text-muted-foreground hover:border-primary/40"
                        }`}
                      >{s}</button>
                    )
                  })}
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">{p.hint}</p>
              <Input
                value={draft.notes[p.n] ?? ""}
                onChange={e => setNote(p.n, e.target.value)}
                placeholder="Toelichting (1 regel, optioneel)"
                className="h-7 text-xs"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Meta */}
      <div className="rounded-lg border border-border bg-card p-5 flex flex-col gap-3">
        <h3 className="font-medium">Observaties</h3>
        <div>
          <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Wat viel op buiten de punten om</label>
          <Textarea rows={2} value={draft.observations} onChange={e => setDraft(d => ({ ...d, observations: e.target.value }))} className="mt-1" />
        </div>
        <div>
          <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Wat moet er in de prompt veranderen</label>
          <Textarea rows={2} value={draft.promptImprovements} onChange={e => setDraft(d => ({ ...d, promptImprovements: e.target.value }))} className="mt-1" placeholder="Concreet: welke prompt-regel gaat het beste eerst aanpakken?" />
        </div>
        <div className="flex justify-end pt-2 border-t border-border/60">
          <Button size="sm" onClick={save} disabled={!isComplete || saving} className="gap-1.5">
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
            Score opslaan
          </Button>
        </div>
      </div>

      {/* History */}
      {scoreHistory.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-5">
          <h3 className="font-medium mb-3">Score-geschiedenis</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Datum</th>
                <th className="text-left px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Klant</th>
                <th className="text-left px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Scenario</th>
                <th className="text-left px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Prompt</th>
                <th className="text-right px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Score</th>
              </tr>
            </thead>
            <tbody>
              {scoreHistory.slice(0, 15).map(e => (
                <tr key={e.id} className="border-t border-border/50">
                  <td className="px-2 py-1 text-xs text-muted-foreground">{new Date(e.createdAt).toLocaleDateString("nl-NL")}</td>
                  <td className="px-2 py-1 text-xs">{e.clientName}</td>
                  <td className="px-2 py-1 text-xs">{e.scenarioName}</td>
                  <td className="px-2 py-1 text-xs font-mono">{e.promptVersion}</td>
                  <td className="px-2 py-1 text-right font-mono font-medium">{e.total}/20</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
