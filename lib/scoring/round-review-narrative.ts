/**
 * Phase 7 — round-review narrative generator (facilitator-only).
 *
 * Produces per-decision Dutch sentences describing what participants chose in
 * a given round, plus omissions (regulatory not filed, retainer not activated,
 * decisions skipped). Never invents facts — if a field is missing, it's simply
 * left out. Consumed only by the facilitator dashboard; NEVER exposed via
 * toParticipantState.
 */

import type { DecisionNodeData, OutcomeVector } from "@/lib/graph/types"
import { RETAINER_ACTIVATED_FLAG } from "@/lib/graph/types"
import type { Role, SessionState, SubmittedDecision } from "@/lib/types"
import { ROLE_META } from "@/lib/types"
import { effectiveRolesForParticipant } from "@/lib/engine/distribute-roles"

export interface RoundReviewNarrative {
  round: number
  lines: string[]
  omissions: string[]
  // Phase 5 — Dutch sentences describing library-fired noise injects during this
  // round's DISCUSSION. Never scored — surfaced for facilitator context only.
  facilitatorInterventions?: string[]
}

// Dutch labels + direction for narrative axis-movement sentences.
const AXIS_LABEL: Record<keyof OutcomeVector, string> = {
  CONT: "Containment",
  FOR: "Forensiek",
  BC: "Continuïteit",
  JUR: "Juridisch",
  VER: "Vertrouwen",
  KOS: "Kosten",
}

// Signed axis phrase — for KOS a positive vector means COSTS go DOWN (better),
// but the raw sign we display in the sentence is the raw number. We keep the
// output faithful to the outcomeVector as authored.
function axisPhrase(dim: keyof OutcomeVector, value: number): string {
  if (value === 0) return ""
  const sign = value > 0 ? "+" : "−"
  const abs = Math.abs(value)
  return `**${sign}${abs} op ${AXIS_LABEL[dim]}**`
}

function joinAxisPhrases(vec: OutcomeVector | undefined): string {
  if (!vec) return ""
  const dims: Array<keyof OutcomeVector> = ["CONT", "FOR", "BC", "JUR", "VER", "KOS"]
  const nonZero = dims
    .map(d => ({ d, v: vec[d] }))
    .filter(x => x.v !== 0)
    .map(x => axisPhrase(x.d, x.v))
  if (nonZero.length === 0) return "geen meetbare beweging op de zes assen"
  if (nonZero.length === 1) return `Dit gaf ${nonZero[0]}`
  const last = nonZero.pop()!
  return `Dit gaf ${nonZero.join(", ")} en ${last}`
}

function findDecisionNodeAndOption(
  session: SessionState,
  optionId: string,
): { nodeId: string; option: DecisionNodeData["options"][number] } | null {
  const graph = session.graph
  if (!graph) return null
  for (const n of graph.nodes) {
    if (n.type !== "decision") continue
    const dd = n.data as DecisionNodeData
    const opt = dd.options.find(o => o.id === optionId)
    if (opt) return { nodeId: n.id, option: opt }
  }
  return null
}

// Roles that owed a decision in this round: any participant × any authored role
// with a matching allowedRole in a decision node the round links to. If the
// scenario doesn't declare per-round decision links (which the graph does via
// sequence edges), we fall back to "all roles the participant covers".
function expectedRoleTuplesForRound(
  session: SessionState,
  roundIndex: number,
): Array<{ participantId: string; participantName: string; role: Role }> {
  const dist = session.roleDistribution
  const overrides = session.roleAssignmentOverrides ?? {}
  if (!dist) return []

  // Find the DecisionNode(s) for this round via graph sequence edges.
  const graph = session.graph
  const roundNodeId = graph?.nodes.find(
    n => n.type === "round" && (n.data as { title?: string }).title
      && session.scenario.rounds[roundIndex]?.title === (n.data as { title?: string }).title,
  )?.id

  const rolesWithOptionInRound = new Set<Role>()
  if (graph && roundNodeId) {
    for (const e of graph.edges) {
      if (e.type !== "sequence") continue
      if (e.source !== roundNodeId) continue
      const child = graph.nodes.find(n => n.id === e.target)
      if (child?.type !== "decision") continue
      const dd = child.data as DecisionNodeData
      for (const o of dd.options) if (o.allowedRole) rolesWithOptionInRound.add(o.allowedRole)
    }
  }

  const result: Array<{ participantId: string; participantName: string; role: Role }> = []
  for (const entry of dist.entries) {
    const roles = effectiveRolesForParticipant(entry, overrides[entry.participantId])
    const applicable = rolesWithOptionInRound.size > 0
      ? roles.filter(r => rolesWithOptionInRound.has(r))
      : roles
    for (const role of applicable) {
      result.push({
        participantId: entry.participantId,
        participantName: entry.participantName,
        role,
      })
    }
  }
  return result
}

// Phase 5 — locate all library-fired noise injects that landed within this
// round's wall-clock window. The window opens at the timeline's round_changed
// event for `roundIndex` (or session start for round 0) and closes at the next
// round_changed. Only surprise_inject entries with a libraryId payload are
// considered — organic surprise injects (freeform text) are ignored so this
// section stays true to its "library button" scope.
function facilitatorInterventionLines(
  session: SessionState,
  roundIndex: number,
): string[] {
  const library = session.graph?.injectLibrary ?? []
  if (library.length === 0) return []

  const timeline = session.timeline ?? []
  // Window boundaries. Round 0 opens at session start.
  const roundOpens = timeline
    .filter(t => t.type === 'round_changed' && (t.data as { roundIndex?: number }).roundIndex === roundIndex)
    .map(t => t.timestamp)
  const openTs = roundOpens[0] ?? session.startedAt ?? session.createdAt
  const nextOpens = timeline
    .filter(t => t.type === 'round_changed' && (t.data as { roundIndex?: number }).roundIndex === roundIndex + 1)
    .map(t => t.timestamp)
  const closeTs = nextOpens[0] ?? Number.POSITIVE_INFINITY

  const lines: string[] = []
  for (const te of timeline) {
    if (te.type !== 'surprise_inject') continue
    if (te.timestamp < openTs || te.timestamp >= closeTs) continue
    const data = te.data as { libraryId?: string; inject?: { title?: string; channel?: string } }
    if (!data.libraryId) continue  // only surface library-fired ones
    const libEntry = library.find(l => l.id === data.libraryId)
    const label = libEntry?.label || data.inject?.title || '(ruis-inject)'
    const channel = libEntry?.channel || data.inject?.channel || 'onbekend'
    const hhmm = new Date(te.timestamp).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
    lines.push(
      `Facilitator introduceerde ruis-inject «${label}» via kanaal ${channel} op ${hhmm} tijdens discussie.`,
    )
  }
  return lines
}

export function roundReviewNarrative(
  session: SessionState,
  roundIndex: number,
): RoundReviewNarrative {
  const lines: string[] = []
  const omissions: string[] = []

  const submissions: SubmittedDecision[] = (session.submittedDecisions ?? []).filter(
    d => d.roundIndex === roundIndex,
  )

  const submittedTuples = new Set<string>()
  for (const d of submissions) {
    submittedTuples.add(`${d.participantId}::${d.role}`)
    const found = findDecisionNodeAndOption(session, d.actionId)
    const optionLabel = found?.option.label ?? d.actionLabel ?? "onbekende optie"
    const commentary = found?.option.facilitatorCommentary?.trim()
    const lesson = found?.option.lessonLearned?.trim()
    const vec = found?.option.outcomeVector
    const roleLabel = ROLE_META[d.role]?.label ?? d.role

    const parts: string[] = []
    parts.push(`**${d.participantName} (${roleLabel})** koos «${optionLabel}».`)
    const axis = joinAxisPhrases(vec)
    if (axis) parts.push(axis + ".")
    if (commentary) parts.push(commentary)
    else if (lesson) parts.push(`Les: ${lesson}`)
    lines.push(parts.join(" "))
  }

  // Omissions: regulatory obligation still open in a round it was opened.
  for (const ob of session.regulatoryObligations ?? []) {
    if (ob.status !== 'open') continue
    // Show a warning if this obligation opened in or before this round.
    if (ob.openedAtRound - 1 <= roundIndex) {
      omissions.push(
        `De meldplicht (${ob.milestoneId}) is niet ingediend. Als dit doorloopt tot de deadline, valt de zaak in **fabel** — categorie omitted.`,
      )
    }
  }

  // Omissions: retainer not activated even though an option was authored for it.
  const graph = session.graph
  if (graph) {
    // Find any decision option in the round that carries the retainer capabilityFlag.
    const roundNodeId = graph.nodes.find(
      n => n.type === "round" && (n.data as { title?: string }).title
        && session.scenario.rounds[roundIndex]?.title === (n.data as { title?: string }).title,
    )?.id
    const decisionNodesForRound: DecisionNodeData[] = []
    if (roundNodeId) {
      for (const e of graph.edges) {
        if (e.type !== "sequence" || e.source !== roundNodeId) continue
        const child = graph.nodes.find(n => n.id === e.target)
        if (child?.type === "decision") decisionNodesForRound.push(child.data as DecisionNodeData)
      }
    }
    const retainerOptionInRound = decisionNodesForRound.some(dd =>
      dd.options.some(o => o.capabilityFlag === RETAINER_ACTIVATED_FLAG),
    )
    const retainerActivated = !!session.flags?.[RETAINER_ACTIVATED_FLAG] || !!session.retainerActivation
    if (retainerOptionInRound && !retainerActivated) {
      omissions.push(
        "De IR-retainer is niet geactiveerd. Forensische ondersteuning die pas beschikbaar zou zijn na activatie blijft dicht.",
      )
    }
  }

  // Omissions: expected (participant, role) tuples that did not submit.
  const expected = expectedRoleTuplesForRound(session, roundIndex)
  for (const t of expected) {
    const key = `${t.participantId}::${t.role}`
    if (submittedTuples.has(key)) continue
    const roleLabel = ROLE_META[t.role]?.label ?? t.role
    omissions.push(
      `**${t.participantName}** heeft **${roleLabel}**-beslissing niet ingediend — dit valt in de scoring als «geen keuze» (default fallback vector).`,
    )
  }

  const facilitatorInterventions = facilitatorInterventionLines(session, roundIndex)

  return {
    round: roundIndex + 1,
    lines,
    omissions,
    ...(facilitatorInterventions.length > 0 ? { facilitatorInterventions } : {}),
  }
}
