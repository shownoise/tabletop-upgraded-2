import { computeImplicitSubmissionsAtLock } from './event-mode'
import { scoreExercise } from './score-exercise'
import type { ExerciseEvent, ExerciseInput, ScenarioSpec, ScoringOutput } from './types'

// Deel B §7.7 — dry-run: facilitator speelt alleen met gesimuleerde groepen
// om te zien of de rondes lopen en de timers kloppen. Puur — genereert
// deterministic event-log op basis van een strategie.

export type SimulatedStrategy =
  | 'best_option'      // altijd hoogst-scorende optie kiezen
  | 'worst_option'     // altijd laagst-scorende
  | 'random_seed'      // pseudo-random, deterministic op seed
  | 'no_decision'      // altijd time-out (LOCK zonder submit)

export interface DryRunInput {
  scenario: ScenarioSpec
  simulatedRoles: string[]  // spec-RoleIds die de dry-run bevolken
  strategy: SimulatedStrategy
  seed?: number
  roundBudgetMinutes?: number  // seconds tussen fase-transities in de simulatie
}

export function simulateExercise(input: DryRunInput): ExerciseInput {
  const { scenario, simulatedRoles, strategy, seed = 42, roundBudgetMinutes = 20 } = input
  let t = 0
  const step = roundBudgetMinutes * 60_000 / 5  // 5 stappen per ronde
  const events: ExerciseEvent[] = [{ kind: 'session_start', t }]
  const rng = mulberry32(seed)

  for (const round of scenario.rounds) {
    events.push({ kind: 'round_phase_changed', t: (t += step), round: round.number, toPhase: 'briefing' })
    events.push({ kind: 'round_phase_changed', t: (t += step), round: round.number, toPhase: 'overleg' })

    events.push({ kind: 'round_phase_changed', t: (t += step), round: round.number, toPhase: 'keuze' })

    // Voor elk beslispunt: pas strategie toe.
    if (strategy !== 'no_decision') {
      for (const dp of scenario.decisionPoints.filter(d => d.round === round.number)) {
        const options = dp.options.filter(o => !o.implicit)
        if (options.length === 0) continue
        let chosen = options[0]
        if (strategy === 'best_option') chosen = pickBest(options)
        else if (strategy === 'worst_option') chosen = pickWorst(options)
        else if (strategy === 'random_seed') chosen = options[Math.floor(rng() * options.length)]
        events.push({
          kind: 'decision_submitted', t: (t += step), round: round.number,
          decisionPointId: dp.id, optionId: chosen.id, by: dp.designedOwner,
        })
      }
    }

    events.push({ kind: 'round_phase_changed', t: (t += step), round: round.number, toPhase: 'lock' })
    // Voeg implicits toe (voor no_decision-strategie of gemiste dps).
    const implicits = computeImplicitSubmissionsAtLock({
      scenario, events, lockTime: t, round: round.number, groups: null,
    })
    events.push(...implicits)
    events.push({ kind: 'round_phase_changed', t: (t += step), round: round.number, toPhase: 'review' })
  }

  return {
    scenario,
    roster: { presentRoles: simulatedRoles },
    events,
    mode: 'ASSESSMENT',
  }
}

// Voer dry-run uit + score direct → snelle sanity-check voor de facilitator.
export function dryRunAndScore(input: DryRunInput): { input: ExerciseInput; output: ScoringOutput } {
  const exerciseInput = simulateExercise(input)
  return { input: exerciseInput, output: scoreExercise(exerciseInput) }
}

// ── Helpers ────────────────────────────────────────────────────────────

function pickBest(options: ScenarioSpec['decisionPoints'][number]['options']): ScenarioSpec['decisionPoints'][number]['options'][number] {
  return [...options].sort((a, b) => vectorSum(b.outcomeVector) - vectorSum(a.outcomeVector))[0]
}

function pickWorst(options: ScenarioSpec['decisionPoints'][number]['options']): ScenarioSpec['decisionPoints'][number]['options'][number] {
  return [...options].sort((a, b) => vectorSum(a.outcomeVector) - vectorSum(b.outcomeVector))[0]
}

function vectorSum(v: Record<string, number>): number {
  return Object.values(v).reduce((s, x) => s + x, 0)
}

// Deterministic RNG (mulberry32). Puur — zelfde seed → zelfde stream.
function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6D2B79F5) | 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
