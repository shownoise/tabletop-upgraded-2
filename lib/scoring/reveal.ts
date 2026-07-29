import { OUTCOME_DIMENSIONS, type OutcomeDimension } from './constants'
import { computeRoundOutcome } from './outcome-round'
import { buildLeaderboard, divergenceOverGroups, type LeaderboardEntry } from './points'
import type { ExerciseEvent, RoundOutcome, ScenarioSpec } from './types'

// Deel B §5.2 — reveal-opbouw per ronde. Volgorde is spec-vereist:
//   1. Weging van deze ronde (nu pas onthuld)
//   2. Verdeling van keuzes over groepen (anoniem)
//   3. Vector per optie + debriefNote (wat elke keuze kostte)
//   4. Stand na deze ronde

export interface RoundReveal {
  round: number
  weights: Record<OutcomeDimension, number>
  decisionReveals: Array<{
    decisionPointId: string
    // Deel B §5.2 punt 2: aggregatie van hoeveel groepen welke optie kozen.
    // Sleutel is optionId, waarde is aantal groepen.
    optionDistribution: Record<string, number>
    // Deel B §7.3 — entropie over de keuzeverdeling ("waar was het gesprek?").
    divergence: number
    // Deel B §5.2 punt 3: vector per optie + debriefNote.
    optionVectors: Array<{
      optionId: string
      outcomeVector: Record<OutcomeDimension, number>
      debriefNote?: string
      isImplicit: boolean
    }>
  }>
  // Deel B §5.2 punt 4: stand per groep na deze ronde.
  standings: LeaderboardEntry[]
}

export function buildReveal(input: {
  scenario: ScenarioSpec
  events: ExerciseEvent[]
  round: number
  groups: Array<{ id: string; participantIds: string[] }>
}): RoundReveal {
  const { scenario, events, round, groups } = input
  const roundSpec = scenario.rounds.find(r => r.number === round)!
  const dps = scenario.decisionPoints.filter(d => d.round === round)

  // Bepaal de finale submission per (group, dp).
  const submissions = collectFinalSubmissions(events, groups, round)

  const decisionReveals = dps.map(dp => {
    const optionDistribution: Record<string, number> = {}
    for (const g of groups) {
      const chosen = submissions.get(keyFor(dp.id, g.id))
      if (chosen) optionDistribution[chosen] = (optionDistribution[chosen] ?? 0) + 1
    }
    const divergence = divergenceOverGroups({ [dp.id]: optionDistribution })[dp.id]

    return {
      decisionPointId: dp.id,
      optionDistribution,
      divergence,
      optionVectors: dp.options.map(o => ({
        optionId: o.id,
        outcomeVector: o.outcomeVector,
        debriefNote: o.debriefNote,
        isImplicit: !!o.implicit,
      })),
    }
  })

  // Standings: per groep de outcomes van deze én voorgaande rondes.
  const outcomesByGroup = computeOutcomesByGroup(scenario, events, groups, round)
  const standings = buildLeaderboard(outcomesByGroup, scenario)

  return {
    round,
    weights: roundSpec.outcomeWeights,
    decisionReveals,
    standings,
  }
}

// Deel B §5.2 eindreveal: causale keten.
//   "vier groepen herstelden in ronde 2 op productie (FOR −2) → drie kunnen
//    in ronde 4 niet volledig melden."
//
// De keten leiden we af uit cumulatieve dimensies onder een drempel én daarna
// gekozen opties. Puur beschrijvend; geen absolute waarheden, geeft de host
// de aanleiding voor het gesprek.
export interface EndReveal {
  finalStandings: LeaderboardEntry[]
  perGroupOutcomes: Record<string, RoundOutcome[]>
  causalChains: Array<{
    dimension: OutcomeDimension
    threshold: number
    groupsBelow: string[]
    consequencesRound: number
    consequenceOptions: string[]
  }>
}

export function buildEndReveal(input: {
  scenario: ScenarioSpec
  events: ExerciseEvent[]
  groups: Array<{ id: string; participantIds: string[] }>
}): EndReveal {
  const { scenario, events, groups } = input
  const maxRound = Math.max(...scenario.rounds.map(r => r.number))
  const outcomesByGroup = computeOutcomesByGroup(scenario, events, groups, maxRound)
  const standings = buildLeaderboard(outcomesByGroup, scenario)

  // Zoek per dimensie of er groepen zijn die na een bepaalde ronde onder 0 uitkomen
  // en in latere rondes een "beperkte optie" hebben moeten kiezen.
  const causalChains: EndReveal['causalChains'] = []
  for (const dim of OUTCOME_DIMENSIONS) {
    for (const r of scenario.rounds) {
      const groupsBelow: string[] = []
      for (const g of groups) {
        let cum = 0
        for (const o of outcomesByGroup[g.id] ?? []) {
          if (o.round > r.number) break
          cum += o.perDimension[dim]
        }
        if (cum < 0) groupsBelow.push(g.id)
      }
      if (groupsBelow.length === 0) continue
      // Consequences-ronde is de eerstvolgende ronde na r.
      const consequenceRound = scenario.rounds.find(x => x.number > r.number)
      if (!consequenceRound) continue
      // Welke opties kozen die "onder" groepen in die consequences-ronde?
      const consequenceDps = scenario.decisionPoints.filter(d => d.round === consequenceRound.number)
      const consOptions = new Set<string>()
      const finalSubs = collectFinalSubmissions(events, groups, consequenceRound.number)
      for (const gid of groupsBelow) {
        for (const dp of consequenceDps) {
          const opt = finalSubs.get(keyFor(dp.id, gid))
          if (opt) consOptions.add(`${dp.id}:${opt}`)
        }
      }
      if (consOptions.size === 0) continue
      causalChains.push({
        dimension: dim,
        threshold: 0,
        groupsBelow,
        consequencesRound: consequenceRound.number,
        consequenceOptions: [...consOptions],
      })
    }
  }

  return { finalStandings: standings, perGroupOutcomes: outcomesByGroup, causalChains }
}

// Helpers ─────────────────────────────────────────────────────────────

function collectFinalSubmissions(
  events: ExerciseEvent[],
  groups: Array<{ id: string; participantIds: string[] }>,
  round: number,
): Map<string, string> {
  const out = new Map<string, string>()
  for (const ev of events) {
    if (ev.kind !== 'decision_submitted' && ev.kind !== 'decision_revised') continue
    if (ev.round !== round) continue
    const gid = groups.find(g => g.participantIds.includes(ev.by))?.id ?? 'single'
    out.set(keyFor(ev.decisionPointId, gid), ev.optionId)
  }
  return out
}

function computeOutcomesByGroup(
  scenario: ScenarioSpec,
  events: ExerciseEvent[],
  groups: Array<{ id: string; participantIds: string[] }>,
  throughRound: number,
): Record<string, RoundOutcome[]> {
  const out: Record<string, RoundOutcome[]> = {}
  const rounds = scenario.rounds.filter(r => r.number <= throughRound)
  for (const g of groups) {
    const groupEvents = events.filter(ev => {
      if (ev.kind !== 'decision_submitted' && ev.kind !== 'decision_revised') return true
      return g.participantIds.includes(ev.by)
    })
    out[g.id] = rounds.map(r => computeRoundOutcome(scenario, groupEvents, r.number))
  }
  return out
}

function keyFor(dpId: string, groupId: string): string {
  return `${dpId}::${groupId}`
}
