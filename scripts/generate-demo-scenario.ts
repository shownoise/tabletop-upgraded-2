// Demo-script: draai de wizard-pipeline één keer met een vaste config en
// schrijf de output naar docs/kwaliteit/nulmeting/. Bedoeld voor de review
// van P6 prompt-regels — laat zien wat de wizard oplevert met de nieuwe rules.
//
// Gebruik: `pnpm tsx scripts/generate-demo-scenario.ts`
// Vereist: ANTHROPIC_API_KEY in .env.local (via `vercel env pull`).
//
// Klant: GGZ De Waterhof (uit docs/kwaliteit/testklanten.md — meest gelaagde
// context: alle 8 rollen bezet, NIS2 + AVG categorie gezondheid, IGJ-toezicht).

import { config as loadEnv } from 'dotenv'
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { runWizardPipeline, type LlmMessage } from '@/lib/wizard/pipeline'
import { defaultWizardConfig } from '@/lib/wizard/config'

loadEnv({ path: '.env.local' })

const apiKey = process.env.ANTHROPIC_API_KEY
if (!apiKey) {
  console.error('❌ ANTHROPIC_API_KEY ontbreekt. Run: `vercel env pull .env.local`')
  process.exit(1)
}

async function callClaude(messages: LlmMessage[]): Promise<string> {
  const systemContent = messages.filter(m => m.role === 'system').map(m => m.content).join('\n\n')
  const others = messages.filter(m => m.role !== 'system').map(m => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }))
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'anthropic-version': '2023-06-01',
      'x-api-key': apiKey!,
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 16000,
      system: systemContent,
      messages: others,
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Claude API ${res.status}: ${err}`)
  }
  const data = await res.json() as { content?: Array<{ text?: string }> }
  return data.content?.[0]?.text ?? ''
}

async function main() {
  const config = {
    ...defaultWizardConfig(),
    clientName: 'GGZ De Waterhof',
    sector: 'ambulante geestelijke gezondheidszorg (jeugd + volwassenen), ~4200 cliënten actief, 6 locaties',
    companySize: 'mkbplus' as const,
    itArrangement:
      'Hybride: EPD (User) in private cloud bij zorg-ISV; kantoor in Microsoft 365; roosterplanning via aparte SaaS; MFA verplicht sinds 2024. MSP voor devices. Interne security-adviseur (0,4 fte) rapporterend aan CFO. NEN 7510-gecertificeerd.',
    importantContext:
      'Kroonjuwelen: EPD (bijzondere persoonsgegevens categorie gezondheid), roosterplanning (crisisdienst), medicatievoorschriften, financiële admin. Toezicht: IGJ + AP + CSIRT/NCSC. Alle 8 rollen zijn bezet — CISO is de security-adviseur.',
    rounds: 4,
    injectsPerRound: 5,
    optionsPerRolePerRound: 3,
    factsNoiseRatio: 0.5,
    rolesIncluded: ['ceo', 'ciso', 'cfo', 'legal', 'head_of_comms', 'hr_lead', 'ops_manager', 'it_manager'] as Array<'ceo' | 'ciso' | 'cfo' | 'legal' | 'head_of_comms' | 'hr_lead' | 'ops_manager' | 'it_manager'>,
    specialConditions: ['single_knowledge_holder'] as string[],
    seed: 'demo-waterhof-p6',
  }

  console.log('▶  Klant:', config.clientName)
  console.log('▶  Rondes:', config.rounds, '· Opties/rol:', config.optionsPerRolePerRound, '· Special:', config.specialConditions.join(','))
  console.log('▶  Feit-ratio:', config.factsNoiseRatio, '· Seed:', config.seed)
  console.log()

  const t0 = Date.now()
  try {
    const result = await runWizardPipeline(config, {
      llm: callClaude,
      maxRepairAttempts: 2,
      now: () => Date.now(),
    })
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1)
    console.log(`✓ Klaar in ${elapsed}s. Repair-log: ${result.repairLog.length} entries.`)
    if (result.repairLog.length > 0) {
      for (const r of result.repairLog) {
        console.log(`   pass ${r.attempt}: ${r.ruleId} — ${r.violation}`)
      }
    }
    const outDir = join(process.cwd(), 'docs/kwaliteit/nulmeting')
    mkdirSync(outDir, { recursive: true })
    const stamp = new Date().toISOString().slice(0, 10)
    const outPath = join(outDir, `demo-waterhof-${stamp}.json`)
    writeFileSync(outPath, JSON.stringify(result.graph, null, 2))
    console.log(`✓ Scenario geschreven: ${outPath}`)

    // Ook een leesbare samenvatting maken.
    const summaryPath = join(outDir, `demo-waterhof-${stamp}.md`)
    const g = result.graph
    const rounds = g.nodes.filter(n => n.type === 'round')
    const injects = g.nodes.filter(n => n.type === 'inject')
    const decisions = g.nodes.filter(n => n.type === 'decision')
    const lines: string[] = []
    lines.push(`# Demo — ${config.clientName} — ${stamp}`)
    lines.push('')
    lines.push(`**Config**: ${config.rounds} rondes, ${config.injectsPerRound} injects/ronde, ${config.optionsPerRolePerRound} opties/rol, feit-ratio ${config.factsNoiseRatio}, special ${config.specialConditions.join(', ')}.`)
    lines.push(`**Seed**: \`${config.seed}\` · **Duur**: ${elapsed}s · **Repair-passes**: ${result.repairLog.length}`)
    lines.push('')
    lines.push(`**Structuur**: ${rounds.length} rondes · ${injects.length} injects · ${decisions.length} decisions`)
    lines.push('')
    if (g.roleBriefings) {
      lines.push('## Role briefings (hidden weakness = rule 11)')
      lines.push('')
      for (const [role, brief] of Object.entries(g.roleBriefings)) {
        lines.push(`- **${role}**: ${brief?.text?.slice(0, 120) ?? '(geen tekst)'}${brief?.playbookGaps && brief.playbookGaps.length > 0 ? ` — gaps: ${brief.playbookGaps.join('; ')}` : ''}`)
      }
      lines.push('')
    }
    for (let i = 0; i < rounds.length; i++) {
      const r = rounds[i]
      const rd = r.data as { title?: string; situation_update?: string; openingPrompts?: string[]; facilitatorNotes?: { discussionGoal?: string; redFlags?: string[] } }
      lines.push(`## Ronde ${i + 1} — ${rd.title ?? '(geen titel)'}`)
      lines.push('')
      lines.push(rd.situation_update ?? '(geen situatie)')
      lines.push('')
      if (rd.openingPrompts && rd.openingPrompts.length > 0) {
        lines.push('**Stuurvragen**:')
        for (const p of rd.openingPrompts) lines.push(`  - ${p}`)
        lines.push('')
      }
      if (rd.facilitatorNotes?.discussionGoal) {
        lines.push(`**Discussie-doel**: ${rd.facilitatorNotes.discussionGoal}`)
        lines.push('')
      }
      if (rd.facilitatorNotes?.redFlags && rd.facilitatorNotes.redFlags.length > 0) {
        lines.push(`**Valkuilen**: ${rd.facilitatorNotes.redFlags.join('; ')}`)
        lines.push('')
      }
    }
    lines.push('## Alle decisions met opties per rol')
    lines.push('')
    for (const d of decisions) {
      const dd = d.data as { prompt?: string; options?: Array<{ label?: string; allowedRole?: string; outcomeVector?: Record<string, number>; lessonLearned?: string }> }
      lines.push(`### ${dd.prompt ?? '(geen vraag)'}`)
      lines.push('')
      const perRole = new Map<string, Array<NonNullable<typeof dd.options>[number]>>()
      for (const o of dd.options ?? []) {
        const r = o.allowedRole ?? '(alle)'
        const arr = perRole.get(r) ?? []
        arr.push(o)
        perRole.set(r, arr)
      }
      for (const [role, opts] of perRole.entries()) {
        lines.push(`- **${role}** (${opts.length} opties):`)
        for (const o of opts) {
          const vec = o.outcomeVector ? Object.entries(o.outcomeVector).map(([k, v]) => `${k}${v >= 0 ? '+' : ''}${v}`).join(' ') : ''
          lines.push(`  - ${o.label} — ${vec}`)
        }
      }
      lines.push('')
    }
    writeFileSync(summaryPath, lines.join('\n'))
    console.log(`✓ Samenvatting geschreven: ${summaryPath}`)
  } catch (err) {
    console.error('✗ Wizard mislukt:', err instanceof Error ? err.message : err)
    process.exit(1)
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
