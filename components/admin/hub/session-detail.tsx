"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import type { SessionSnapshot } from "@/lib/admin/sessions-archive"
import { useToast } from "./toast"

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString("nl-NL")
}

export function SessionDetail({ id }: { id: string }) {
  const [snapshot, setSnapshot] = useState<SessionSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const toast = useToast()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/sessions?id=${encodeURIComponent(id)}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json() as { snapshot: SessionSnapshot }
      setSnapshot(data.snapshot)
    } catch (e) {
      toast.push("error", `Laden mislukt: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setLoading(false)
    }
  }, [id, toast])

  useEffect(() => { void load() }, [load])

  if (loading) return <p className="text-sm text-muted-foreground">Laden…</p>
  if (!snapshot) return <p className="text-sm text-muted-foreground">Sessie niet gevonden.</p>

  const s = snapshot.snapshot
  const decisions = s.submittedDecisions ?? []
  const rounds = s.scenario.rounds

  return (
    <section className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">{snapshot.scenarioName}</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {snapshot.clientName ? <>Klant: <Link href={`/admin/clients/${encodeURIComponent(snapshot.clientId ?? "")}`} className="text-primary hover:underline">{snapshot.clientName}</Link> · </> : null}
          {formatDate(snapshot.startedAt)}{snapshot.endedAt ? ` – ${formatDate(snapshot.endedAt)}` : " (nog niet afgerond)"}
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Stat label="Modus" value={snapshot.mode} />
        <Stat label="Deelnemers" value={String(snapshot.participantCount)} />
        <Stat label="Rondes" value={`${snapshot.currentRound}/${snapshot.rounds}`} />
        <Stat label="Status" value={snapshot.status} />
        <Stat label="Uitkomst" value={snapshot.finalOutcomeLabel ?? "—"} />
      </div>

      <div className="rounded-lg border border-border bg-card p-5">
        <h3 className="font-semibold mb-3">Verloop per ronde</h3>
        <div className="flex flex-col gap-3">
          {rounds.map((r, i) => {
            const rDecisions = decisions.filter(d => d.roundIndex === i)
            return (
              <div key={i} className="border-l-2 border-primary/40 pl-3">
                <div className="flex items-baseline justify-between">
                  <h4 className="font-medium text-sm">Ronde {i + 1} — {r.title}</h4>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {rDecisions.length} beslissing{rDecisions.length === 1 ? "" : "en"} ingediend
                  </span>
                </div>
                {rDecisions.length > 0 && (
                  <ul className="mt-2 flex flex-col gap-1 text-xs text-muted-foreground">
                    {rDecisions.map(d => (
                      <li key={`${d.participantId}-${d.actionId}`}>
                        <span className="font-mono text-[10px] uppercase">{d.role}</span> · {d.participantName} → {d.actionLabel}
                        {d.reasoning && <span className="italic"> — "{d.reasoning}"</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div className="rounded-lg border border-dashed border-border bg-card p-4 text-xs text-muted-foreground">
        Bekijk het complete rapport via <Link href={`/admin/report/${encodeURIComponent(snapshot.id)}`} className="text-primary hover:underline">/admin/report/{snapshot.id}</Link>. Dit paneel is een korte samenvatting; het rapport toont de zes dimensies, alternatieven per keuze, en de facilitator-narrative.
      </div>
    </section>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="font-medium mt-1">{value}</div>
    </div>
  )
}
