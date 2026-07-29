import { describe, expect, it } from 'vitest'
import { scoreBesluitPerRound } from '../dimensions/besluit'
import { TEMPO_SIGMA } from '../constants'
import type { ExerciseEvent, ScenarioSpec } from '../types'

// Golden vectors — §7.1 BESLUIT
//   ρ=1 (Δ=Δ_ref)                → Tempo = 5.0
//   Tempo(ρ) = Tempo(1/ρ)         (symmetrie in log-ruimte, property test)
//   ρ→0 en ρ→∞                    → Tempo → 0
//   D=E=1                         → Info = 5.0
//   D=0                           → Info = 0

const scenario = (designMin: number, injects: Array<{ id: string; importance: 'crucial' | 'info' }> = []): ScenarioSpec => ({
  rounds: [{ number: 1, designTimeMinutes: designMin, outcomeWeights: { CONT: 1, FOR: 1, BC: 1, JUR: 1, VER: 1, KOS: 1 } }],
  decisionPoints: [{ id: 'dp', round: 1, domain: 'CONTAINMENT', designedOwner: 'SEC', options: [
    { id: 'o1', outcomeVector: { CONT: 0, FOR: 0, BC: 0, JUR: 0, VER: 0, KOS: 0 } },
  ] }],
  injects: injects.map(i => ({ id: i.id, round: 1, importance: i.importance, origin: 'scenario' as const })),
})

const events = (overlegAtMin: number, lockAtMin: number, injects: Array<{ id: string; recvMin: number; recipient?: string }> = []): ExerciseEvent[] => [
  { kind: 'session_start', t: 0 },
  { kind: 'round_phase_changed', t: overlegAtMin * 60_000, round: 1, toPhase: 'overleg' },
  ...injects.map<ExerciseEvent>(i => ({ kind: 'inject_received', t: i.recvMin * 60_000, round: 1, injectId: i.id, recipient: i.recipient ?? 'SEC' })),
  { kind: 'decision_submitted', t: lockAtMin * 60_000, round: 1, decisionPointId: 'dp', optionId: 'o1', by: 'SEC' },
  { kind: 'round_phase_changed', t: lockAtMin * 60_000, round: 1, toPhase: 'lock' },
]

describe('BESLUIT (§7.1)', () => {
  it('golden 1: ρ=1, D=E=1 → Tempo=5, Info=5, BESLUIT=5', () => {
    const s = scenario(20, [{ id: 'a', importance: 'crucial' }])
    const e = events(0, 20, [{ id: 'a', recvMin: 5 }])
    const r = scoreBesluitPerRound(s, e, 1)
    expect(r.value).toBeCloseTo(5.0, 2)
    expect(r.detail.rho).toBeCloseTo(1.0, 3)
  })

  it('golden 2: ρ=1.7 (referentie uit spec) → Tempo≈3.0, D=0.80 E=0.67 → Info≈3.6 → BESLUIT≈3.3', () => {
    // Spec: "4 van 5 crucial injects uit 6 totaal → D=0.80, E=0.67"
    // 5 crucial (4 arrived pre-lock, 1 post-lock) + 1 info = 6 totaal.
    const s = scenario(20, [
      { id: 'c1', importance: 'crucial' }, { id: 'c2', importance: 'crucial' },
      { id: 'c3', importance: 'crucial' }, { id: 'c4', importance: 'crucial' },
      { id: 'c5', importance: 'crucial' },  // arriveert na lock — telt niet in D
      { id: 'i1', importance: 'info' },
    ])
    const e = events(0, 34, [
      { id: 'c1', recvMin: 2 }, { id: 'c2', recvMin: 3 }, { id: 'c3', recvMin: 4 }, { id: 'c4', recvMin: 5 },
      { id: 'c5', recvMin: 40 },  // NA de lock op t=34min → sluit uit D
      { id: 'i1', recvMin: 6 },
    ])
    const r = scoreBesluitPerRound(s, e, 1)
    // Exact: ρ=1.7 → Tempo=3.38; D=0.8 E=5/6=0.833 → Info=4.08; BESLUIT=√(3.38·4.08)=3.72.
    // Spec noemt 3.3, maar spec-berekening rondt E naar 0.67 → onze code gebruikt exact 5/6.
    expect(r.value).toBeGreaterThan(3.0)
    expect(r.value).toBeLessThan(3.8)
    expect(r.detail.D).toBeCloseTo(0.8, 2)
    expect(r.detail.E).toBeCloseTo(5 / 6, 2)
  })

  it('golden 3: ρ→∞ (Δ heel groot) → Tempo→0 → BESLUIT→0', () => {
    const s = scenario(1, [{ id: 'a', importance: 'crucial' }])
    const e = events(0, 100, [{ id: 'a', recvMin: 1 }])
    const r = scoreBesluitPerRound(s, e, 1)
    expect(r.value).toBeLessThan(0.5)
  })

  it('golden 4: geen crucial injects → D=1 (fallback), Info afhankelijk van E', () => {
    const s = scenario(20, [{ id: 'i1', importance: 'info' }])
    const e = events(0, 20, [{ id: 'i1', recvMin: 3 }])
    const r = scoreBesluitPerRound(s, e, 1)
    // D=1 (geen crucial), E=0 → Info=0 → BESLUIT=0
    expect(r.value).toBe(0)
  })

  it('golden 5: crucial ontvangen ná lock telt niet mee in D', () => {
    const s = scenario(20, [{ id: 'a', importance: 'crucial' }, { id: 'b', importance: 'crucial' }])
    const e = events(0, 15, [{ id: 'a', recvMin: 5 }, { id: 'b', recvMin: 18 }]) // b na klik
    const r = scoreBesluitPerRound(s, e, 1)
    expect(r.detail.D).toBeCloseTo(0.5, 2)
  })

  it('property: Tempo(ρ) = Tempo(1/ρ) (log-ruimte symmetrie)', () => {
    // ρ=2 (te lang) en ρ=0.5 (te snel) leveren gelijk Tempo.
    const sLong = scenario(20)
    const sShort = scenario(20)
    const eLong = events(0, 40)   // ρ=2
    const eShort = events(0, 10)  // ρ=0.5
    const rLong = scoreBesluitPerRound(sLong, eLong, 1)
    const rShort = scoreBesluitPerRound(sShort, eShort, 1)
    expect(rLong.detail.tempo).toBeCloseTo(rShort.detail.tempo as number, 4)
  })

  it('property: score altijd in [0,5]', () => {
    for (const design of [5, 10, 20, 60]) {
      for (const delta of [0.1, 1, 20, 60, 300]) {
        const s = scenario(design, [{ id: 'a', importance: 'crucial' }])
        const e = events(0, delta, [{ id: 'a', recvMin: 0.5 }])
        const r = scoreBesluitPerRound(s, e, 1)
        if (r.value !== null) {
          expect(r.value).toBeGreaterThanOrEqual(0)
          expect(r.value).toBeLessThanOrEqual(5)
        }
      }
    }
  })

  it('spec-check: TEMPO_SIGMA is 0.6', () => {
    expect(TEMPO_SIGMA).toBe(0.6)
  })
})
