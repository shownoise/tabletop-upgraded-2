import { KAPPA_SHARE_MIN, SHARE_MIN_ROL_COVERAGE } from '../constants'
import type { RoleResolution } from '../role-resolution'
import type { DimensionScore, ExerciseEvent, ScenarioSpec } from '../types'

// Deel A §7.7 — DELEN = 5 · gem_i ( exp(−deelvertraging(i) / κ_deel) )
//   deelvertraging(i) = t_share(i) − t_receive(i)
//   κ_deel ≈ 10 min
//
// Nooit gedeelde injects krijgen exp(...) = 0. Alleen injects die *iemand anders
// dan de ontvanger* nodig had zijn kandidaat voor deling — dat is per definitie
// injects met `visibleTo` én in ronde waar een ander domein beslist. In deze
// implementatie: elke inject met `visibleTo` telt.
//
// Deel B §1.5 — DELEN = null bij rolCoverage < 0.4 (te weinig rolscheiding).
export function scoreDelen(scenario: ScenarioSpec, events: ExerciseEvent[], resolution: RoleResolution): DimensionScore {
  if (resolution.rolCoverage < SHARE_MIN_ROL_COVERAGE) {
    return { value: null, dataQuality: 'null', reason: `rolCoverage=${round4(resolution.rolCoverage)} < ${SHARE_MIN_ROL_COVERAGE} — geen rolscheiding` }
  }
  const relevant = scenario.injects.filter(i => (i.visibleTo?.length ?? 0) > 0)
  if (relevant.length === 0) {
    return { value: null, dataQuality: 'null', reason: 'no injects with visibleTo — geen deel-materiaal' }
  }

  const receipts = events.filter(e => e.kind === 'inject_received') as Extract<ExerciseEvent, { kind: 'inject_received' }>[]
  const shares = events.filter(e => e.kind === 'inject_shared') as Extract<ExerciseEvent, { kind: 'inject_shared' }>[]

  const scores: number[] = []
  for (const inj of relevant) {
    const recvT = receipts.filter(r => r.injectId === inj.id).map(r => r.t)
    const shareT = shares.filter(s => s.injectId === inj.id).map(s => s.t)
    if (recvT.length === 0) { scores.push(0); continue }
    const firstRecv = Math.min(...recvT)
    if (shareT.length === 0) { scores.push(0); continue }
    const firstShare = Math.min(...shareT)
    const delayMin = Math.max((firstShare - firstRecv) / 60000, 0)
    scores.push(Math.exp(-delayMin / KAPPA_SHARE_MIN))
  }
  const avg = scores.reduce((s, x) => s + x, 0) / scores.length
  return {
    value: clamp05(5 * avg),
    dataQuality: 'measured',
    detail: { avg: round4(avg), n: scores.length },
  }
}

function clamp05(x: number): number { return Math.min(5, Math.max(0, x)) }
function round4(x: number): number { return Math.round(x * 10000) / 10000 }
