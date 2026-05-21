import type { CapabilityId, AssessmentDimensionId } from "@/lib/engine/types"
import type { GoalId } from "@/lib/engine/types"
import type { ScenarioType } from "@/lib/types"

export type GoalStatus = 'active' | 'beta' | 'coming_soon'

export interface GoalPlugin {
  id: GoalId
  name: string
  description: string
  status: GoalStatus
  capabilities: CapabilityId[]
  defaultScenarioTypes: ScenarioType[]
  assessmentDimensions: AssessmentDimensionId[]
  facilitatorGuide: string
  participantBriefing: string
}
