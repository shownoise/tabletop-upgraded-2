import { ROLE_META } from "@/lib/types"
import type { SessionState } from "@/lib/types"

function fmt(ts: number): string {
  return new Date(ts).toLocaleString("nl-NL", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  })
}

// Markdown session report. Reads only from graph state, submitted decisions,
// timeline, and role distribution — no legacy assessment events.
export function exportReportMarkdown(session: SessionState): string {
  const lines: string[] = []
  const graph = session.graph
  const state = session.graphState
  const nodeById = graph ? new Map(graph.nodes.map(n => [n.id, n])) : new Map()

  lines.push(`# ${session.scenario.scenario_title ?? "Cyber Crisis Rapport"}`)
  lines.push("")
  lines.push(`_Gegenereerd op ${fmt(Date.now())}_`)
  lines.push(`_Sessie ID: \`${session.id}\`_`)
  lines.push("")

  lines.push("## Uitkomst")
  if (state?.finalOutcome) {
    lines.push(`### ${state.finalOutcome.label}`)
    lines.push(state.finalOutcome.narrative)
    lines.push("")
  } else {
    lines.push(`Sessie status: **${session.status}**`)
    lines.push("")
  }

  // Rondes recap
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

  // Genomen branches
  if (graph && state && state.branchLog.length > 0) {
    lines.push("## Genomen branches")
    lines.push("")
    for (const entry of state.branchLog) {
      const node = nodeById.get(entry.nodeId)
      const d = node?.data as { prompt?: string } | undefined
      lines.push(`- ${fmt(entry.triggeredAt)} — ${d?.prompt ?? entry.nodeId} → **${entry.choseHandle}** (${entry.trigger.replace(/_/g, " ")})`)
    }
    lines.push("")
  }

  // Ingediende beslissingen
  const decisions = session.submittedDecisions ?? []
  if (decisions.length > 0) {
    lines.push("## Ingediende beslissingen")
    lines.push("")
    for (const d of decisions) {
      lines.push(`### Ronde ${d.roundIndex + 1} — ${d.participantName} (${ROLE_META[d.role]?.label ?? d.role})`)
      lines.push(`- **Actie:** ${d.actionLabel}`)
      if (d.reasoning) lines.push(`- **Onderbouwing:** _${d.reasoning}_`)
      if (d.isWrongRole) lines.push(`- Actie buiten rol-mandaat`)
      if (d.isIrDeviation) lines.push(`- Deviatie van IR-plan`)
      lines.push("")
    }
  }

  // Rolverdeling
  if (session.roleDistribution) {
    lines.push("## Rolverdeling")
    lines.push("")
    for (const e of session.roleDistribution.entries) {
      const roles = [e.primaryRole, ...e.inheritedRoles].map(r => ROLE_META[r]?.label ?? r).join(' + ')
      lines.push(`- **${e.participantName}** — ${roles}`)
    }
    if (session.roleDistribution.unassignedRoles.length > 0) {
      lines.push(`- _Niet ingevuld_: ${session.roleDistribution.unassignedRoles.map(r => ROLE_META[r]?.label ?? r).join(', ')}`)
    }
    lines.push("")
  }

  // Deelnemers
  if (session.participants.length > 0) {
    lines.push("## Deelnemers")
    lines.push("")
    for (const p of session.participants) {
      lines.push(`- **${p.name}** — ${p.role ? ROLE_META[p.role]?.label ?? p.role : "geen rol"}`)
    }
    lines.push("")
  }

  // Tijdlijn appendix
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
