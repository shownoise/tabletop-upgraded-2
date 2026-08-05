import { SCORING_VERSION } from './constants'
import { computeRoundOutcome } from './outcome-round'
import { resolveRoles } from './role-resolution'
import type { ExerciseInput, ScoringOutput } from './types'

// Deel B §5.1 — per-groep scoring voor EVENT-mode leaderboard.
// Filtert de events per group.id (via groupId of participantIds-fallback) en
// draait scoreExercise voor elke groep. Zonder groups → één 'all'-key.
export function scoreExerciseByGroup(input: ExerciseInput): Record<string, ScoringOutput> {
  const groups = input.roster.groups ?? []
  if (groups.length === 0) {
    return { all: scoreExercise(input) }
  }
  const out: Record<string, ScoringOutput> = {}
  for (const g of groups) {
    const groupEvents = input.events.filter(ev => {
      if (ev.kind !== 'decision_submitted' && ev.kind !== 'decision_revised') return true
      if (ev.groupId) return ev.groupId === g.id
      return g.participantIds.includes(ev.by)
    })
    out[g.id] = scoreExercise({ ...input, events: groupEvents })
  }
  return out
}

// Hoofd-entry: input → volledige ScoringOutput. Puur, geen I/O.
export function scoreExercise(input: ExerciseInput): ScoringOutput {
  const { scenario, roster, events, mode } = input
  const resolution = resolveRoles(roster, scenario, firstStart(events))

  const outcomes = scenario.rounds.map(r => computeRoundOutcome(scenario, events, r.number))
  const totalPoints = outcomes.reduce((s, o) => s + o.points, 0)

  // Beslispunten die required=false zijn en moeten vervallen bij te weinig rolscheiding.
  const droppedOptionalDecisions = dropOptionalDecisions(scenario, resolution)

  return {
    scoringVersion: SCORING_VERSION,
    mode,
    roleResolution: {
      effectiveOwners: resolution.effectiveOwners,
      rolCoverage: resolution.rolCoverage,
      distinctOwners: resolution.distinctOwners,
      resolvedAt: resolution.resolvedAt,
    },
    outcomes,
    totalPoints,
    droppedOptionalDecisions,
  }
}

function firstStart(events: ExerciseInput['events']): number {
  const s = events.find(e => e.kind === 'session_start')
  return s?.t ?? 0
}

function dropOptionalDecisions(
  scenario: ExerciseInput['scenario'],
  resolution: ReturnType<typeof resolveRoles>,
): string[] {
  const threshold = scenario.optionalDecisionThreshold ?? 3
  if (resolution.distinctOwners >= threshold) return []
  return scenario.decisionPoints.filter(dp => dp.required === false).map(dp => dp.id)
}
