import { aggregateProcess } from './aggregate'
import { SCORING_VERSION } from './constants'
import { scoreCalibration } from './calibration'
import { scoreAanname } from './dimensions/aanname'
import { scoreAdapt } from './dimensions/adapt'
import { scoreBesluit } from './dimensions/besluit'
import { scoreDelen } from './dimensions/delen'
import { scoreExtern } from './dimensions/extern'
import { scoreMandaat } from './dimensions/mandaat'
import { scoreVolhoud } from './dimensions/volhoud'
import { maskUnmeasurable } from './mode-matrix'
import { computeRoundOutcome } from './outcome-round'
import { resolveRoles } from './role-resolution'
import type { DimensionScore, ExerciseInput, ProcessDimension, ScoringOutput } from './types'

// Deel A §7.9 — als een dimensie geen data heeft maar de facilitator een slider
// heeft ingevuld, gebruiken we die als *observation* (niet als meting). Twee
// gevallen combineren we niet: als er data is, negeren we de slider.
function applyFacilitatorSlider(
  score: DimensionScore,
  events: ExerciseInput['events'],
  dim: ProcessDimension,
): DimensionScore {
  if (score.value !== null) return score
  const sliders = events.filter(e => e.kind === 'facilitator_slider' && e.dimension === dim) as Extract<ExerciseInput['events'][number], { kind: 'facilitator_slider' }>[]
  if (sliders.length === 0) return score
  const avg = sliders.reduce((s, x) => s + x.value, 0) / sliders.length
  return {
    value: avg,
    dataQuality: 'observation',
    reason: `facilitator-slider (dimensie zonder meet-data)`,
    detail: score.detail,
  }
}

// Deel A §7.9 & Deel B §3 — combineer per-dimensie:
//   1. Bereken score uit event-data.
//   2. Mask via MODE_MATRIX (unmeasurable dimensies → null).
//   3. Als resultaat null en er is een facilitator-slider → observation.
function finalizeDimension(
  score: DimensionScore,
  events: ExerciseInput['events'],
  dim: ProcessDimension,
  mode: ExerciseInput['mode'],
): DimensionScore {
  const masked = maskUnmeasurable(mode, dim, score)
  return applyFacilitatorSlider(masked, events, dim)
}

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

  const raw: Record<ProcessDimension, DimensionScore> = {
    BESLUIT: scoreBesluit(scenario, events),
    MANDAAT: scoreMandaat(scenario, events, resolution),
    AANNAME: scoreAanname(events),
    ADAPT: scoreAdapt(scenario, events),
    EXTERN: scoreExtern(scenario, events),
    VOLHOUD: scoreVolhoud(events),
    DELEN: scoreDelen(scenario, events, resolution),
  }

  const dimensions: Record<ProcessDimension, DimensionScore> = {
    BESLUIT: finalizeDimension(raw.BESLUIT, events, 'BESLUIT', mode),
    MANDAAT: finalizeDimension(raw.MANDAAT, events, 'MANDAAT', mode),
    AANNAME: finalizeDimension(raw.AANNAME, events, 'AANNAME', mode),
    ADAPT: finalizeDimension(raw.ADAPT, events, 'ADAPT', mode),
    EXTERN: finalizeDimension(raw.EXTERN, events, 'EXTERN', mode),
    VOLHOUD: finalizeDimension(raw.VOLHOUD, events, 'VOLHOUD', mode),
    DELEN: finalizeDimension(raw.DELEN, events, 'DELEN', mode),
  }

  // Alleen dimensies met dataQuality='measured' meelopen in de aggregate. Observation
  // (facilitator-slider) verschijnt in het rapport, maar niet in het PROCES-getal.
  const measuredOnly = {} as Record<ProcessDimension, DimensionScore>
  for (const k of Object.keys(dimensions) as ProcessDimension[]) {
    measuredOnly[k] = dimensions[k].dataQuality === 'measured' ? dimensions[k] : { ...dimensions[k], value: null }
  }
  const processAggregate = aggregateProcess(measuredOnly, scenario)

  const calibration = scoreCalibration(events, outcomes)

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
    dimensions,
    processAggregate,
    calibration,
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
