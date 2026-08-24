import type {
  DecisionNodeData,
  InjectNodeData,
  OutcomeNodeData,
  PremadeInject,
  RoleBriefing,
  RoundNodeData,
  ScenarioGraph,
  OutcomeVector,
} from "./types"
import { EYE_SECURITY_RETAINER, DEFAULT_FEATURES } from "./types"
import type {
  ChoiceQuality,
  InjectChannel,
  InjectReliability,
  InjectType,
  MeldingMoment,
  MeldingRecipient,
  Role,
  RoleAction,
  ScenarioType,
  Urgency,
} from "@/lib/types"
import { createSeededRng, type SeededRng } from "@/lib/wizard/seed"

// The AI returns a "plan" — a compact, LLM-friendly shape. planToGraph converts
// it to a full ScenarioGraph with correct edges, coordinates, and defaults.

export interface WizardPlanRoleAction {
  id: string
  label: string
  description: string
  allowedRoles: Role[]
  isRecommended?: boolean
  irPlanAligned: boolean
  consequence?: string
  qualityRank?: ChoiceQuality
  facilitatorCommentary?: string
  lessonLearned?: string
  respondsToMisleading?: boolean
}

export interface WizardPlanInject {
  id?: string      // author may reference this from meldingMoment.types[].triggersInjectId
  type: InjectType
  channel?: InjectChannel
  title: string
  content: string
  urgency: Urgency
  senderName?: string
  senderHandle?: string
  source?: string  // free-text source label (e.g. "RTV Oost — regionale redactie")
  timestamp?: string
  targetTeam?: "all" | "crisis_management" | "technical_it"
  targetRoles?: Role[]
  nis2Relevant?: boolean
  reliability?: InjectReliability
  deliverySeconds?: number
  // Phase 3 — capability-gated visibility. Inject hidden until session.flags[key]==true.
  requiresCapability?: string
  // Phase 2 — opens the initial regulatory obligation on the session when fired.
  triggersRegulatoryNotification?: boolean
  // Phase 9 — new fields exposed to the wizard so generated plans can express
  // classification (feit/aanname), setsUpDecisionNodeId (author link to
  // a decision), and facilitator-only notes.
  classification?: 'feit' | 'aanname'
  setsUpDecisionNodeId?: string   // author-id of a decision in same/prev round
  facilitatorNote?: string
}

export interface WizardPlanMeldingType {
  id: string
  label: string
  triggersInjectId?: string  // matches an inject id anywhere in the plan
}

export interface WizardPlanMeldingMoment {
  id: string
  allowedRoles: Role[]
  recipient: MeldingRecipient
  helper?: string
  types: WizardPlanMeldingType[]
}

export interface WizardPlanRound {
  title: string
  situation: string
  timerMinutes?: number
  roleActions?: WizardPlanRoleAction[]
  injects?: WizardPlanInject[]
  meldingMoment?: WizardPlanMeldingMoment
  discussionGoal?: string
  keyQuestions?: string[]
  hints?: string[]
  expectedDecisions?: string[]
  redFlags?: string[]
  openingPrompts?: string[]
  facilitatorPerspective?: string
  reviewPrompts?: string[]
  // Phase 9 — author-picked stable decision id used to link setup injects to a
  // decision that will be emitted in the same or next round. Optional — if
  // absent, planToGraph generates ids per the seed.
  decisionAuthorId?: string
}

// Per-round decision — participants pick one option that carries an explicit
// outcomeVector on the 6 axes. This is the primary scoring signal.
export interface WizardPlanDecision {
  afterRoundIndex: number
  prompt: string
  perRole?: boolean
  // Phase 9 — stable author-id so injects can link to this decision via
  // setsUpDecisionNodeId. Optional — falls back to auto-generated id.
  authorId?: string
  options: Array<{
    label: string
    linksToRoleActionId?: string
    // "round:<index>" | "outcome:<key>". If omitted, defaults to the next round
    // in sequence (or the first outcome if there is no next round). Useful when
    // the decision is scoring-only and every option should just continue.
    leadsTo?: string
    allowedRole?: Role
    outcomeVector?: OutcomeVector
    qualityRank?: ChoiceQuality
    facilitatorCommentary?: string
    lessonLearned?: string
    implicit?: boolean
    // Phase 3 — capability wiring. See DecisionNodeData.options[] in graph/types.ts.
    capabilityFlag?: string
    consumesOptionAfterUse?: boolean
    requiresCapability?: string
  }>
}

export interface WizardPlanOutcome {
  key: string
  label: string
  narrative: string
  lessonLearned?: string
  scoreRange?: { min?: number; max?: number }
}

export interface WizardPlan {
  name: string
  scenarioType: ScenarioType
  rounds: WizardPlanRound[]
  decisions?: WizardPlanDecision[]
  outcomes: WizardPlanOutcome[]
  irPlaybook?: string
  // Phase 9 — per-role briefing + playbook gaps rendered at session start.
  roleBriefings?: Partial<Record<Role, RoleBriefing>>
  // Phase 9 — ad-hoc noise inject library the facilitator can drop during
  // DISCUSSION. Scenario-scoped, never scored.
  injectLibrary?: PremadeInject[]
}

function resolveTarget(
  ref: string,
  roundNodeIds: string[],
  outcomeIdByKey: Map<string, string>,
): string | null {
  if (ref.startsWith("round:")) {
    const idx = parseInt(ref.slice(6), 10)
    return roundNodeIds[idx] ?? null
  }
  if (ref.startsWith("outcome:")) return outcomeIdByKey.get(ref.slice(8)) ?? null
  return null
}

export interface PlanToGraphOptions {
  // Phase 9 — reproducibility. If provided, all ids derive from this seed.
  seed?: string
  // Phase 9 — timestamp injected for tests / deterministic serialisation. If
  // omitted, Date.now() is used (only for non-reproducible callers).
  now?: number
  // Phase 9 — publish status attached to the compiled graph. The wizard
  // always compiles as 'draft'; the builder may promote to 'published'.
  publishStatus?: 'draft' | 'published'
}

export function planToGraph(plan: WizardPlan, options: PlanToGraphOptions = {}): ScenarioGraph {
  const seed = options.seed ?? "unspecified"
  const rng: SeededRng = createSeededRng(seed)
  const nid = (prefix: string) => rng.nid(prefix)
  const now = options.now ?? Date.now()
  const startId = nid("start")

  const roundNodeIds = plan.rounds.map(() => nid("round"))
  const outcomeIdByKey = new Map<string, string>()
  for (const o of plan.outcomes) outcomeIdByKey.set(o.key, nid("out"))

  // Second pass: assign inject ids up-front so meldingMoment.triggersInjectId
  // (author-supplied string ids) can be mapped to real node ids.
  const injectIdMap = new Map<string, string>()  // author-id → real-node-id
  plan.rounds.forEach(round => {
    for (const inj of round.injects ?? []) {
      if (inj.id) injectIdMap.set(inj.id, nid("inj"))
    }
  })

  // Reserve decision-node ids up-front so inject.setsUpDecisionNodeId (which
  // uses author-supplied ids) can be resolved to real node ids before any
  // inject nodes are emitted.
  const decisionIdMap = new Map<string, string>()  // author-id → real-node-id
  for (const d of (plan.decisions ?? [])) {
    if (d.authorId) decisionIdMap.set(d.authorId, nid("dec"))
  }

  const nodes: ScenarioGraph["nodes"] = []
  const edges: ScenarioGraph["edges"] = []

  const startX = 40, roundX0 = 260, roundStep = 320
  const rowY = 200
  const injectY = 440

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
      qualityRank: a.qualityRank,
      facilitatorCommentary: a.facilitatorCommentary,
      lessonLearned: a.lessonLearned,
      respondsToMisleading: a.respondsToMisleading,
    }))

    // Resolve triggersInjectId author-id → node-id
    const meldingMoment: MeldingMoment | undefined = round.meldingMoment
      ? {
          id: round.meldingMoment.id,
          allowedRoles: round.meldingMoment.allowedRoles,
          recipient: round.meldingMoment.recipient,
          helper: round.meldingMoment.helper,
          roundIndex: idx,
          types: round.meldingMoment.types.map(t => ({
            id: t.id,
            label: t.label,
            triggersInjectId: t.triggersInjectId ? injectIdMap.get(t.triggersInjectId) : undefined,
          })),
        }
      : undefined

    const roundData: RoundNodeData = {
      kind: "round",
      title: round.title,
      situation_update: round.situation,
      timerMinutes: round.timerMinutes ?? 15,
      roleActions,
      openingPrompts: round.openingPrompts,
      facilitatorPerspective: round.facilitatorPerspective,
      reviewPrompts: round.reviewPrompts,
      meldingMoments: meldingMoment ? [meldingMoment] : undefined,
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

    ;(round.injects ?? []).forEach((inj, ii) => {
      const injectId = (inj.id && injectIdMap.get(inj.id)) || nid("inj")
      // Phase 9 — resolve author-supplied setsUpDecisionNodeId (an author-id)
      // to the real decision node id. If unknown, we keep the raw string so
      // the framework rule can still flag the dangling reference for repair.
      const resolvedSetup = inj.setsUpDecisionNodeId
        ? (decisionIdMap.get(inj.setsUpDecisionNodeId) ?? inj.setsUpDecisionNodeId)
        : undefined
      const data: InjectNodeData = {
        kind: "inject",
        type: inj.type,
        channel: inj.channel,
        title: inj.title,
        content: inj.content,
        urgency: inj.urgency,
        senderName: inj.senderName,
        senderHandle: inj.senderHandle,
        source: inj.source,
        timestamp: inj.timestamp,
        targetTeam: inj.targetTeam,
        targetRoles: inj.targetRoles,
        nis2Relevant: inj.nis2Relevant,
        reliability: inj.reliability,
        deliverySeconds: inj.deliverySeconds,
        requiresCapability: inj.requiresCapability,
        triggersRegulatoryNotification: inj.triggersRegulatoryNotification,
        classification: inj.classification,
        setsUpDecisionNodeId: resolvedSetup,
        facilitatorNote: inj.facilitatorNote,
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

  // Outcomes stacked on the right of the last round.
  const outcomeXBase = roundX0 + plan.rounds.length * roundStep + 100
  plan.outcomes.forEach((o, i) => {
    const oid = outcomeIdByKey.get(o.key)!
    const data: OutcomeNodeData = {
      kind: "outcome",
      key: o.key,
      label: o.label,
      narrative: o.narrative,
      lessonLearned: o.lessonLearned,
      scoreRange: o.scoreRange,
    }
    nodes.push({
      id: oid,
      type: "outcome",
      position: { x: outcomeXBase, y: 60 + i * 160 },
      data,
    })
  })

  // Start → Round 0
  if (roundNodeIds.length > 0) {
    edges.push({ id: nid("e"), source: startId, target: roundNodeIds[0], type: "sequence" })
  }

  // Decisions between rounds (or sequential Round → Round when no decision).
  const decisionsByAfter = new Map<number, WizardPlanDecision>()
  const decisionsArr = Array.isArray(plan.decisions) ? plan.decisions : []
  for (const d of decisionsArr) {
    if (d && typeof d.afterRoundIndex === "number") decisionsByAfter.set(d.afterRoundIndex, d)
  }

  for (let i = 0; i < plan.rounds.length; i++) {
    const decision = decisionsByAfter.get(i)
    if (decision) {
      // Defensief: LLM gaf soms een decision zonder valid options-array,
      // of met een lege array. Skippen is beter dan crashen of een decision
      // zonder keuzes te renderen.
      if (!Array.isArray(decision.options) || decision.options.length === 0) {
        console.warn(`[wizard-plan] Decision ${decision.authorId ?? "?"} bij ronde ${i + 1} geskipt — options ontbreekt of is leeg`)
        continue
      }
      const did = (decision.authorId && decisionIdMap.get(decision.authorId)) || nid("dec")
      const options = decision.options.map(opt => ({
        id: nid("opt"),
        label: opt.label,
        roleActionId: opt.linksToRoleActionId,
        allowedRole: opt.allowedRole,
        outcomeVector: opt.outcomeVector,
        qualityRank: opt.qualityRank,
        facilitatorCommentary: opt.facilitatorCommentary,
        lessonLearned: opt.lessonLearned,
        implicit: opt.implicit,
        capabilityFlag: opt.capabilityFlag,
        consumesOptionAfterUse: opt.consumesOptionAfterUse,
        requiresCapability: opt.requiresCapability,
      }))
      const data: DecisionNodeData = {
        kind: "decision",
        prompt: decision.prompt,
        measuredBy: "participant_choice",
        perRole: decision.perRole ?? true,
        options,
      }
      nodes.push({
        id: did,
        type: "decision",
        position: { x: roundX0 + (i + 1) * roundStep - 60, y: rowY - 20 },
        data,
      })
      edges.push({ id: nid("e"), source: roundNodeIds[i], target: did, type: "sequence" })
      // Default target: next round in sequence, or first outcome if this is the
      // final round. Authors may override per-option via `leadsTo`.
      const defaultTarget = roundNodeIds[i + 1]
        ?? (plan.outcomes[0] ? outcomeIdByKey.get(plan.outcomes[0].key) : undefined)
      decision.options.forEach((opt, oi) => {
        const target = opt.leadsTo
          ? resolveTarget(opt.leadsTo, roundNodeIds, outcomeIdByKey)
          : defaultTarget
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
    } else if (roundNodeIds[i + 1]) {
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
    irRetainerName: EYE_SECURITY_RETAINER.name,
    irRetainerProfile: EYE_SECURITY_RETAINER,
    irPlaybook: plan.irPlaybook,
    features: DEFAULT_FEATURES,
    roleBriefings: plan.roleBriefings,
    injectLibrary: plan.injectLibrary,
    wizardSeed: options.seed,
    publishStatus: options.publishStatus ?? 'draft',
  }
}
