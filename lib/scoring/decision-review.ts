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

// De inzender die `finalizeDecision` in lib/session-store.ts gebruikt voor een
// rol die niets heeft ingediend.
const IMPLICIT_PARTICIPANT_ID = 'IMPLICIT'

// Eén predikaat voor "hier is binnen de tijd niet besloten", voor beide
// reviewpaden (dit bestand en components/admin/facilitator/review-items.ts).
// Zonder dit liep het uit elkaar: dit pad las de impliciete inzending als een
// genomen besluit waarvan het label nu eenmaal "Geen besluit binnen de tijd"
// heet, en toonde "GEKOZEN" waar de facilitatorconsole "GEEN BESLUIT" toonde.
//
// Twee signalen, omdat een pad soms maar één ervan in handen heeft. Ze zeggen
// hetzelfde: een deelnemer kán een impliciete optie niet indienen
// (app/api/session/submit-decision/route.ts weigert dat), dus staat zo'n optie
// er altijd omdat de facilitator de beslissing afsloot.
export function isNoDecisionSubmission(
  submission: Pick<SubmittedDecision, 'participantId'>,
  option?: { implicit?: boolean },
): boolean {
  return submission.participantId === IMPLICIT_PARTICIPANT_ID || !!option?.implicit
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
        const noDecision = isNoDecisionSubmission(d, option)
        entries.push({
          // De rol hoort in de key: bij meerdere onbeantwoorde rollen op één
          // beslispunt dragen de impliciete rijen dezelfde inzender én dezelfde
          // optie, en gaf de key zonder rol dubbele React-keys.
          key: `${node.id}::${d.role ?? 'geen-rol'}::${d.participantId}::${d.actionId}`,
          submission: d,
          scored: !!option.outcomeVector,
          item: {
            question: dd.prompt,
            noDecision,
            // Bij "geen besluit" draagt `participantName` de groepsnaam of
            // 'Geen besluit' en het label de impliciete optie: beide zouden als
            // een genomen besluit lezen. De reden reist mee in `reasoning`.
            chosenLabel: noDecision ? null : option.label,
            role: d.role,
            byName: noDecision ? undefined : d.participantName,
            unoccupied: noDecision && !!d.role && !session.participants.some(p => p.role === d.role),
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

// Eén regel voor de rapportsamenvatting: hoeveel van de besproken
// beslismomenten zijn als "geen besluit binnen de tijd" gescoord. Zonder die
// regel las een rapport waarin niemand iets koos precies hetzelfde als een
// rapport met zes magere keuzes — dezelfde dimensies, dezelfde punten, geen
// woord over het verschil. Staat er geen enkele echte keuze tussen, dan zegt de
// regel ook waar de punten dan wél vandaan komen.
//
// Geteld wordt per kaart in de scorebespreking (één per rol per beslisvraag),
// vandaar "besproken": de lezer kan het getal naschalen door te scrollen.
// Elders in die samenvatting staat "beslismoment" voor een hele ronde.
export function noDecisionSummarySentence(rounds: DecisionReviewRound[]): string {
  const items = rounds.flatMap(r => r.entries).map(e => e.item)
  const total = items.length
  if (total === 0) return ''
  const noDecision = items.filter(item => item.noDecision).length

  const moments = total === 1
    ? 'het enige besproken beslismoment'
    : `alle ${total} besproken beslismomenten`
  if (noDecision === 0) {
    return `In ${moments} ligt een gekozen optie; de punten hierboven volgen dus uit wat het team besloot.`
  }
  if (noDecision === total) {
    const kop = moments.charAt(0).toUpperCase() + moments.slice(1)
    return `${kop} ${total === 1 ? 'is' : 'zijn'} als "geen besluit binnen de tijd" gescoord — de punten zijn het gevolg van niets doen, niet van wat het team besloot.`
  }
  const decided = total - noDecision
  return `${noDecision} van de ${total} besproken beslismomenten ${noDecision === 1 ? 'is' : 'zijn'} als "geen besluit binnen de tijd" gescoord; de andere ${decided} ${decided === 1 ? 'bevat' : 'bevatten'} een gekozen optie.`
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
      noDecision: true,
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
