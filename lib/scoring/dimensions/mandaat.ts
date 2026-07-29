import { MANDATE_MIN_DISTINCT_OWNERS } from '../constants'
import { mandaatValue, type RoleResolution } from '../role-resolution'
import type { DimensionScore, ExerciseEvent, RoleId, ScenarioSpec } from '../types'

// Deel A §7.2 — MANDAAT = 5 · (0.40·gem(m) + 0.20·S + 0.20·E_score + 0.20·Routing)
//   m(d)     : 1.0/0.5/0.0 per beslispunt tegen effectiveOwner
//   S        : 1 − ½ · Σ | p_i − p_i* |
//   E_score  : min(1, 1/L) met L = mediaan(t_escalatie − t_trigger) / t_doel
//   Routing  : 0.7·Rt + 0.3·tijdigheid  (correct-doorgezette misroutes / totaal)
//
// Deel B §1.5 — MANDAAT wordt null bij distinctOwners < 3 met reden.
export function scoreMandaat(
  scenario: ScenarioSpec,
  events: ExerciseEvent[],
  resolution: RoleResolution,
): DimensionScore {
  if (resolution.distinctOwners < MANDATE_MIN_DISTINCT_OWNERS) {
    return { value: null, dataQuality: 'null', reason: `distinctOwners=${resolution.distinctOwners} < ${MANDATE_MIN_DISTINCT_OWNERS} — te weinig rolscheiding` }
  }

  const mValues: number[] = []
  const actualOwnerCounts: Record<RoleId, number> = {}
  const expectedDistribution: Record<RoleId, number> = {}
  let dpCount = 0

  const lastSubmissionByDp = new Map<string, { optionId: string; by: RoleId; cosignedBy?: RoleId[] }>()
  for (const ev of events) {
    if (ev.kind === 'decision_submitted') lastSubmissionByDp.set(ev.decisionPointId, ev)
    if (ev.kind === 'decision_revised') {
      const prev = lastSubmissionByDp.get(ev.decisionPointId)
      if (prev) lastSubmissionByDp.set(ev.decisionPointId, { ...prev, optionId: ev.optionId, by: ev.by })
    }
  }

  for (const dp of scenario.decisionPoints) {
    const sub = lastSubmissionByDp.get(dp.id)
    const optChosen = sub ? dp.options.find(o => o.id === sub.optionId) : undefined
    // Deel B §1.3: co-sign op een onbezette rol vervalt. Als álle required cosigners
    // vervallen, is de eis trivially voldaan (geen cosignedBy nodig). Anders moet
    // elke niet-vervallen cosigner in cosignedBy staan.
    const required = optChosen?.requiresCosign ?? []
    const activeCosigners = required.filter(r => !cosignVervalt(r, resolution))
    const cosignShort = activeCosigners.length > 0
      && !activeCosigners.every(r => (sub?.cosignedBy ?? []).includes(r))
    if (sub) {
      const m = cosignShort ? 0 : mandaatValue(sub.by, dp.domain, resolution)
      mValues.push(m)
      actualOwnerCounts[sub.by] = (actualOwnerCounts[sub.by] ?? 0) + 1
      dpCount++
    }
    // Verwachte verdeling opbouwen.
    const dist = dp.expectedOwnerDistribution ?? { [effectiveOwnerOrDesigned(dp, resolution)]: 1 }
    for (const [role, share] of Object.entries(dist)) {
      expectedDistribution[role] = (expectedDistribution[role] ?? 0) + share
    }
  }

  const gemM = mValues.length ? mValues.reduce((s, v) => s + v, 0) / mValues.length : null

  const S = spreadingScore(actualOwnerCounts, expectedDistribution, dpCount)

  const escalationEval = escalationScore(scenario, events)
  const routingEval = routingScore(scenario, events, resolution)

  const contribs: number[] = []
  const weights: number[] = []
  if (gemM !== null) { contribs.push(0.40 * gemM); weights.push(0.40) }
  if (S !== null)    { contribs.push(0.20 * S);    weights.push(0.20) }
  if (escalationEval.value !== null) { contribs.push(0.20 * escalationEval.value); weights.push(0.20) }
  if (routingEval.value !== null)    { contribs.push(0.20 * routingEval.value);    weights.push(0.20) }

  if (contribs.length === 0) {
    return { value: null, dataQuality: 'null', reason: 'no MANDATE inputs at all' }
  }
  const totalW = weights.reduce((s, w) => s + w, 0)
  const raw = contribs.reduce((s, c) => s + c, 0)
  const rescaled = totalW > 0 ? raw / totalW : 0
  return {
    value: clamp05(5 * rescaled),
    dataQuality: 'measured',
    detail: {
      gemM: gemM === null ? null : round4(gemM),
      S: S === null ? null : round4(S),
      Escore: escalationEval.value === null ? null : round4(escalationEval.value),
      Routing: routingEval.value === null ? null : round4(routingEval.value),
    },
  }
}

function effectiveOwnerOrDesigned(dp: import('../types').DecisionPointSpec, resolution: RoleResolution): RoleId {
  const eff = resolution.effectiveOwners[dp.domain]
  return eff === 'NPC' ? dp.designedOwner : eff
}

function cosignVervalt(role: RoleId, resolution: RoleResolution): boolean {
  // Deel B §1.3 — co-sign op onbezette rol vervalt.
  return !Object.values(resolution.effectiveOwners).includes(role)
}

function spreadingScore(
  actual: Record<RoleId, number>,
  expected: Record<RoleId, number>,
  n: number,
): number | null {
  if (n === 0) return null
  const roles = new Set<RoleId>([...Object.keys(actual), ...Object.keys(expected)])
  const totalExpected = Object.values(expected).reduce((s, v) => s + v, 0) || 1
  let diff = 0
  for (const r of roles) {
    const pi = (actual[r] ?? 0) / n
    const piStar = (expected[r] ?? 0) / totalExpected
    diff += Math.abs(pi - piStar)
  }
  return Math.max(0, 1 - 0.5 * diff)
}

function escalationScore(scenario: ScenarioSpec, events: ExerciseEvent[]): { value: number | null } {
  const escalationEvents = events.filter(e => e.kind === 'escalation_fired') as Extract<ExerciseEvent, { kind: 'escalation_fired' }>[]
  const withTriggers = scenario.decisionPoints.filter(d => d.escalationTrigger)
  if (withTriggers.length === 0 || escalationEvents.length === 0) {
    return { value: null }
  }
  const ratios: number[] = []
  for (const dp of withTriggers) {
    if (!dp.escalationTrigger) continue
    const trig = triggerTime(events, dp.escalationTrigger.atInject)
    const esc = escalationEvents.find(e => e.decisionPointId === dp.id)
    if (trig == null || !esc) continue
    const deltaHours = Math.max((esc.t - trig) / 3600000, 0)
    ratios.push(deltaHours / Math.max(dp.escalationTrigger.targetHours, 0.01))
  }
  if (ratios.length === 0) return { value: null }
  ratios.sort((a, b) => a - b)
  const L = median(ratios)
  return { value: Math.min(1, 1 / Math.max(L, 0.0001)) }
}

function triggerTime(events: ExerciseEvent[], injectId: string): number | null {
  const receipts = events.filter(e => e.kind === 'inject_received' && e.injectId === injectId).map(e => e.t)
  return receipts.length ? Math.min(...receipts) : null
}

function median(xs: number[]): number {
  const n = xs.length
  if (n === 0) return NaN
  const mid = Math.floor(n / 2)
  return n % 2 ? xs[mid] : (xs[mid - 1] + xs[mid]) / 2
}

function routingScore(scenario: ScenarioSpec, events: ExerciseEvent[], resolution: RoleResolution): { value: number | null } {
  const misroutes = scenario.injects.filter(i => i.correctRoute)
  if (misroutes.length === 0) return { value: null }
  let correct = 0
  let totalTimeliness = 0
  for (const inj of misroutes) {
    const shares = events.filter(e => e.kind === 'inject_shared' && e.injectId === inj.id) as Extract<ExerciseEvent, { kind: 'inject_shared' }>[]
    const received = events.filter(e => e.kind === 'inject_received' && e.injectId === inj.id) as Extract<ExerciseEvent, { kind: 'inject_received' }>[]
    if (shares.length === 0) { totalTimeliness += 0; continue }
    const targetRole = inj.correctRoute!
    const eff = resolution.effectiveOwners
    const targetIsBezet = Object.values(eff).includes(targetRole)
    const targetOrProxy = targetIsBezet ? targetRole : Object.values(eff).find(r => r !== 'NPC')
    // Interpretatie: correct doorgezet als een deel-event bestaat en het target bezet is,
    // of naar de originele rol was (fallback niet mogelijk zonder specifieke deel-target — houd conservatief).
    const anyShare = shares.length > 0
    if (anyShare && targetOrProxy) correct++
    // Tijdigheid: exp(−(t_share − t_received)/κ) — κ=5 min als default.
    const receiveT = received.length ? Math.min(...received.map(r => r.t)) : null
    const shareT = shares.length ? Math.min(...shares.map(s => s.t)) : null
    if (receiveT != null && shareT != null) {
      const delayMin = Math.max((shareT - receiveT) / 60000, 0)
      totalTimeliness += Math.exp(-delayMin / 5)
    }
  }
  const Rt = correct / misroutes.length
  const timeliness = totalTimeliness / misroutes.length
  return { value: 0.7 * Rt + 0.3 * timeliness }
}

function clamp05(x: number): number { return Math.min(5, Math.max(0, x)) }
function round4(x: number): number { return Math.round(x * 10000) / 10000 }
