import type { Scenario, Round, Inject, FacilitatorNotes, InjectChannel, LearningObjective, RoleAction, Role, ModuleId, SpecialType } from "../types"
import type { ScenarioInstance, ModuleInstance, RichInject } from "../types/scenario-instance"

// Maps new InjectChannel values to the legacy InjectChannel values the render
// layer already handles. When both sets overlap (email, sms, phone) they pass through.
const CHANNEL_MAP: Partial<Record<string, InjectChannel>> = {
  teams: 'slack',
  siem: 'siem_alert',
  edr: 'system_alert',
  news: 'news_ticker',
  memo: 'raw',
  ransom_note: 'raw',
}

function mapChannel(ch: string): InjectChannel {
  return (CHANNEL_MAP[ch] as InjectChannel | undefined) ?? (ch as InjectChannel)
}

function richInjectToInject(ri: RichInject, order: number): Inject {
  return {
    id: ri.id || `inj-bridge-${order}`,
    type: resolveInjectType(ri.channel),
    channel: mapChannel(ri.channel),
    title: buildTitle(ri),
    content: ri.content,
    urgency: 'high',
    senderName: ri.sender,
    timestamp: ri.timestamp,
    source: ri.sender,
  }
}

function resolveInjectType(ch: string): Inject['type'] {
  if (ch === 'siem' || ch === 'siem_alert' || ch === 'edr') return 'technical'
  if (ch === 'news' || ch === 'news_ticker') return 'media'
  if (ch === 'memo') return 'internal'
  if (ch === 'ransom_note') return 'intel'
  if (ch === 'email') return 'executive'
  return 'internal'
}

function buildTitle(ri: RichInject): string {
  const lines = ri.content.split('\n').filter(Boolean)
  const first = lines[0] ?? ri.sender
  return first.length > 80 ? first.slice(0, 77) + '…' : first
}

function moduleToRound(mod: ModuleInstance, index: number): Round {
  const injects: Inject[] = mod.injects.map((ri, i) => richInjectToInject(ri, i))

  const questions = mod.decisions.flatMap(d => d.questions)
  const facilitatorNotes: FacilitatorNotes = {
    discussionGoal: mod.facilitator_notes[0] ?? '',
    keyQuestions: questions,
    hints: mod.facilitator_notes.slice(1),
    expectedDecisions: mod.decisions.map(d => d.questions[0] ?? '').filter(Boolean),
    redFlags: mod.facilitator_notes.filter(n => n.toLowerCase().startsWith('rode vlag')),
  }

  const roleActions: RoleAction[] = mod.decisions.flatMap((d, di) =>
    d.options?.map((opt, oi) => ({
      id: `${mod.id}-d${di}-o${oi}`,
      label: opt.label,
      description: opt.description ?? '',
      allowedRoles: (opt.allowedRoles ?? []) as Role[],
      irPlanAligned: opt.recommended ?? false,
      isRecommended: opt.recommended ?? false,
      consequence: opt.consequence,
    })) ?? []
  )

  const learningObjectives: LearningObjective[] = (mod.learning_objectives ?? []).map(obj => ({
    id: obj.id,
    description: obj.description,
    module: obj.module as ModuleId,
    measuredBy: obj.measuredBy,
    triggerActionIds: obj.triggerActionIds,
    triggerSpecialType: obj.triggerSpecialType as SpecialType | undefined,
    achieved: false,
  }))

  return {
    round_number: index + 1,
    title: formatModuleTitle(mod.module_id),
    situation_update: mod.situation,
    injects,
    timerMinutes: mod.duration_minutes,
    facilitatorNotes,
    roleActions: roleActions.length > 0 ? roleActions : undefined,
    learningObjectives: learningObjectives.length > 0 ? learningObjectives : undefined,
  }
}

const MODULE_TITLES: Record<string, string> = {
  detection_sensemaking: 'Detection & Sensemaking',
  triage_containment: 'Triage & Containment',
  business_continuity: 'Business Continuity',
  crisis_communication: 'Crisis Communication',
  legal_regulatory: 'Legal & Regulatory',
  ransom_negotiation: 'Ransom Negotiation',
  recovery_lessons: 'Recovery & Lessons Learned',
  insider_investigation: 'Insider Investigation',
  supply_chain_response: 'Supply Chain Response',
  forensic_attribution: 'Forensic & Attribution',
}

function formatModuleTitle(moduleId: string): string {
  return MODULE_TITLES[moduleId] ?? moduleId
}

export function scenarioInstanceToScenario(instance: ScenarioInstance): Scenario {
  const rounds: Round[] = instance.modules
    .sort((a, b) => a.order - b.order)
    .map((mod, i) => moduleToRound(mod, i))

  return {
    scenario_title: `OPERATIE ${instance.meta.codename} — ${instance.meta.scenario_type.replace(/_/g, ' ').toUpperCase()}`,
    scenario_summary: instance.ir_observations[0] ?? instance.modules[0]?.situation ?? '',
    rounds,
  }
}
