import type {
  FactCheckEntry,
  GovernanceFlag,
  RegulatoryObligationState,
  RegulatoryRegime,
  Role,
  SessionState,
  SubmittedDecision,
  SupervisionReportEdits,
} from "@/lib/types"
import type { DecisionNodeData, GraphNode, InjectNodeData, ScenarioGraph } from "@/lib/graph/types"
import { RETAINER_ACTIVATED_FLAG } from "@/lib/graph/types"

export type SupervisionArea =
  | 'detection_classification'
  | 'crisis_activation'
  | 'roles_mandates'
  | 'ir_retainer'
  | 'technical_response'
  | 'logging_evidence'
  | 'notification_duty'
  | 'business_continuity'
  | 'recovery'
  | 'crisis_communication'
  | 'emergency_communication'
  | 'suppliers_chain'
  | 'board_decision_making'
  | 'aftercare'

export interface SupervisionAreaMeta {
  id: SupervisionArea
  numberLabel: string
  label: string
  question: string
  evidenceExamples: string[]
}

export const SUPERVISION_AREAS: SupervisionAreaMeta[] = [
  {
    id: 'detection_classification',
    numberLabel: '1',
    label: 'Detectie en classificatie',
    question: 'Herkent de organisatie het incident tijdig en classificeert zij het correct als (aanzienlijk) incident onder Cbw?',
    evidenceExamples: [
      'Detectiemoment met tijdstip (SIEM/EDR/melding)',
      'Classificatiebesluit en onderliggende criteria',
      'Escalatiepad van SOC naar crisisteam',
    ],
  },
  {
    id: 'crisis_activation',
    numberLabel: '2',
    label: 'Crisisactivatie',
    question: 'Wordt het crisisteam onverwijld geactiveerd volgens vastgestelde criteria?',
    evidenceExamples: [
      'Activatietijdstip crisisteam',
      'Gebruikte activatiecriteria',
      'Bereikbaarheidsketen en OOH-oncall',
    ],
  },
  {
    id: 'roles_mandates',
    numberLabel: '3',
    label: 'Rollen en mandaten',
    question: 'Zijn rollen, plaatsvervangers en mandaten vastgelegd en werkbaar tijdens het incident?',
    evidenceExamples: [
      'Rollenmatrix crisisteam',
      'Vervangingsregeling CEO/CFO/CISO',
      'Delegatiebesluiten tijdens incident',
    ],
  },
  {
    id: 'ir_retainer',
    numberLabel: '4',
    label: 'IR-retainer',
    question: 'Kan de organisatie een externe IR-partij tijdig activeren en effectief informatie overdragen?',
    evidenceExamples: [
      'Activatietijdstip retainer',
      'Geautoriseerde activator (rol en naam)',
      'Overdrachtchecklist compleet (assets, netwerk, logs)',
    ],
  },
  {
    id: 'technical_response',
    numberLabel: '5',
    label: 'Technische respons',
    question: 'Voert de organisatie containment, eradicatie en verificatie beheerst uit?',
    evidenceExamples: [
      'Isolatiebesluit met scope',
      'Eradicatiestappen en verificatie',
      'Rebuild-plan met acceptatiecriteria',
    ],
  },
  {
    id: 'logging_evidence',
    numberLabel: '6',
    label: 'Logging en bewijs',
    question: 'Worden logs en artefacten veiliggesteld en gecontroleerd overgedragen aan forensics?',
    evidenceExamples: [
      'Chain of custody van logs',
      'Bewaartermijnen en integriteit',
      'Handoff naar forensisch partner',
    ],
  },
  {
    id: 'notification_duty',
    numberLabel: '7',
    label: 'Meldplicht',
    question: 'Voldoet de organisatie aan de wettelijke meldingsverplichtingen (Cbw 24u/72u/1 maand en AVG 72u)?',
    evidenceExamples: [
      'Tijdstip vroegtijdige waarschuwing NCSC (≤24u)',
      'Melding met initiële beoordeling (≤72u)',
      'AP-melding bij (vermoeden) datalek (≤72u)',
      'Eindverslag / voortgangsverslag',
    ],
  },
  {
    id: 'business_continuity',
    numberLabel: '8',
    label: 'Bedrijfscontinuïteit',
    question: 'Werkt het BCP voor de getroffen kritieke processen en klantcontracten?',
    evidenceExamples: [
      'BIA en RTO/RPO doelstellingen',
      'Activering noodprocessen',
      'Klant-SLA-communicatie',
    ],
  },
  {
    id: 'recovery',
    numberLabel: '9',
    label: 'Herstel',
    question: 'Vindt herstel gecontroleerd plaats met verifieerbare acceptatiecriteria?',
    evidenceExamples: [
      'Herstelvolgorde en criteria',
      'Sign-off IR-partij vóór productie',
      'Backup-integriteit gecontroleerd',
    ],
  },
  {
    id: 'crisis_communication',
    numberLabel: '10',
    label: 'Crisiscommunicatie',
    question: 'Is externe en interne communicatie tijdig, consistent en juridisch afgestemd?',
    evidenceExamples: [
      'Persverklaring / Q&A',
      'Klantcommunicatie',
      'Intern personeelsbericht',
    ],
  },
  {
    id: 'emergency_communication',
    numberLabel: '11',
    label: 'Noodcommunicatie',
    question: 'Is er een uitwijkkanaal voor communicatie als primaire systemen uitvallen?',
    evidenceExamples: [
      'Out-of-band-kanaal geactiveerd',
      'Contactlijst offline beschikbaar',
      'Test noodcommunicatie',
    ],
  },
  {
    id: 'suppliers_chain',
    numberLabel: '12',
    label: 'Leveranciers en keten',
    question: 'Zijn ketenpartners tijdig betrokken en aangestuurd conform contract?',
    evidenceExamples: [
      'Notificatie aan leveranciers',
      'Coördinatie met MSP/cloud',
      'SLA-invocatie',
    ],
  },
  {
    id: 'board_decision_making',
    numberLabel: '13',
    label: 'Bestuurlijke besluitvorming',
    question: 'Neemt het bestuur tijdig en gedocumenteerd de vereiste besluiten?',
    evidenceExamples: [
      'Bestuursbesluit met tijdstip',
      'Financiële en juridische afwegingen',
      'Board-brief / notulen',
    ],
  },
  {
    id: 'aftercare',
    numberLabel: '14',
    label: 'Nazorg',
    question: 'Vindt er structurele nazorg plaats met lessons learned, verbeteracties en hertest?',
    evidenceExamples: [
      'Debrief-verslag',
      'Lessons learned register',
      'Verbeterplan met eigenaars en deadlines',
      'Hertest / opvolging',
    ],
  },
]

export type SupervisionScore = 0 | 1 | 2 | 3

export interface SupervisionEvidence {
  kind: 'decision' | 'inject_handled' | 'notification_draft' | 'timeline_event' | 'observation'
  timestamp: number
  summary: string
  relatedIds?: string[]
  supervisionArea?: SupervisionArea
}

export interface SupervisionAreaResult {
  area: SupervisionArea
  score: SupervisionScore
  rationale: string
  evidence: SupervisionEvidence[]
}

export interface TraceabilityChain {
  id: string
  risk: string
  measure: string
  testGoal: string
  observation: string
  gap: string
  correctiveAction: string
  owner: string
  deadline: string
  proofOfClosure?: string
  retest?: string
  priority: 'critical' | 'high' | 'medium' | 'low'
  status: 'open' | 'in_progress' | 'blocked' | 'closed'
}

export interface LessonLearned {
  id: string
  finding: string
  evidence: string
  impact: string
  cause: string
  correctiveAction: string
  owner: string
  deadline: string
  priority: 'critical' | 'high' | 'medium' | 'low'
  status: 'open' | 'in_progress' | 'blocked' | 'closed'
  proofOfClosure?: string
  retest?: string
}

export interface SupervisionReport {
  sessionId: string
  scenarioTitle: string
  organizationName?: string
  facilitatorName?: string
  participants: Array<{ id: string; name: string; role?: Role }>
  timeline: SupervisionEvidence[]
  areas: SupervisionAreaResult[]
  overallScore: number
  lessonsLearned: LessonLearned[]
  traceability: TraceabilityChain[]
  generatedAt: number
}

/** Shared shape between real sessions and design-time previews. */
export interface PseudoSessionState {
  scenario?: SessionState['scenario']
  submittedDecisions?: SubmittedDecision[]
  factChecks?: FactCheckEntry[]
  regulatoryRegime?: RegulatoryRegime
  regulatoryObligations?: RegulatoryObligationState[]
  incidentDetectedAt?: number
  flags?: Record<string, boolean>
  retainerActivation?: SessionState['retainerActivation']
  timeline?: SessionState['timeline']
  governanceFlags?: GovernanceFlag[]
  participants?: SessionState['participants']
  graph?: ScenarioGraph
  config?: SessionState['config']
}

const AREA_ORDER: SupervisionArea[] = SUPERVISION_AREAS.map(a => a.id)

export function areaMeta(area: SupervisionArea): SupervisionAreaMeta {
  return SUPERVISION_AREAS.find(a => a.id === area) ?? SUPERVISION_AREAS[0]
}

function timestampFromIso(iso: string | undefined, fallback: number): number {
  if (!iso) return fallback
  const t = Date.parse(iso)
  return isNaN(t) ? fallback : t
}

function decisionOptimalityFromQuality(qualityRank: string | undefined): 'optimal' | 'neutral' | 'bad' {
  if (qualityRank === 'best' || qualityRank === 'good') return 'optimal'
  if (qualityRank === 'poor' || qualityRank === 'wrong') return 'bad'
  return 'neutral'
}

interface DecisionEvidenceItem {
  area: SupervisionArea
  optimality: 'optimal' | 'neutral' | 'bad'
  evidence: SupervisionEvidence
}

export function collectDecisionEvidence(session: PseudoSessionState): DecisionEvidenceItem[] {
  const out: DecisionEvidenceItem[] = []
  const graph = session.graph
  const decisions = session.submittedDecisions ?? []
  const nodeById = new Map<string, GraphNode>((graph?.nodes ?? []).map(n => [n.id, n]))
  const startedAt = session.incidentDetectedAt ?? 0

  for (const d of decisions) {
    const roundIndex = d.roundIndex
    const scenarioRound = session.scenario?.rounds?.[roundIndex]
    const action = scenarioRound?.roleActions?.find(a => a.id === d.actionId)
    const areasFromAction = action?.supervisionAreas ?? []
    const ts = timestampFromIso(d.submittedAt, startedAt)
    const summary = `Besluit R${roundIndex + 1}: ${d.actionLabel} — door ${d.participantName}`
    const optimality = decisionOptimalityFromQuality(action?.qualityRank)
    const areas = areasFromAction.length > 0 ? areasFromAction : []
    for (const area of areas) {
      out.push({
        area,
        optimality,
        evidence: {
          kind: 'decision',
          timestamp: ts,
          summary,
          relatedIds: [d.actionId],
          supervisionArea: area,
        },
      })
    }
  }

  if (graph) {
    for (const node of graph.nodes) {
      if (node.type !== 'decision') continue
      const dd = node.data as DecisionNodeData
      const areas = dd.supervisionAreas ?? []
      if (areas.length === 0) continue
      // graph-level decisions map onto option scores; approximated by inspecting flags/branch log later.
    }
  }

  return out
}

export function collectInjectEvidence(session: PseudoSessionState): SupervisionEvidence[] {
  const out: SupervisionEvidence[] = []
  const checks = session.factChecks ?? []
  const rounds = session.scenario?.rounds ?? []
  for (let ri = 0; ri < rounds.length; ri++) {
    const r = rounds[ri]
    for (const inj of r.injects) {
      const areas = inj.supervisionAreas ?? []
      if (areas.length === 0) continue
      const check = checks.find(c => c.injectId === inj.id)
      if (!check) continue
      const truth = inj.reliability
      const correct = truth ? check.tag === truth : undefined
      const label = correct === true ? 'correct getagd' : correct === false ? 'onjuist getagd' : 'getagd'
      for (const area of areas) {
        out.push({
          kind: 'inject_handled',
          timestamp: check.taggedAt,
          summary: `Inject "${inj.title}" ${label}`,
          relatedIds: [inj.id],
          supervisionArea: area,
        })
      }
    }
  }
  return out
}

export function collectNotificationEvidence(session: PseudoSessionState): SupervisionEvidence[] {
  const out: SupervisionEvidence[] = []
  const regime = session.regulatoryRegime
  if (!regime) return out
  for (const o of session.regulatoryObligations ?? []) {
    if (o.status !== 'filed') continue
    const ms = regime.milestones.find(m => m.id === o.milestoneId)
    const label = ms?.label ?? o.milestoneId
    const anchor = session.incidentDetectedAt ?? 0
    const ts = anchor + (o.filedAtHour ?? 0) * 60 * 60 * 1000
    out.push({
      kind: 'notification_draft',
      timestamp: ts,
      summary: `${label} ingediend`,
      relatedIds: [`${o.regimeId}:${o.milestoneId}`],
      supervisionArea: 'notification_duty',
    })
  }
  return out
}

export interface NotificationScoreInputs {
  submitted: boolean
  submittedBeforeDeadline: boolean
}

export function scoreNotificationBundle(inputs: NotificationScoreInputs[]): SupervisionScore {
  if (inputs.length === 0) return 0
  const anySubmitted = inputs.some(i => i.submitted)
  if (!anySubmitted) return 0
  const allSubmitted = inputs.every(i => i.submitted)
  const allOnTime = inputs.every(i => i.submitted && i.submittedBeforeDeadline)
  if (allSubmitted && allOnTime) return 3
  if (allSubmitted) return 2
  return 1
}

export interface RetainerScoreInputs {
  activated: boolean
  activatedAtRound?: number   // 1-based
}

// Phase 3 — timing-driven grading. Round-1/-2 activation = full credit;
// later activation = partial credit; never activated = 0.
export function scoreRetainer(inputs: RetainerScoreInputs): SupervisionScore {
  if (!inputs.activated) return 0
  const round = inputs.activatedAtRound ?? Number.POSITIVE_INFINITY
  if (round <= 2) return 3
  if (round <= 4) return 2
  return 1
}

export interface CoverageEntry {
  area: SupervisionArea
  meta: SupervisionAreaMeta
  touchedByNodes: string[]
  touchedByActions: string[]
  coverageLevel: 'none' | 'thin' | 'good'
}

export function computeCoverage(graph: ScenarioGraph): CoverageEntry[] {
  const nodeMap = new Map<SupervisionArea, Set<string>>()
  const actionMap = new Map<SupervisionArea, Set<string>>()
  for (const area of AREA_ORDER) {
    nodeMap.set(area, new Set())
    actionMap.set(area, new Set())
  }
  for (const node of graph.nodes) {
    const d = node.data as { supervisionAreas?: SupervisionArea[] } & { roleActions?: { id: string; supervisionAreas?: SupervisionArea[] }[] }
    for (const area of d.supervisionAreas ?? []) {
      nodeMap.get(area)?.add(node.id)
    }
    for (const action of d.roleActions ?? []) {
      for (const area of action.supervisionAreas ?? []) {
        actionMap.get(area)?.add(action.id)
      }
    }
  }
  return AREA_ORDER.map(area => {
    const nodes = Array.from(nodeMap.get(area) ?? [])
    const actions = Array.from(actionMap.get(area) ?? [])
    const count = nodes.length + actions.length
    const level: CoverageEntry['coverageLevel'] = count === 0 ? 'none' : count === 1 ? 'thin' : 'good'
    return { area, meta: areaMeta(area), touchedByNodes: nodes, touchedByActions: actions, coverageLevel: level }
  })
}

export function scoreAreaFromEvidence(
  area: SupervisionArea,
  session: PseudoSessionState,
  evidence: SupervisionEvidence[],
  decisionItems: DecisionEvidenceItem[],
): { score: SupervisionScore; rationale: string } {
  const forArea = decisionItems.filter(d => d.area === area)
  const injectItems = evidence.filter(e => e.kind === 'inject_handled')
  const startedAt = session.incidentDetectedAt ?? 0
  const regime = session.regulatoryRegime

  if (area === 'notification_duty') {
    if (!regime) {
      return { score: 0, rationale: 'Geen regulatory regime actief in deze sessie.' }
    }
    const list = session.regulatoryObligations ?? []
    const inputs: NotificationScoreInputs[] = regime.milestones.map(ms => {
      const o = list.find(x => x.milestoneId === ms.id)
      if (!o) return { submitted: false, submittedBeforeDeadline: false }
      const submitted = o.status === 'filed'
      const filedHour = o.filedAtHour ?? Number.POSITIVE_INFINITY
      const deadlineHour = o.openedAtHour + ms.deadlineHours
      const submittedBeforeDeadline = submitted && filedHour <= deadlineHour
      return { submitted, submittedBeforeDeadline }
    })
    const score = scoreNotificationBundle(inputs)
    const parts: string[] = []
    regime.milestones.forEach((ms, i) => {
      const s = inputs[i]
      if (!s.submitted) parts.push(`${ms.label}: niet ingediend.`)
      else if (!s.submittedBeforeDeadline) parts.push(`${ms.label}: ingediend na wettelijke deadline.`)
      else parts.push(`${ms.label}: op tijd ingediend.`)
    })
    return { score, rationale: parts.join(' ') || 'Geen meldplicht-evidence beschikbaar.' }
  }

  if (area === 'ir_retainer') {
    const ra = session.retainerActivation
    const activated = !!ra?.activatedAtTs || (session.flags?.[RETAINER_ACTIVATED_FLAG] === true)
    const score = scoreRetainer({ activated, activatedAtRound: ra?.activatedAtRound })
    const parts: string[] = []
    if (!activated) parts.push('IR-retainer niet geactiveerd.')
    else if (ra?.activatedAtRound !== undefined) {
      if (ra.activatedAtRound <= 2) parts.push(`IR-retainer vroeg geactiveerd (ronde ${ra.activatedAtRound}).`)
      else if (ra.activatedAtRound <= 4) parts.push(`IR-retainer geactiveerd in ronde ${ra.activatedAtRound} — deel van de forensische kansen mogelijk verloren.`)
      else parts.push(`IR-retainer laat geactiveerd (ronde ${ra.activatedAtRound}).`)
    } else {
      parts.push('IR-retainer geactiveerd (timing onbekend).')
    }
    return { score, rationale: parts.join(' ') }
  }

  if (area === 'detection_classification') {
    if (forArea.some(f => f.optimality === 'optimal')) {
      return { score: 3, rationale: 'Correcte classificatie als (aanzienlijk) incident, tijdig genomen.' }
    }
    if (forArea.some(f => f.optimality !== 'bad')) {
      return { score: 2, rationale: 'Classificatie genomen maar niet volledig conform Cbw-criteria.' }
    }
    if (forArea.length > 0) {
      return { score: 1, rationale: 'Alleen technisch incident gemarkeerd, geen crisis-classificatie.' }
    }
    return { score: 0, rationale: 'Geen classificatiebesluit vastgelegd.' }
  }

  // Fallback rule
  const anyOptimal = forArea.some(d => d.optimality === 'optimal')
  const anyBad = forArea.some(d => d.optimality === 'bad')
  const anyTouch = forArea.length > 0 || injectItems.some(i => i.supervisionArea === area)
  if (forArea.length > 0 && anyOptimal && !anyBad) {
    return { score: 3, rationale: 'Alle geregistreerde besluiten waren conform.' }
  }
  if (forArea.length > 0 && anyOptimal) {
    return { score: 2, rationale: 'Gemengd beeld: enkele juiste besluiten, één of meer met tekortkoming.' }
  }
  if (anyTouch) {
    return { score: 1, rationale: 'Onderwerp is geraakt maar zonder aantoonbaar juiste uitvoering.' }
  }
  return { score: 0, rationale: 'Geen bewijs verzameld voor dit testgebied.' }
}

export function seedLessonsFromResults(
  results: SupervisionAreaResult[],
  session: PseudoSessionState,
  edits?: SupervisionReportEdits,
): LessonLearned[] {
  const out: LessonLearned[] = []
  for (const r of results) {
    if (r.score >= 3) continue
    const meta = areaMeta(r.area)
    const id = `lesson_${r.area}`
    const editable = edits?.lessonEdits?.[id] ?? {}
    const firstEvidence = r.evidence[0]
    const impact = r.score === 0 ? 'Toezichthouder krijgt geen bewijs op dit testgebied.' : 'Testgebied niet volledig aangetoond; risico op tekortkoming in Cbw-verantwoording.'
    out.push({
      id,
      finding: `${meta.numberLabel}. ${meta.label}: ${r.rationale}`,
      evidence: firstEvidence ? `${new Date(firstEvidence.timestamp).toISOString()} — ${firstEvidence.summary}` : 'Geen concreet bewijs beschikbaar in de sessie.',
      impact,
      cause: meta.question,
      correctiveAction: editable.correctiveAction ?? '',
      owner: editable.owner ?? '',
      deadline: editable.deadline ?? '',
      priority: editable.priority ?? (r.score === 0 ? 'high' : 'medium'),
      status: editable.status ?? 'open',
      proofOfClosure: editable.proofOfClosure,
      retest: editable.retest,
    })
  }
  return out
}

export function seedTraceabilityFromResults(
  results: SupervisionAreaResult[],
  session: PseudoSessionState,
  edits?: SupervisionReportEdits,
): TraceabilityChain[] {
  const out: TraceabilityChain[] = []
  for (const r of results) {
    if (r.score >= 3) continue
    const meta = areaMeta(r.area)
    const id = `chain_${r.area}`
    const editable = edits?.chainEdits?.[id] ?? {}
    out.push({
      id,
      risk: `Ontbrekend bewijs op testgebied ${meta.numberLabel}. ${meta.label}`,
      measure: `Beheersmaatregel voor ${meta.label.toLowerCase()}`,
      testGoal: meta.question,
      observation: r.rationale,
      gap: r.score === 0 ? 'Geen enkele evidence verzameld.' : 'Uitvoering aanwezig maar niet effectief aantoonbaar.',
      correctiveAction: editable.correctiveAction ?? '',
      owner: editable.owner ?? '',
      deadline: editable.deadline ?? '',
      proofOfClosure: editable.proofOfClosure,
      retest: editable.retest,
      priority: editable.priority ?? (r.score === 0 ? 'high' : 'medium'),
      status: editable.status ?? 'open',
    })
  }
  return out
}

export function computeSupervisionReport(session: SessionState): SupervisionReport {
  const decisionItems = collectDecisionEvidence(session)
  const injectEvidence = collectInjectEvidence(session)
  const notificationEvidence = collectNotificationEvidence(session)
  const timeline: SupervisionEvidence[] = [
    ...decisionItems.map(d => d.evidence),
    ...injectEvidence,
    ...notificationEvidence,
  ].sort((a, b) => a.timestamp - b.timestamp)

  const areas: SupervisionAreaResult[] = AREA_ORDER.map(area => {
    const areaEvidence = timeline.filter(e => e.supervisionArea === area)
    const { score, rationale } = scoreAreaFromEvidence(area, session, areaEvidence, decisionItems)
    return { area, score, rationale, evidence: areaEvidence }
  })

  const overallScore = Math.round((areas.reduce((s, a) => s + a.score, 0) / areas.length) * 10) / 10
  const edits = session.supervisionReportEdits

  return {
    sessionId: session.id,
    scenarioTitle: session.scenario.scenario_title,
    organizationName: undefined,
    facilitatorName: undefined,
    participants: session.participants.map(p => ({ id: p.id, name: p.name, role: p.role })),
    timeline,
    areas,
    overallScore,
    lessonsLearned: seedLessonsFromResults(areas, session, edits),
    traceability: seedTraceabilityFromResults(areas, session, edits),
    generatedAt: Date.now(),
  }
}

export function previewSupervisionReport(graph: ScenarioGraph, outcomeId: string): SupervisionReport {
  // Design-time synthesis: assume the participant took the path most likely to reach outcomeId.
  const outcomeNode = graph.nodes.find(n => n.id === outcomeId && n.type === 'outcome')
  const pseudo: PseudoSessionState = { graph }
  const timeline: SupervisionEvidence[] = []
  const decisionItems: DecisionEvidenceItem[] = []
  const startedAt = 0

  // Walk edges backwards from the outcome to gather predicted-taken decisions.
  const parentEdges = new Map<string, typeof graph.edges>()
  for (const e of graph.edges) {
    const list = parentEdges.get(e.target) ?? []
    list.push(e)
    parentEdges.set(e.target, list)
  }
  const visited = new Set<string>()
  const stack: string[] = outcomeNode ? [outcomeNode.id] : []
  while (stack.length) {
    const id = stack.pop()!
    if (visited.has(id)) continue
    visited.add(id)
    const node = graph.nodes.find(n => n.id === id)
    if (!node) continue
    if (node.type === 'decision') {
      const dd = node.data as DecisionNodeData
      const chosenOptionId = graph.edges.find(e => e.source === node.id && visited.has(e.target))?.sourceHandle
      const chosen = dd.options.find(o => o.id === chosenOptionId)
      const optimality = decisionOptimalityFromQuality(chosen?.qualityRank)
      for (const area of dd.supervisionAreas ?? []) {
        const ev: SupervisionEvidence = {
          kind: 'decision',
          timestamp: startedAt,
          summary: `Verwachte keuze bij "${dd.prompt.slice(0, 60)}": ${chosen?.label ?? '—'}`,
          relatedIds: chosen ? [chosen.id] : [],
          supervisionArea: area,
        }
        decisionItems.push({ area, optimality, evidence: ev })
        timeline.push(ev)
      }
    }
    for (const parent of parentEdges.get(id) ?? []) {
      stack.push(parent.source)
    }
  }

  const areas: SupervisionAreaResult[] = AREA_ORDER.map(area => {
    const areaEvidence = timeline.filter(e => e.supervisionArea === area)
    const { score, rationale } = scoreAreaFromEvidence(area, pseudo, areaEvidence, decisionItems)
    return { area, score, rationale, evidence: areaEvidence }
  })

  const overallScore = Math.round((areas.reduce((s, a) => s + a.score, 0) / areas.length) * 10) / 10
  return {
    sessionId: `preview_${outcomeId}`,
    scenarioTitle: graph.name,
    participants: [],
    timeline,
    areas,
    overallScore,
    lessonsLearned: seedLessonsFromResults(areas, pseudo),
    traceability: seedTraceabilityFromResults(areas, pseudo),
    generatedAt: Date.now(),
  }
}

