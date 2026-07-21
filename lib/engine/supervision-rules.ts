import type { PseudoSessionState, SupervisionArea, SupervisionAreaResult, SupervisionEvidence, SupervisionScore } from "./supervision"
import { SUPERVISION_AREAS, scoreAreaFromEvidence, collectDecisionEvidence, collectInjectEvidence, collectNotificationEvidence } from "./supervision"

export type AreaScorer = (
  session: PseudoSessionState,
  evidence: SupervisionEvidence[],
) => { score: SupervisionScore; rationale: string }

export function makeAreaScorer(area: SupervisionArea): AreaScorer {
  return (session, evidence) => {
    const decisions = collectDecisionEvidence(session)
    return scoreAreaFromEvidence(area, session, evidence, decisions)
  }
}

export const AREA_SCORERS: Record<SupervisionArea, AreaScorer> = Object.fromEntries(
  SUPERVISION_AREAS.map(a => [a.id, makeAreaScorer(a.id)]),
) as Record<SupervisionArea, AreaScorer>

export function assembleAreaResults(session: PseudoSessionState): SupervisionAreaResult[] {
  const decisionItems = collectDecisionEvidence(session)
  const injectEvidence = collectInjectEvidence(session)
  const notificationEvidence = collectNotificationEvidence(session)
  const timeline: SupervisionEvidence[] = [
    ...decisionItems.map(d => d.evidence),
    ...injectEvidence,
    ...notificationEvidence,
  ].sort((a, b) => a.timestamp - b.timestamp)

  return SUPERVISION_AREAS.map(meta => {
    const areaEvidence = timeline.filter(e => e.supervisionArea === meta.id)
    const { score, rationale } = scoreAreaFromEvidence(meta.id, session, areaEvidence, decisionItems)
    return { area: meta.id, score, rationale, evidence: areaEvidence }
  })
}
