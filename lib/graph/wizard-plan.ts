import type {
  DecisionNodeData,
  InjectNodeData,
  OutcomeNodeData,
  RoundNodeData,
  ScenarioGraph,
  SpecialNodeData,
} from "./types"
import type {
  AssessmentDimensionKey,
  BobPhase,
  InjectChannel,
  InjectReliability,
  InjectType,
  Role,
  RoleAction,
  ScenarioType,
  SpecialType,
  Urgency,
} from "@/lib/types"

// The AI returns a "plan" (a compact, LLM-friendly shape).
// We convert it into a full ScenarioGraph with correct edges and coordinates.

export interface WizardPlanRoleAction {
  id: string
  label: string
  description: string
  allowedRoles: Role[]
  isRecommended?: boolean
  irPlanAligned: boolean
  consequence?: string
  scoreImpact?: number
  linkedDimension?: AssessmentDimensionKey
  lessonLearned?: string
  respondsToMisleading?: boolean
}

export interface WizardPlanInject {
  type: InjectType
  channel?: InjectChannel
  title: string
  content: string
  urgency: Urgency
  senderName?: string
  senderHandle?: string
  timestamp?: string
  targetTeam?: "all" | "crisis_management" | "technical_it"
  targetRoles?: Role[]
  nis2Relevant?: boolean
  reliability?: InjectReliability
  deliverySeconds?: number
}

export interface WizardPlanRound {
  title: string
  situation: string
  timerMinutes?: number
  roleActions?: WizardPlanRoleAction[]
  injects?: WizardPlanInject[]
  discussionGoal?: string
  keyQuestions?: string[]
  hints?: string[]
  expectedDecisions?: string[]
  redFlags?: string[]
  bobPhase?: BobPhase
  openingPrompts?: string[]
  facilitatorPerspective?: string
}

export interface WizardPlanDecision {
  afterRoundIndex: number
  prompt: string
  measuredBy?: "participant_choice" | "facilitator_trigger"
  options: Array<{
    label: string
    linksToRoleActionId?: string
    leadsTo: string // "round:<index>" | "outcome:<key>" | "special:<key>"
  }>
}

export interface WizardPlanSpecial {
  key: string
  afterRoundIndex: number
  type: SpecialType
  assignedRole?: Role
  goodLeadsTo: string
  badLeadsTo: string
}

export interface WizardPlanOutcome {
  key: string
  label: string
  narrative: string
  scoreImpact?: number
  linkedDimension?: AssessmentDimensionKey
  lessonLearned?: string
}

export interface WizardPlan {
  name: string
  scenarioType: ScenarioType
  rounds: WizardPlanRound[]
  decisions?: WizardPlanDecision[]
  specials?: WizardPlanSpecial[]
  outcomes: WizardPlanOutcome[]
  irRetainerName?: string
  irPlaybook?: string
}

function nid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}`
}

function resolveTarget(
  ref: string,
  roundNodeIds: string[],
  outcomeIdByKey: Map<string, string>,
  specialIdByKey: Map<string, string>,
): string | null {
  if (ref.startsWith("round:")) {
    const idx = parseInt(ref.slice(6), 10)
    return roundNodeIds[idx] ?? null
  }
  if (ref.startsWith("outcome:")) return outcomeIdByKey.get(ref.slice(8)) ?? null
  if (ref.startsWith("special:")) return specialIdByKey.get(ref.slice(8)) ?? null
  return null
}

export function planToGraph(plan: WizardPlan): ScenarioGraph {
  const now = Date.now()
  const startId = nid("start")

  const roundNodeIds = plan.rounds.map(() => nid("round"))
  const outcomeIdByKey = new Map<string, string>()
  const specialIdByKey = new Map<string, string>()

  for (const o of plan.outcomes) outcomeIdByKey.set(o.key, nid("out"))
  for (const s of (plan.specials ?? [])) specialIdByKey.set(s.key, nid("spec"))

  const nodes: ScenarioGraph["nodes"] = []
  const edges: ScenarioGraph["edges"] = []

  // Layout constants
  const startX = 40, roundX0 = 260, roundStep = 300
  const rowY = 200
  const injectY = 430

  nodes.push({ id: startId, type: "start", position: { x: startX, y: rowY + 40 }, data: { kind: "start" } })

  plan.rounds.forEach((round, idx) => {
    const rid = roundNodeIds[idx]
    const roleActions: RoleAction[] = (round.roleActions ?? []).map(a => ({
      id: a.id || nid("act"),
      label: a.label,
      description: a.description,
      allowedRoles: a.allowedRoles ?? [],
      isRecommended: a.isRecommended ?? false,
      irPlanAligned: a.irPlanAligned ?? true,
      consequence: a.consequence,
      scoreImpact: a.scoreImpact,
      linkedDimension: a.linkedDimension,
      lessonLearned: a.lessonLearned,
      respondsToMisleading: a.respondsToMisleading,
    }))
    const roundData: RoundNodeData = {
      kind: "round",
      title: round.title,
      situation_update: round.situation,
      timerMinutes: round.timerMinutes ?? 15,
      roleActions,
      bobPhase: round.bobPhase,
      openingPrompts: round.openingPrompts,
      facilitatorPerspective: round.facilitatorPerspective,
      facilitatorNotes: {
        discussionGoal: round.discussionGoal ?? "",
        keyQuestions: round.keyQuestions ?? [],
        hints: round.hints ?? [],
        expectedDecisions: round.expectedDecisions ?? [],
        redFlags: round.redFlags ?? [],
      },
    }
    nodes.push({
      id: rid,
      type: "round",
      position: { x: roundX0 + idx * roundStep, y: rowY },
      data: roundData,
    })

    // Injects hang below
    ;(round.injects ?? []).forEach((inj, ii) => {
      const injectId = nid("inj")
      const data: InjectNodeData = {
        kind: "inject",
        type: inj.type,
        channel: inj.channel,
        title: inj.title,
        content: inj.content,
        urgency: inj.urgency,
        senderName: inj.senderName,
        senderHandle: inj.senderHandle,
        timestamp: inj.timestamp,
        targetTeam: inj.targetTeam,
        targetRoles: inj.targetRoles,
        nis2Relevant: inj.nis2Relevant,
        reliability: inj.reliability,
        deliverySeconds: inj.deliverySeconds,
      }
      nodes.push({
        id: injectId,
        type: "inject",
        position: { x: roundX0 + idx * roundStep + ii * 30, y: injectY + ii * 30 },
        data,
      })
      edges.push({ id: nid("e"), source: rid, target: injectId, type: "inject" })
    })
  })

  // Outcomes — place them in a stack on the right
  const outcomeXBase = roundX0 + plan.rounds.length * roundStep + 100
  plan.outcomes.forEach((o, i) => {
    const oid = outcomeIdByKey.get(o.key)!
    const data: OutcomeNodeData = {
      kind: "outcome",
      key: o.key,
      label: o.label,
      narrative: o.narrative,
      scoreImpact: o.scoreImpact,
      linkedDimension: o.linkedDimension,
      lessonLearned: o.lessonLearned,
    }
    nodes.push({
      id: oid,
      type: "outcome",
      position: { x: outcomeXBase, y: 60 + i * 140 },
      data,
    })
  })

  // Specials
  ;(plan.specials ?? []).forEach((sp, i) => {
    const sid = specialIdByKey.get(sp.key)!
    const data: SpecialNodeData = {
      kind: "special",
      type: sp.type,
      assignedRole: sp.assignedRole,
      thresholds: [
        { id: "bad", label: "Slecht (< 0)", predicate: { op: "<", value: 0 } },
        { id: "good", label: "Goed (>= 0)", predicate: { op: ">=", value: 0 } },
      ],
    }
    const anchorRound = sp.afterRoundIndex
    const x = roundX0 + (anchorRound + 1) * roundStep - 50
    nodes.push({
      id: sid,
      type: "special",
      position: { x, y: rowY - 40 + i * 220 },
      data,
    })
    // Connect the anchor round to the special
    if (roundNodeIds[anchorRound]) {
      edges.push({ id: nid("e"), source: roundNodeIds[anchorRound], target: sid, type: "sequence" })
    }
    // Threshold edges
    const goodTarget = resolveTarget(sp.goodLeadsTo, roundNodeIds, outcomeIdByKey, specialIdByKey)
    const badTarget = resolveTarget(sp.badLeadsTo, roundNodeIds, outcomeIdByKey, specialIdByKey)
    if (goodTarget) edges.push({ id: nid("e"), source: sid, target: goodTarget, sourceHandle: "good", type: "branch", label: "Goed" })
    if (badTarget) edges.push({ id: nid("e"), source: sid, target: badTarget, sourceHandle: "bad", type: "branch", label: "Slecht" })
  })

  // Sequence: connect Start → Round[0]
  if (roundNodeIds.length > 0) {
    edges.push({ id: nid("e"), source: startId, target: roundNodeIds[0], type: "sequence" })
  }

  // Handle decisions BETWEEN rounds and sequential Round→Round connections
  const decisionsByAfter = new Map<number, WizardPlanDecision>()
  for (const d of (plan.decisions ?? [])) decisionsByAfter.set(d.afterRoundIndex, d)

  // A special is attached to a round via a sequence edge; the next round should come from the special's targets.
  // But we've already wired specials. For rounds without a special or decision after them, sequential linking.
  const specialByAfter = new Map<number, WizardPlanSpecial>()
  for (const s of (plan.specials ?? [])) specialByAfter.set(s.afterRoundIndex, s)

  for (let i = 0; i < plan.rounds.length; i++) {
    const decision = decisionsByAfter.get(i)
    const special = specialByAfter.get(i)
    if (decision) {
      // Create a decision node between round i and next round(s)
      const did = nid("dec")
      const options = decision.options.map(opt => ({
        id: nid("opt"),
        label: opt.label,
        roleActionId: opt.linksToRoleActionId,
      }))
      const data: DecisionNodeData = {
        kind: "decision",
        prompt: decision.prompt,
        measuredBy: decision.measuredBy ?? "participant_choice",
        options,
      }
      nodes.push({
        id: did,
        type: "decision",
        position: { x: roundX0 + (i + 1) * roundStep - 60, y: rowY - 20 },
        data,
      })
      edges.push({ id: nid("e"), source: roundNodeIds[i], target: did, type: "sequence" })
      decision.options.forEach((opt, oi) => {
        const target = resolveTarget(opt.leadsTo, roundNodeIds, outcomeIdByKey, specialIdByKey)
        if (target) {
          edges.push({
            id: nid("e"),
            source: did,
            target,
            sourceHandle: options[oi].id,
            type: "branch",
            label: opt.label.slice(0, 20),
          })
        }
      })
    } else if (!special && roundNodeIds[i + 1]) {
      edges.push({ id: nid("e"), source: roundNodeIds[i], target: roundNodeIds[i + 1], type: "sequence" })
    }
  }

  return {
    id: nid("graph"),
    name: plan.name,
    version: 1,
    scenarioType: plan.scenarioType,
    createdAt: now,
    updatedAt: now,
    nodes,
    edges,
    irRetainerName: plan.irRetainerName,
    irPlaybook: plan.irPlaybook,
  }
}
