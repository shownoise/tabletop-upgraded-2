import type { AssessmentEvent, AssessmentDimensionId, SessionAssessment } from "./types"
import type { GoalId } from "./types"
import { getGoal } from "@/lib/goals/registry"

export function logAssessmentEvent(
  events: AssessmentEvent[],
  event: Omit<AssessmentEvent, 'timestamp'>,
): AssessmentEvent[] {
  return [...events, { ...event, timestamp: Date.now() }]
}

export function computeDimensionScores(
  events: AssessmentEvent[],
  relevantDimensions: AssessmentDimensionId[],
): Partial<Record<AssessmentDimensionId, number>> {
  const scores: Partial<Record<AssessmentDimensionId, number>> = {}
  for (const dim of relevantDimensions) {
    const dimEvents = events.filter(e => e.dimensionId === dim)
    if (dimEvents.length === 0) continue
    scores[dim] = Math.round(
      dimEvents.reduce((sum, e) => sum + e.value, 0) / dimEvents.length
    )
  }
  return scores
}

export function computeOverallScore(
  dimensionScores: Partial<Record<AssessmentDimensionId, number>>,
): number {
  const values = Object.values(dimensionScores).filter((v): v is number => v !== undefined)
  if (values.length === 0) return 0
  return Math.round(values.reduce((sum, v) => sum + v, 0) / values.length)
}

export function buildSessionAssessment(
  sessionId: string,
  goalId: GoalId,
  events: AssessmentEvent[],
): SessionAssessment {
  const goal = getGoal(goalId)
  const dimensionScores = computeDimensionScores(events, goal.assessmentDimensions)
  const overallScore = computeOverallScore(dimensionScores)
  return {
    sessionId,
    goalId,
    events,
    dimensionScores,
    overallScore,
    advice: [],
  }
}
