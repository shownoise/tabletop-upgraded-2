import { ROLE_META } from "@/lib/types"
import type { SessionState } from "@/lib/types"
import type { AssessmentEvent } from "@/lib/engine/types"

function fmt(ts: number): string {
  return new Date(ts).toLocaleString("nl-NL", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  })
}

export function exportReportMarkdown(session: SessionState): string {
  const lines: string[] = []
  const graph = session.graph
  const state = session.graphState
  const events = session.assessmentEvents ?? []
  const withLessons = events.filter(e => e.lesson && e.lesson.trim().length > 0)

  const nodeById = graph ? new Map(graph.nodes.map(n => [n.id, n])) : new Map()

  // Title
  lines.push(`# ${session.scenario.scenario_title ?? "Cyber Crisis Rapport"}`)
  lines.push("")
  lines.push(`_Gegenereerd op ${fmt(Date.now())}_`)
  lines.push(`_Sessie ID: \`${session.id}\`_`)
  lines.push("")

  // BOB-fase analyse — welke fase(s) gaven de meeste fouten?
  const graphNodes = graph?.nodes ?? []
  const roundNodes = graphNodes.filter(n => n.type === "round")
  const bobBreakdown = new Map<string, { total: number; count: number; impacts: number }>()
  for (const ev of events) {
    if (!ev.roundNumber && ev.roundNumber !== 0) continue
    // Find the graph round node for this round index by pathHistory order
    const roundIds = state?.pathHistory.filter(id => roundNodes.some(r => r.id === id)) ?? []
    const roundNodeId = roundIds[ev.roundNumber]
    const roundNode = graphNodes.find(n => n.id === roundNodeId)
    const bob = (roundNode?.data as { bobPhase?: string })?.bobPhase ?? "onbekend"
    const entry = bobBreakdown.get(bob) ?? { total: 0, count: 0, impacts: 0 }
    entry.total += ev.value
    entry.count += 1
    entry.impacts += ev.scoreImpact ?? 0
    bobBreakdown.set(bob, entry)
  }

  // Executive summary — outcome first
  lines.push("## Uitkomst")
  if (state?.finalOutcome) {
    lines.push(`### ${state.finalOutcome.label}`)
    if (typeof state.finalOutcome.scoreImpact === "number") {
      lines.push(`**Score-impact:** ${state.finalOutcome.scoreImpact > 0 ? "+" : ""}${state.finalOutcome.scoreImpact}`)
      lines.push("")
    }
    lines.push(state.finalOutcome.narrative)
    lines.push("")
  } else {
    lines.push(`Sessie status: **${session.status}**`)
    lines.push("")
  }

  // BOB fase analyse
  if (bobBreakdown.size > 1 || (bobBreakdown.size === 1 && !bobBreakdown.has("onbekend"))) {
    lines.push("## BOB-fase performance")
    lines.push("")
    lines.push("Analyse van keuzes per Beeldvorming/Oordeel/Besluit-fase. Negatieve totalen wijzen op BOB-vergissingen (bijvoorbeeld: aannames als feiten behandelen, opties niet gewogen, te vroeg beslissen).")
    lines.push("")
    lines.push("| BOB-fase | Gemiddelde | Totaal impact | # events |")
    lines.push("|---|---|---|---|")
    for (const [phase, { total, count, impacts }] of bobBreakdown.entries()) {
      if (phase === "onbekend" && bobBreakdown.size > 1) continue
      const avg = Math.round(total / count)
      lines.push(`| ${phase.charAt(0).toUpperCase() + phase.slice(1)} | ${avg}/100 | ${impacts > 0 ? "+" : ""}${impacts} | ${count} |`)
    }
    lines.push("")
  }

  // Reacties op misleidende signalen
  const misleadingHits = events.filter(e => e.note?.includes("misleidend"))
  if (misleadingHits.length > 0) {
    lines.push("## Reacties op misleidende signalen")
    lines.push("")
    lines.push(`Het team reageerde **${misleadingHits.length} keer** op signalen die achteraf misleidend bleken. Dit zijn klassieke BOB-vergissingen: aannames worden als feiten behandeld.`)
    lines.push("")
    for (const ev of misleadingHits) {
      lines.push(`- ${ev.note} (${ev.scoreImpact ?? 0})`)
      if (ev.lesson) lines.push(`  ${ev.lesson}`)
    }
    lines.push("")
  }

  // Lessons learned — grouped by dimension, ranked by |scoreImpact|
  if (withLessons.length > 0) {
    lines.push("## Lessons Learned")
    lines.push("")
    const byDim = new Map<string, AssessmentEvent[]>()
    for (const ev of withLessons) {
      const list = byDim.get(ev.dimensionId) ?? []
      list.push(ev)
      byDim.set(ev.dimensionId, list)
    }
    for (const [dim, list] of byDim.entries()) {
      lines.push(`### ${dim.replace(/_/g, " ").toUpperCase()}`)
      const sorted = [...list].sort((a, b) => Math.abs(b.scoreImpact ?? 0) - Math.abs(a.scoreImpact ?? 0))
      for (const ev of sorted) {
        const impact = ev.scoreImpact ?? 0
        const symbol = impact > 0 ? "✔" : impact < 0 ? "✘" : "•"
        lines.push(`- **${symbol} ${impact > 0 ? "+" : ""}${impact}** — ${ev.note ?? ""}`)
        lines.push(`  ${ev.lesson}`)
      }
      lines.push("")
    }
  }

  // NIS2 compliance checklist
  const complianceEvents = events.filter(e => e.dimensionId === "compliance_awareness")
  if (complianceEvents.length > 0) {
    lines.push("## NIS2 Compliance Checklist")
    lines.push("")
    const checks: Array<{ label: string; matcher: (note: string) => boolean }> = [
      { label: "Vroegtijdige waarschuwing binnen 24u (NIS2 art. 23 lid 4a)", matcher: n => /early|vroegtijdig|24u|nis2/i.test(n) },
      { label: "Volledige NIS2-melding binnen 72u (art. 23 lid 4b)", matcher: n => /72u|full nis2|nis2.submit|volledige melding/i.test(n) },
      { label: "AVG-datalekmelding bij AP", matcher: n => /avg|ap[- ]submit|ap-melding/i.test(n) },
      { label: "Individuele betrokkenen-notificatie voorbereid (AVG art. 34)", matcher: n => /individ|notify/i.test(n) },
      { label: "Board formeel geïnformeerd (NIS2 art. 20)", matcher: n => /board|bestuur|ceo.brief/i.test(n) },
      { label: "Finaal rapport 30d (art. 23 lid 4c)", matcher: n => /final.report|slotmelding|30d/i.test(n) },
    ]
    for (const check of checks) {
      const hit = events.find(e => e.note && check.matcher(e.note) && (e.scoreImpact ?? 0) > 0)
      const miss = events.find(e => e.note && check.matcher(e.note) && (e.scoreImpact ?? 0) < 0)
      const mark = hit ? "[x]" : miss ? "[✘]" : "[ ]"
      lines.push(`- ${mark} ${check.label}`)
    }
    lines.push("")
  }

  // Score per dimension
  if (events.length > 0) {
    lines.push("## Score per dimensie")
    lines.push("")
    lines.push("| Dimensie | Gemiddelde | Totaal impact | # events |")
    lines.push("|---|---|---|---|")
    const byDim = new Map<string, { total: number; count: number; impacts: number }>()
    for (const ev of events) {
      const entry = byDim.get(ev.dimensionId) ?? { total: 0, count: 0, impacts: 0 }
      entry.total += ev.value
      entry.count += 1
      entry.impacts += ev.scoreImpact ?? 0
      byDim.set(ev.dimensionId, entry)
    }
    for (const [dim, { total, count, impacts }] of byDim.entries()) {
      const avg = Math.round(total / count)
      lines.push(`| ${dim.replace(/_/g, " ")} | ${avg}/100 | ${impacts > 0 ? "+" : ""}${impacts} | ${count} |`)
    }
    lines.push("")
  }

  // Path taken
  if (graph && state) {
    lines.push("## Doorlopen pad")
    lines.push("")
    for (const id of state.pathHistory) {
      const node = nodeById.get(id)
      const d = node?.data as { title?: string; label?: string; prompt?: string; type?: string } | undefined
      const label = node?.type === "round" ? d?.title
        : node?.type === "decision" ? d?.prompt?.slice(0, 60)
        : node?.type === "special" ? d?.type
        : node?.type === "outcome" ? d?.label
        : node?.type
      lines.push(`- \`${node?.type ?? "?"}\` — ${label ?? "(untitled)"}`)
    }
    lines.push("")

    if (state.branchLog.length > 0) {
      lines.push("### Genomen branches")
      lines.push("")
      for (const entry of state.branchLog) {
        const node = nodeById.get(entry.nodeId)
        const d = node?.data as { prompt?: string } | undefined
        lines.push(`- ${fmt(entry.triggeredAt)} — ${d?.prompt ?? entry.nodeId} → handle **${entry.choseHandle}** (${entry.trigger.replace(/_/g, " ")})`)
      }
      lines.push("")
    }
  }

  // Rounds recap
  if (session.scenario.rounds.length > 0) {
    lines.push("## Rondes")
    lines.push("")
    session.scenario.rounds.forEach((round, idx) => {
      lines.push(`### Ronde ${idx + 1}: ${round.title}`)
      if (round.situation_update) {
        lines.push("")
        lines.push(round.situation_update)
      }
      lines.push("")
    })
  }

  // Decisions submitted (participant reasoning)
  const decisions = session.submittedDecisions ?? []
  if (decisions.length > 0) {
    lines.push("## Ingediende beslissingen")
    lines.push("")
    for (const d of decisions) {
      lines.push(`### Ronde ${d.roundIndex + 1} — ${d.participantName} (${ROLE_META[d.role]?.label ?? d.role})`)
      lines.push(`- **Actie:** ${d.actionLabel}`)
      if (d.reasoning) lines.push(`- **Onderbouwing:** _${d.reasoning}_`)
      if (d.isWrongRole) lines.push(`- ⚠ Actie buiten rol-mandaat`)
      if (d.isIrDeviation) lines.push(`- ⚠ Deviatie van IR-plan`)
      lines.push("")
    }
  }

  // Participants
  if (session.participants.length > 0) {
    lines.push("## Deelnemers")
    lines.push("")
    for (const p of session.participants) {
      lines.push(`- **${p.name}** — ${p.role ? ROLE_META[p.role].label : "geen rol"}`)
    }
    lines.push("")
  }

  // Timeline appendix
  if (session.timeline.length > 0) {
    lines.push("## Tijdlijn (appendix)")
    lines.push("")
    for (const ev of session.timeline) {
      const type = ev.type.replace(/_/g, " ")
      lines.push(`- ${fmt(ev.timestamp)} — ${type}`)
    }
  }

  return lines.join("\n")
}

export function downloadReport(session: SessionState) {
  const md = exportReportMarkdown(session)
  const blob = new Blob([md], { type: "text/markdown;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  const stamp = new Date().toISOString().slice(0, 10)
  a.download = `rapport-${session.id.slice(0, 12)}-${stamp}.md`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
