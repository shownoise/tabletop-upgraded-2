import { TEMPO_SIGMA } from '../constants'
import type { DimensionScore, ExerciseEvent, ScenarioSpec } from '../types'

// Deel A §7.1 — BESLUIT = √(Tempo · Info).
//   Tempo = 5 · exp( −(ln ρ)² / (2·σ²) ),  ρ = Δ / Δ_ref
//   D = crucial injects die de beslisser vóór het besluit had / totaal crucial in ronde
//   E = crucial injects / alle injects die het team ontving of opvroeg
//   Info = 5 · 2·D·E / (D+E)   (harmonisch gemiddelde × 5)
export function scoreBesluit(scenario: ScenarioSpec, events: ExerciseEvent[]): DimensionScore {
  const perRound = scenario.rounds.map(r => scoreBesluitPerRound(scenario, events, r.number))
  const scored = perRound.filter(x => x.value !== null) as { value: number; detail: Record<string, number | null> }[]
  if (scored.length === 0) {
    return { value: null, dataQuality: 'null', reason: 'no rounds with sufficient timing + inject data' }
  }
  const avg = scored.reduce((s, x) => s + x.value, 0) / scored.length
  return { value: avg, dataQuality: 'measured', detail: { rounds: scored.length } }
}

export function scoreBesluitPerRound(
  scenario: ScenarioSpec,
  events: ExerciseEvent[],
  round: number,
): { value: number | null; detail: Record<string, number | null>; reason?: string } {
  const roundSpec = scenario.rounds.find(r => r.number === round)
  if (!roundSpec) return { value: null, detail: {}, reason: 'unknown round' }

  const start = phaseStart(events, round, 'overleg')
  const lock = phaseStart(events, round, 'lock') ?? phaseStart(events, round, 'review')
  const firstDecisionTime = firstDecisionForRound(events, round)

  const tKlik = lock ?? firstDecisionTime
  if (start == null || tKlik == null) {
    return { value: null, detail: {}, reason: 'missing phase timestamps' }
  }

  const deltaMin = Math.max((tKlik - start) / 60000, 0.0001)
  const rho = deltaMin / roundSpec.designTimeMinutes
  const lnRho = Math.log(rho)
  const tempo = 5 * Math.exp(-(lnRho * lnRho) / (2 * TEMPO_SIGMA * TEMPO_SIGMA))

  // Injects van deze ronde.
  const injectsThisRound = scenario.injects.filter(i => i.round === round)
  const crucialAll = injectsThisRound.filter(i => i.importance === 'crucial')

  // D: crucial injects die de beslisser bereikten vóór het klikken.
  const decisionsThisRound = scenario.decisionPoints.filter(d => d.round === round)
  const decisionOwners = new Set(decisionsThisRound.map(d => d.designedOwner))
  const receivedBefore = events.filter(ev =>
    ev.kind === 'inject_received' && ev.round === round && ev.t <= tKlik &&
    crucialAll.some(ci => ci.id === ev.injectId) &&
    decisionOwners.has(ev.recipient),
  ).length
  const crucialCount = crucialAll.length
  const D = crucialCount === 0 ? 1 : receivedBefore / crucialCount

  // E: crucial / (crucial + info) — team ontving of opvroeg.
  const totalRelevant = injectsThisRound.length
  const E = totalRelevant === 0 ? 1 : crucialAll.length / totalRelevant

  const info = D + E === 0 ? 0 : 5 * (2 * D * E) / (D + E)
  const besluit = Math.sqrt(Math.max(0, tempo) * Math.max(0, info))

  return {
    value: clamp05(besluit),
    detail: { rho: round4(rho), tempo: round4(tempo), D: round4(D), E: round4(E), info: round4(info) },
  }
}

function phaseStart(events: ExerciseEvent[], round: number, phase: 'briefing' | 'overleg' | 'keuze' | 'lock' | 'review'): number | null {
  const ev = events.find(e => e.kind === 'round_phase_changed' && e.round === round && e.toPhase === phase)
  return ev ? ev.t : null
}

function firstDecisionForRound(events: ExerciseEvent[], round: number): number | null {
  const submits = events
    .filter(e => e.kind === 'decision_submitted' && e.round === round)
    .map(e => e.t)
  return submits.length ? Math.min(...submits) : null
}

function clamp05(x: number): number { return Math.min(5, Math.max(0, x)) }
function round4(x: number): number { return Math.round(x * 10000) / 10000 }
