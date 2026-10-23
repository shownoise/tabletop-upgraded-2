import { scoreDenominator, scoreExerciseByGroup, type ScoringOutput } from "./scoring"
import { sessionToScoringInput } from "./scoring/graph-adapter"
import type { OutcomeVector } from "./graph/types"
import { ROLE_META } from "./types"
import type {
  ParticipantClosing, ParticipantClosingChoice, ParticipantClosingRound, SessionState,
} from "./types"

// End-of-session recap for one participant: the rounds they played, the choice
// they made in each, and what that choice loaded onto the six dimensions.
//
// Reuses scoreExerciseByGroup so the numbers are the same ones the facilitator
// report shows — this derives nothing of its own. Everything it cannot read
// from the scoring output is left out rather than filled in.
export function buildParticipantClosing(session: SessionState, participantId: string): ParticipantClosing {
  const participant = session.participants.find(p => p.id === participantId)
  const groupId = participant?.groupId
  // In EVENT mode one device submits for the whole team, so a team member's own
  // participantId carries no choices — the group's do.
  const myDecisions = (session.submittedDecisions ?? []).filter(d =>
    session.mode === "event" && groupId
      ? d.groupId === groupId
      : d.participantId === participantId,
  )

  const input = sessionToScoringInput(session)
  const perGroup = input ? scoreExerciseByGroup(input) : {}
  const mine: ScoringOutput | undefined =
    (groupId ? perGroup[groupId] : undefined) ?? perGroup.all ?? Object.values(perGroup)[0]

  // SubmittedDecision.actionId is the chosen option's id, which is what the
  // adapter keys OptionSpec by — for graph options and for legacy roleActions.
  const optionById = new Map<string, { label?: string; outcomeVector: OutcomeVector; debriefNote?: string }>()
  for (const dp of input?.scenario.decisionPoints ?? []) {
    for (const option of dp.options) {
      if (optionById.has(option.id)) continue
      optionById.set(option.id, {
        label: option.label,
        outcomeVector: option.outcomeVector,
        debriefNote: option.debriefNote,
      })
    }
  }

  const rounds: ParticipantClosingRound[] = session.scenario.rounds.map((round, i) => {
    const outcome = mine?.outcomes.find(o => o.round === i + 1)
    const choices: ParticipantClosingChoice[] = myDecisions
      .filter(d => d.roundIndex === i)
      .map(d => {
        const spec = optionById.get(d.actionId)
        return {
          roleLabel: ROLE_META[d.role].label,
          optionLabel: d.actionLabel || spec?.label || "Keuze zonder omschrijving",
          outcomeVector: spec?.outcomeVector,
          debriefNote: spec?.debriefNote,
        }
      })
    return {
      roundNumber: i + 1,
      title: round.title,
      choices,
      ...(outcome?.hasSubmissions
        ? { perDimension: outcome.perDimension, points: outcome.points }
        : {}),
    }
  })

  // De noemer komt uit dezelfde helper als het facilitatorrapport. Dit stond
  // hier eerder als `scoredRounds.length * 100` — dat telt alleen rondes waarin
  // het team wél iets indiende, dus een gemiste ronde maakte de score juist
  // mooier. Issue #105 eist dat deelnemer, facilitator en rapport exact dezelfde
  // noemer tonen, dus mag er maar één implementatie van die regel bestaan.
  const denom = input ? scoreDenominator(input.scenario, mine?.outcomes ?? [], mine?.totalPoints ?? 0) : null
  const groups = session.groups ?? []
  const standings = groups
    .filter(g => perGroup[g.id])
    .map(g => ({ name: g.name, points: perGroup[g.id].totalPoints, isMine: g.id === groupId }))
    .sort((a, b) => b.points - a.points)

  return {
    rounds,
    ...(mine && denom && !denom.nothingToScore
      ? {
          totalPoints: mine.totalPoints,
          maxPoints: denom.maxPoints,
          scoringVersion: mine.scoringVersion,
        }
      : {}),
    ...(groupId ? { teamName: groups.find(g => g.id === groupId)?.name } : {}),
    ...(standings.length > 1 ? { teamStandings: standings } : {}),
  }
}
