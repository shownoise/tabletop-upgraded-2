import { OUTCOME_DIMENSIONS, type OutcomeDimension } from './constants'
import { buildEndReveal } from './reveal'
import { scoreExercise } from './score-exercise'
import type { ExerciseInput, RoundOutcome, ScoringOutput } from './types'

// Deel B §6 — twee PDF-varianten. Deze module produceert *payloads*; het
// eigenlijke PDF-renderen is buiten scoring (browser-print of aparte renderer).

// ── ASSESSMENT — volledig debriefrapport ───────────────────────────────

export interface AssessmentReport {
  meta: {
    scoringVersion: string
    generatedAt: number
    rolCoverage: number
    distinctOwners: number
  }
  outcomes: RoundOutcome[]
  totalPoints: number
  // Deel B §6 "spiderweb per rol": filter outcomes op besluiten waarvan die rol
  // eigenaar was — beperkt tot beschikbaar in de input.
  spider: {
    team: Record<OutcomeDimension, number>
    perDimensionAcrossRounds: Array<{ round: number; vector: Record<OutcomeDimension, number> }>
  }
  effectiveOwners: ScoringOutput['roleResolution']['effectiveOwners']
  droppedOptionalDecisions: string[]
}

export function buildAssessmentReport(input: ExerciseInput): AssessmentReport {
  const s = scoreExercise(input)
  const teamSpider = sumVectors(s.outcomes.map(o => o.perDimension))
  return {
    meta: {
      scoringVersion: s.scoringVersion,
      generatedAt: Date.now(),
      rolCoverage: s.roleResolution.rolCoverage,
      distinctOwners: s.roleResolution.distinctOwners,
    },
    outcomes: s.outcomes,
    totalPoints: s.totalPoints,
    spider: {
      team: teamSpider,
      perDimensionAcrossRounds: s.outcomes.map(o => ({ round: o.round, vector: o.perDimension })),
    },
    effectiveOwners: s.roleResolution.effectiveOwners,
    droppedOptionalDecisions: s.droppedOptionalDecisions,
  }
}

// ── EVENT — one-pager per groep + hostsamenvatting ─────────────────────

export interface EventGroupOnePager {
  groupId: string
  groupName: string
  totalPoints: number
  rank: number
  perRound: Array<{
    round: number
    points: number
    perDimension: Record<OutcomeDimension, number>
    // Deel B §6: één zin per as.
    sentences: Record<OutcomeDimension, string>
  }>
}

export interface EventHostSummary {
  scoringVersion: string
  generatedAt: number
  groupCount: number
  standings: Array<{ groupId: string; groupName: string; totalPoints: number; rank: number }>
  distributionPerDecision: Record<string, Record<string, number>>
  // Deel B §6 causale keten.
  causalChains: ReturnType<typeof buildEndReveal>['causalChains']
}

export interface EventReport {
  onePagers: EventGroupOnePager[]
  hostSummary: EventHostSummary
}

export function buildEventReport(input: {
  exerciseInput: ExerciseInput
  groups: Array<{ id: string; name: string; participantIds: string[] }>
  perGroupInputs: Record<string, ExerciseInput>  // per groep scoring-input (delen event-log per groep)
}): EventReport {
  const { exerciseInput, groups, perGroupInputs } = input
  // Bereken per groep de outcomes.
  const perGroup: Record<string, ScoringOutput> = {}
  for (const g of groups) {
    perGroup[g.id] = scoreExercise(perGroupInputs[g.id] ?? exerciseInput)
  }
  const sortedGroups = [...groups].sort((a, b) => perGroup[b.id].totalPoints - perGroup[a.id].totalPoints)
  const standings = sortedGroups.map((g, i) => ({
    groupId: g.id, groupName: g.name, totalPoints: perGroup[g.id].totalPoints, rank: i + 1,
  }))

  const onePagers: EventGroupOnePager[] = sortedGroups.map((g, i) => ({
    groupId: g.id,
    groupName: g.name,
    totalPoints: perGroup[g.id].totalPoints,
    rank: i + 1,
    perRound: perGroup[g.id].outcomes.map(o => ({
      round: o.round,
      points: o.points,
      perDimension: o.perDimension,
      sentences: makeDimensionSentences(o.perDimension),
    })),
  }))

  // Verdeling per beslispunt (voor host).
  const distributionPerDecision: Record<string, Record<string, number>> = {}
  for (const ev of exerciseInput.events) {
    if (ev.kind !== 'decision_submitted' && ev.kind !== 'decision_revised') continue
    const bucket = (distributionPerDecision[ev.decisionPointId] ??= {})
    bucket[ev.optionId] = (bucket[ev.optionId] ?? 0) + 1
  }

  const causalChains = buildEndReveal({
    scenario: exerciseInput.scenario, events: exerciseInput.events,
    groups: groups.map(g => ({ id: g.id, participantIds: g.participantIds })),
  }).causalChains

  return {
    onePagers,
    hostSummary: {
      scoringVersion: perGroup[groups[0]?.id]?.scoringVersion ?? '1.0.0',
      generatedAt: Date.now(),
      groupCount: groups.length,
      standings,
      distributionPerDecision,
      causalChains,
    },
  }
}

// ── Helpers ────────────────────────────────────────────────────────────

function sumVectors(vectors: Array<Record<OutcomeDimension, number>>): Record<OutcomeDimension, number> {
  const out: Record<OutcomeDimension, number> = { CONT: 0, FOR: 0, BC: 0, JUR: 0, VER: 0, KOS: 0 }
  for (const v of vectors) for (const d of OUTCOME_DIMENSIONS) out[d] += v[d]
  return out
}

function makeDimensionSentences(v: Record<OutcomeDimension, number>): Record<OutcomeDimension, string> {
  const s: Record<OutcomeDimension, string> = { CONT: '', FOR: '', BC: '', JUR: '', VER: '', KOS: '' }
  s.CONT = phraseFor('containment',           v.CONT)
  s.FOR  = phraseFor('forensische integriteit', v.FOR)
  s.BC   = phraseFor('bedrijfscontinuïteit',  v.BC)
  s.JUR  = phraseFor('juridisch',             v.JUR)
  s.VER  = phraseFor('stakeholder-vertrouwen', v.VER)
  s.KOS  = phraseFor('kosten',                v.KOS)
  return s
}

function phraseFor(label: string, v: number): string {
  if (v >= 1.5)  return `Sterk resultaat op ${label} (+${v.toFixed(1)}).`
  if (v > 0)     return `Positief op ${label} (+${v.toFixed(1)}).`
  if (v === 0)   return `Neutraal op ${label}.`
  if (v > -1.5)  return `Verlies op ${label} (${v.toFixed(1)}).`
  return `Kritiek verlies op ${label} (${v.toFixed(1)}).`
}
