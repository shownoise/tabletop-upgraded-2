// Strip ASCII/Unicode control characters (except \n and \t) that could smuggle in prompt boundaries.
const CONTROL_RE = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g
// Common role-prefix injection markers used to hijack an in-progress conversation.
const INSTRUCTION_MARKERS = /(?:^|\n)\s*(?:system|assistant|user|human|developer|<\|.*?\|>)\s*:/gi

export function sanitizeForPrompt(input: string | undefined | null, maxLen = 2000): string {
  if (!input) return ""
  return input
    .replace(CONTROL_RE, " ")
    .replace(INSTRUCTION_MARKERS, "[filtered] ")
    .slice(0, maxLen)
}

export const PROMPT_FIELD_CAPS = {
  sector: 200,
  companySize: 100,
  crownJewels: 1000,
  criticalSystems: 1000,
  irTemplateText: 6000,
  scenarioType: 200,
  exerciseGoal: 200,
  teamStructure: 500,
} as const
