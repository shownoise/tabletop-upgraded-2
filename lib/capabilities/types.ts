import type { InjectChannel } from "@/lib/types"
import type { CapabilityId, AssessmentDimensionId, RoundActionType, DocTemplateId } from "@/lib/engine/types"

export interface CapabilityPlugin {
  id: CapabilityId
  name: string
  description: string
  injectChannelPreferences: InjectChannel[]
  roundActionTypes: RoundActionType[]
  participantDocTemplates: DocTemplateId[]
  facilitatorHints: string[]
  assessmentDimensions: AssessmentDimensionId[]
}
