import type { DiscussionPhase, FacilitatorRoundContext, AssessmentControl, CapabilityId } from "./types"
import type { ResolvedExerciseConfig } from "./exercise-config"

export const BOB_PHASES: DiscussionPhase[] = [
  {
    id: 'beeldvorming',
    name: 'Beeldvorming',
    durationSeconds: 300,
    participantPrompt: 'Beeldvorming — Wat weten we? Wat weten we niet? Klopt alles wat we denken te weten?',
    facilitatorHint: 'Let op: springt het team naar oplossingen voordat er een volledig beeld is?',
    assessmentTrigger: { dimensionId: 'decision_quality' },
  },
  {
    id: 'oordeelsvorming',
    name: 'Oordeelsvorming',
    durationSeconds: 240,
    participantPrompt: 'Oordeelsvorming — Wat zijn onze opties? Wat zijn de risico\'s? Wat is ons doel?',
    facilitatorHint: 'Let op: dragen alle rollen bij? Wordt Juridisch/Legal geraadpleegd?',
  },
  {
    id: 'besluitvorming',
    name: 'Besluitvorming',
    durationSeconds: 120,
    participantPrompt: 'Besluitvorming — Wat besluiten we? Wie is eigenaar van dit besluit? Is het voor iedereen helder?',
    facilitatorHint: 'Let op: is duidelijk wie de bevoegdheid heeft dit te autoriseren?',
    assessmentTrigger: { dimensionId: 'mandate_clarity' },
  },
]

export const OODA_PHASES: DiscussionPhase[] = [
  {
    id: 'observe',
    name: 'Observe',
    durationSeconds: 180,
    participantPrompt: 'Observe — Welke informatie hebben we? Wat zien we nu precies?',
    facilitatorHint: 'Let op: filtert het team signaal van ruis?',
    assessmentTrigger: { dimensionId: 'decision_quality' },
  },
  {
    id: 'orient',
    name: 'Orient',
    durationSeconds: 180,
    participantPrompt: 'Orient — Wat betekent dit voor ons? Hoe past dit in wat we al weten?',
    facilitatorHint: 'Let op: worden eerdere aannames kritisch getoetst of blindelings bevestigd?',
  },
  {
    id: 'decide',
    name: 'Decide',
    durationSeconds: 120,
    participantPrompt: 'Decide — Welke koers kiezen we? Wie neemt dit besluit?',
    facilitatorHint: 'Let op: is de beslissende rol helder? Is het mandaat bepaald?',
    assessmentTrigger: { dimensionId: 'mandate_clarity' },
  },
  {
    id: 'act',
    name: 'Act',
    durationSeconds: 60,
    participantPrompt: 'Act — Wie doet wat, wanneer? Benoem eigenaren expliciet.',
    facilitatorHint: 'Let op: worden actie-eigenaren expliciet benoemd of impliciet verondersteld?',
    assessmentTrigger: { dimensionId: 'escalation_timing' },
  },
]

function buildAssessmentControls(capabilities: CapabilityId[]): AssessmentControl[] {
  const controls: AssessmentControl[] = []

  if (capabilities.includes('governance_decisions')) {
    controls.push(
      { dimensionId: 'mandate_clarity', label: 'Mandate clear — decision owner identified', value: 80 },
      { dimensionId: 'escalation_timing', label: 'Escalation: correctly timed', value: 85 },
      { dimensionId: 'escalation_timing', label: 'Escalation: too early or too late', value: 30 },
      { dimensionId: 'decision_quality', label: 'Decision: well-reasoned with trade-offs', value: 85 },
      { dimensionId: 'decision_quality', label: 'Decision: rushed or poorly justified', value: 25 },
      { dimensionId: 'framework_adherence', label: 'Framework: applied consistently', value: 90 },
    )
  }

  if (capabilities.includes('crisis_communication')) {
    controls.push(
      { dimensionId: 'communication_clarity', label: 'Comms: clear and appropriate', value: 85 },
      { dimensionId: 'communication_clarity', label: 'Comms: unclear or premature', value: 25 },
    )
  }

  if (capabilities.includes('legal_compliance')) {
    controls.push(
      { dimensionId: 'compliance_awareness', label: 'Compliance: obligation identified unprompted', value: 90 },
      { dimensionId: 'compliance_awareness', label: 'Compliance: missed or delayed', value: 20 },
    )
  }

  if (capabilities.includes('gamification')) {
    controls.push(
      { dimensionId: 'dilemma_participation', label: 'Dilemma: all roles voted', value: 100 },
      { dimensionId: 'dilemma_participation', label: 'Dilemma: partial participation', value: 50 },
    )
  }

  return controls
}

function buildObservationPrompts(capabilities: CapabilityId[], roundNumber: number): string[] {
  const prompts: string[] = []

  if (capabilities.includes('governance_decisions')) {
    prompts.push('Is there a clear decision owner in this round?')
    prompts.push('Is escalation happening at the right level?')
    if (roundNumber === 1) {
      prompts.push('Does the team recognise the pattern, or are they treating signals in isolation?')
    }
    if (roundNumber >= 2) {
      prompts.push('Is the incident commander role clear, or are decisions being made by committee?')
    }
  }

  if (capabilities.includes('legal_compliance')) {
    prompts.push('Have they identified the regulatory clock?')
    prompts.push('Is Legal in the conversation, or siloed?')
  }

  if (capabilities.includes('crisis_communication')) {
    prompts.push('Who owns external communications? Is there a designated spokesperson?')
  }

  return prompts
}

function buildComplianceTriggers(capabilities: CapabilityId[], roundNumber: number): string[] {
  if (!capabilities.includes('legal_compliance')) return []
  const triggers: string[] = []
  if (roundNumber === 1) {
    triggers.push('GDPR clock: if PII is confirmed at risk, the 72h notification window may already be open')
  }
  if (roundNumber === 2) {
    triggers.push('NIS2 early warning: significant incident must be reported to NCSC within 24h')
  }
  if (roundNumber >= 3) {
    triggers.push('AP notification: 72h window — has Legal filed or is it tracked?')
  }
  return triggers
}

function buildMandateChecks(capabilities: CapabilityId[]): string[] {
  if (!capabilities.includes('governance_decisions')) return []
  return [
    'Who is authorized to make this decision? Is that person in the room?',
    'Does the team need CEO sign-off, or can CISO decide?',
    'Is this a financial threshold that requires CFO or board approval?',
  ]
}

export function buildFacilitatorContext(
  resolvedConfig: ResolvedExerciseConfig,
  roundNumber: number,
  notes = '',
): FacilitatorRoundContext {
  const activeCapabilities = resolvedConfig.capabilities.map(c => c.id)

  return {
    roundNumber,
    activeCapabilities,
    observationPrompts: buildObservationPrompts(activeCapabilities, roundNumber),
    complianceTriggers: buildComplianceTriggers(activeCapabilities, roundNumber),
    mandateChecks: buildMandateChecks(activeCapabilities),
    assessmentControls: buildAssessmentControls(activeCapabilities),
    notes,
  }
}
