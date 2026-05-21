/**
 * Template system — defines the structure for reusable scenario templates.
 * Templates can be fully static, semi-dynamic (AI fills content), or hybrid.
 */

import type { ScenarioType, DecisionFramework } from "./types"
import type { TemplateModuleSlot } from "./types/scenario-instance"

export type { TemplateModuleSlot }

export type TemplateTag =
  | "ransomware" | "insider-threat" | "supply-chain" | "bec" | "ddos"
  | "cloud-breach" | "data-exfil" | "ot-ics" | "tabletop" | "technical"
  | "executive" | "beginner" | "advanced" | "nis2" | "gdpr"

export type DifficultyLevel = "beginner" | "intermediate" | "advanced" | "expert"
export type ContentMode = "static" | "ai-generated" | "hybrid"

export interface InjectTemplate {
  id: string
  type: import("./types").InjectType
  channel: import("./types").InjectChannel
  urgency: import("./types").Urgency
  // Static content (used as-is or as AI seed)
  title?: string
  content?: string
  senderName?: string
  senderHandle?: string
  // If htmlContent is set, inject renders as rich HTML (phishing email, log dump, etc.)
  htmlContent?: string
  htmlType?: "phishing_email" | "siem_log" | "ransom_note" | "news_article" | "internal_memo"
  // For hybrid mode: AI fills these fields using the prompt as context
  aiPromptHint?: string
  // Facilitator notes per inject
  showNotes?: string
  context?: string
  expectedActions?: string[]
  // Team targeting and compliance metadata
  targetTeam?: 'all' | 'crisis_management' | 'technical_it'
  nis2Relevant?: boolean
}

export interface DecisionPoint {
  id: string
  title: string
  description: string
  // Only the crisis team lead (first participant or designated role) can decide
  teamLeadOnly: boolean
  options: DecisionOption[]
  // Which round each option leads to (for branching)
  // If not set, always goes to next round in sequence
}

export interface DecisionOption {
  id: string
  label: string
  description: string
  consequence: string
  // Optional: override which round comes next
  nextRoundIndex?: number
  // Metadata for scoring/debrief
  isRecommended?: boolean
}

export interface RoundTemplate {
  id: string
  title: string
  situationUpdateTemplate: string // may contain {placeholders}
  timerMinutes: number
  injects: InjectTemplate[]
  // Optional decision point at end of round
  decisionPoint?: DecisionPoint
  facilitatorNotes: {
    discussionGoal: string
    keyQuestions: string[]
    hints: string[]
    expectedDecisions: string[]
    redFlags: string[]
    // Shown after participant feedback collected
    debriefPoints: string[]
  }
  // If true, all participants must submit feedback before progression
  requireAllFeedback?: boolean
  // Role-based actions for this round
  roleActions?: import("./types").RoleAction[]
}

export interface ScenarioTemplate {
  id: string
  name: string
  operationName: string // e.g. "OPERATION BLACK TIDE"
  description: string
  tags: TemplateTag[]
  difficulty: DifficultyLevel
  contentMode: ContentMode
  version: string
  createdAt: number
  updatedAt: number
  author?: string
  // Target configuration
  targetSector?: string
  targetCompanySize?: string
  estimatedDurationMinutes: number
  rounds: RoundTemplate[]
  // Business context shown to participants
  organizationContext: {
    name: string // placeholder like "{company}" if AI fills it
    sector: string
    size: string
    criticalSystems: string
    crownJewels: string
  }
  // Outcome definitions for debrief
  outcomes: {
    good: string[]
    bad: string[]
    debriefQuestions: string[]
  }
  // For hybrid/AI mode: system prompt additions
  aiSystemPromptAddition?: string
  // ─── New scenario-architecture fields (upgrade) ───
  // When set, runtime uses the three-layer generator instead of rounds[]
  scenario_type?: ScenarioType
  decision_framework?: DecisionFramework
  modules?: TemplateModuleSlot[]
}

// ─── Template library store ───

export interface TemplateLibrary {
  templates: ScenarioTemplate[]
  lastUpdated: number
}

export function emptyLibrary(): TemplateLibrary {
  return { templates: [], lastUpdated: Date.now() }
}
