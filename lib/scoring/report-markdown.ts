import { OUTCOME_DIMENSIONS } from './constants'
import type { AssessmentReport, EventReport } from './report'

// Pure markdown-renderers. Output is deterministisch (geen Date-formatting die
// met locale schuift, geen precision-verschillen). Voor PDF: browser-print of
// eender welke markdown-to-pdf pipeline.

export function renderAssessmentMarkdown(r: AssessmentReport): string {
  const lines: string[] = []
  lines.push(`# Debriefrapport`)
  lines.push(``)
  lines.push(`- Scoring-versie: **${r.meta.scoringVersion}**`)
  lines.push(`- Rolcoverage: **${(r.meta.rolCoverage * 100).toFixed(0)}%** (${r.meta.distinctOwners} verschillende eigenaren)`)
  lines.push(`- Totaal punten: **${r.totalPoints}**`)
  if (r.droppedOptionalDecisions.length > 0) {
    lines.push(``)
    lines.push(`> Verkorte versie gespeeld — ${r.droppedOptionalDecisions.length} optionele beslispunten overgeslagen wegens klein team.`)
  }

  lines.push(``)
  lines.push(`## Uitkomst per ronde`)
  lines.push(``)
  lines.push(`| Ronde | Punten | Genormaliseerd | ${OUTCOME_DIMENSIONS.join(' | ')} |`)
  lines.push(`|---|---|---|${OUTCOME_DIMENSIONS.map(() => '---').join('|')}|`)
  for (const o of r.outcomes) {
    lines.push(`| ${o.round} | ${o.points} | ${o.normalized.toFixed(2)} | ${OUTCOME_DIMENSIONS.map(d => o.perDimension[d].toFixed(1)).join(' | ')} |`)
  }

  lines.push(``)
  lines.push(`## Spider — team-totaal`)
  lines.push(``)
  for (const d of OUTCOME_DIMENSIONS) {
    lines.push(`- ${d}: ${r.spider.team[d].toFixed(1)}`)
  }

  lines.push(``)
  lines.push(`## Rolresolutie`)
  lines.push(``)
  for (const [domain, owner] of Object.entries(r.effectiveOwners)) {
    lines.push(`- ${domain}: ${owner}`)
  }

  return lines.join('\n')
}

export function renderEventOnePagerMarkdown(p: EventReport['onePagers'][number]): string {
  const lines: string[] = []
  lines.push(`# ${p.groupName} — Positie #${p.rank}`)
  lines.push(``)
  lines.push(`Totaal: **${p.totalPoints} punten**`)
  lines.push(``)
  for (const round of p.perRound) {
    lines.push(`## Ronde ${round.round} — ${round.points} punten`)
    lines.push(``)
    for (const d of OUTCOME_DIMENSIONS) {
      lines.push(`- **${d}** (${round.perDimension[d].toFixed(1)}): ${round.sentences[d]}`)
    }
    lines.push(``)
  }
  return lines.join('\n')
}

export function renderEventHostMarkdown(r: EventReport): string {
  const lines: string[] = []
  lines.push(`# Host samenvatting`)
  lines.push(``)
  lines.push(`- Scoring-versie: **${r.hostSummary.scoringVersion}**`)
  lines.push(`- Aantal groepen: **${r.hostSummary.groupCount}**`)
  lines.push(``)
  lines.push(`## Eindstand`)
  lines.push(``)
  lines.push(`| # | Groep | Punten |`)
  lines.push(`|---|---|---|`)
  for (const s of r.hostSummary.standings) {
    lines.push(`| ${s.rank} | ${s.groupName} | ${s.totalPoints} |`)
  }

  if (Object.keys(r.hostSummary.distributionPerDecision).length > 0) {
    lines.push(``)
    lines.push(`## Verdeling per beslispunt`)
    lines.push(``)
    for (const [dp, dist] of Object.entries(r.hostSummary.distributionPerDecision)) {
      lines.push(`- **${dp}**: ${Object.entries(dist).map(([o, n]) => `${o}=${n}`).join(', ')}`)
    }
  }

  if (r.hostSummary.causalChains.length > 0) {
    lines.push(``)
    lines.push(`## Causale ketens`)
    lines.push(``)
    for (const c of r.hostSummary.causalChains) {
      lines.push(`- **${c.dimension}** onder ${c.threshold}: ${c.groupsBelow.length} groep(en) → ronde ${c.consequencesRound} met opties ${c.consequenceOptions.join(', ')}`)
    }
  }

  return lines.join('\n')
}
