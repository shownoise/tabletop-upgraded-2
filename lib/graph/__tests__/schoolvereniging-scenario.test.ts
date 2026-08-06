import { describe, expect, it } from 'vitest'
import { schoolverenigingScenario } from '@/lib/graph/examples-schoolvereniging'
import { validateGraph } from '@/lib/graph/validate'
import type { DecisionNodeData, InjectNodeData, RoundNodeData } from '@/lib/graph/types'
import type { Role } from '@/lib/types'
import { validateFramework } from '@/lib/wizard/framework'
import type { WizardConfig } from '@/lib/wizard/config'

// Guardrail suite for the school-association starter scenario. These tests
// codify the structural promises the brief made — no test is bound to the
// exact Dutch prose so authors can tweak wording without breaking the suite.

const CONFIG: WizardConfig = {
  clientName: 'Onderwijsvereniging Noord-Oost',
  sector: 'onderwijs — funderend/VO',
  companySize: 'mkbplus',
  itArrangement: 'ICT uitbesteed aan regionale MSP (WestNet ICT B.V.)',
  rounds: 6,
  injectsPerRound: 4,
  optionsPerRolePerRound: 4,
  factsNoiseRatio: 0.6,
  rolesIncluded: ['ceo', 'ciso', 'cfo', 'legal', 'head_of_comms', 'hr_lead', 'ops_manager', 'it_manager'],
  regulatoryRegimeId: 'nl_avg_nis2',
  specialConditions: ['backups_untested', 'single_knowledge_holder', 'outsourced_it_thin_sla', 'unclear_insurance'],
}

describe('examples-schoolvereniging — structural invariants', () => {
  const graph = schoolverenigingScenario()

  it('has exactly 6 round nodes', () => {
    const rounds = graph.nodes.filter(n => n.type === 'round')
    expect(rounds.length).toBe(6)
  })

  it('every decision option has a valid outcomeVector on all 6 axes', () => {
    const dims = ['CONT', 'FOR', 'BC', 'JUR', 'VER', 'KOS'] as const
    for (const node of graph.nodes) {
      if (node.type !== 'decision') continue
      const dd = node.data as DecisionNodeData
      for (const opt of dd.options) {
        expect(opt.outcomeVector, `option "${opt.label}" missing outcomeVector`).toBeDefined()
        for (const d of dims) {
          expect(typeof opt.outcomeVector![d], `option "${opt.label}" dim ${d} not number`).toBe('number')
        }
      }
    }
  })

  it('every role appears as allowedRole on at least 3 decision options across the scenario', () => {
    const roleCounts: Record<Role, number> = {
      ceo: 0, ciso: 0, cfo: 0, legal: 0, head_of_comms: 0,
      hr_lead: 0, ops_manager: 0, it_manager: 0,
    }
    for (const node of graph.nodes) {
      if (node.type !== 'decision') continue
      const dd = node.data as DecisionNodeData
      for (const opt of dd.options) {
        if (opt.allowedRole) roleCounts[opt.allowedRole]++
      }
    }
    for (const role of Object.keys(roleCounts) as Role[]) {
      expect(roleCounts[role], `role ${role} has < 3 decision options`).toBeGreaterThanOrEqual(3)
    }
  })

  it('at least one inject carries triggersRegulatoryNotification: true', () => {
    const withTrigger = graph.nodes.filter(n => {
      if (n.type !== 'inject') return false
      const d = n.data as InjectNodeData
      return d.triggersRegulatoryNotification === true
    })
    expect(withTrigger.length).toBeGreaterThanOrEqual(1)
  })

  it('at least 12 cross-role coupling moments exist (capabilityFlag OR requiresCapability)', () => {
    let coupling = 0
    for (const node of graph.nodes) {
      if (node.type === 'decision') {
        const dd = node.data as DecisionNodeData
        for (const opt of dd.options) {
          if (opt.capabilityFlag) coupling++
          if (opt.requiresCapability) coupling++
        }
      }
      if (node.type === 'inject') {
        const d = node.data as InjectNodeData
        if (d.requiresCapability) coupling++
      }
    }
    expect(coupling, 'need at least 12 coupling moments across the scenario').toBeGreaterThanOrEqual(12)
  })

  it('scenario passes validateGraph() with no errors', () => {
    const issues = validateGraph(graph)
    const errors = issues.filter(i => i.severity === 'error')
    if (errors.length > 0) {
      console.error('Validation errors:', JSON.stringify(errors, null, 2))
    }
    expect(errors).toEqual([])
  })

  it('every round has at least 3 injects', () => {
    const rounds = graph.nodes.filter(n => n.type === 'round')
    for (const round of rounds) {
      const injectEdges = graph.edges.filter(e => e.source === round.id && e.type === 'inject')
      const rd = round.data as RoundNodeData
      expect(injectEdges.length, `round "${rd.title}" has < 3 injects`).toBeGreaterThanOrEqual(3)
    }
  })

  it('every round has reviewPrompts authored', () => {
    const rounds = graph.nodes.filter(n => n.type === 'round')
    for (const round of rounds) {
      const rd = round.data as RoundNodeData
      expect(rd.reviewPrompts, `round "${rd.title}" missing reviewPrompts`).toBeDefined()
      expect(rd.reviewPrompts!.length).toBeGreaterThanOrEqual(2)
    }
  })
})

// Phase 10 — new migration coverage: schema + framework alignment.
describe('examples-schoolvereniging — Phase 10 migration', () => {
  const graph = schoolverenigingScenario()

  it('every inject carries a classification (feit/aanname/fabel)', () => {
    for (const node of graph.nodes) {
      if (node.type !== 'inject') continue
      const d = node.data as InjectNodeData
      expect(d.classification, `inject "${d.title}" missing classification`).toBeDefined()
      expect(['feit', 'aanname', 'fabel']).toContain(d.classification)
    }
  })

  it('classification ratio approximates config.factsNoiseRatio ±0.15', () => {
    const injects = graph.nodes.filter(n => n.type === 'inject').map(n => n.data as InjectNodeData)
    const classified = injects.filter(i => !!i.classification)
    const facts = classified.filter(i => i.classification === 'feit').length
    const ratio = facts / classified.length
    expect(Math.abs(ratio - CONFIG.factsNoiseRatio)).toBeLessThanOrEqual(0.15)
  })

  it('every decision node has at least one setup inject (feit or aanname) in same or prior round', () => {
    // Rule 1 wrapper — we verify via validateFramework's single-rule invocation.
    const res = validateFramework(graph, CONFIG)
    const rule1 = res.failures.find(f => f.ruleId === 'rule1_setup_inject')
    expect(rule1, `rule1 failed: ${rule1?.violation}`).toBeUndefined()
  })

  it('no setup inject is classified fabel (rule 4)', () => {
    const res = validateFramework(graph, CONFIG)
    const rule4 = res.failures.find(f => f.ruleId === 'rule4_noise_not_only_path')
    expect(rule4, `rule4 failed: ${rule4?.violation}`).toBeUndefined()
  })

  it('roleBriefings authored for every used role', () => {
    const usedRoles = new Set<Role>()
    for (const node of graph.nodes) {
      if (node.type !== 'decision') continue
      const dd = node.data as DecisionNodeData
      for (const opt of dd.options) {
        if (opt.allowedRole) usedRoles.add(opt.allowedRole)
      }
    }
    expect(graph.roleBriefings, 'roleBriefings must be set').toBeDefined()
    for (const role of usedRoles) {
      expect(graph.roleBriefings![role], `roleBriefing missing for ${role}`).toBeDefined()
      expect(graph.roleBriefings![role]!.text.length, `roleBriefing.text for ${role} too short`).toBeGreaterThanOrEqual(80)
    }
  })

  it('every round has a non-empty facilitatorNotes.discussionGoal', () => {
    for (const node of graph.nodes) {
      if (node.type !== 'round') continue
      const rd = node.data as RoundNodeData
      const goal = rd.facilitatorNotes?.discussionGoal?.trim() ?? ''
      expect(goal.length, `round "${rd.title}" missing discussionGoal`).toBeGreaterThan(0)
    }
  })

  it('publishStatus is "published" (authored, not wizard-drafted)', () => {
    expect(graph.publishStatus).toBe('published')
  })

  it('injectLibrary has the seeded 7 entries (2 feit / 2 aanname / 2 fabel + drift-tolerant)', () => {
    expect(graph.injectLibrary).toBeDefined()
    expect(graph.injectLibrary!.length).toBeGreaterThanOrEqual(6)
  })

  it('every option has a non-zero outcomeVector on at least one axis (rule 6)', () => {
    const res = validateFramework(graph, CONFIG)
    const rule6 = res.failures.find(f => f.ruleId === 'rule6_dimension_mapped')
    expect(rule6, `rule6 failed: ${rule6?.violation}`).toBeUndefined()
  })

  it('special conditions appear in required rounds (rule 8)', () => {
    const res = validateFramework(graph, CONFIG)
    const rule8 = res.failures.find(f => f.ruleId === 'rule8_special_conditions')
    expect(rule8, `rule8 failed: ${rule8?.violation}`).toBeUndefined()
  })

  it('regulatory notification placed with authority keywords (rule 9)', () => {
    const res = validateFramework(graph, CONFIG)
    const rule9 = res.failures.find(f => f.ruleId === 'rule9_regulatory_window')
    expect(rule9, `rule9 failed: ${rule9?.violation}`).toBeUndefined()
  })

  it('rounds 2-6 reference prior-round decision consequences (rule 5)', () => {
    const res = validateFramework(graph, CONFIG)
    const rule5 = res.failures.find(f => f.ruleId === 'rule5_cross_round_lesson')
    expect(rule5, `rule5 failed: ${rule5?.violation}`).toBeUndefined()
  })

  it('per-role options match target of 4 (rule 2)', () => {
    const res = validateFramework(graph, CONFIG)
    const rule2 = res.failures.find(f => f.ruleId === 'rule2_options_per_role')
    expect(rule2, `rule2 failed: ${rule2?.violation}`).toBeUndefined()
  })

  it('facilitator guidance is grounded in round content (rule 10)', () => {
    const res = validateFramework(graph, CONFIG)
    const rule10 = res.failures.find(f => f.ruleId === 'rule10_facilitator_guidance')
    expect(rule10, `rule10 failed: ${rule10?.violation}`).toBeUndefined()
  })

  it('classification ratio approximates target (rule 7)', () => {
    const res = validateFramework(graph, CONFIG)
    const rule7 = res.failures.find(f => f.ruleId === 'rule7_classification_ratio')
    expect(rule7, `rule7 failed: ${rule7?.violation}`).toBeUndefined()
  })

  it('no within-role dominant option (rule 3)', () => {
    const dims = ['CONT', 'FOR', 'BC', 'JUR', 'VER', 'KOS'] as const
    for (const node of graph.nodes) {
      if (node.type !== 'decision') continue
      const dd = node.data as DecisionNodeData
      if (!dd.perRole) continue
      const byRole = new Map<string, typeof dd.options>()
      for (const opt of dd.options) {
        if (!opt.outcomeVector) continue
        const key = opt.allowedRole ?? '__implicit__'
        if (!byRole.has(key)) byRole.set(key, [] as any)
        byRole.get(key)!.push(opt)
      }
      for (const [_role, opts] of byRole) {
        for (let i = 0; i < opts.length; i++) {
          for (let j = 0; j < opts.length; j++) {
            if (i === j) continue
            const A = opts[i].outcomeVector!
            const B = opts[j].outcomeVector!
            let dom = true
            let strict = false
            for (const ax of dims) {
              if ((A[ax] ?? 0) < (B[ax] ?? 0)) { dom = false; break }
              if ((A[ax] ?? 0) > (B[ax] ?? 0)) strict = true
            }
            expect(dom && strict, `Within-role dominance: "${opts[i].label}" dominates "${opts[j].label}"`).toBe(false)
          }
        }
      }
    }
  })

  it('FRAMEWORK STATUS — validateFramework passes every rule on the showcase scenario', () => {
    const res = validateFramework(graph, CONFIG)
    const failing = res.failures.map(f => f.ruleId).sort()
    expect(failing, `unexpected framework failures: ${JSON.stringify(res.failures, null, 2)}`).toEqual([])
  })
})
