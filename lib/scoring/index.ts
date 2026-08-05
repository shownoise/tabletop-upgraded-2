// Public API van @exercise/scoring.
//
// Pure functies. Geen state, geen I/O. Alle inputs zijn immutable data-shapes;
// alle outputs zijn plain objects. Herberekening uit dezelfde inputs is
// idempotent (zie property-tests).
//
// Gebruik:
//   import { scoreExercise, SCORING_VERSION } from '@/lib/scoring'
//   const result = scoreExercise(input)
//   // result.scoringVersion === SCORING_VERSION

export { SCORING_VERSION, DEFAULT_DOMAIN_OWNERSHIP,
  OUTCOME_DIMENSIONS, DOMAINS,
  TEMPO_SIGMA, KAPPA_SHARE_MIN, REVISION_WINDOW_MIN, NO_DECISION_FALLBACK_VECTOR,
  type OutcomeDimension, type Domain,
} from './constants'

export type {
  Mode, RoleId, OptionSpec, DecisionPointSpec, InjectSpec, RoundSpec,
  ExternalPartySpec, ScenarioSpec, Roster, ExerciseEvent, ExerciseInput,
  AssumptionTag, PremiseTag, RoundOutcome,
  ScoringOutput,
} from './types'

export { resolveRoles, effectiveRoleFor, mandaatValue } from './role-resolution'
export type { RoleResolution } from './role-resolution'
export { computeRoundOutcome, cumulativeOutcome } from './outcome-round'
export { buildLeaderboard, divergenceOverGroups } from './points'
export type { LeaderboardEntry } from './points'
export { scoreExercise, scoreExerciseByGroup } from './score-exercise'
export { referenceExercise, REFERENCE_EXPECTED } from './reference-case'
export {
  isValidTransition, canForceLock, computeImplicitSubmissionsAtLock,
  scenarioWithFallbackImplicits, isSubmissionAllowed,
} from './event-mode'
export type { EventModePhase } from './event-mode'
export { buildReveal, buildEndReveal } from './reveal'
export type { RoundReveal, EndReveal } from './reveal'
export { buildAssessmentReport, buildEventReport } from './report'
export type { AssessmentReport, EventReport, EventGroupOnePager, EventHostSummary } from './report'
export { renderAssessmentMarkdown, renderEventOnePagerMarkdown, renderEventHostMarkdown } from './report-markdown'
export { buildRoleCards } from './role-cards'
export type { RoleCard } from './role-cards'
export { simulateExercise, dryRunAndScore } from './dry-run'
export type { DryRunInput, SimulatedStrategy } from './dry-run'
export { buildHealthReport } from './scenario-health'
export type { ScenarioHealthReport, SessionForHealth } from './scenario-health'
