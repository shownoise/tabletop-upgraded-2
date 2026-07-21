"use client"

import { useEffect, useMemo, useState } from "react"
import { Download, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { api } from "@/lib/api-client"
import type { SupervisionReport } from "@/lib/engine/supervision"
import { SUPERVISION_AREAS } from "@/lib/engine/supervision"
import type { SupervisionReportEdits } from "@/lib/types"

interface Props {
  organizationName?: string
  facilitatorName?: string
}

const SCORE_LABELS: Record<0 | 1 | 2 | 3, string> = {
  0: "Niet aanwezig",
  1: "Gedocumenteerd",
  2: "Uitgevoerd",
  3: "Effectief",
}

const SCORE_COLORS: Record<0 | 1 | 2 | 3, string> = {
  0: "bg-red-500 text-white",
  1: "bg-yellow-500 text-black",
  2: "bg-emerald-400 text-black",
  3: "bg-emerald-600 text-white",
}

export function SupervisionReportView({ organizationName, facilitatorName }: Props) {
  const [report, setReport] = useState<SupervisionReport | null>(null)
  const [edits, setEdits] = useState<SupervisionReportEdits>({})
  const [busy, setBusy] = useState(false)
  const [filter, setFilter] = useState<string>("")

  async function load() {
    setBusy(true)
    try {
      const res = await api.getSupervisionReport()
      setReport(res.report)
    } catch { setReport(null) }
    finally { setBusy(false) }
  }

  useEffect(() => { void load() }, [])

  async function saveEdits(next: SupervisionReportEdits) {
    setEdits(next)
    try { await api.updateSupervisionReport(next) } catch {}
  }

  const timeline = useMemo(() => {
    if (!report) return []
    return report.timeline.filter(e => filter === "" || e.supervisionArea === filter)
  }, [report, filter])

  if (!report) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        {busy ? "Rapport laden…" : "Geen rapport beschikbaar."}
      </div>
    )
  }

  function downloadJson() {
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `toezichthouder-rapport-${report!.sessionId}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  function downloadMarkdown() {
    const md = renderMarkdown(report!, edits, organizationName, facilitatorName)
    const blob = new Blob([md], { type: "text/markdown" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `toezichthouder-rapport-${report!.sessionId}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <header className="flex items-start justify-between gap-2">
        <div>
          <h2 className="font-mono text-sm uppercase tracking-widest text-tt-accent">Toezichthouder-rapport</h2>
          <p className="text-sm">{report.scenarioTitle}</p>
          <p className="text-[11px] text-muted-foreground">
            {organizationName ?? "—"} · Facilitator: {facilitatorName ?? "—"} · {new Date(report.generatedAt).toLocaleString()}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="font-mono text-xs">Gemiddelde: <span className="font-bold">{report.overallScore.toFixed(1)}</span> / 3</div>
          <div className="flex gap-1">
            <Button size="sm" variant="outline" onClick={load} className="h-7 gap-1">
              <RefreshCw className="size-3" /> Herlaad
            </Button>
            <Button size="sm" variant="outline" onClick={downloadJson} className="h-7 gap-1">
              <Download className="size-3" /> JSON
            </Button>
            <Button size="sm" variant="outline" onClick={downloadMarkdown} className="h-7 gap-1">
              <Download className="size-3" /> Markdown
            </Button>
          </div>
        </div>
      </header>

      <section>
        <h3 className="mb-2 font-mono text-xs uppercase text-muted-foreground">Testgebieden (14)</h3>
        <ul className="flex flex-col divide-y divide-border rounded border border-border">
          {report.areas.map(a => {
            const meta = SUPERVISION_AREAS.find(m => m.id === a.area)
            return (
              <li key={a.area} className="p-2">
                <details>
                  <summary className="flex cursor-pointer items-center gap-2 text-xs">
                    <span className={`inline-flex size-6 items-center justify-center rounded-full font-mono text-[11px] ${SCORE_COLORS[a.score]}`}>{a.score}</span>
                    <span className="font-mono text-muted-foreground">{meta?.numberLabel}.</span>
                    <span className="flex-1">{meta?.label}</span>
                    <span className="text-[10px] text-muted-foreground">{a.evidence.length} evidence</span>
                  </summary>
                  <div className="mt-2 pl-8 text-[11px] text-muted-foreground">
                    <div className="italic mb-1">{meta?.question}</div>
                    <p>{a.rationale}</p>
                    {a.evidence.length > 0 && (
                      <ul className="mt-2 space-y-0.5">
                        {a.evidence.map((e, i) => (
                          <li key={i} className="flex gap-2">
                            <span className="font-mono text-[9px]">{new Date(e.timestamp).toLocaleTimeString()}</span>
                            <span>{e.summary}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </details>
              </li>
            )
          })}
        </ul>
      </section>

      <section>
        <h3 className="mb-2 font-mono text-xs uppercase text-muted-foreground">Traceability-ketens</h3>
        {report.traceability.length === 0 && <p className="text-[11px] text-muted-foreground">Geen open gaps — alle testgebieden scoren 3.</p>}
        <div className="flex flex-col gap-2">
          {report.traceability.map(c => {
            const chainEdit = edits.chainEdits?.[c.id] ?? {}
            function set(patch: Partial<typeof chainEdit>) {
              saveEdits({ ...edits, chainEdits: { ...(edits.chainEdits ?? {}), [c.id]: { ...chainEdit, ...patch } } })
            }
            return (
              <div key={c.id} className="rounded border border-border p-2 text-[11px]">
                <div className="grid grid-cols-2 gap-2">
                  <ReadOnly label="Risico" value={c.risk} />
                  <ReadOnly label="Maatregel" value={c.measure} />
                  <ReadOnly label="Testdoel" value={c.testGoal} />
                  <ReadOnly label="Waarneming" value={c.observation} />
                  <ReadOnly label="Tekortkoming" value={c.gap} />
                  <Editable label="Verbeteractie" value={chainEdit.correctiveAction ?? c.correctiveAction} onChange={v => set({ correctiveAction: v })} multiline />
                  <Editable label="Eigenaar" value={chainEdit.owner ?? c.owner} onChange={v => set({ owner: v })} />
                  <Editable label="Deadline" value={chainEdit.deadline ?? c.deadline} onChange={v => set({ deadline: v })} placeholder="YYYY-MM-DD" />
                  <Editable label="Sluitingsbewijs" value={chainEdit.proofOfClosure ?? c.proofOfClosure ?? ""} onChange={v => set({ proofOfClosure: v })} />
                  <Editable label="Hertest" value={chainEdit.retest ?? c.retest ?? ""} onChange={v => set({ retest: v })} />
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <section>
        <h3 className="mb-2 font-mono text-xs uppercase text-muted-foreground">Lessons learned</h3>
        <table className="w-full border-collapse text-[11px]">
          <thead>
            <tr className="text-left text-[10px] uppercase text-muted-foreground">
              <th className="border-b border-border p-1">Bevinding</th>
              <th className="border-b border-border p-1">Bewijs</th>
              <th className="border-b border-border p-1">Impact</th>
              <th className="border-b border-border p-1">Oorzaak</th>
              <th className="border-b border-border p-1">Corrigerende actie</th>
              <th className="border-b border-border p-1">Eigenaar</th>
              <th className="border-b border-border p-1">Deadline</th>
              <th className="border-b border-border p-1">Prio</th>
              <th className="border-b border-border p-1">Status</th>
              <th className="border-b border-border p-1">Sluitingsbewijs</th>
              <th className="border-b border-border p-1">Hertest</th>
            </tr>
          </thead>
          <tbody>
            {report.lessonsLearned.map(l => {
              const le = edits.lessonEdits?.[l.id] ?? {}
              function set(patch: Partial<typeof le>) {
                saveEdits({ ...edits, lessonEdits: { ...(edits.lessonEdits ?? {}), [l.id]: { ...le, ...patch } } })
              }
              return (
                <tr key={l.id} className="align-top">
                  <td className="border-b border-border/40 p-1">{l.finding}</td>
                  <td className="border-b border-border/40 p-1">{l.evidence}</td>
                  <td className="border-b border-border/40 p-1">{l.impact}</td>
                  <td className="border-b border-border/40 p-1">{l.cause}</td>
                  <td className="border-b border-border/40 p-1"><Input className="h-6 text-[11px]" value={le.correctiveAction ?? l.correctiveAction} onChange={e => set({ correctiveAction: e.target.value })} /></td>
                  <td className="border-b border-border/40 p-1"><Input className="h-6 text-[11px]" value={le.owner ?? l.owner} onChange={e => set({ owner: e.target.value })} /></td>
                  <td className="border-b border-border/40 p-1"><Input className="h-6 text-[11px]" value={le.deadline ?? l.deadline} onChange={e => set({ deadline: e.target.value })} placeholder="YYYY-MM-DD" /></td>
                  <td className="border-b border-border/40 p-1">
                    <select value={le.priority ?? l.priority} onChange={e => set({ priority: e.target.value as never })} className="h-6 rounded border border-border bg-background text-[11px]">
                      {["critical","high","medium","low"].map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </td>
                  <td className="border-b border-border/40 p-1">
                    <select value={le.status ?? l.status} onChange={e => set({ status: e.target.value as never })} className="h-6 rounded border border-border bg-background text-[11px]">
                      {["open","in_progress","blocked","closed"].map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </td>
                  <td className="border-b border-border/40 p-1"><Input className="h-6 text-[11px]" value={le.proofOfClosure ?? l.proofOfClosure ?? ""} onChange={e => set({ proofOfClosure: e.target.value })} /></td>
                  <td className="border-b border-border/40 p-1"><Input className="h-6 text-[11px]" value={le.retest ?? l.retest ?? ""} onChange={e => set({ retest: e.target.value })} /></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>

      <section>
        <h3 className="mb-2 font-mono text-xs uppercase text-muted-foreground">Bewijs-tijdlijn</h3>
        <div className="mb-1 flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">Filter:</span>
          <select value={filter} onChange={e => setFilter(e.target.value)} className="rounded border border-border bg-background px-1 py-0.5 text-[11px]">
            <option value="">Alles</option>
            {SUPERVISION_AREAS.map(a => <option key={a.id} value={a.id}>{a.numberLabel}. {a.label}</option>)}
          </select>
        </div>
        <ul className="flex flex-col gap-0.5 text-[11px]">
          {timeline.map((e, i) => (
            <li key={i} className="flex gap-2">
              <span className="font-mono text-[9px] text-muted-foreground">{new Date(e.timestamp).toLocaleTimeString()}</span>
              <span className="font-mono text-[9px] text-tt-accent">{e.kind}</span>
              <span>{e.summary}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

function ReadOnly({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-mono text-[9px] uppercase text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  )
}

function Editable({ label, value, onChange, placeholder, multiline }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; multiline?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-mono text-[9px] uppercase text-muted-foreground">{label}</span>
      {multiline ? (
        <Textarea rows={2} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="text-[11px]" />
      ) : (
        <Input className="h-7 text-[11px]" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
      )}
    </div>
  )
}

function renderMarkdown(report: SupervisionReport, edits: SupervisionReportEdits, org?: string, fac?: string): string {
  const lines: string[] = []
  lines.push(`# Toezichthouder-rapport — ${report.scenarioTitle}`)
  lines.push("")
  lines.push(`- Organisatie: ${org ?? "—"}`)
  lines.push(`- Facilitator: ${fac ?? "—"}`)
  lines.push(`- Sessie: ${report.sessionId}`)
  lines.push(`- Gemiddelde score: ${report.overallScore.toFixed(1)} / 3`)
  lines.push(`- Gegenereerd: ${new Date(report.generatedAt).toISOString()}`)
  lines.push("")
  lines.push("## Testgebieden")
  for (const a of report.areas) {
    const meta = SUPERVISION_AREAS.find(m => m.id === a.area)
    lines.push(`### ${meta?.numberLabel}. ${meta?.label} — score ${a.score}`)
    lines.push(a.rationale)
    for (const e of a.evidence) {
      lines.push(`- ${new Date(e.timestamp).toISOString()} — ${e.summary}`)
    }
    lines.push("")
  }
  lines.push("## Lessons learned")
  for (const l of report.lessonsLearned) {
    const le = edits.lessonEdits?.[l.id] ?? {}
    lines.push(`- **${l.finding}** — Bewijs: ${l.evidence} — Impact: ${l.impact} — Oorzaak: ${l.cause} — Corrigerende actie: ${le.correctiveAction ?? l.correctiveAction} — Eigenaar: ${le.owner ?? l.owner} — Deadline: ${le.deadline ?? l.deadline} — Status: ${le.status ?? l.status}`)
  }
  return lines.join("\n")
}
