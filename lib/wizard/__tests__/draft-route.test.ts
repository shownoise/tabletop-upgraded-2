import { describe, expect, it, vi } from 'vitest'
// vitest hijst de vi.mock-aanroepen boven deze import, dus de route ziet de
// gemockte auth-gate en rate limiter.
import { POST } from '@/app/api/scenario-graph/draft/route'
import type { ScenarioGraph } from '@/lib/graph/types'
import type { RuleFailure } from '@/lib/wizard/framework'

// De conceptroute moet het zonder API-key kunnen — dat is de hele reden dat hij
// bestaat. Deze test draait de echte handler met alleen de facilitator-gate en
// de rate limiter weggemockt, en controleert dat er een geldige graph uit komt
// en dat een anonieme aanvraag wordt geweigerd.

const gate = vi.hoisted(() => ({ ok: true }))

vi.mock('@/lib/auth-guard', () => ({
  requireFacilitator: async () => (gate.ok
    ? { ok: true as const, session: { user: { id: 'test-facilitator', role: 'facilitator' } }, role: 'facilitator' as const }
    : { ok: false as const, response: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }) }),
}))

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: async () => ({ ok: true, remaining: 59, resetSeconds: 60 }),
}))

function request(body: unknown): Request {
  return new Request('http://localhost/api/scenario-graph/draft', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const CONFIG = {
  clientName: 'Eye security',
  sector: 'MSP',
  companySize: 'mkbplus',
  itArrangement: 'ICT deels uitbesteed aan een regionale MSP',
  rounds: 4,
  injectsPerRound: 3,
  optionsPerRolePerRound: 4,
  rolesIncluded: ['ceo', 'ciso', 'legal', 'it_manager'],
}

describe('POST /api/scenario-graph/draft', () => {
  it('levert zonder API-key een geldige concept-graph', async () => {
    delete process.env.ANTHROPIC_API_KEY
    const res = await POST(request(CONFIG))
    expect(res.status).toBe(200)
    const data = await res.json() as { ok: boolean; graph: ScenarioGraph; warnings: RuleFailure[]; seed: string }
    expect(data.ok).toBe(true)
    expect(data.warnings).toEqual([])
    expect(data.seed.length).toBeGreaterThan(0)
    expect(data.graph.publishStatus).toBe('draft')
    expect(data.graph.nodes.filter(n => n.type === 'round')).toHaveLength(4)
    // 4 rondes × (3 gedeelde injects + 1 rolbericht per rol).
    const perRonde = CONFIG.injectsPerRound + CONFIG.rolesIncluded.length
    expect(data.graph.nodes.filter(n => n.type === 'inject')).toHaveLength(4 * perRonde)
    expect(data.graph.nodes.filter(n => n.type === 'decision')).toHaveLength(4)
  })

  it('weigert een onvolledige config', async () => {
    const res = await POST(request({ ...CONFIG, clientName: '' }))
    expect(res.status).toBe(400)
    expect((await res.json() as { error: string }).error).toContain('clientName')
  })

  it('weigert een aanvraag zonder facilitator-sessie', async () => {
    gate.ok = false
    try {
      const res = await POST(request(CONFIG))
      expect(res.status).toBe(401)
    } finally {
      gate.ok = true
    }
  })
})
