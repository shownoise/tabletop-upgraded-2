import type { ExerciseConfig } from "@/lib/types"
import type { GoalId } from "./types"
import type { GoalPlugin } from "@/lib/goals/types"
import type { CapabilityPlugin } from "@/lib/capabilities/types"
import { getGoal } from "@/lib/goals/registry"
import { getCapability } from "@/lib/capabilities/registry"

export interface ResolvedExerciseConfig {
  goalId: GoalId
  goal: GoalPlugin
  capabilities: CapabilityPlugin[]
  baseConfig: ExerciseConfig
}

export function buildExerciseConfig(
  goalId: GoalId,
  baseConfig: ExerciseConfig,
): ResolvedExerciseConfig {
  const goal = getGoal(goalId)
  const capabilities = goal.capabilities.map(id => getCapability(id))
  return { goalId, goal, capabilities, baseConfig }
}
