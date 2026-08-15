"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Loader2, Printer, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import type { SessionSnapshot } from "@/lib/admin/sessions-archive"
import { useToast } from "./toast"
import { SpiderChart, type ReportVector } from "./report-charts"
import { ROLE_META, type Role } from "@/lib/types"
import type { DecisionNodeData, InjectNodeData, ScenarioGraph } from "@/lib/graph/types"

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString("nl-NL", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })
}

function formatDateShort(ts: number): string {
  return new Date(ts).toLocaleDateString("nl-NL", { day: "2-digit", month: "short", year: "numeric" })
}

interface RoundReport {
  index: number
  title: string
  situation: string
  openingPrompts: string[]
  decisions: Array<{
    decisionNodeId: string
    prompt: string
    perRole: Array<{
      role: Role
      chosen: { label: string; vector?: ReportVector; participantName?: string; reasoning?: string } | null
      alternatives: Array<{ label: string; vector?: ReportVector }>
    }>
    setupInjects: Array<{
      injectId: string
      title: string
      classification?: string
      groundTruth?: string
      participantViews: Array<{ participantName: string; tag: "fact" | "assumption" }>
    }>
  }>
  lessonsLearned: string[]
}

function buildRoundReport(snapshot: SessionSnapshot): RoundReport[] {
  const s = snapshot.snapshot
  const g = s.graph as ScenarioGraph | undefined
  const rounds = s.scenario.rounds
  const submissions = s.submittedDecisions ?? []
  const factChecks = s.factChecks ?? []
  const participants = s.participants

  const decisionsInRound = new Map<number, Array<{ id: string; data: DecisionNodeData }>>()
  if (g) {
    const roundNodes = g.nodes.filter(n => n.type === "round")
    const roundOrder = new Map<string, number>()
    let idx = 0
    for (const rn of [...roundNodes].sort((a, b) => a.position.x - b.position.x)) {
      roundOrder.set(rn.id, idx++)
    }
    for (const n of g.nodes) {
      if (n.type !== "decision") continue
      const incoming = g.edges.find(e => e.target === n.id && e.type === "sequence")
      if (!incoming) continue
      const roundIdx = roundOrder.get(incoming.source) ?? 0
      const arr = decisionsInRound.get(roundIdx) ?? []
      arr.push({ id: n.id, data: n.data as DecisionNodeData })
      decisionsInRound.set(roundIdx, arr)
    }
  }

  const injectById = new Map<string, InjectNodeData & { id: string }>()
  if (g) {
    for (const n of g.nodes) {
      if (n.type !== "inject") continue
      injectById.set(n.id, { ...(n.data as InjectNodeData), id: n.id })
    }
  }

  return rounds.map((r, i) => {
    const roundDecisions = decisionsInRound.get(i) ?? []
    const decisions = roundDecisions.map(dNode => {
      const dd = dNode.data
      const roles = Array.from(new Set(dd.options.map(o => o.allowedRole).filter((x): x is Role => !!x)))
      const perRole = roles.map(role => {
        const roleOpts = dd.options.filter(o => o.allowedRole === role)
        const submission = submissions.find(sub =>
          sub.roundIndex === i && sub.role === role && roleOpts.some(o => o.id === sub.actionId)
        )
        const chosenOpt = submission ? roleOpts.find(o => o.id === submission.actionId) : null
        return {
          role,
          chosen: chosenOpt ? {
            label: chosenOpt.label,
            vector: (chosenOpt.outcomeVector as ReportVector | undefined),
            participantName: submission?.participantName,
            reasoning: submission?.reasoning,
          } : null,
          alternatives: roleOpts
            .filter(o => o.id !== chosenOpt?.id)
            .map(o => ({ label: o.label, vector: (o.outcomeVector as ReportVector | undefined) })),
        }
      })
      const setupInjects: RoundReport["decisions"][0]["setupInjects"] = []
      for (const [, inj] of injectById) {
        if (inj.setsUpDecisionNodeId !== dNode.id) continue
        const participantViews = factChecks
          .filter(fc => fc.injectId === inj.id)
          .map(fc => ({
            participantName: participants.find(p => p.id === fc.participantId)?.name ?? fc.participantId,
            tag: fc.tag,
          }))
        setupInjects.push({
          injectId: inj.id,
          title: inj.title,
          classification: inj.classification,
          groundTruth: inj.reliability,
          participantViews,
        })
      }
      return {
        decisionNodeId: dNode.id,
        prompt: dd.prompt,
        perRole,
        setupInjects,
      }
    })

    const lessons: string[] = []
    for (const d of decisions) {
      for (const rp of d.perRole) {
        const opt = roundDecisions.find(rd => rd.id === d.decisionNodeId)?.data.options.find(o => o.label === rp.chosen?.label)
        const lesson = (opt as unknown as { lessonLearned?: string } | undefined)?.lessonLearned
        if (lesson) lessons.push(lesson)
      }
    }

    return {
      index: i,
      title: r.title,
      situation: r.situation_update,
      openingPrompts: (r as unknown as { openingPrompts?: string[] }).openingPrompts ?? [],
      decisions,
      lessonsLearned: lessons,
    }
  })
}

function cumulativeVector(rounds: RoundReport[]): ReportVector {
  const acc: ReportVector = { CONT: 0, FOR: 0, BC: 0, JUR: 0, VER: 0, KOS: 0 }
  let n = 0
  for (const r of rounds) {
    for (const d of r.decisions) {
      for (const rp of d.perRole) {
        if (!rp.chosen?.vector) continue
        for (const k of Object.keys(acc) as Array<keyof ReportVector>) {
          acc[k] += rp.chosen.vector[k]
        }
        n++
      }
    }
  }
  if (n === 0) return acc
  for (const k of Object.keys(acc) as Array<keyof ReportVector>) acc[k] = +(acc[k] / n).toFixed(2)
  return acc
}

interface FactAssumptionRow {
  injectId: string
  injectTitle: string
  groundTruth: "fact" | "assumption" | "misleading"
  participantViews: Array<{ participantName: string; tag: "fact" | "assumption" }>
  // Wat het team volgens de facilitator behandelde (retroactief). Leeg als
  // de facilitator (nog) niet heeft ingevuld.
  retroactiveTag?: "fact" | "assumption"
  // Effectieve team-perceptie: eerst deelnemer-consensus (majority) als
  // die er is, anders de retro-tag.
  effectiveTeamTag?: "fact" | "assumption"
  linkedDecisionPrompt?: string
  isMismatch: boolean
}

function buildFactAssumptionRows(
  rounds: RoundReport[],
  retroactiveTags: Record<string, "fact" | "assumption">,
): FactAssumptionRow[] {
  const rows: FactAssumptionRow[] = []
  const seenInjects = new Set<string>()
  for (const r of rounds) {
    for (const d of r.decisions) {
      for (const inj of d.setupInjects) {
        if (!inj.groundTruth) continue
        if (seenInjects.has(inj.injectId)) continue
        seenInjects.add(inj.injectId)
        const gt = inj.groundTruth as "fact" | "assumption" | "misleading"
        const retro = retroactiveTags[inj.injectId]
        // Majority-tag van deelnemers als er meer factchecks zijn dan één
        // is-fact en één is-assumption. Bij tie kiezen we niks.
        let participantMajority: "fact" | "assumption" | undefined
        if (inj.participantViews.length > 0) {
          const facts = inj.participantViews.filter(v => v.tag === "fact").length
          const asns = inj.participantViews.filter(v => v.tag === "assumption").length
          if (facts > asns) participantMajority = "fact"
          else if (asns > facts) participantMajority = "assumption"
        }
        const effective = participantMajority ?? retro
        const isMismatch =
          effective === "fact" && (gt === "misleading" || gt === "assumption")
        rows.push({
          injectId: inj.injectId,
          injectTitle: inj.title,
          groundTruth: gt,
          participantViews: inj.participantViews,
          retroactiveTag: retro,
          effectiveTeamTag: effective,
          linkedDecisionPrompt: d.prompt,
          isMismatch,
        })
      }
    }
  }
  return rows
}

export function SessionDetail({ id }: { id: string }) {
  const [snapshot, setSnapshot] = useState<SessionSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [observations, setObservations] = useState("")
  const [recommendations, setRecommendations] = useState("")
  const [retroTags, setRetroTags] = useState<Record<string, "fact" | "assumption">>({})
  const [saving, setSaving] = useState(false)
  const [savingRetro, setSavingRetro] = useState(false)
  const toast = useToast()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/sessions?id=${encodeURIComponent(id)}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json() as { snapshot: SessionSnapshot }
      setSnapshot(data.snapshot)
      setObservations(data.snapshot.facilitatorReport?.observations ?? "")
      setRecommendations(data.snapshot.facilitatorReport?.recommendations ?? "")
      setRetroTags(data.snapshot.facilitatorReport?.retroactiveInjectTags ?? {})
    } catch (e) {
      toast.push("error", `Laden mislukt: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setLoading(false)
    }
  }, [id, toast])

  useEffect(() => { void load() }, [load])

  async function saveNotes() {
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/sessions?id=${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ facilitatorReport: { observations, recommendations } }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      toast.push("success", "Notities opgeslagen")
      await load()
    } catch (e) {
      toast.push("error", `Opslaan mislukt: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setSaving(false)
    }
  }

  const rounds = useMemo(() => snapshot ? buildRoundReport(snapshot) : [], [snapshot])
  const totalVector = useMemo(() => cumulativeVector(rounds), [rounds])
  const factAssumptionRows = useMemo(() => buildFactAssumptionRows(rounds, retroTags), [rounds, retroTags])
  const mismatchCount = factAssumptionRows.filter(r => r.isMismatch).length

  // Retro-tag update: debounce naar server zodat facilitator niet elke klik hoeft te bevestigen.
  const saveRetroTags = useCallback(async (next: Record<string, "fact" | "assumption">) => {
    setSavingRetro(true)
    try {
      const res = await fetch(`/api/admin/sessions?id=${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ facilitatorReport: { retroactiveInjectTags: next } }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
    } catch (e) {
      toast.push("error", `Retro-tag opslaan mislukt: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setSavingRetro(false)
    }
  }, [id, toast])

  function setRetroTag(injectId: string, tag: "fact" | "assumption" | "") {
    setRetroTags(prev => {
      const next = { ...prev }
      if (tag === "") delete next[injectId]
      else next[injectId] = tag
      void saveRetroTags(next)
      return next
    })
  }

  if (loading) return <p className="text-sm text-muted-foreground">Laden…</p>
  if (!snapshot) return <p className="text-sm text-muted-foreground">Sessie niet gevonden.</p>

  const s = snapshot.snapshot
  const participants = s.participants

  return (
    <section className="flex flex-col gap-8 report-container">
      <div className="flex items-baseline justify-between gap-4 flex-wrap no-print">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Rapport — {snapshot.scenarioName}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {snapshot.clientName ? <>Klant: <Link href={`/admin/clients/${encodeURIComponent(snapshot.clientId ?? "")}`} className="text-primary hover:underline">{snapshot.clientName}</Link> · </> : null}
            {formatDate(snapshot.startedAt)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => window.print()} className="gap-1.5">
            <Printer className="size-3.5" /> Print / PDF
          </Button>
        </div>
      </div>

      <ReportSection title="Samenvatting">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="Klant" value={snapshot.clientName ?? "—"} />
          <Stat label="Scenario" value={snapshot.scenarioName} />
          <Stat label="Modus" value={snapshot.mode} />
          <Stat label="Datum" value={formatDateShort(snapshot.startedAt)} />
          <Stat label="Deelnemers" value={String(snapshot.participantCount)} />
          <Stat label="Rondes" value={`${snapshot.currentRound}/${snapshot.rounds}`} />
          <Stat label="Status" value={snapshot.status} />
          <Stat label="Uitkomst" value={snapshot.finalOutcomeLabel ?? "—"} />
        </div>

        {participants.length > 0 && (
          <div className="mt-4">
            <h3 className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2">Team</h3>
            <div className="flex flex-wrap gap-1.5">
              {participants.map(p => (
                <span key={p.id} className="text-xs px-2 py-1 rounded border border-border bg-muted/30">
                  {p.name}
                  {p.role && <span className="text-muted-foreground ml-1">— {ROLE_META[p.role]?.label ?? p.role}</span>}
                </span>
              ))}
            </div>
          </div>
        )}

        <p className="text-sm text-muted-foreground mt-4 leading-relaxed">
          Het team doorliep {snapshot.currentRound} van de {snapshot.rounds} rondes in {snapshot.mode}-modus.
          {snapshot.finalOutcomeLabel && <> Eindoordeel: <strong className="text-foreground">{snapshot.finalOutcomeLabel}</strong>.</>}
          {mismatchCount > 0 && <> Het team behandelde {mismatchCount} inject{mismatchCount === 1 ? "" : "s"} als feit terwijl de ground truth aanname of misleidend was — zie sectie feiten &amp; aannamen.</>}
        </p>
      </ReportSection>

      <ReportSection title="Zes dimensies">
        <p className="text-sm text-muted-foreground mb-4">
          Cumulatieve score per dimensie (gemiddelde over alle gekozen opties). Waardes lopen −2 tot +2 per as.
        </p>
        <div className="rounded-lg border border-border bg-card p-4 flex flex-col items-center gap-2 max-w-md mx-auto">
          <SpiderChart vector={totalVector} size={340} />
        </div>
      </ReportSection>

      <ReportSection title="Verloop per ronde">
        {rounds.length === 0 ? (
          <p className="text-sm text-muted-foreground">Geen ronde-data.</p>
        ) : (
          <div className="flex flex-col gap-6">
            {rounds.map(r => (
              <RoundBlock key={r.index} round={r} />
            ))}
          </div>
        )}
      </ReportSection>

      <ReportSection title="Feit versus aanname">
        {factAssumptionRows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Geen setup-injects met ground truth in dit scenario.</p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground mb-4">
              Wat het team behandelde als feit, tegenover wat het in werkelijkheid was. Waar deelnemers niet zelf tagden tijdens de sessie: kies hieronder wat het team volgens jou behandelde — de mismatches worden meteen bijgewerkt.
              {savingRetro && <span className="ml-2 text-xs italic text-muted-foreground">opslaan…</span>}
            </p>
            <div className="flex flex-col gap-2">
              {factAssumptionRows.map(row => (
                <FactAssumptionRowView
                  key={row.injectId}
                  row={row}
                  onSetRetro={tag => setRetroTag(row.injectId, tag)}
                />
              ))}
            </div>
            {mismatchCount > 0 && (
              <p className="text-xs text-amber-700 dark:text-amber-500 mt-3">
                {mismatchCount} van de {factAssumptionRows.length} injects: het team behandelde als feit terwijl de ground truth aanname of misleidend was.
              </p>
            )}
          </>
        )}
      </ReportSection>

      <ReportSection title="Lessons learned">
        {(() => {
          const allLessons = rounds.flatMap(r => r.lessonsLearned)
          if (allLessons.length === 0) return <p className="text-sm text-muted-foreground">Geen expliciete lessen bij de gekozen opties. Lessons-learned wordt bij het scenario auteurschap ingevuld op elke optie (<code className="font-mono text-xs">DecisionOption.lessonLearned</code>).</p>
          return (
            <ul className="flex flex-col gap-1.5 list-disc list-inside text-sm">
              {allLessons.map((l, i) => (
                <li key={i} className="text-foreground/90 leading-relaxed">{l}</li>
              ))}
            </ul>
          )
        })()}
      </ReportSection>

      <ReportSection title="Aanbevelingen (placeholder — facilitator vult in)">
        <p className="text-xs text-amber-700 dark:text-amber-500 mb-3 no-print">
          De app legt geen post-sessie observaties of aanbevelingen vast. Vul hier zelf in wat de klant morgen anders moet doen — het verschijnt in de PDF-export.
        </p>
        <div className="flex flex-col gap-3">
          <div>
            <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Wat viel je op</label>
            <Textarea
              rows={3}
              value={observations}
              onChange={e => setObservations(e.target.value)}
              placeholder="Losse observaties buiten de dimensies om — sfeer in het team, kwaliteit van de discussie, uitschieters…"
              className="mt-1 no-print"
            />
          </div>
          <div>
            <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Concrete aanbevelingen voor de klant</label>
            <Textarea
              rows={4}
              value={recommendations}
              onChange={e => setRecommendations(e.target.value)}
              placeholder="Wat moet deze klant morgen anders doen? Denk aan: back-up-tests, oefenschema, mandaat-vastlegging, contract-review met MSP…"
              className="mt-1 no-print"
            />
          </div>
          <div className="flex items-center justify-between gap-2 no-print">
            <span className="text-xs text-muted-foreground">
              {snapshot.facilitatorReport?.updatedAt ? `Laatst opgeslagen ${formatDateShort(snapshot.facilitatorReport.updatedAt)}` : "Nog niet opgeslagen"}
            </span>
            <Button size="sm" onClick={saveNotes} disabled={saving} className="gap-1.5">
              {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
              Notities opslaan
            </Button>
          </div>
          <div className="hidden print:block">
            {observations && <p className="text-sm mb-2"><strong>Observaties:</strong> {observations}</p>}
            {recommendations && <p className="text-sm"><strong>Aanbevelingen:</strong> {recommendations}</p>}
            {!observations && !recommendations && <p className="text-sm italic text-muted-foreground">— nog niet ingevuld —</p>}
          </div>
        </div>
      </ReportSection>

      {/* Placeholders overzicht — dev-info voor de facilitator, wordt niet mee-geprint */}
      <div className="no-print rounded-lg border border-dashed border-border bg-muted/20 p-4 text-xs text-muted-foreground leading-relaxed">
        <strong className="text-foreground">Data-gaten in dit rapport</strong> — de app legt de volgende dingen nog niet automatisch vast; ze staan er als placeholder of ontbreken:
        <ul className="mt-2 list-disc list-inside space-y-1">
          <li><strong>Post-sessie observaties + aanbevelingen</strong>: facilitator-input hierboven, wordt niet uit sessie-data afgeleid.</li>
          <li><strong>Feit-vs-aanname als deelnemers niet tagden</strong>: opgelost — waar geen deelnemer-tags zijn, kun je nu retroactief per inject vullen wat het team volgens jou behandelde. Mismatches worden direct bijgewerkt.</li>
          <li><strong>Discussie-transcript</strong>: alleen finale keuzes en (optioneel) reasoning worden opgeslagen. Wat er in de discussie gezegd werd, blijft buiten het rapport.</li>
          <li><strong>Groepsvergelijking bij event-mode</strong>: rapport toont team-cumulatief; per-groep uitsplitsing zit er nog niet in.</li>
          <li><strong>Follow-up datum</strong>: wanneer je deze klant opnieuw wil oefenen — geen veld voor.</li>
        </ul>
      </div>

      <style jsx global>{`
        @media print {
          .no-print { display: none !important; }
          .report-container { max-width: 100% !important; padding: 0 !important; }
          header, nav { display: none !important; }
          body { background: white !important; color: black !important; }
          .rounded-lg, .rounded-xl { break-inside: avoid; }
          section > section { page-break-inside: avoid; margin-bottom: 20px; }
        }
      `}</style>
    </section>
  )
}

function ReportSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-card p-6 print:border-0 print:shadow-none print:break-inside-avoid">
      <h2 className="text-lg font-semibold mb-4 pb-2 border-b border-border/60">{title}</h2>
      {children}
    </section>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-border p-3">
      <div className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="font-medium mt-1 text-sm">{value}</div>
    </div>
  )
}

function RoundBlock({ round }: { round: RoundReport }) {
  return (
    <div className="border-l-2 border-primary/40 pl-4 print:break-inside-avoid">
      <h3 className="font-semibold">Ronde {round.index + 1} — {round.title}</h3>
      {round.situation && <p className="text-sm text-foreground/80 mt-2 leading-relaxed">{round.situation}</p>}

      {round.openingPrompts.length > 0 && (
        <div className="mt-3">
          <h4 className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-1">Stuurvragen</h4>
          <ul className="text-sm list-disc list-inside space-y-0.5">
            {round.openingPrompts.map((p, i) => <li key={i} className="text-foreground/80">{p}</li>)}
          </ul>
        </div>
      )}

      {round.decisions.length === 0 && (
        <p className="text-sm text-muted-foreground mt-3 italic">Geen decisions in deze ronde.</p>
      )}

      {round.decisions.map(d => (
        <div key={d.decisionNodeId} className="mt-4 rounded border border-border p-3 bg-background/30 print:bg-white">
          <h4 className="font-medium text-sm mb-3">{d.prompt}</h4>

          <div className="flex flex-col gap-3">
            {d.perRole.map(rp => (
              <div key={rp.role} className="text-sm">
                <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                  {ROLE_META[rp.role]?.label ?? rp.role}
                  {rp.chosen?.participantName && <span className="ml-2 normal-case text-muted-foreground">door {rp.chosen.participantName}</span>}
                </div>
                {rp.chosen ? (
                  <div className="rounded border border-primary/40 bg-primary/5 px-3 py-2 mb-1">
                    <div className="flex items-baseline justify-between gap-3 flex-wrap">
                      <span className="text-sm">✓ {rp.chosen.label}</span>
                      {rp.chosen.vector && <VectorBadges vector={rp.chosen.vector} />}
                    </div>
                    {rp.chosen.reasoning && <p className="text-xs italic text-muted-foreground mt-1">"{rp.chosen.reasoning}"</p>}
                  </div>
                ) : (
                  <p className="text-xs italic text-muted-foreground">Geen inzending</p>
                )}
                {rp.alternatives.length > 0 && (
                  <details className="text-xs mt-1">
                    <summary className="cursor-pointer text-muted-foreground hover:text-foreground select-none">
                      {rp.alternatives.length} alternatie{rp.alternatives.length === 1 ? "f" : "ven"}
                    </summary>
                    <div className="mt-2 flex flex-col gap-1 pl-2 border-l border-border">
                      {rp.alternatives.map((alt, i) => (
                        <div key={i} className="py-0.5 flex items-baseline justify-between gap-3 flex-wrap">
                          <span>{alt.label}</span>
                          {alt.vector && <VectorBadges vector={alt.vector} />}
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function VectorBadges({ vector }: { vector: ReportVector }) {
  const keys: Array<keyof ReportVector> = ["CONT", "FOR", "BC", "JUR", "VER", "KOS"]
  return (
    <div className="flex gap-1 flex-wrap">
      {keys.map(k => {
        const v = vector[k]
        const cls = v > 0 ? "text-emerald-700 dark:text-emerald-400 border-emerald-500/40 bg-emerald-500/10"
                  : v < 0 ? "text-rose-700 dark:text-rose-400 border-rose-500/40 bg-rose-500/10"
                  : "text-muted-foreground border-border bg-muted/30"
        return (
          <span key={k} className={`font-mono text-[9px] px-1 py-0.5 rounded border ${cls}`}>
            {k} {v > 0 ? "+" : ""}{v}
          </span>
        )
      })}
    </div>
  )
}

function FactAssumptionRowView({
  row,
  onSetRetro,
}: {
  row: {
    injectId: string
    injectTitle: string
    groundTruth: "fact" | "assumption" | "misleading"
    participantViews: Array<{ participantName: string; tag: "fact" | "assumption" }>
    retroactiveTag?: "fact" | "assumption"
    effectiveTeamTag?: "fact" | "assumption"
    linkedDecisionPrompt?: string
    isMismatch: boolean
  }
  onSetRetro: (tag: "fact" | "assumption" | "") => void
}) {
  const gtLabel = row.groundTruth === "misleading" ? "misleidend"
                : row.groundTruth === "assumption" ? "aanname"
                : "feit"
  const gtClass = row.groundTruth === "misleading" ? "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-400"
                : row.groundTruth === "assumption" ? "border-yellow-500/40 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400"
                : "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
  const teamHadTags = row.participantViews.length > 0
  const outerClass = row.isMismatch
    ? "border-amber-500/40 bg-amber-500/5"
    : "border-border bg-card"
  return (
    <div className={`rounded-lg border ${outerClass} p-3`}>
      <div className="flex items-baseline justify-between gap-3 mb-2 flex-wrap">
        <h4 className="font-medium text-sm">{row.injectTitle}</h4>
        <span className={`font-mono text-[10px] uppercase tracking-wider border px-1.5 py-0.5 rounded ${gtClass}`}>
          Ground truth: {gtLabel}
        </span>
      </div>

      {/* Team-perceptie */}
      <div className="flex items-baseline gap-2 flex-wrap text-xs mb-2">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Team behandelde als:</span>
        {teamHadTags ? (
          <>
            <span className="text-foreground">
              {row.participantViews.map(v => `${v.participantName} → ${v.tag === "fact" ? "feit" : "aanname"}`).join(" · ")}
            </span>
            {row.effectiveTeamTag && (
              <span className="font-mono text-[10px] text-muted-foreground">
                majority: {row.effectiveTeamTag === "fact" ? "feit" : "aanname"}
              </span>
            )}
          </>
        ) : (
          <select
            value={row.retroactiveTag ?? ""}
            onChange={e => onSetRetro(e.target.value as "fact" | "assumption" | "")}
            className="h-7 rounded border border-border bg-background px-2 text-xs no-print"
          >
            <option value="">— nog niet bepaald —</option>
            <option value="fact">Team behandelde als feit</option>
            <option value="assumption">Team behandelde als aanname</option>
          </select>
        )}
        {!teamHadTags && row.retroactiveTag && (
          <span className="hidden print:inline text-foreground">
            {row.retroactiveTag === "fact" ? "feit" : "aanname"} <span className="text-muted-foreground text-[10px]">(retroactief door facilitator)</span>
          </span>
        )}
      </div>

      {row.isMismatch && (
        <p className="text-xs text-amber-800 dark:text-amber-400 mb-2">
          <strong>Mismatch:</strong> team behandelde dit als feit terwijl ground truth {gtLabel} was.
        </p>
      )}

      {row.linkedDecisionPrompt && (
        <div className="text-xs">
          <span className="text-muted-foreground">Beslissing die hierop rustte: </span>
          <span className="italic">{row.linkedDecisionPrompt}</span>
        </div>
      )}
    </div>
  )
}
