// Van sessiestate naar reviewkaarten.
//
// Waarom hier en niet in lib/: de facilitator krijgt de volledige sessiestate
// via de stream, en de deelnemer een geprojecteerde versie. Deze afleiding
// werkt op beide shapes, dus hij hoort bij de weergave en niet bij de engine.
// De uitkomstwaarden komen wél uit de engine — nooit zelf een vector verzinnen.
//
// Eén bron voor review én eindbespreking: beide schermen renderen dezelfde
// `DecisionReviewItem`s met `DecisionReviewCard`, zodat facilitator en
// deelnemer hetzelfde verhaal zien (acceptatie-eis issue #105).

import type { DecisionReviewItem } from "@/components/shared/decision-review-card"
import type { DecisionNodeData, ScenarioGraph } from "@/lib/graph/types"
import {
  NO_DECISION_FALLBACK_VECTOR,
  OUTCOME_DIMENSIONS,
  scoreExercise,
  type OutcomeDimension,
} from "@/lib/scoring"
import { sessionToScoringInput } from "@/lib/scoring/graph-adapter"
import { vectorOverrideFor } from "@/lib/scoring/vector-overrides"
import { roleCoverage } from "@/lib/session-roles"
import type { Role, SessionState } from "@/lib/types"

export interface RoundReviewData {
  // 0-based, zoals `session.currentRound` en `SubmittedDecision.roundIndex`.
  roundIndex: number
  roundNumber: number
  roundTitle: string
  // De beslisvraag van deze ronde, zoals de auteur hem heeft geschreven.
  question: string
  items: DecisionReviewItem[]
  // Punten die de engine voor deze ronde heeft berekend. Alleen gevuld als er
  // werkelijk is ingezonden; zonder inzending is een score geen nul maar
  // "nog niet gemeten".
  points: number | null
  hasSubmissions: boolean
  // Vragen waarmee de facilitator deze ronde plenair kan openen.
  talkingPoints: string[]
}

type DecisionOption = DecisionNodeData["options"][number]

// ── Puntentotaal ───────────────────────────────────────────────────────

// De noemer van het puntentotaal hoort uit de engine te komen: welke rondes
// waren werkelijk te verdienen. Die helper (`scorableRounds` in lib/scoring)
// bestaat nog niet, en een zelfbedachte noemer naast een getal was precies de
// klacht uit de live test. Tot die tijd geeft dit null terug en toont de UI
// geen totaal. Zodra de helper er is: hier één keer aansluiten.
export interface ScoreTotal {
  earned: number
  possible: number
  rounds: number
}

export function facilitatorScoreTotal(_rounds: RoundReviewData[]): ScoreTotal | null {
  return null
}

// ── Afleiding ──────────────────────────────────────────────────────────

export function buildRoundReviews(
  session: SessionState,
  opts: { onlyRoundIndex?: number } = {},
): RoundReviewData[] {
  const decisionsByRound = mapDecisionsToRounds(session.graph)
  const optionIndex = indexOptions(session.graph)
  const coverage = new Map(roleCoverage(session).map(c => [c.role, c]))
  const outcomes = roundOutcomes(session)

  const lastPlayed = Math.max(session.currentRound, -1)
  const indices = opts.onlyRoundIndex !== undefined
    ? [opts.onlyRoundIndex]
    : range(0, lastPlayed)

  return indices
    .filter(roundIndex => roundIndex >= 0)
    .map(roundIndex => {
      const round = session.scenario.rounds[roundIndex]
      const nodes = decisionsByRound.get(roundIndex) ?? []
      const subs = (session.submittedDecisions ?? []).filter(d => d.roundIndex === roundIndex)
      const items: DecisionReviewItem[] = []

      // 1. Wat is er werkelijk ingezonden.
      for (const sub of subs) {
        const hit = optionIndex.get(sub.actionId)
        const roleAction = round?.roleActions?.find(a => a.id === sub.actionId)
        const label = hit?.option.label ?? roleAction?.label ?? sub.actionLabel
        const vector = hit
          ? vectorForOption(hit.option)
          : vectorOverrideFor(roleAction?.allowedRoles?.[0], label) ?? flatVector(roleAction?.qualityRank)
        const primary = session.participants.find(p => p.id === sub.participantId)?.role
        items.push({
          question: hit?.data.prompt ?? questionFor(nodes, round?.title, roundIndex),
          chosenLabel: label,
          role: sub.role,
          byName: sub.participantName,
          viaInheritance: !!primary && primary !== sub.role,
          reasoning: sub.reasoning || undefined,
          vector,
          facilitatorCommentary: hit
            ? hit.option.facilitatorCommentary ?? hit.option.lessonLearned
            : roleAction?.facilitatorCommentary ?? roleAction?.lessonLearned,
        })
      }

      // 2. Welke rollen een keuze bezaten maar niets hebben ingezonden. Zonder
      //    deze kaarten lijkt een ronde compleet terwijl er een gat zit.
      const decided = new Set(subs.map(s => s.role))
      for (const node of nodes) {
        const owning = new Set<Role>(
          node.data.options
            .filter(o => !o.implicit && o.allowedRole)
            .map(o => o.allowedRole as Role),
        )
        for (const role of owning) {
          if (decided.has(role)) continue
          const implicit = node.data.options.find(o => o.implicit && (!o.allowedRole || o.allowedRole === role))
          items.push({
            question: node.data.prompt,
            chosenLabel: null,
            role,
            vector: implicit ? vectorForOption(implicit) : { ...NO_DECISION_FALLBACK_VECTOR },
            unoccupied: coverage.get(role)?.status === "onbezet",
          })
        }
      }

      const outcome = outcomes.get(roundIndex + 1)
      return {
        roundIndex,
        roundNumber: roundIndex + 1,
        roundTitle: round?.title ?? `Ronde ${roundIndex + 1}`,
        question: questionFor(nodes, round?.title, roundIndex),
        items,
        points: outcome?.hasSubmissions ? outcome.points : null,
        hasSubmissions: !!outcome?.hasSubmissions,
        talkingPoints: talkingPointsFor(session, roundIndex),
      }
    })
}

// ── Helpers ────────────────────────────────────────────────────────────

function range(from: number, to: number): number[] {
  const out: number[] = []
  for (let i = from; i <= to; i++) out.push(i)
  return out
}

function questionFor(
  nodes: Array<{ data: DecisionNodeData }>,
  roundTitle: string | undefined,
  roundIndex: number,
): string {
  if (nodes.length > 0) return nodes.map(n => n.data.prompt).join(" · ")
  // Scenario's zonder beslisknoop hebben geen geschreven beslisvraag. De
  // rondetitel is dan het enige wat de auteur erover heeft gezegd.
  return roundTitle ?? `Ronde ${roundIndex + 1}`
}

// Gespreksvragen: eerst wat de auteur heeft geschreven, anders twee vaste
// vragen die bij elke ronde werken. Beter een bruikbare opening dan een leeg
// vak op het eindbesprekingsscherm.
const GENERIC_TALKING_POINTS = [
  "Welke dimensie heeft dit team bewust laten vallen — en was dat een keuze of een vergissing?",
  "Wie had dit besluit volgens het draaiboek moeten nemen, en gebeurde dat ook?",
]

function talkingPointsFor(session: SessionState, roundIndex: number): string[] {
  const authored = session.scenario.rounds[roundIndex]?.facilitatorNotes?.keyQuestions ?? []
  return authored.length > 0 ? authored : GENERIC_TALKING_POINTS
}

function vectorForOption(option: DecisionOption): Record<OutcomeDimension, number> {
  return (
    option.outcomeVector
    ?? vectorOverrideFor(option.allowedRole, option.label)
    ?? flatVector(option.qualityRank)
  )
}

// Spiegelt `qualityRankToVector` uit lib/scoring/graph-adapter.ts, dat privé is.
// Zonder deze val zou een optie zonder eigen vector hier zes nullen tonen,
// terwijl de engine er wél een vlakke plus of min voor rekent.
function flatVector(qualityRank?: string): Record<OutcomeDimension, number> {
  const sign = qualityRank === "best" ? 2
    : qualityRank === "good" ? 1
    : qualityRank === "poor" ? -1
    : qualityRank === "wrong" ? -2
    : 0
  const out = {} as Record<OutcomeDimension, number>
  for (const dim of OUTCOME_DIMENSIONS) out[dim] = sign
  return out
}

function roundOutcomes(session: SessionState): Map<number, { points: number; hasSubmissions: boolean }> {
  const out = new Map<number, { points: number; hasSubmissions: boolean }>()
  const input = sessionToScoringInput(session)
  if (!input) return out
  try {
    for (const o of scoreExercise(input).outcomes) {
      out.set(o.round, { points: o.points, hasSubmissions: o.hasSubmissions })
    }
  } catch {
    // Een halve sessie (geen start-event, lege graph) mag het reviewscherm niet
    // slopen; de keuzes en dimensies staan er dan nog steeds.
  }
  return out
}

interface IndexedOption {
  option: DecisionOption
  data: DecisionNodeData
}

function indexOptions(graph: ScenarioGraph | undefined): Map<string, IndexedOption> {
  const out = new Map<string, IndexedOption>()
  for (const node of graph?.nodes ?? []) {
    if (node.type !== "decision") continue
    const data = node.data as DecisionNodeData
    for (const option of data.options) out.set(option.id, { option, data })
  }
  return out
}

interface RoundDecisionNode {
  nodeId: string
  data: DecisionNodeData
}

// Beslisknopen koppelen aan de ronde waar ze bij horen. Dezelfde route als de
// scoring-adapter: eerst de rondes nummeren langs de sequence-keten vanaf start,
// daarna elke beslisknoop terugkoppelen aan zijn naastgelegen ronde. De adapter
// houdt die twee functies privé, vandaar deze kopie.
function mapDecisionsToRounds(graph: ScenarioGraph | undefined): Map<number, RoundDecisionNode[]> {
  const byRound = new Map<number, RoundDecisionNode[]>()
  if (!graph) return byRound

  const nodeById = new Map(graph.nodes.map(n => [n.id, n] as const))
  const outgoing = new Map<string, Array<{ target: string; type: string }>>()
  const incoming = new Map<string, string[]>()
  for (const edge of graph.edges) {
    const outs = outgoing.get(edge.source) ?? []
    outs.push({ target: edge.target, type: edge.type })
    outgoing.set(edge.source, outs)
    const ins = incoming.get(edge.target) ?? []
    ins.push(edge.source)
    incoming.set(edge.target, ins)
  }

  const roundIndexByNode = new Map<string, number>()
  let cursor = graph.nodes.find(n => n.type === "start")?.id
  let index = -1
  const seen = new Set<string>()
  while (cursor && !seen.has(cursor)) {
    seen.add(cursor)
    const node = nodeById.get(cursor)
    if (!node) break
    if (node.type === "round") {
      index++
      roundIndexByNode.set(node.id, index)
    }
    const outs = outgoing.get(cursor) ?? []
    const sequence = outs.find(e => e.type === "sequence")
    if (sequence) { cursor = sequence.target; continue }
    cursor = outs.find(e => e.type === "branch" && nodeById.get(e.target)?.type === "round")?.target
  }

  for (const node of graph.nodes) {
    if (node.type !== "decision") continue
    const roundIndex = nearestRoundIndex(node.id, incoming, roundIndexByNode)
    if (roundIndex === null) continue
    const list = byRound.get(roundIndex) ?? []
    list.push({ nodeId: node.id, data: node.data as DecisionNodeData })
    byRound.set(roundIndex, list)
  }
  return byRound
}

function nearestRoundIndex(
  nodeId: string,
  incoming: Map<string, string[]>,
  roundIndexByNode: Map<string, number>,
): number | null {
  const queue = [...(incoming.get(nodeId) ?? [])]
  const seen = new Set<string>([nodeId])
  while (queue.length > 0) {
    const current = queue.shift() as string
    if (seen.has(current)) continue
    seen.add(current)
    const hit = roundIndexByNode.get(current)
    if (hit !== undefined) return hit
    queue.push(...(incoming.get(current) ?? []))
  }
  return null
}
