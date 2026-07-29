import { OUTCOME_DIMENSIONS } from './constants'
import { computeRoundOutcome } from './outcome-round'
import type { ExerciseEvent, ScenarioSpec } from './types'

// Deel B §7.4 — Scenario health report. Na elke oefening automatisch aanvullen,
// cross-oefening:
//   - welke opties zijn nooit gekozen
//   - welke rondes discrimineren niet (iedereen scoort gelijk)
//   - waar loopt de timer structureel af (fractie no-decisions)
//   - welke knock-on regels zijn nooit getriggerd

export interface ScenarioHealthReport {
  scenarioId: string
  scenarioVersion: number
  sessionCount: number
  neverChosenOptions: Array<{ decisionPointId: string; optionId: string }>
  weakDiscriminatingRounds: Array<{ round: number; stdev: number }>
  timerRunsOutRate: Record<string, number>  // decisionPointId → fractie no-decisions
  unusedKnockOns: string[]  // niet berekend zonder knock-on model — placeholder
}

export interface SessionForHealth {
  scenarioId: string
  scenarioVersion: number
  events: ExerciseEvent[]
  scenario: ScenarioSpec
}

export function buildHealthReport(sessions: SessionForHealth[]): ScenarioHealthReport {
  if (sessions.length === 0) {
    return {
      scenarioId: '', scenarioVersion: 0, sessionCount: 0,
      neverChosenOptions: [], weakDiscriminatingRounds: [], timerRunsOutRate: {}, unusedKnockOns: [],
    }
  }
  const first = sessions[0]
  const scenario = first.scenario

  // Alle keuzes over alle sessies.
  const chosen = new Set<string>()
  const totalPerDp: Record<string, number> = {}
  const noDecisionPerDp: Record<string, number> = {}
  for (const s of sessions) {
    for (const ev of s.events) {
      if (ev.kind !== 'decision_submitted' && ev.kind !== 'decision_revised') continue
      chosen.add(`${ev.decisionPointId}::${ev.optionId}`)
      totalPerDp[ev.decisionPointId] = (totalPerDp[ev.decisionPointId] ?? 0) + 1
      if (ev.by === 'IMPLICIT' || ev.optionId.startsWith('__implicit_')) {
        noDecisionPerDp[ev.decisionPointId] = (noDecisionPerDp[ev.decisionPointId] ?? 0) + 1
      }
    }
  }

  const neverChosenOptions: ScenarioHealthReport['neverChosenOptions'] = []
  for (const dp of scenario.decisionPoints) {
    for (const opt of dp.options) {
      if (!chosen.has(`${dp.id}::${opt.id}`)) {
        neverChosenOptions.push({ decisionPointId: dp.id, optionId: opt.id })
      }
    }
  }

  // Discriminatie per ronde: standaarddeviatie van normalized outcome over sessies.
  const weakDiscriminatingRounds: ScenarioHealthReport['weakDiscriminatingRounds'] = []
  const DISCRIMINATION_THRESHOLD = 0.1
  for (const r of scenario.rounds) {
    const outcomes = sessions.map(s => computeRoundOutcome(s.scenario, s.events, r.number).normalized)
    const stdev = stdDev(outcomes)
    if (stdev < DISCRIMINATION_THRESHOLD) {
      weakDiscriminatingRounds.push({ round: r.number, stdev: round4(stdev) })
    }
  }

  const timerRunsOutRate: Record<string, number> = {}
  for (const [dp, total] of Object.entries(totalPerDp)) {
    timerRunsOutRate[dp] = round4((noDecisionPerDp[dp] ?? 0) / Math.max(total, 1))
  }

  return {
    scenarioId: first.scenarioId,
    scenarioVersion: first.scenarioVersion,
    sessionCount: sessions.length,
    neverChosenOptions,
    weakDiscriminatingRounds,
    timerRunsOutRate,
    unusedKnockOns: [],   // model bestaat nog niet in de app (gap 14)
  }
}

function stdDev(xs: number[]): number {
  const n = xs.length
  if (n < 2) return 0
  const mean = xs.reduce((s, x) => s + x, 0) / n
  const variance = xs.reduce((s, x) => s + (x - mean) ** 2, 0) / (n - 1)
  return Math.sqrt(variance)
}

function round4(x: number): number { return Math.round(x * 10000) / 10000 }

// Voorkom unused-import waarschuwing wanneer OUTCOME_DIMENSIONS niet direct wordt gebruikt.
export const _outcomeDimensionsRef: typeof OUTCOME_DIMENSIONS = OUTCOME_DIMENSIONS
