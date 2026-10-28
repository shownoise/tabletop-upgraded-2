import { describe, expect, it } from 'vitest'
import { buildDraftGraph, SITUATION_LONG_WORDS } from '@/lib/wizard/deterministic'
import { validateFramework, FRAMEWORK_RULE_IDS, ruleSituationDoesNotRevealInjects } from '@/lib/wizard/framework'
import { validateGraph } from '@/lib/graph/validate'
import { buildRoundIndexMap, collectSetupInjectsForDecision } from '@/lib/graph/setup-injects'
import { defaultWizardConfig, type WizardConfig } from '@/lib/wizard/config'
import type { DecisionNodeData, InjectNodeData, OutcomeVector, RoundNodeData } from '@/lib/graph/types'
import type { Role } from '@/lib/types'

// buildDraftGraph is het pad zonder LLM. Twee eisen staan hier vast:
//   1. dezelfde config levert een byte-identieke graph;
//   2. het concept haalt álle regels uit framework.ts zonder repair-pass.
// De tweede eis is de hele reden dat dit pad bestaat — zakt die, dan is de
// wizard terug bij het timeout-probleem.

const AXES: Array<keyof OutcomeVector> = ['CONT', 'FOR', 'BC', 'JUR', 'VER', 'KOS']

function config(overrides: Partial<WizardConfig>): WizardConfig {
  return {
    ...defaultWizardConfig(),
    clientName: 'Bakker & Zonen Logistics',
    sector: 'transport en opslag',
    itArrangement: 'ICT deels uitbesteed aan een regionale MSP',
    ...overrides,
  }
}

const SMALL = config({
  clientName: 'Kleine Praktijk',
  sector: 'zorg — huisartsenpraktijk',
  companySize: 'small',
  rounds: 2,
  injectsPerRound: 2,
  optionsPerRolePerRound: 2,
  rolesIncluded: ['ceo', 'ciso', 'legal'],
})

const LARGE = config({
  clientName: 'Eye security',
  sector: 'MSP',
  companySize: 'mkbplus',
  rounds: 6,
  injectsPerRound: 5,
  optionsPerRolePerRound: 4,
  rolesIncluded: ['ceo', 'ciso', 'cfo', 'legal', 'head_of_comms', 'hr_lead', 'ops_manager', 'it_manager'],
  specialConditions: ['backups_untested', 'outsourced_it_thin_sla'],
  factsNoiseRatio: 0.6,
})

// De config uit de storing van de eigenaar: hierop liep het LLM-pad in de
// 5-minuten-timeout.
const REPORTED = config({
  clientName: 'Eye security',
  sector: 'MSP',
  companySize: 'mkbplus',
  rounds: 4,
  injectsPerRound: 3,
  optionsPerRolePerRound: 4,
  rolesIncluded: ['ceo', 'ciso', 'legal', 'it_manager'],
})

const CASES: Array<{ name: string; config: WizardConfig }> = [
  { name: 'klein (2 rondes, 2 injects, 2 opties, 3 rollen)', config: SMALL },
  { name: 'groot (6 rondes, 5 injects, 4 opties, 8 rollen)', config: LARGE },
  { name: 'gerapporteerd (4 rondes, 3 injects, 4 opties, 4 rollen)', config: REPORTED },
  { name: 'alle rondes en alle opties', config: config({ rounds: 8, injectsPerRound: 4, optionsPerRolePerRound: 6 }) },
  { name: 'één rol, maximale ruis', config: config({ rounds: 5, injectsPerRound: 3, optionsPerRolePerRound: 3, rolesIncluded: ['ciso'], factsNoiseRatio: 0 }) },
  { name: 'alleen feiten', config: config({ rounds: 4, injectsPerRound: 5, optionsPerRolePerRound: 3, factsNoiseRatio: 1 }) },
  { name: 'alle bijzondere omstandigheden', config: config({ rounds: 7, injectsPerRound: 3, optionsPerRolePerRound: 4, specialConditions: ['backups_untested', 'single_knowledge_holder', 'outsourced_it_thin_sla', 'no_tested_crisis_plan', 'unclear_insurance', 'ot_production_dependency', 'supplier_concentration'] }) },
]

function words(text: string): string[] {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
}

describe('buildDraftGraph — reproduceerbaar', () => {
  it('levert bij dezelfde config een byte-identieke graph', () => {
    for (const testCase of CASES) {
      const first = buildDraftGraph(testCase.config)
      const second = buildDraftGraph(testCase.config)
      expect(JSON.stringify(second), testCase.name).toBe(JSON.stringify(first))
    }
  })

  it('negeert de volgorde waarin rollen zijn aangevinkt', () => {
    const clicked = buildDraftGraph(config({ rounds: 4, rolesIncluded: ['it_manager', 'ceo', 'legal'] }))
    const ordered = buildDraftGraph(config({ rounds: 4, rolesIncluded: ['ceo', 'legal', 'it_manager'] }))
    expect(JSON.stringify(clicked)).toBe(JSON.stringify(ordered))
  })

  it('gebruikt geen wandklok tenzij de aanroeper er één meegeeft', () => {
    const fixed = buildDraftGraph(SMALL)
    expect(fixed.createdAt).toBe(0)
    expect(fixed.updatedAt).toBe(0)
    expect(buildDraftGraph(SMALL, { now: 1_700_000_000_000 }).createdAt).toBe(1_700_000_000_000)
  })

  it('laat clientId en goalId ongemoeid als de config die niet geeft', () => {
    const graph = buildDraftGraph(REPORTED)
    expect(graph.clientId).toBeUndefined()
    expect(graph.goalId).toBeUndefined()
    expect(graph.publishStatus).toBe('draft')
  })
})

describe('buildDraftGraph — framework', () => {
  it('haalt alle regels zonder repair-pass', () => {
    for (const testCase of CASES) {
      const graph = buildDraftGraph(testCase.config)
      const result = validateFramework(graph, testCase.config)
      expect(
        result.failures.map(f => `[${f.ruleId}] ${f.violation}`).join('\n'),
        `${testCase.name} — framework-schendingen`,
      ).toBe('')
      expect(result.ok).toBe(true)
    }
  })

  it('toetst werkelijk alle veertien regels', () => {
    // Vangt af dat een regel stilletjes uit de set verdwijnt en de test
    // daarmee niets meer zegt.
    expect(FRAMEWORK_RULE_IDS).toHaveLength(14)
  })

  it('levert een graph zonder blokkerende structuurfouten', () => {
    for (const testCase of CASES) {
      const graph = buildDraftGraph(testCase.config)
      const errors = validateGraph(graph)
        .filter(issue => issue.severity === 'error')
        // Zelfde uitzonderingen als de pipeline: score-gekozen uitkomsten
        // hebben geen branch-edge nodig.
        .filter(issue => {
          const node = graph.nodes.find(n => n.id === issue.nodeId)
          if (node?.type === 'outcome' && issue.message.includes('unreachable')) return false
          return true
        })
      expect(errors.map(e => e.message).join('\n'), testCase.name).toBe('')
    }
  })
})

describe('buildDraftGraph — structuur', () => {
  it('bouwt per ronde injects, één keuzemoment en opties per rol', () => {
    for (const testCase of CASES) {
      const { config: cfg, name } = testCase
      const graph = buildDraftGraph(cfg)
      const rounds = graph.nodes.filter(n => n.type === 'round')
      const injects = graph.nodes.filter(n => n.type === 'inject')
      const decisions = graph.nodes.filter(n => n.type === 'decision')

      expect(rounds.length, name).toBe(cfg.rounds)
      expect(injects.length, name).toBe(cfg.rounds * cfg.injectsPerRound)
      expect(decisions.length, name).toBe(cfg.rounds)

      for (const decision of decisions) {
        const data = decision.data as DecisionNodeData
        expect(data.perRole, name).toBe(true)
        expect(data.measuredBy, name).toBe('participant_choice')

        const perRole = new Map<Role, number>()
        for (const option of data.options) {
          if (!option.allowedRole) continue
          perRole.set(option.allowedRole, (perRole.get(option.allowedRole) ?? 0) + 1)
        }
        expect([...perRole.keys()].sort(), name).toEqual([...cfg.rolesIncluded].sort())
        for (const [role, count] of perRole) {
          expect(count, `${name} — ${role}`).toBe(cfg.optionsPerRolePerRound)
        }

        const implicit = data.options.filter(o => o.implicit)
        expect(implicit.length, name).toBe(1)
        expect(implicit[0].allowedRole, name).toBeUndefined()
      }
    }
  })

  it('geeft elke optie alle zes dimensies met gehele waarden in -2..+2', () => {
    for (const testCase of CASES) {
      const graph = buildDraftGraph(testCase.config)
      for (const node of graph.nodes) {
        if (node.type !== 'decision') continue
        for (const option of (node.data as DecisionNodeData).options) {
          const vector = option.outcomeVector
          expect(vector, `${testCase.name} — "${option.label}" zonder vector`).toBeDefined()
          for (const axis of AXES) {
            const value = vector![axis]
            expect(Number.isInteger(value), `${testCase.name} — "${option.label}" as ${axis}`).toBe(true)
            expect(value).toBeGreaterThanOrEqual(-2)
            expect(value).toBeLessThanOrEqual(2)
          }
          expect(AXES.some(axis => vector![axis] !== 0), `${testCase.name} — "${option.label}" alle-nul`).toBe(true)
        }
      }
    }
  })

  it('kent elke rol in elke ronde evenveel handelingsrichtingen toe', () => {
    // De kwaliteitsrang komt uit dezelfde index als de actietekst. Loopt het
    // aantal acties per rol uit de pas met het aantal kwaliteitsrangen, dan
    // krijgt een optie een rang die niet bij de tekst hoort.
    const graph = buildDraftGraph(config({ rounds: 8, optionsPerRolePerRound: 6 }))
    for (const node of graph.nodes) {
      if (node.type !== 'decision') continue
      const labels = (node.data as DecisionNodeData).options
        .filter(o => o.allowedRole === 'ceo')
        .map(o => o.label)
      expect(new Set(labels).size, labels.join(' | ')).toBe(6)
    }
  })

  it('geeft de opties van één rol onderling verschillende afwegingen', () => {
    const graph = buildDraftGraph(LARGE)
    for (const node of graph.nodes) {
      if (node.type !== 'decision') continue
      const byRole = new Map<string, string[]>()
      for (const option of (node.data as DecisionNodeData).options) {
        if (!option.allowedRole) continue
        const key = option.allowedRole
        byRole.set(key, [...(byRole.get(key) ?? []), JSON.stringify(option.outcomeVector)])
      }
      for (const [role, vectors] of byRole) {
        expect(new Set(vectors).size, `${role} heeft identieke scorevectoren`).toBe(vectors.length)
      }
    }
  })

  it('geeft elke gekozen rol een briefing en minstens één rol een playbook-gap', () => {
    for (const testCase of CASES) {
      const graph = buildDraftGraph(testCase.config)
      const briefings = graph.roleBriefings ?? {}
      expect([...Object.keys(briefings)].sort(), testCase.name)
        .toEqual([...testCase.config.rolesIncluded].sort())
      expect(
        Object.values(briefings).some(b => (b?.playbookGaps?.length ?? 0) > 0),
        testCase.name,
      ).toBe(true)
    }
  })
})

describe('buildDraftGraph — setup-injects kondigen de beslissing aan', () => {
  it('heeft per ronde een setup-inject die op de beslisvraag eindigt', () => {
    for (const testCase of CASES) {
      const graph = buildDraftGraph(testCase.config)
      const roundMap = buildRoundIndexMap(graph)
      const decisions = graph.nodes.filter(n => n.type === 'decision')

      for (const decision of decisions) {
        const data = decision.data as DecisionNodeData
        const setups = collectSetupInjectsForDecision(graph, decision.id, roundMap)
        expect(setups.length, `${testCase.name} — "${data.prompt}" zonder setup-inject`).toBeGreaterThanOrEqual(1)

        // Dezelfde maatstaf als lib/graph/__tests__/setup-inject-announces-decision:
        // een vraagteken (de vraag staat er echt) én een inhoudelijk kernwoord
        // uit de prompt (de vraag gaat over déze beslissing).
        const keywords = new Set(words(data.prompt).filter(w => w.length >= 6).map(w => w.slice(0, 6)))
        expect(keywords.size, `${testCase.name} — prompt zonder kernwoord`).toBeGreaterThanOrEqual(1)

        const announces = setups.some(setup => {
          const node = graph.nodes.find(n => n.id === setup.injectId)!
          const inject = node.data as InjectNodeData
          const text = `${inject.title ?? ''} ${inject.content ?? ''}`.trim()
          const shared = words(text).map(w => w.slice(0, 6)).filter(w => keywords.has(w))
          return text.endsWith('?') && shared.length > 0
        })
        expect(announces, `${testCase.name} — "${data.prompt}" wordt niet aangekondigd`).toBe(true)
      }
    }
  })
})

describe('buildDraftGraph — de rondekop verklapt niets', () => {
  it('haalt rule13_situation_no_spoiler voor elke config', () => {
    for (const testCase of CASES) {
      const graph = buildDraftGraph(testCase.config)
      const result = ruleSituationDoesNotRevealInjects(graph)
      expect(result.ok ? '' : result.violation, testCase.name).toBe('')
    }
  })

  it('houdt het lange-woorden-vocabulaire van schets en injects gescheiden', () => {
    // De structurele garantie onder rule13: een schets gebruikt alleen korte
    // woorden plus een vaste lijst lange woorden, en die lijst komt in geen
    // enkele inject voor. Daarmee kan de tweede drempel van rule13 (vier
    // inject-eigen woorden in de schets) nooit afgaan — bij welke config ook.
    const allowed = new Set(SITUATION_LONG_WORDS)
    for (const testCase of CASES) {
      const graph = buildDraftGraph(testCase.config)

      const situationLongWords = new Set<string>()
      for (const node of graph.nodes) {
        if (node.type !== 'round') continue
        for (const word of words((node.data as RoundNodeData).situation_update ?? '')) {
          if (word.length >= 7) situationLongWords.add(word)
        }
      }
      const unexpected = [...situationLongWords].filter(w => !allowed.has(w)).sort()
      expect(unexpected, `${testCase.name} — lange woorden buiten de lijst`).toEqual([])

      const injectWords = new Set<string>()
      for (const node of graph.nodes) {
        if (node.type !== 'inject') continue
        const inject = node.data as InjectNodeData
        for (const word of words(`${inject.title ?? ''} ${inject.content ?? ''}`)) injectWords.add(word)
      }
      const leaked = SITUATION_LONG_WORDS.filter(w => injectWords.has(w))
      expect(leaked, `${testCase.name} — schets-woord ook in een inject`).toEqual([])
    }
  })

  it('houdt de schets kort: drie of vier zinnen', () => {
    const graph = buildDraftGraph(LARGE)
    for (const node of graph.nodes) {
      if (node.type !== 'round') continue
      const situation = (node.data as RoundNodeData).situation_update
      const sentences = situation.split(/[.!?]+\s*/).filter(s => s.trim().length > 0)
      expect(sentences.length, situation).toBeGreaterThanOrEqual(3)
      expect(sentences.length, situation).toBeLessThanOrEqual(5)
    }
  })
})
