import type { ExerciseConfig } from "@/lib/types"
import type { GoalId, GamificationConfig, GamificationMode } from "./types"
import type { GoalPlugin } from "@/lib/goals/types"
import type { CapabilityPlugin } from "@/lib/capabilities/types"
import { getGoal } from "@/lib/goals/registry"
import { getCapability } from "@/lib/capabilities/registry"

export interface ResolvedExerciseConfig {
  goalId: GoalId
  goal: GoalPlugin
  capabilities: CapabilityPlugin[]
  gamification: GamificationConfig
  baseConfig: ExerciseConfig
}

export function buildExerciseConfig(
  goalId: GoalId,
  baseConfig: ExerciseConfig,
): ResolvedExerciseConfig {
  const goal = getGoal(goalId)
  const capabilities = goal.capabilities.map(id => getCapability(id))

  return {
    goalId,
    goal,
    capabilities,
    gamification: resolveGamification(goalId),
    baseConfig,
  }
}

function resolveGamification(goalId: GoalId): GamificationConfig {
  const mode: GamificationMode = goalId === 'partner_mix' ? 'competitive' : 'subtle'
  return {
    mode,
    pointsTracked: true,
    pointsVisible: mode !== 'subtle',
    leaderboardEnabled: mode === 'competitive',
    speedBonusEnabled: mode === 'competitive',
    dilemmaCardsEnabled: true,
    twistsEnabled: true,
  }
}
