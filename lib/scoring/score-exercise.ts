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

  const outcomes = scenario.rounds.map(r => computeRoundOutcome(scenario, events, r.number, mode === 'EVENT'))
  const totalPoints = outcomes.reduce((total, outcome) => total + (outcome.hasSubmissions ? outcome.points : 0), 0)

  // Een beantwoorde optionele keuze telt al mee in de score en mag in het rapport
  // daarom niet als overgeslagen worden beschreven.
  const droppedOptionalDecisions = dropOptionalDecisions(scenario, resolution, events)

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
  events: ExerciseInput['events'],
): string[] {
  const threshold = scenario.optionalDecisionThreshold ?? 3
  if (resolution.distinctOwners >= threshold) return []
  return scenario.decisionPoints.filter(dp =>
    dp.required === false && !events.some(ev =>
      (ev.kind === 'decision_submitted' || ev.kind === 'decision_revised') &&
      ev.round === dp.round &&
      ev.decisionPointId === dp.id &&
      ev.by !== 'IMPLICIT' &&
      dp.options.some(option => option.id === ev.optionId && !option.implicit),
    ),
  ).map(dp => dp.id)
}
