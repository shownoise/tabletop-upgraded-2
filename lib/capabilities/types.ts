import type { InjectChannel } from "@/lib/types"
import type { CapabilityId, DocTemplateId } from "@/lib/engine/types"

export interface CapabilityPlugin {
  id: CapabilityId
  name: string
  description: string
  injectChannelPreferences: InjectChannel[]
  participantDocTemplates: DocTemplateId[]
  facilitatorHints: string[]
}
