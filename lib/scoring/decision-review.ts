// Eén bron voor de scorebespreking per ronde: welke beslisvraag lag er, wie
// koos wat, en wat deed die keuze met de zes dimensies.
//
// Waarom hier en niet in de rapportcomponenten: het rapport, het dashboard en
// de assessment-PDF toonden dit elk op hun eigen manier (afkortingen, balkjes,
// losse labelmappings). Issue #105 eist dat ze exact hetzelfde tonen, dus komt
// de inhoud uit één functie en de opmaak uit één component
// (`components/shared/decision-review-card.tsx`).
//
// De type-import van die component is bewust type-only: er komt geen JSX of
// React in lib/scoring, maar de shape kan niet uit elkaar lopen.

import type { DecisionNodeData } from '@/lib/graph/types'
import type { Role, SessionState, SubmittedDecision } from '@/lib/types'
import type { DecisionReviewItem } from '@/components/shared/decision-review-card'
import { NO_DECISION_FALLBACK_VECTOR } from './constants'
import { graphToScenarioSpec } from './graph-adapter'

export interface DecisionReviewEntry {
  // Stabiele key voor React — nodeId plus de inzender, of 'geen-besluit'.
  key: string
  item: DecisionReviewItem
  // Ontbreekt bij "geen besluit binnen de tijd".
  submission?: SubmittedDecision
  // False wanneer de gekozen optie geen geautoriseerde outcomeVector heeft. Dan
  // zijn de punten níet vastgesteld en mag de weergave geen nullen tonen alsof
  // de keuze geen effect had.
  scored: boolean
}

export interface DecisionReviewRound {
  // 1-based, dezelfde nummering als RoundOutcome.round.
  round: number
  title?: string
  entries: DecisionReviewEntry[]
}

// Alle beslismomenten van de gespeelde rondes, in rondevolgorde.
export function decisionReviewItems(session: SessionState): DecisionReviewRound[] {
  const graph = session.graph
  if (!graph) return []

  // Dezelfde node→rondenummer-afbeelding die de scoring gebruikt, zodat het
  // rapport en de punten over dezelfde ronde praten. Rolacties laten we buiten
  // beschouwing: die hebben geen beslisvraag met alternatieven.
  const spec = graphToScenarioSpec(graph, { mode: 'ASSESSMENT', includeRoundActions: false })
  const roundByNodeId = new Map(spec.decisionPoints.map(dp => [dp.id, dp.round] as const))

  const decisionNodes = graph.nodes.filter(n => n.type === 'decision')
  const submissions = session.submittedDecisions ?? []
  const playedRounds = session.scenario?.rounds?.length ?? 0

  const byRound = new Map<number, DecisionReviewEntry[]>()
  for (const node of decisionNodes) {
    const round = roundByNodeId.get(node.id)
    if (round === undefined || round > playedRounds) continue
    const dd = node.data as DecisionNodeData
    const entries = byRound.get(round) ?? []

    const mine = submissions.filter(
      d => d.roundIndex === round - 1 && dd.options.some(o => matches(o, d)),
    )

    if (mine.length === 0) {
      entries.push(noDecisionEntry(node.id, dd, session))
    } else {
      for (const d of mine) {
        const option = dd.options.find(o => matches(o, d))!
        entries.push({
          key: `${node.id}::${d.participantId}::${d.actionId}`,
          submission: d,
          scored: !!option.outcomeVector,
          item: {
            question: dd.prompt,
            chosenLabel: option.label,
            role: d.role,
            byName: d.participantName,
            reasoning: d.reasoning || undefined,
            vector: option.outcomeVector ?? null,
            facilitatorCommentary: option.facilitatorCommentary ?? option.lessonLearned,
          },
        })
      }
    }
    byRound.set(round, entries)
  }

  return [...byRound.entries()]
    .sort(([a], [b]) => a - b)
    .map(([round, entries]) => ({
      round,
      title: session.scenario?.rounds?.[round - 1]?.title,
      entries,
    }))
}

// Niemand heeft deze beslisvraag beantwoord. De gevolgen zijn die van niets
// doen: de auteur-vector van de impliciete optie, anders de standaard.
function noDecisionEntry(nodeId: string, dd: DecisionNodeData, session: SessionState): DecisionReviewEntry {
  const implicit = dd.options.find(o => o.implicit)
  const owner = dd.scoringOwner ?? dd.triggerRole ?? firstAllowedRole(dd)
  return {
    key: `${nodeId}::geen-besluit`,
    scored: true,
    item: {
      question: dd.prompt,
      chosenLabel: null,
      role: owner,
      // Alleen "rol was niet bezet" melden als dat aantoonbaar zo is: niemand
      // in de sessie droeg deze rol.
      unoccupied: owner !== undefined && !session.participants.some(p => p.role === owner),
      vector: implicit?.outcomeVector ?? NO_DECISION_FALLBACK_VECTOR,
    },
  }
}

function firstAllowedRole(dd: DecisionNodeData): Role | undefined {
  return dd.options.find(o => o.allowedRole)?.allowedRole
}

function matches(option: DecisionNodeData['options'][number], d: SubmittedDecision): boolean {
  return option.id === d.actionId || option.roleActionId === d.actionId
}
