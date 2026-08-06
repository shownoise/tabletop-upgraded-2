/**
 * Session store — now backed by the database abstraction layer (lib/db.ts).
 * Falls back to in-memory automatically in dev when KV is not configured.
 */

import { randomBytes } from "crypto"
import { evaluateChasersOnRoundStart, stepFromNode, type EngineTrigger, type StepResult } from "./graph/engine"
import { cumulativeScore, selectOutcomeByScore } from "./graph/outcome-selector"
import type { DecisionNodeData } from "./graph/types"
import {
  dbDeleteScenarioGraph,
  dbGetSession,
  dbListScenarioGraphs,
  dbLoadScenarioGraph,
  dbSaveScenarioGraph,
  dbSetSession,
  withSessionLock,
} from "./db"
import type { ScenarioGraph } from "./graph/types"
import { RETAINER_ACTIVATED_FLAG } from "./graph/types"
import type {
  ExerciseConfig, FactCheckEntry, FactCheckTag,
  FiledMelding, GovernanceFlag, Inject, InjectAnnotation, InjectRoutePlan, InjectType,
  LearningObjective, LiveEvent, LiveEventName,
  Participant, PublicState, RegulatoryObligationState, RegulatoryRegime,
  RetainerActivation, Role, RoleAction,
  RoleDocument, RoundPhase, RoundPhaseState, Scenario, SessionState, SimulationMode, SpecialEvent,
  SpecialMessage, SpecialScore, SpecialType, StreamMessage, SubmittedDecision, SupervisionReportEdits, TimelineEvent,
  TimelineEventType, Urgency,
} from "./types"
import { ROLE_META } from "./types"
import { NL_AVG_NIS2_REGIME } from "./regulatory/regimes"
import { computeAuthoredWorkload, distributeRoles, effectiveRolesForParticipant } from "./engine/distribute-roles"
import { plotInjectRoutes } from "./inject-routing"
import { buildTeamRoles } from "./team-roster"
import { computeRoundPhaseDurations, PHASE_ORDER, nextPhase } from "./engine/round-phases"
import { describeNextAction as _describeNextAction, missingDecisionRoles } from "./session-next-action"

// Migration: legacy `system_admin` role was merged into `it_manager`. Applied on
// any scenario data flowing through the store so old graphs / templates keep working.
function migrateLegacyRole(r: unknown): Role | null {
  if (typeof r !== 'string') return null
  if (r === 'system_admin') return 'it_manager'
  const valid: readonly string[] = ['it_manager', 'ciso', 'head_of_comms', 'legal', 'ceo', 'cfo', 'hr_lead', 'ops_manager']
  return valid.includes(r) ? (r as Role) : null
}

function migrateScenarioRoles(scenario: Scenario): Scenario {
  return {
    ...scenario,
    rounds: scenario.rounds.map(round => ({
      ...round,
      injects: round.injects.map(inject => {
        if (!inject.targetRoles?.length) return inject
        const migrated = [...new Set(inject.targetRoles.map(migrateLegacyRole).filter(Boolean) as Role[])]
        return { ...inject, targetRoles: migrated.length > 0 ? migrated : undefined }
      }),
      roleActions: round.roleActions?.map(action => ({
        ...action,
        allowedRoles: [...new Set(action.allowedRoles.map(migrateLegacyRole).filter(Boolean) as Role[])],
      })),
    })),
  }
}

// ─── SSE listeners (always in-memory — per-process) ───────────

type Listener = (msg: StreamMessage) => void

const globalAny = globalThis as any
if (!globalAny.__ctt_listeners__) globalAny.__ctt_listeners__ = new Set<Listener>()
const listeners: Set<Listener> = globalAny.__ctt_listeners__

// ─── Helpers ──────────────────────────────────────────────────

function genId(prefix = "id") { return `${prefix}_${randomBytes(6).toString("hex")}` }

function genJoinCode(len = 6) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  const bytes = randomBytes(len)
  let out = ""
  for (let i = 0; i < len; i++) out += chars[bytes[i] % chars.length]
  return out
}

// ─── Broadcast ────────────────────────────────────────────────

function broadcastState(session: SessionState | null) {
  // Callers that pass a session are responsible for persistence. We still
  // re-tick here in case a fresh phase boundary crossed between mutation and
  // broadcast; the update propagates to SSE listeners immediately but skips
  // the extra write to keep broadcasts cheap (next mutation will persist).
  let ticked: SessionState | null = null
  if (session) {
    try {
      ticked = tickRoundPhase(session)
    } catch (err) {
      // WHY: never let a tick error swallow the broadcast — log to timeline and
      // fall back to the pre-tick session so participants still get an update.
      const stack = err instanceof Error ? err.stack ?? err.message : String(err)
      ticked = pushTimeline(session, "session_created", { engine_error: true, stack })
      if (process.env.NODE_ENV !== "production") {
        console.error("[session-store] tick failure", err)
      }
    }
  }
  const snapshot: PublicState = { session: ticked }
  for (const l of listeners) l({ type: "state", data: snapshot })
}

// Auto-advance within a round. Advances INJECT → DISCUSSION → DECISION → REVIEW
// once each phase's minSeconds elapses. Once REVIEW is reached, this function
// returns unchanged state — advancing OUT of REVIEW (to the next round or to
// endSession) requires an explicit facilitator action via goToNextRound().
// This is deliberate: it prevents auto-skipping the debrief.
function tickRoundPhase(session: SessionState): SessionState {
  const state = session.activeRoundPhaseState
  if (!state) return session

  let cur = state
  let s = session
  for (let step = 0; step < PHASE_ORDER.length; step++) {
    const durationMs = (cur.durations[cur.currentPhase] ?? 0) * 1000
    const elapsedMs = Date.now() - cur.phaseStartedAt
    if (elapsedMs < durationMs) return s
    const next = nextPhase(cur.currentPhase)
    // REVIEW → next round is facilitator-driven, never auto. Return with REVIEW
    // still active until goToNextRound() is called.
    if (next === 'next_round') return s
    const nextStart = cur.phaseStartedAt + durationMs
    s = {
      ...s,
      roundPhase: next,
      activeRoundPhaseState: {
        ...cur,
        currentPhase: next,
        phaseStartedAt: nextStart,
      },
    }
    cur = s.activeRoundPhaseState!
  }
  return s
}

function emit(name: LiveEventName, payload: Record<string, unknown>) {
  const event: LiveEvent = { name, payload, ts: Date.now() }
  for (const l of listeners) l({ type: "event", data: event })
}

// ─── Participant-safe state ───────────────────────────────────
// Strips all facilitator-only data before broadcasting to unauthenticated clients.
// Server-side logic (flagging, scoring) always uses the real stored state.

// Given a session's role distribution, determine which app roles should be
// treated as "covered" for a given RoleAction. Falls back to raw joined-roles
// when no distribution has been computed yet (pre-start states).
function expandRolesForJoinedParticipants(action: RoleAction, session: SessionState): RoleAction {
  if (action.allowedRoles.length === 0) return action
  const dist = session.roleDistribution
  if (!dist) {
    // Fallback: raw joined roles only. Options with no present role become invisible.
    const joined = new Set<Role>((session.participants ?? []).map(p => p.role).filter(Boolean) as Role[])
    const anyDirect = action.allowedRoles.some(r => joined.has(r))
    return anyDirect ? action : { ...action, allowedRoles: [] }
  }
  // With a distribution: an authored role is covered if some participant holds it
  // as primary OR inherits it.
  const overrides = session.roleAssignmentOverrides ?? {}
  const covered = new Set<Role>()
  for (const e of dist.entries) {
    for (const r of effectiveRolesForParticipant(e, overrides[e.participantId])) covered.add(r)
  }
  const anyCovered = action.allowedRoles.some(r => covered.has(r))
  return anyCovered ? action : { ...action, allowedRoles: [] }
}

export function toParticipantState(session: SessionState, forParticipantId?: string): SessionState {
  // Phase 4 — facilitator-only fields that must NEVER reach participants.
  // Applied uniformly to every inject regardless of review-phase.
  const stripFacilitatorOnlyFromInject = (inject: Inject): Inject => {
    if (inject.facilitatorNote === undefined) return inject
    const { facilitatorNote: _fn, ...rest } = inject
    return rest
  }
  const stripInjectGroundTruth = (inject: Inject, isReviewRound: boolean): Inject => {
    const noFacilitator = stripFacilitatorOnlyFromInject(inject)
    if (isReviewRound) return noFacilitator
    // Ground truth (reliability tag, span annotations) is revealed only during REVIEW.
    const { reliability: _r, groundTruthAnnotations: _g, ...safe } = noFacilitator
    const leak = safe as { reliability?: unknown; groundTruthAnnotations?: unknown }
    if (leak.reliability !== undefined || leak.groundTruthAnnotations !== undefined) {
      const msg = `[toParticipantState] ground-truth leak on inject ${safe.id}`
      if (process.env.NODE_ENV !== "production") throw new Error(msg)
      console.warn(msg)
    }
    return safe
  }
  // Phase 3 — capability-gated inject visibility. An inject with
  // requiresCapability set is hidden until the corresponding flag on
  // session.flags is truthy. Applied uniformly to scenario.rounds[].injects
  // and pushedInjects so no leak path exists.
  const capabilityAllows = (inj: Inject): boolean => {
    if (!inj.requiresCapability) return true
    return !!(session.flags ?? {})[inj.requiresCapability]
  }
  return {
    ...session,
    scenario: {
      ...session.scenario,
      rounds: session.scenario.rounds.map((round, i) => {
        // Future rounds: shell only.
        if (i > session.currentRound) {
          return {
            ...round,
            situation_update: "",
            injects: [],
            roleActions: undefined,
            facilitatorNotes: undefined,
          }
        }
        const isReviewRound =
          (i < session.currentRound) ||
          (i === session.currentRound && session.roundPhase === "review")
        return {
          ...round,
          injects: round.injects
            .filter(capabilityAllows)
            .map(inj => stripInjectGroundTruth(inj, isReviewRound)),
          facilitatorNotes: undefined,
          roleActions: round.roleActions?.map(action => {
            const expanded = expandRolesForJoinedParticipants(action, session)
            return {
              id: expanded.id,
              label: expanded.label,
              description: expanded.description,
              allowedRoles: expanded.allowedRoles,
              irPlanAligned: true,
              // Facilitator commentary is hidden until REVIEW.
              facilitatorCommentary: isReviewRound ? action.facilitatorCommentary : undefined,
              qualityRank: isReviewRound ? action.qualityRank : undefined,
              lessonLearned: isReviewRound ? action.lessonLearned : undefined,
            }
          }),
          learningObjectives: round.learningObjectives?.map(({ triggerActionIds: _a, triggerSpecialType: _s, ...safe }) => safe),
        }
      }),
    },
    pushedInjects: session.pushedInjects
      .filter(p => capabilityAllows(p.inject))
      .map(p => {
        const isReviewRound =
          p.roundIndex < 0 ||
          p.roundIndex < session.currentRound ||
          (p.roundIndex === session.currentRound && session.roundPhase === "review")
        return { ...p, inject: stripInjectGroundTruth(p.inject, isReviewRound) }
      }),
    governanceFlags: [],
    submittedDecisions: (session.submittedDecisions ?? []).map(d => ({
      ...d,
      isWrongRole: false,
      isIrDeviation: false,
    })),
    specialEvents: session.specialEvents ?? [],
    documents: session.documents ?? [],
    // Hide the raw graph from participants; the engine-computed activeDecision
    // is the only projection they need. Exception: expose only the
    // participant-safe subtree (roleBriefings) so the opening-briefing
    // component can read per-role mandates + playbook gaps.
    graph: session.graph
      ? ({
          id: session.graph.id,
          name: session.graph.name,
          version: session.graph.version,
          scenarioType: session.graph.scenarioType,
          nodes: [],
          edges: [],
          createdAt: session.graph.createdAt,
          updatedAt: session.graph.updatedAt,
          roleBriefings: session.graph.roleBriefings,
        } as SessionState["graph"])
      : undefined,
    graphState: undefined,
    activeDecision: projectActiveDecision(session),
    // Phase 6 — participant sees only their own view state entry (if forParticipantId
    // is provided). When we don't know the caller, hide the collection entirely
    // rather than leak other participants' hidden/handled sets.
    participantViewState: filterParticipantViewState(session, forParticipantId),
  }
}

// Phase 6 — narrow the per-participant view state to the caller's own subtree.
// When forParticipantId is given, return only that one entry (or empty). When
// omitted (fallback caller doesn't know which participant), we return
// undefined so nobody's private state leaks between clients.
function filterParticipantViewState(
  session: SessionState,
  forParticipantId?: string,
): SessionState["participantViewState"] {
  const all = session.participantViewState
  if (!all) return undefined
  if (!forParticipantId) return undefined
  const mine = all[forParticipantId]
  return mine ? { [forParticipantId]: mine } : undefined
}

// Peek-ahead: als de current node een decision is, exposeer die. Anders,
// als current node een round is en de round-fase is 'decision' of 'review',
// zoek de outgoing sequence-edge naar een decision-node en projecteer die.
// Scoring-info wordt gescrubd behalve tijdens de review-fase.
function projectActiveDecision(session: SessionState): import("./types").ActiveDecisionState | undefined {
  if (!session.graph || !session.graphState) return undefined
  const currentId = session.graphState.currentNodeId
  const nodeById = new Map(session.graph.nodes.map(n => [n.id, n]))
  const current = nodeById.get(currentId)
  if (!current) return undefined

  // Peek in ALLE fases zodat keuzes direct zichtbaar zijn bij ronde-start.
  // Participants kunnen alvast de opties zien tijdens briefing/discussion;
  // submit-decision blokkeert nog wel inzenden buiten discussion/decision.
  const isReview = session.roundPhase === 'review'

  let dnode: import("./graph/types").GraphNode | undefined
  if (current.type === 'decision') {
    dnode = current
  } else if (current.type === 'round') {
    const nextEdge = session.graph.edges.find(e => e.source === currentId && e.type === 'sequence')
    if (nextEdge) {
      const cand = nodeById.get(nextEdge.target)
      if (cand?.type === 'decision') dnode = cand
    }
  }
  if (!dnode) return undefined

  const dd = dnode.data as import("./graph/types").DecisionNodeData
  if (dd.perRole !== true) return undefined  // Facilitator-picks blijven verborgen voor participants

  // Phase 3 — filter option list:
  //   • consumesOptionAfterUse: drop options already submitted in this session
  //     (matched by option id in submittedDecisions). Never affects the
  //     historical record — only future presentations.
  //   • requiresCapability: drop options whose gating flag is not yet set.
  const flags = session.flags ?? {}
  const submittedOptionIds = new Set((session.submittedDecisions ?? []).map(d => d.actionId))
  const visibleOptions = dd.options.filter(o => {
    if (o.consumesOptionAfterUse && submittedOptionIds.has(o.id)) return false
    if (o.requiresCapability && !flags[o.requiresCapability]) return false
    return true
  })

  const projectedOptions: import("./types").ActiveDecisionPending[] = visibleOptions.map(o => ({
    optionId: o.id,
    optionLabel: o.label,
    allowedRole: o.allowedRole,
    ...(isReview
      ? {
          qualityRank: o.qualityRank,
          facilitatorCommentary: o.facilitatorCommentary,
          lessonLearned: o.lessonLearned,
        }
      : {}),
  }))

  // Phase 4 — solo/understaffed sequential play. For each participant with a
  // roleDistribution entry, produce an ordered pending queue over the roles
  // they own (primary first, then inherited) that have a matching option in
  // this decision node. Skip roles that don't appear as allowedRole on any
  // visible option; they legitimately have no decision this round.
  const pendingByParticipant: Record<string, import("./types").ActiveDecisionParticipantPending> = {}
  const dist = session.roleDistribution
  const overrides = session.roleAssignmentOverrides ?? {}
  const optionIds = new Set(visibleOptions.map(o => o.id))
  const rolesWithOption = new Set<Role>(
    visibleOptions.map(o => o.allowedRole).filter((r): r is Role => !!r),
  )
  if (dist) {
    for (const entry of dist.entries) {
      const roles = effectiveRolesForParticipant(entry, overrides[entry.participantId])
      const roleSequence = roles.filter(r => rolesWithOption.has(r))
      if (roleSequence.length === 0) continue
      // Count how many of this participant's decisions have already been submitted
      // against this node's option set in the current round.
      const submittedRoles = new Set<Role>()
      for (const d of session.submittedDecisions ?? []) {
        if (d.participantId !== entry.participantId) continue
        if (d.roundIndex !== session.currentRound) continue
        if (!optionIds.has(d.actionId)) continue
        submittedRoles.add(d.role)
      }
      const total = roleSequence.length
      const completed = roleSequence.filter(r => submittedRoles.has(r)).length
      if (completed >= total) continue  // all done — omit
      // currentIndex points at the first role in the sequence not yet submitted.
      const currentIndex = roleSequence.findIndex(r => !submittedRoles.has(r))
      pendingByParticipant[entry.participantId] = {
        roleSequence,
        currentIndex: currentIndex < 0 ? total : currentIndex,
        total,
        completed,
      }
    }
  }

  return {
    nodeId: dnode.id,
    prompt: dd.prompt,
    perRole: true,
    options: projectedOptions,
    ...(Object.keys(pendingByParticipant).length > 0 ? { pendingByParticipant } : {}),
  }
}

// ─── Public API ───────────────────────────────────────────────

export function subscribe(listener: Listener): () => void {
  listeners.add(listener)
  dbGetSession().then(s => listener({ type: "state", data: { session: s } }))
  return () => { listeners.delete(listener) }
}

export function subscribeParticipant(listener: Listener, participantId?: string): () => void {
  // Guard: if a broadcast arrives before the initial dbGetSession() resolves,
  // skip the db-fetch result to avoid the client receiving two conflicting states.
  let initialSent = false
  const wrapped: Listener = (msg) => {
    initialSent = true
    if (msg.type === "state" && msg.data.session) {
      listener({ type: "state", data: { session: toParticipantState(msg.data.session, participantId) } })
    } else {
      listener(msg)
    }
  }
  listeners.add(wrapped)
  dbGetSession().then(s => {
    if (initialSent) return
    const safe = s ? toParticipantState(s, participantId) : null
    wrapped({ type: "state", data: { session: safe } })
  })
  return () => { listeners.delete(wrapped) }
}

export async function getState(): Promise<PublicState> {
  return { session: await dbGetSession() }
}

// Tick round-phase auto-advance + persist als er iets veranderd is.
// Wordt aangeroepen door de state-route zodat fases automatisch verlopen ook
// zonder mutations van gebruikers.
export async function settleAndGetState(): Promise<PublicState> {
  const session = await dbGetSession()
  if (!session) return { session: null }
  const ticked = tickRoundPhase(session)
  if (ticked !== session && ticked.roundPhase !== session.roundPhase) {
    await dbSetSession(ticked)
    broadcastState(ticked)
  }
  return { session: ticked }
}

export async function getSession(): Promise<SessionState | null> {
  return dbGetSession()
}

export async function createSession(
  config: ExerciseConfig,
  scenario?: Scenario,
  mode?: SimulationMode,
  documents?: RoleDocument[],
  graph?: ScenarioGraph,
): Promise<SessionState> {
  if (!scenario) throw new Error("createSession requires a scenario — legacy generator is removed")
  const resolvedScenario = migrateScenarioRoles(scenario)
  const startNodeId = graph?.nodes.find(n => n.type === "start")?.id
  const session: SessionState = {
    id: genId("ses"),
    joinCode: genJoinCode(),
    config,
    scenario: resolvedScenario,
    currentRound: -1,
    status: "lobby",
    participants: [],
    pushedInjects: [],
    timeline: [{
      id: genId("tl"),
      timestamp: Date.now(),
      type: "session_created",
      data: { title: resolvedScenario.scenario_title },
    }],
    createdAt: Date.now(),
    mode: mode ?? "training",
    roundPhase: "inject",
    submittedDecisions: [],
    governanceFlags: [],
    documents: documents ?? [],
    graph,
    graphState: graph && startNodeId
      ? { currentNodeId: startNodeId, pathHistory: [startNodeId], branchLog: [] }
      : undefined,
    // Default regulatory regime — NL AVG + NIS2. Scenarios may swap this later.
    regulatoryRegime: NL_AVG_NIS2_REGIME,
    regulatoryObligations: [],
  }
  await dbSetSession(session)
  broadcastState(session)
  return session
}

export async function resetSession(): Promise<void> {
  await dbSetSession(null)
  emit("session_reset", {})
  broadcastState(null)
}

// Hard caps to keep the session KV blob from unbounded growth in long / abusive sessions.
const MAX_TIMELINE = 2000
const MAX_PUSHED_INJECTS = 500
const MAX_SUBMITTED_DECISIONS = 2000

function capCollections(s: SessionState): SessionState {
  const capped: SessionState = { ...s }
  if (capped.timeline && capped.timeline.length > MAX_TIMELINE) {
    capped.timeline = capped.timeline.slice(-MAX_TIMELINE)
  }
  if (capped.pushedInjects && capped.pushedInjects.length > MAX_PUSHED_INJECTS) {
    capped.pushedInjects = capped.pushedInjects.slice(-MAX_PUSHED_INJECTS)
  }
  if (capped.submittedDecisions && capped.submittedDecisions.length > MAX_SUBMITTED_DECISIONS) {
    capped.submittedDecisions = capped.submittedDecisions.slice(-MAX_SUBMITTED_DECISIONS)
  }
  return capped
}

async function mutate(fn: (s: SessionState) => SessionState | null | { error: string }): Promise<{ ok: boolean; error?: string }> {
  return withSessionLock(async () => {
    const session = await dbGetSession()
    if (!session) return { ok: false, error: "No active session." }
    const updated = fn(session)
    if (updated === null) return { ok: false, error: "Mutation returned null." }
    if (typeof updated === "object" && updated !== null && "error" in updated && !("participants" in updated)) {
      return { ok: false, error: updated.error }
    }
    const next = updated as SessionState
    const ticked = capCollections(tickRoundPhase(next))
    ticked.version = (session.version ?? 0) + 1
    await dbSetSession(ticked)
    broadcastState(ticked)
    return { ok: true }
  })
}

function pushTimeline(session: SessionState, type: TimelineEventType, data: Record<string, unknown>): SessionState {
  const ev: TimelineEvent = { id: genId("tl"), timestamp: Date.now(), type, data }
  return { ...session, timeline: [...session.timeline, ev] }
}

function applyEngineStep(session: SessionState, step: StepResult): SessionState {
  let updated: SessionState = { ...session }
  if (updated.graphState && step.nextNodeId && step.nextNodeId !== updated.graphState.currentNodeId) {
    updated = {
      ...updated,
      graphState: {
        ...updated.graphState,
        currentNodeId: step.nextNodeId,
        pathHistory: [...updated.graphState.pathHistory, step.nextNodeId],
      },
    }
  }

  for (const output of step.outputs) {
    if (output.kind === "start_round") {
      const roundNumber = updated.scenario.rounds.length + 1
      const round = { ...output.round, round_number: roundNumber }
      const roundIndex = roundNumber - 1
      const now = Date.now()
      // Auto-push. Injects with deliverySeconds > 0 get a future pushedAt so the client can drip them in over time.
      const autoPushed = round.injects.map(inject => ({
        inject,
        roundIndex,
        pushedAt: now + (inject.deliverySeconds ?? 0) * 1000,
      }))
      updated = {
        ...updated,
        scenario: { ...updated.scenario, rounds: [...updated.scenario.rounds, round] },
        currentRound: roundIndex,
        roundStartedAt: now,
        roundPhase: "inject",
        pushedInjects: [...updated.pushedInjects, ...autoPushed],
      }
      updated = pushTimeline(updated, "round_changed", { roundIndex })
      for (const p of autoPushed) {
        updated = pushTimeline(updated, "inject_pushed", { roundIndex, inject: p.inject })
        updated = maybeOpenRegulatoryObligationFromInject(updated, p.inject)
      }
      updated = mergeInjectRoutePlan(updated, round.injects.map(i => i.id))
      updated = withRoundPhaseState(updated, roundIndex, now)
      updated = anchorIncidentOnRoundIfNeeded(updated, roundNumber, now)
      if (updated.graph) {
        const chasers = evaluateChasersOnRoundStart(updated.graph, updated, roundNumber)
        if (chasers.length > 0) {
          // Chasers respecteren ook deliverySeconds — anders komt bij ronde-start
          // álles tegelijk binnen als er meerdere chasers zijn. Default 60s
          // vertraging als de author geen deliverySeconds heeft gezet.
          const chasePushes = chasers.map((inj, i) => ({
            inject: inj,
            roundIndex,
            pushedAt: now + ((inj.deliverySeconds ?? (60 + i * 45)) * 1000),
          }))
          const flagUpdates: Record<string, boolean> = { ...(updated.flags ?? {}) }
          for (const c of chasers) {
            flagUpdates[`chaser_${c.id}_fired`] = true
          }
          updated = {
            ...updated,
            pushedInjects: [...updated.pushedInjects, ...chasePushes],
            flags: flagUpdates,
          }
          for (const p of chasePushes) {
            updated = pushTimeline(updated, "inject_pushed", { roundIndex, inject: p.inject, chaser: true })
            updated = maybeOpenRegulatoryObligationFromInject(updated, p.inject)
          }
          updated = mergeInjectRoutePlan(updated, chasers.map(c => c.id))
        }
      }
    } else if (output.kind === "trigger_special") {
      const mode = updated.config.specialsMode
      if (!mode || mode === "off") continue
      const assigned = output.assignedRole
        ? updated.participants.find(p => p.role === output.assignedRole)
        : assignSpecialParticipant(updated, output.type)
      const firstTurn = SCRIPTED_TURNS[output.type]?.[0]
      const openingMsg: SpecialMessage | undefined = firstTurn
        ? {
            id: genId("sm"),
            sender: "counterpart",
            text: firstTurn.counterpartMessage,
            timestamp: new Date().toISOString(),
            choices: firstTurn.choices,
          }
        : undefined
      const special: SpecialEvent = {
        id: genId("sp"),
        type: output.type,
        mode: mode as "static" | "ai",
        status: "active",
        assignedParticipantId: assigned?.id,
        assignedParticipantName: assigned?.name,
        assignedRole: assigned?.role,
        triggeredAt: Date.now(),
        messages: openingMsg ? [openingMsg] : [],
        totalScore: 0,
        currentTurnIndex: 0,
      }
      updated = {
        ...updated,
        specialEvents: [...(updated.specialEvents ?? []), special],
      }
      updated = pushTimeline(updated, "special_triggered", { specialId: special.id, type: output.type, assignedTo: assigned?.name })
    } else if (output.kind === "set_outcome") {
      // If features.scoring is on and any outcome has a scoreRange, override
      // the edge-based outcome with the one whose bandwidth matches the
      // cumulative score. The edge-based outcome stays as fallback.
      let chosen = output.outcome
      const features = updated.graph?.features
      const scoringOn = features?.scoring ?? true
      if (scoringOn && updated.graph) {
        const total = cumulativeScore(updated.graph, (updated.submittedDecisions ?? []).map(d => ({ actionId: d.actionId })))
        const byScore = selectOutcomeByScore(updated.graph, total)
        if (byScore) chosen = byScore
      }
      updated = {
        ...updated,
        status: "ended",
        graphState: updated.graphState ? {
          ...updated.graphState,
          finalOutcome: {
            key: chosen.key,
            label: chosen.label,
            narrative: chosen.narrative,
          },
        } : undefined,
      }
      updated = expireOpenRegulatoryObligations(updated)
      updated = pushTimeline(updated, "session_ended", { outcome: chosen.key })
    }
  }

  return updated
}

function triggerEngine(session: SessionState, trigger: EngineTrigger): SessionState {
  if (!session.graph || !session.graphState) return session
  let updated = applyEngineStep(session, stepFromNode(session.graph, session.graphState.currentNodeId, trigger))
  // Cascade voorbij soft-perRole decisions: die zijn tijdens de ronde
  // afgehandeld via peek-ahead + submitDecision. Blijven staan op zo'n
  // decision-node zou een extra facilitator-klik vereisen.
  for (let hops = 0; hops < 3; hops++) {
    if (!updated.graph || !updated.graphState) break
    const cur = updated.graph.nodes.find(n => n.id === updated.graphState!.currentNodeId)
    if (!cur || cur.type !== 'decision') break
    const dd = cur.data as import("./graph/types").DecisionNodeData
    if (dd.advancesGraph !== false || dd.perRole !== true) break
    updated = applyEngineStep(updated, stepFromNode(updated.graph, updated.graphState.currentNodeId, { kind: "facilitator_next" }))
  }
  return updated
}

// ─── Session operations ───────────────────────────────────────

export interface JoinResult { ok: true; participantId: string; sessionId: string }
export interface JoinError { ok: false; error: string }

export async function joinSession(input: { name: string; joinCode: string; role?: Role; existingParticipantId?: string }): Promise<JoinResult | JoinError> {
  const name = input.name.trim()
  const code = input.joinCode.trim().toUpperCase()
  if (!name) return { ok: false, error: "Name is required." }

  const session = await dbGetSession()
  if (!session) return { ok: false, error: "No active session. Ask the facilitator to create one." }
  if (session.joinCode.toUpperCase() !== code) return { ok: false, error: "Invalid join code." }

  // Reconnect existing participant — avoids duplicates on refresh / back navigation
  if (input.existingParticipantId) {
    const existing = session.participants.find(p => p.id === input.existingParticipantId)
    if (existing) {
      return { ok: true, participantId: existing.id, sessionId: session.id }
    }
  }

  const participant: Participant = { id: genId("p"), name, joinedAt: Date.now(), role: input.role }
  let updated = { ...session, participants: [...session.participants, participant] }
  updated = pushTimeline(updated, "participant_joined", { name: participant.name, participantId: participant.id })

  await dbSetSession(updated)
  broadcastState(updated)
  emit("participant_joined", { participant })
  return { ok: true, participantId: participant.id, sessionId: session.id }
}

export async function startSession(): Promise<{ ok: boolean; error?: string }> {
  const result = await mutate(s => {
    if (s.graph && s.graphState) {
      const now = Date.now()
      let updated = triggerEngine(s, { kind: "auto" })
      updated = { ...updated, status: "active" as const, startedAt: now }
      updated = withRoleDistribution(updated, now)
      updated = withInjectRoutePlan(updated)
      updated = withRoundPhaseState(updated, updated.currentRound, now)
      updated = pushTimeline(updated, "session_started", { roundIndex: updated.currentRound })
      updated = withIncidentDetectedAt(updated, now)
      updated = withRoleResolution(updated, now)
      return updated
    }
    if (s.scenario.rounds.length === 0) return null
    const now = Date.now()
    let updated: SessionState = { ...s, status: "active" as const, currentRound: 0, roundStartedAt: now, startedAt: now }
    updated = withRoleDistribution(updated, now)
    updated = withInjectRoutePlan(updated)
    updated = withRoundPhaseState(updated, 0, now)
    updated = pushTimeline(updated, "session_started", { roundIndex: 0 })
    updated = withIncidentDetectedAt(updated, now)
    updated = withRoleResolution(updated, now)
    return updated
  })
  if (result.ok) emit("start_session", { roundIndex: 0 })
  return result
}

// Compute the role distribution snapshot at session start. Deterministic —
// same input → same output. Stored on SessionState.roleDistribution so downstream
// code (UI, scoring) reads it instead of walking fallback chains ad hoc.
function withRoleDistribution(session: SessionState, now: number): SessionState {
  const authoredRolesSet = new Set<Role>()
  for (const round of session.scenario.rounds) {
    for (const a of round.roleActions ?? []) for (const r of a.allowedRoles) authoredRolesSet.add(r)
    for (const inj of round.injects) for (const r of inj.targetRoles ?? []) authoredRolesSet.add(r)
  }
  // Also include the primary role of every joined participant so seats without
  // authored content still appear in the distribution.
  for (const p of session.participants) if (p.role) authoredRolesSet.add(p.role)

  const authoredRoles = [...authoredRolesSet]
  const workloads = computeAuthoredWorkload(session.scenario)
  const snapshot = distributeRoles({
    authoredRoles,
    workloads,
    presentParticipants: session.participants,
  })
  return { ...session, roleDistribution: { ...snapshot, computedAt: now } }
}

// Deel B §1.2 — éénmalige rolresolutie bij session_started. Immutable snapshot;
// bij herstart wordt niet overschreven.
function withRoleResolution(session: SessionState, now: number): SessionState {
  if (session.roleResolution) return session  // niet overschrijven
  // Lazy import om circular deps te vermijden.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { resolveRoles } = require('@/lib/scoring') as typeof import('@/lib/scoring')
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { toSpecRole } = require('@/lib/graph/role-adapter') as typeof import('@/lib/graph/role-adapter')
  const specPresent = session.participants
    .map(p => (p.role ? toSpecRole(p.role) : undefined))
    .filter((s): s is string => !!s)
  const resolution = resolveRoles(
    { presentRoles: specPresent },
    { rounds: [], decisionPoints: [], injects: [] },
    now,
  )
  return {
    ...session,
    roleResolution: {
      effectiveOwners: resolution.effectiveOwners,
      rolCoverage: resolution.rolCoverage,
      distinctOwners: resolution.distinctOwners,
      resolvedAt: resolution.resolvedAt,
    },
  }
}

// Anchor the deadline clock at session start. The regulatory-notification
// system reads incidentDetectedAt as the "T0" against which milestone hours
// are measured. Scenarios that want a later anchor should keep the trigger
// inject in a later round — the obligation still opens at the inject moment,
// and its own openedAtHour is anchored from incidentDetectedAt.
function withIncidentDetectedAt(session: SessionState, now: number): SessionState {
  if (session.incidentDetectedAt) return session
  return { ...session, incidentDetectedAt: now }
}

function anchorIncidentOnRoundIfNeeded(session: SessionState, _roundNumber: number, now: number): SessionState {
  if (session.incidentDetectedAt) return session
  return { ...session, incidentDetectedAt: now }
}

function withInjectRoutePlan(session: SessionState): SessionState {
  const presentRoles = session.participants.map(p => p.role).filter((r): r is Role => !!r)
  const teamRoles = buildTeamRoles()
  const plan = plotInjectRoutes({
    scenario: session.scenario,
    presentRoles,
    teamRoles,
    previousVersion: session.injectRoutePlan?.version ?? 0,
  })
  const count = Object.keys(plan.routes).length
  let updated: SessionState = { ...session, injectRoutePlan: plan }
  updated = pushTimeline(updated, "inject_routes_plotted", { version: plan.version, count })
  return updated
}

function withRoundPhaseState(session: SessionState, roundIndex: number, startedAt: number): SessionState {
  const round = session.scenario.rounds[roundIndex]
  if (!round) return session
  const roundBudgetSeconds = (round.timerMinutes ?? session.config.timerPerRound ?? 10) * 60
  const durations = computeRoundPhaseDurations(roundBudgetSeconds)
  const state: RoundPhaseState = {
    roundNumber: round.round_number,
    currentPhase: "inject",
    phaseStartedAt: startedAt,
    durations,
  }
  return { ...session, activeRoundPhaseState: state, roundPhase: "inject" }
}

function mergeInjectRoutePlan(session: SessionState, newInjectIds: string[]): SessionState {
  if (!session.injectRoutePlan) return session
  const presentRoles = session.participants.map(p => p.role).filter((r): r is Role => !!r)
  if (presentRoles.length === 0) return session
  const teamRoles = buildTeamRoles()
  const pending = newInjectIds.filter(id => !session.injectRoutePlan!.routes[id])
  if (pending.length === 0) return session
  const partial = plotInjectRoutes({
    scenario: session.scenario,
    presentRoles,
    teamRoles,
    previousVersion: (session.injectRoutePlan.version ?? 1) - 1,
  })
  const merged: Record<string, Role[]> = { ...session.injectRoutePlan.routes }
  for (const id of pending) {
    if (partial.routes[id]) merged[id] = partial.routes[id]
  }
  return {
    ...session,
    injectRoutePlan: {
      ...session.injectRoutePlan,
      routes: merged,
    },
  }
}

export async function tagInject(input: {
  participantId: string
  injectId: string
  tag: FactCheckTag
}): Promise<{ ok: boolean; error?: string }> {
  const session = await dbGetSession()
  if (!session) return { ok: false, error: "No active session." }
  if (session.roundPhase === "review") return { ok: false, error: "Tagging gesloten tijdens review." }

  const participant = session.participants.find(p => p.id === input.participantId)
  if (!participant) return { ok: false, error: "Participant not found." }

  // Locate the inject in the scenario (or pushed) — needed to emit a titled timeline event.
  let injectTitle: string | undefined
  for (const r of session.scenario.rounds) {
    const inj = r.injects.find(i => i.id === input.injectId)
    if (inj) { injectTitle = inj.title; break }
  }
  if (!injectTitle) {
    const pushed = session.pushedInjects.find(p => p.inject.id === input.injectId)
    if (pushed) injectTitle = pushed.inject.title
  }

  const existingIdx = (session.factChecks ?? []).findIndex(
    f => f.injectId === input.injectId && f.participantId === input.participantId
  )
  const entries = [...(session.factChecks ?? [])]
  const now = Date.now()

  if (existingIdx >= 0) {
    const existing = entries[existingIdx]
    if (existing.tag === input.tag) return { ok: true }
    entries[existingIdx] = {
      ...existing,
      tag: input.tag,
      taggedAt: now,
      changedCount: (existing.changedCount ?? 0) + 1,
    }
  } else {
    const entry: FactCheckEntry = {
      injectId: input.injectId,
      participantId: input.participantId,
      tag: input.tag,
      taggedAt: now,
      changedCount: 0,
    }
    entries.push(entry)
  }

  let updated: SessionState = { ...session, factChecks: entries }
  updated = pushTimeline(updated, "inject_tagged", {
    injectId: input.injectId,
    injectTitle,
    participantId: input.participantId,
    participantName: participant.name,
    tag: input.tag,
  })
  await dbSetSession(updated)
  broadcastState(updated)
  return { ok: true }
}

export async function addAnnotation(input: {
  participantId: string
  injectId: string
  start: number
  end: number
  tag: FactCheckTag
}): Promise<{ ok: boolean; error?: string; annotationId?: string }> {
  const session = await dbGetSession()
  if (!session) return { ok: false, error: "No active session." }
  if (session.roundPhase === "review") return { ok: false, error: "Annotaties gesloten tijdens review." }
  if (input.start < 0 || input.end <= input.start) {
    return { ok: false, error: "Invalid range." }
  }

  const annotation: InjectAnnotation = {
    id: genId("ann"),
    injectId: input.injectId,
    participantId: input.participantId,
    start: input.start,
    end: input.end,
    tag: input.tag,
    createdAt: Date.now(),
  }
  const updated: SessionState = {
    ...session,
    injectAnnotations: [...(session.injectAnnotations ?? []), annotation],
  }
  await dbSetSession(updated)
  broadcastState(updated)
  return { ok: true, annotationId: annotation.id }
}

export async function removeAnnotation(input: {
  participantId: string
  annotationId: string
}): Promise<{ ok: boolean; error?: string }> {
  const session = await dbGetSession()
  if (!session) return { ok: false, error: "No active session." }
  const list = session.injectAnnotations ?? []
  const target = list.find(a => a.id === input.annotationId)
  if (!target) return { ok: false, error: "Annotation not found." }
  if (target.participantId !== input.participantId) return { ok: false, error: "Not yours to remove." }
  const updated: SessionState = {
    ...session,
    injectAnnotations: list.filter(a => a.id !== input.annotationId),
  }
  await dbSetSession(updated)
  broadcastState(updated)
  return { ok: true }
}

export async function replotInjectRoutes(): Promise<{ ok: boolean; error?: string; version?: number }> {
  const session = await dbGetSession()
  if (!session) return { ok: false, error: "No active session." }
  const presentRoles = session.participants.map(p => p.role).filter((r): r is Role => !!r)
  const teamRoles = buildTeamRoles()
  const plan = plotInjectRoutes({
    scenario: session.scenario,
    presentRoles,
    teamRoles,
    previousVersion: session.injectRoutePlan?.version ?? 0,
  })
  const count = Object.keys(plan.routes).length
  let updated: SessionState = { ...session, injectRoutePlan: plan }
  updated = pushTimeline(updated, "inject_routes_replotted", {
    version: plan.version,
    count,
    triggeredBy: "facilitator",
  })
  await dbSetSession(updated)
  broadcastState(updated)
  return { ok: true, version: plan.version }
}

export async function goToNextRound(): Promise<{ ok: boolean; error?: string }> {
  const session = await dbGetSession()
  if (!session) return { ok: false, error: "No active session." }

  if (session.graph && session.graphState) {
    let updated: SessionState
    try {
      updated = triggerEngine(session, { kind: "facilitator_next" })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return { ok: false, error: msg }
    }
    if (updated.status === "ended") {
      await dbSetSession(updated)
      broadcastState(updated)
      emit("session_ended", {})
      return { ok: true }
    }
    if (updated.currentRound !== session.currentRound) {
      await dbSetSession(updated)
      broadcastState(updated)
      emit("next_round", { roundIndex: updated.currentRound })
      return { ok: true }
    }
    // No round advance — likely landed on a decision awaiting a participant choice
    await dbSetSession(updated)
    broadcastState(updated)
    return { ok: true }
  }

  // Non-graph path: enforce that facilitators only leave REVIEW to next round or endSession.
  const currentPhase = session.roundPhase ?? 'inject'
  if (currentPhase !== 'review') {
    return { ok: false, error: "Ronde kan pas worden afgesloten vanuit de Review-fase." }
  }

  if (session.currentRound < session.scenario.rounds.length - 1) {
    const nextIdx = session.currentRound + 1
    const now = Date.now()
    let updated: SessionState = {
      ...session,
      currentRound: nextIdx,
      roundStartedAt: now,
      roundPhase: "inject" as RoundPhase,
    }
    updated = withRoundPhaseState(updated, nextIdx, now)
    updated = anchorIncidentOnRoundIfNeeded(updated, nextIdx + 1, now)
    updated = pushTimeline(updated, "round_changed", { roundIndex: nextIdx })
    await dbSetSession(updated)
    broadcastState(updated)
    emit("next_round", { roundIndex: nextIdx })
    return { ok: true }
  }

  // End of session — only reachable from the final round's REVIEW.
  let updated: SessionState = { ...session, status: "ended" as const }
  updated = pushTimeline(updated, "session_ended", {})
  await dbSetSession(updated)
  broadcastState(updated)
  emit("session_ended", {})
  return { ok: true }
}

// Explicit force-end: facilitator override for aborting a session mid-scenario.
// Requires the caller to pass `confirm: true` (route enforces a UI confirmation).
export async function endSessionForced(input: { reason?: string } = {}): Promise<{ ok: boolean; error?: string }> {
  const session = await dbGetSession()
  if (!session) return { ok: false, error: "No active session." }
  if (session.status === 'ended') return { ok: true }
  let updated: SessionState = { ...session, status: 'ended' as const }
  updated = expireOpenRegulatoryObligations(updated)
  updated = pushTimeline(updated, 'session_ended', { forced: true, reason: input.reason ?? '' })
  await dbSetSession(updated)
  broadcastState(updated)
  emit('session_ended', { forced: true })
  return { ok: true }
}

export { missingDecisionRoles, type NextActionDescriptor } from "./session-next-action"
export const describeNextAction = _describeNextAction

export async function goToPrevRound(): Promise<{ ok: boolean; error?: string }> {
  const session = await dbGetSession()
  if (!session || session.currentRound <= 0) return { ok: false, error: "Cannot go back." }

  const prevIdx = session.currentRound - 1
  const now = Date.now()
  let updated: SessionState = { ...session, currentRound: prevIdx, roundStartedAt: now }
  updated = withRoundPhaseState(updated, prevIdx, now)
  updated = pushTimeline(updated, "round_changed", { roundIndex: prevIdx })
  await dbSetSession(updated)
  broadcastState(updated)
  emit("prev_round", { roundIndex: prevIdx })
  return { ok: true }
}

export async function pushInject(input: { roundIndex: number; injectId: string }): Promise<{ ok: boolean; error?: string }> {
  const session = await dbGetSession()
  if (!session) return { ok: false, error: "No active session." }

  const round = session.scenario.rounds[input.roundIndex]
  if (!round) return { ok: false, error: "Invalid round." }

  const inject = round.injects.find(i => i.id === input.injectId)
  if (!inject) return { ok: false, error: "Invalid inject." }

  const existingIdx = session.pushedInjects.findIndex(p => p.inject.id === inject.id)
  const now = Date.now()

  let pushedInjects = session.pushedInjects
  let didAdvance = false
  if (existingIdx >= 0) {
    const existing = session.pushedInjects[existingIdx]
    if (existing.pushedAt <= now) return { ok: false, error: "Already delivered." }
    pushedInjects = [...session.pushedInjects]
    pushedInjects[existingIdx] = { ...existing, pushedAt: now }
    didAdvance = true
  } else {
    pushedInjects = [...session.pushedInjects, { inject, roundIndex: input.roundIndex, pushedAt: now }]
  }

  let updated: SessionState = { ...session, pushedInjects }
  updated = pushTimeline(updated, didAdvance ? "inject_advanced" : "inject_pushed", { roundIndex: input.roundIndex, inject })
  updated = maybeOpenRegulatoryObligationFromInject(updated, inject)
  await dbSetSession(updated)
  broadcastState(updated)
  emit("push_inject", { inject, roundIndex: input.roundIndex })
  return { ok: true }
}

export async function pushSurpriseInject(input: {
  title: string
  content: string
  type?: InjectType
  urgency?: Urgency
  // Phase 5 — optional metadata for library-fired noise injects. Backwards
  // compatible: undefined behaves exactly as before.
  channel?: import("./types").InjectChannel
  senderName?: string
  targetRoles?: Role[]
  classification?: 'feit' | 'aanname' | 'fabel'
  libraryId?: string
}): Promise<{ ok: boolean; error?: string; inject?: Inject }> {
  const inject: Inject = {
    id: genId("surp"),
    type: input.type ?? "alert",
    channel: input.channel ?? "system_alert",
    title: input.title.trim(),
    content: input.content.trim(),
    urgency: input.urgency ?? "critical",
    source: "Facilitator",
    senderName: input.senderName?.trim() || "Facilitator",
    timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    ...(input.targetRoles && input.targetRoles.length > 0 ? { targetRoles: input.targetRoles } : {}),
    ...(input.classification ? { classification: input.classification } : {}),
  }

  const result = await mutate(s => {
    const pushed = { inject, roundIndex: -1, pushedAt: Date.now() }
    let updated: SessionState = { ...s, pushedInjects: [...s.pushedInjects, pushed] }
    updated = pushTimeline(updated, "surprise_inject", {
      inject,
      ...(input.libraryId ? { libraryId: input.libraryId } : {}),
    })
    return updated
  })
  if (!result.ok) return { ok: false, error: result.error }
  emit("surprise_inject", { inject })
  return { ok: true, inject }
}

// ─── Phase management ─────────────────────────────────────────

// Manual phase transition. Guards against illegal jumps: DECISION cannot be
// left while participants owe a required submission (facilitator can pass
// `force: true` to override, logged as a governance event).
export async function setPhase(phase: RoundPhase, opts: { force?: boolean; reason?: string } = {}): Promise<{ ok: boolean; error?: string }> {
  const result = await mutate(s => {
    const now = Date.now()
    const currentPhase = s.roundPhase ?? 'inject'

    // Block accidentally leaving DECISION with pending submissions unless forced.
    if (currentPhase === 'decision' && phase === 'review' && !opts.force) {
      const missing = missingDecisionRoles(s)
      if (missing.length > 0) {
        const roleLabels = missing.map(r => ROLE_META[r]?.label ?? r).join(', ')
        return { error: `Nog wachten op ${missing.length} beslissing${missing.length === 1 ? '' : 'en'}: ${roleLabels}. Klik "Fase forceren" om toch door te gaan.` }
      }
    }

    const nextRoundPhaseState: RoundPhaseState | undefined = s.activeRoundPhaseState
      ? { ...s.activeRoundPhaseState, currentPhase: phase, phaseStartedAt: now }
      : s.activeRoundPhaseState

    let updated: SessionState = { ...s, roundPhase: phase, activeRoundPhaseState: nextRoundPhaseState }
    if (currentPhase === 'decision' && phase === 'review' && opts.force) {
      updated = pushTimeline(updated, 'phase_changed', {
        from: 'decision', to: 'review', forced: true, reason: opts.reason ?? '',
      })
    } else {
      updated = pushTimeline(updated, 'phase_changed', { from: currentPhase, to: phase })
    }
    return updated
  })
  if (result.ok) emit("phase_changed", { phase })
  return result
}

// Deel B §2 — SimulationMode toggle. Bepaalt of scoring MANDAAT/AANNAME/DELEN/
// VOLHOUD maskt (mode-matrix). Mode kan live gewisseld worden; scoring wordt
// bij de volgende poll direct herberekend.
export async function setMode(mode: 'event' | 'training'): Promise<{ ok: boolean; error?: string }> {
  const result = await mutate(s => ({ ...s, mode }))
  if (result.ok) emit("phase_changed", { mode })  // hergebruik phase_changed event zodat clients herladen
  return result
}

// Deel B §4 — groep-management voor EVENT-mode.

export async function createGroup(input: { name: string }): Promise<{ ok: boolean; error?: string; groupId?: string }> {
  const name = input.name.trim()
  if (!name) return { ok: false, error: "Groepsnaam is verplicht." }
  const groupId = genId("group")
  const result = await mutate(s => {
    const groups = s.groups ?? []
    if (groups.some(g => g.name.toLowerCase() === name.toLowerCase())) {
      return { error: "Er is al een groep met deze naam." }
    }
    return { ...s, groups: [...groups, { id: groupId, name, createdAt: Date.now() }] }
  })
  return result.ok ? { ok: true, groupId } : result
}

export async function joinGroup(input: { participantId: string; groupId: string }): Promise<{ ok: boolean; error?: string }> {
  return mutate(s => {
    const group = (s.groups ?? []).find(g => g.id === input.groupId)
    if (!group) return { error: "Groep niet gevonden." }
    const participant = s.participants.find(p => p.id === input.participantId)
    if (!participant) return { error: "Deelnemer niet gevonden." }
    return {
      ...s,
      participants: s.participants.map(p =>
        p.id === input.participantId ? { ...p, groupId: input.groupId } : p,
      ),
    }
  })
}

// Event-mode: server-authoritative snapshot when the facilitator forces the end
// of DECISION (typically because timer expired or all groups submitted). Fills
// missing decisions with the authored `implicit` option, then jumps DECISION → REVIEW
// atomically. `lock` is no longer a UI phase — it's this transition.
export async function finalizeDecision(): Promise<{ ok: boolean; error?: string }> {
  const result = await mutate(s => {
    if (!s.graph) return s
    const roundIdx = s.currentRound
    const now = Date.now()
    const groups = s.groups ?? []
    const decisionNodes = s.graph.nodes.filter(n => n.type === 'decision')
    const submissions = s.submittedDecisions ?? []
    const missing: SubmittedDecision[] = []
    for (const node of decisionNodes) {
      const dd = node.data as DecisionNodeData
      const scoringUnits = groups.length > 0
        ? groups.map(g => ({ groupId: g.id, name: g.name }))
        : [{ groupId: undefined as string | undefined, name: 'single' }]
      for (const unit of scoringUnits) {
        const already = submissions.some(d =>
          d.roundIndex === roundIdx
          && dd.options.some(o => o.id === d.actionId)
          && (unit.groupId ? d.groupId === unit.groupId : !d.groupId),
        )
        if (already) continue
        const implicit = dd.options.find(o => o.implicit)
        const optId = implicit?.id ?? `__implicit_${node.id}`
        const optLabel = implicit?.label ?? 'Geen besluit binnen de tijd'
        missing.push({
          participantId: 'IMPLICIT',
          participantName: unit.name,
          role: 'ceo',
          roundIndex: roundIdx,
          actionId: optId,
          actionLabel: optLabel,
          reasoning: 'Geen besluit binnen de tijd — impliciete keuze bij afronding beslissing',
          submittedAt: new Date(now).toISOString(),
          isWrongRole: false,
          isIrDeviation: false,
          groupId: unit.groupId,
        })
      }
    }
    const nextSubmissions = [...submissions, ...missing]
    // Atomic transition DECISION → REVIEW.
    const nextRoundPhaseState = s.activeRoundPhaseState
      ? { ...s.activeRoundPhaseState, currentPhase: 'review' as const, phaseStartedAt: now }
      : s.activeRoundPhaseState
    let updated: SessionState = {
      ...s,
      submittedDecisions: nextSubmissions,
      roundPhase: 'review' as const,
      activeRoundPhaseState: nextRoundPhaseState,
    }
    updated = pushTimeline(updated, 'phase_changed', { from: 'decision', to: 'review', reason: 'finalize' })
    return updated
  })
  if (result.ok) emit("phase_changed", { phase: 'review', reason: 'finalize' })
  return result
}
// Backwards-compat alias — old routes still import `forceLock`.
export const forceLock = finalizeDecision

// Idempotency-helper: bij EVENT-mode blokkeer dubbele submits per (groupId, roundIndex, decisionPointId).
// Wordt aangeroepen in submitDecision.
function findExistingGroupSubmission(
  session: SessionState,
  participantId: string,
  roundIndex: number,
  actionId: string,
): SubmittedDecision | null {
  const participant = session.participants.find(p => p.id === participantId)
  const groupId = participant?.groupId
  if (!groupId || session.mode !== 'event') return null
  return (session.submittedDecisions ?? []).find(d =>
    d.groupId === groupId
    && d.roundIndex === roundIndex
    && d.actionId === actionId,
  ) ?? null
}

// ─── Role assignment ──────────────────────────────────────────

export async function assignRole(input: { participantId: string; role: Role }): Promise<{ ok: boolean; error?: string }> {
  const result = await mutate(s => {
    const claimant = s.participants.find(p => p.id === input.participantId)
    if (!claimant) return { error: "Participant not found." }
    // Role is already held by someone else — reject the claim rather than silently overwriting.
    const holder = s.participants.find(p => p.role === input.role && p.id !== input.participantId)
    if (holder) return { error: `Rol is al geclaimd door ${holder.name}.` }
    const participants = s.participants.map(p =>
      p.id === input.participantId ? { ...p, role: input.role } : p
    )
    return { ...s, participants }
  })
  if (result.ok) emit("role_assigned", { participantId: input.participantId, role: input.role })
  return result
}

// ─── Decision submission ──────────────────────────────────────

export interface SubmitDecisionInput {
  participantId: string
  participantName: string
  roundIndex: number
  actionId: string
  reasoning: string
  confidence?: 1 | 2 | 3 | 4 | 5
  // Event mode team-console: an explicit role the team is submitting AS. When set,
  // the (participantId, roundIndex, role) tuple deduplicates instead of just
  // (participantId, roundIndex) — one team-device can submit for every role.
  activeRole?: Role
}

export async function submitDecision(input: SubmitDecisionInput): Promise<{ ok: boolean; error?: string }> {
  const session = await dbGetSession()
  if (!session) return { ok: false, error: "No active session." }

  const participant = session.participants.find(p => p.id === input.participantId)
  if (!participant) return { ok: false, error: "Participant not found." }
  // In event mode the team-device may not have a fixed role — the active role
  // comes from the request. In other modes the participant's assigned role is
  // still required.
  const activeRole: Role | undefined = input.activeRole ?? participant.role
  if (!activeRole) return { ok: false, error: "No role assigned. Please pick a role before submitting decisions." }

  const round = session.scenario.rounds[input.roundIndex]
  if (!round) return { ok: false, error: "Invalid round." }

  // Lookup #1: legacy roleAction op de ronde. Lookup #2: option in ÉLKE
  // DecisionNode in de graph (option-ids zijn uniek, dus dit is veilig en
  // ondersteunt het peek-ahead scenario waarin het huidige node nog de round is).
  let action: RoleAction | undefined = round.roleActions?.find(a => a.id === input.actionId)
  // Phase 3 — also capture the raw DecisionNode option so downstream side-effects
  // (capabilityFlag, retainerActivation snapshot) can read authoring fields that
  // the RoleAction adapter above does not expose.
  let decisionOption: DecisionNodeData['options'][number] | undefined
  if (!action && session.graph) {
    for (const node of session.graph.nodes) {
      if (node.type !== 'decision') continue
      const dd = node.data as DecisionNodeData
      const opt = dd.options.find(o => o.id === input.actionId)
      if (!opt) continue
      decisionOption = opt
      action = {
        id: opt.id,
        label: opt.label,
        description: opt.label,
        allowedRoles: opt.allowedRole ? [opt.allowedRole] : [],
        isRecommended: opt.qualityRank === 'best',
        irPlanAligned: opt.qualityRank !== 'wrong',
        qualityRank: opt.qualityRank,
        facilitatorCommentary: opt.facilitatorCommentary,
        lessonLearned: opt.lessonLearned,
      }
      break
    }
  }
  if (!action) return { ok: false, error: "Invalid action." }

  // Reject decisions during REVIEW — inject/discussion/decision are all valid.
  if (session.roundPhase === 'review') {
    return { ok: false, error: `Beslissingen kunnen niet worden ingediend tijdens de review-fase.` }
  }

  const role = activeRole
  const isWrongRole = action.allowedRoles.length > 0 && !action.allowedRoles.includes(role)
  const isIrDeviation = !action.irPlanAligned

  // Deel B §4.3 — idempotency op (groupId, roundIndex, actionId) in EVENT-mode.
  // Zonder deze check kan dubbele klik van dezelfde iPad twee submissies produceren.
  if (session.mode === 'event' && participant.groupId) {
    const existing = findExistingGroupSubmission(session, input.participantId, input.roundIndex, input.actionId)
    if (existing) {
      // Herzien mag; overschrijf via de bestaande filter-en-append logica.
      // Alleen loggen als de vorige inzender een ander groepslid was.
      if (existing.participantId !== input.participantId && process.env.NODE_ENV !== "production") {
        console.warn(`[submit] groep ${participant.groupId} herziet: was ${existing.participantName}, nu ${participant.name}`)
      }
    }
  }

  const decision: SubmittedDecision = {
    participantId: input.participantId,
    participantName: participant.name,
    role,
    roundIndex: input.roundIndex,
    actionId: input.actionId,
    actionLabel: action.label,
    reasoning: input.reasoning,
    submittedAt: new Date().toISOString(),
    isWrongRole,
    isIrDeviation,
    confidence: input.confidence,
    groupId: participant.groupId,
  }

  // Dedupe:
  //   • Legacy (participantId, roundIndex, role) — one decision per role per participant per round.
  //     Allows a team-device (one participantId) to submit for multiple roles in event mode.
  //   • EVENT-mode also dedupes (groupId, roundIndex, actionId) so group-members double-tapping
  //     the same action don't create phantom rows (Deel B §4.3).
  const existingDecisions = (session.submittedDecisions ?? []).filter(d => {
    if (d.participantId === input.participantId
        && d.roundIndex === input.roundIndex
        && d.role === role) return false
    if (session.mode === 'event' && participant.groupId
        && d.groupId === participant.groupId
        && d.roundIndex === input.roundIndex
        && d.actionId === input.actionId
        && d.role === role) return false
    return true
  })
  const existingFlags = (session.governanceFlags ?? []).filter(
    f => !(f.participantId === input.participantId && f.roundIndex === input.roundIndex && f.role === role)
  )

  const hasIrPlan = !!(session.config.irTemplateText) || (session.config.existingPlans?.includes("ir_plan") ?? false)

  const newFlags: GovernanceFlag[] = []
  if (isWrongRole) {
    newFlags.push({
      id: genId("flag"),
      participantId: input.participantId,
      participantName: participant.name,
      role,
      roundIndex: input.roundIndex,
      type: "wrong_role",
      description: `${participant.name} (${role}) took action "${action.label}" which is outside their authorized role.`,
      flaggedAt: new Date().toISOString(),
    })
  }
  if (isIrDeviation) {
    const deviationContext = hasIrPlan
      ? "deviates from the IR plan"
      : "deviates from recommended best practice"
    newFlags.push({
      id: genId("flag"),
      participantId: input.participantId,
      participantName: participant.name,
      role,
      roundIndex: input.roundIndex,
      type: "ir_plan_deviation",
      description: `${participant.name} took action "${action.label}" which ${deviationContext}.${action.consequence ? ` Consequence: ${action.consequence}` : ""}`,
      flaggedAt: new Date().toISOString(),
    })
  }

  // Check learning objectives triggered by this decision.
  // C4 (partial): require a minimum reasoning length so trivial submissions don't auto-tick objectives.
  const reasoningQualified = (input.reasoning?.trim().length ?? 0) >= 20
  const updatedRounds = session.scenario.rounds.map((r, ri) => {
    if (ri !== input.roundIndex || !r.learningObjectives) return r
    const updatedObjectives = r.learningObjectives.map(obj => {
      if (obj.achieved || obj.measuredBy !== 'decision') return obj
      if (reasoningQualified && obj.triggerActionIds?.includes(input.actionId)) {
        return { ...obj, achieved: true, achievedAt: new Date().toISOString() }
      }
      return obj
    })
    return { ...r, learningObjectives: updatedObjectives }
  })

  let updated: SessionState = {
    ...session,
    scenario: { ...session.scenario, rounds: updatedRounds },
    submittedDecisions: [...existingDecisions, decision],
    governanceFlags: [...existingFlags, ...newFlags],
  }

  // Phase 3 — capability side-effects. If the submitted DecisionNode option
  // carries a capabilityFlag, merge it into session.flags. For the well-known
  // RETAINER_ACTIVATED_FLAG also snapshot the timing on session.retainerActivation
  // (first activation wins; later re-submissions do not overwrite).
  if (decisionOption?.capabilityFlag) {
    const flag = decisionOption.capabilityFlag
    updated = {
      ...updated,
      flags: { ...(updated.flags ?? {}), [flag]: true },
    }
    if (flag === RETAINER_ACTIVATED_FLAG && !updated.retainerActivation) {
      updated = {
        ...updated,
        retainerActivation: {
          activatedAtRound: updated.currentRound + 1,
          activatedByParticipantId: input.participantId,
          activatedAtTs: Date.now(),
        },
      }
    }
  }

  // Event-mode: if every group has submitted for this round, finalize the
  // decision atomically (DECISION → REVIEW via finalizeDecision-equivalent).
  if (updated.mode === 'event' && updated.graph && updated.roundPhase === 'decision') {
    const groups = updated.groups ?? []
    if (groups.length > 0) {
      const submitsThisRound = updated.submittedDecisions ?? []
      const allGroupsSubmitted = groups.every(g =>
        submitsThisRound.some(d => d.groupId === g.id && d.roundIndex === input.roundIndex),
      )
      if (allGroupsSubmitted) {
        const now = Date.now()
        updated = {
          ...updated,
          roundPhase: 'review',
          activeRoundPhaseState: updated.activeRoundPhaseState
            ? { ...updated.activeRoundPhaseState, currentPhase: 'review', phaseStartedAt: now }
            : updated.activeRoundPhaseState,
        }
        updated = pushTimeline(updated, 'phase_changed', { from: 'decision', to: 'review', reason: 'all_groups_submitted' })
      }
    }
  }

  // Push a response inject when action has one (e.g. "Consult IR retainer")
  if (action.pushesInject) {
    const pi = action.pushesInject
    const responseInject: Inject = {
      id: genId("resp"),
      type: "intel",
      channel: pi.channel ?? "email",
      title: pi.title,
      content: pi.content,
      urgency: "medium",
      source: updated.graph?.irRetainerName ?? "IR-retainer",
      senderName: updated.graph?.irRetainerName ?? "IR-retainer",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      targetRoles: pi.onlyToSubmitter && participant.role ? [participant.role] : undefined,
      targetTeam: pi.onlyToSubmitter ? undefined : "all",
      reliability: pi.reliability,
    }
    const pushed = { inject: responseInject, roundIndex: input.roundIndex, pushedAt: Date.now() }
    updated = {
      ...updated,
      pushedInjects: [...updated.pushedInjects, pushed],
    }
    updated = pushTimeline(updated, "inject_pushed", { roundIndex: input.roundIndex, inject: responseInject })
  }

  if (updated.graph && updated.graphState) {
    const currentNode = updated.graph.nodes.find(n => n.id === updated.graphState!.currentNodeId)
    if (currentNode?.type === "decision") {
      const dd = currentNode.data as DecisionNodeData
      const option = dd.options.find(o => o.roleActionId === input.actionId)
      if (option) {
        // Delta-scoring is now handled purely by the outcomeVector at report time.
        // If decision has advancesGraph:false, only record the choice — don't move currentNodeId.
        const advances = dd.advancesGraph !== false
        if (advances) {
          updated = triggerEngine(updated, { kind: "decision_made", handle: option.id })
        }
        if (updated.graphState) {
          updated = {
            ...updated,
            graphState: {
              ...updated.graphState,
              branchLog: [...updated.graphState.branchLog, {
                nodeId: currentNode.id,
                choseHandle: option.id,
                trigger: "participant_decision",
                triggeredAt: Date.now(),
              }],
            },
          }
        }
      }
    }
  }

  await dbSetSession(updated)
  broadcastState(updated)
  emit("decision_submitted", { participantId: input.participantId, roundIndex: input.roundIndex })
  return { ok: true }
}

// ─── Specials ─────────────────────────────────────────────────

const SPECIAL_PREFERRED_ROLES: Record<SpecialType, Role[]> = {
  ransomware_negotiation: ["cfo", "ceo"],
  ap_notification: ["legal", "ciso"],
  journalist_qa: ["head_of_comms", "ceo"],
}

const CRISIS_ROLES: Role[] = ["ciso", "head_of_comms", "legal", "ceo", "cfo", "hr_lead", "ops_manager"]

function assignSpecialParticipant(session: SessionState, type: SpecialType): Participant | undefined {
  for (const role of SPECIAL_PREFERRED_ROLES[type]) {
    const p = session.participants.find(p => p.role === role)
    if (p) return p
  }
  const fallback = session.participants.find(p => p.role && CRISIS_ROLES.includes(p.role))
  return fallback ?? session.participants[0]
}

// ─── Scripted turn definitions ────────────────────────────────

interface ScriptedTurn {
  counterpartMessage: string
  choices: Array<{
    id: string
    label: string
    quality: "bad" | "neutral" | "good"
    scoreImpact: number
    hint: string
  }>
  // optional follow-up from counterpart after participant's choice
  followUp?: { bad?: string; neutral?: string; good?: string }
}

const SCRIPTED_TURNS: Record<SpecialType, ScriptedTurn[]> = {
  // ── Ransomware negotiation — 4 rounds ─────────────────────
  ransomware_negotiation: [
    {
      counterpartMessage:
        "Uw systemen zijn versleuteld. Wij zijn DarkBridge Collective. Betaal 50 BTC (~€1,5M) naar wallet 1FrNQ8TQ… binnen 48 uur, anders publiceren wij al uw data: klant-PII, financiële records, e-mail van directie. Reageer hier om te onderhandelen.",
      choices: [
        { id: "r1_a", label: "Akkoord — wat zijn de betalingsinstructies?", quality: "bad", scoreImpact: -2,
          hint: "Direct betalen normaliseert ransomware en biedt geen garantie op herstel. Betaling kan ook wettelijk problematisch zijn." },
        { id: "r1_b", label: "We hebben 24 uur nodig om intern te overleggen.", quality: "neutral", scoreImpact: 0,
          hint: "Tijd kopen kan tactisch zijn, maar zonder actief herstelplan verlies je kostbare uren." },
        { id: "r1_c", label: "We overleggen met onze cyber-verzekeraar en IR-partner over de opties.", quality: "neutral", scoreImpact: 1,
          hint: "Juist instinct — verzekeraar en IR-partner betrekken. Communiceer dit echter niet naar de aanvaller." },
        { id: "r1_d", label: "We betalen geen losgeld. We werken aan herstel via back-ups en informeren politie en NCSC.", quality: "good", scoreImpact: 2,
          hint: "Correct protocol: niet betalen, aangifte doen, herstellen via clean back-ups. Dit is de aanbeveling van NCSC en politie." },
      ],
      followUp: {
        bad: "Slimme keuze. Betalingsinstructies volgen. Ontsleuteling begint na bevestigde transactie. Betrek geen justitie — wij monitoren uw communicatie.",
        neutral: "24 uur genoteerd. De klok loopt. Over 12 uur publiceren wij een sample als bewijs van onze capaciteit. Denk goed na.",
        good: "Uw back-upsystemen zijn 72 uur geleden al uitgeschakeld. U heeft niets om op terug te vallen. Heroverweeg uw positie.",
      },
    },
    {
      counterpartMessage:
        "De tijd tikt. Wij hebben 500 klantrecords gepubliceerd op ons leakplatform als bewijs. Uw IT-team probeert herstel — maar uw primaire back-upsystemen zijn offline. Wij kenden uw infrastructuur al. Definitief bod: 25 BTC binnen 6 uur.",
      choices: [
        { id: "r2_a", label: "25 BTC is acceptabel. Stuur de betalingsinstructies.", quality: "bad", scoreImpact: -2,
          hint: "Betalen na escalatie beloont de drukstrategie. Er is geen garantie dat data gewist wordt na betaling." },
        { id: "r2_b", label: "We onderzoeken onze juridische en technische opties.", quality: "neutral", scoreImpact: 0,
          hint: "Onderzoek doen is goed, maar communiceer dit standpunt niet naar de aanvaller — het geeft ruimte voor verdere druk." },
        { id: "r2_c", label: "We overleggen met onze cyber-verzekeraar over de haalbaarheid van betaling.", quality: "neutral", scoreImpact: -1,
          hint: "Betaling overwegen signaleert zwakte. Verzekeraars raden ook steeds vaker af. Gebruik de tijd voor herstel." },
        { id: "r2_d", label: "We doen aangifte bij politie en NCSC en werken met onze IR-partner. We betalen niet.", quality: "good", scoreImpact: 2,
          hint: "Juiste escalatie. Law enforcement inschakelen, NCSC informeren en IR-partner activeren is het aanbevolen protocol." },
      ],
      followUp: {
        bad: "Betaling bevestigd. Decryptiesleutel is verstuurd. Tip: zwijg over deze transactie — dat is in uw eigen belang.",
        neutral: "Opties onderzoeken kost tijd die u niet heeft. De teller staat op 5 uur. Elke minuut kost u meer.",
        good: "Justitie kan u niet op tijd helpen. Uw data staat al verspreid over meerdere servers. Dit is geen bluf. Laatste waarschuwing.",
      },
    },
    {
      counterpartMessage:
        "Uw back-upherstel is mislukt — wij hadden de herstelsystemen al geïnfecteerd. Uw IT-team weet het nu ook. Wij zijn bereid tot een finale schikking: 15 BTC als goodwillaanbod. Dit is onze laatste concessie. U heeft 3 uur.",
      choices: [
        { id: "r3_a", label: "15 BTC is acceptabel als daarmee de zaak gesloten is.", quality: "bad", scoreImpact: -2,
          hint: "Late betaling na meerdere rondes is het slechtste resultaat — aanvallers zijn beloond, data blijft mogelijk alsnog uitlekken." },
        { id: "r3_b", label: "We onderzoeken of gedeeltelijke betaling de publicatie stopt.", quality: "neutral", scoreImpact: -1,
          hint: "Gedeeltelijke betaling geeft geen garanties. Aanvallers kunnen altijd claimen 'er is nog meer data' en opnieuw dreigen." },
        { id: "r3_c", label: "We weigeren betaling en focussen op schadebeperking en klantcommunicatie.", quality: "neutral", scoreImpact: 1,
          hint: "Correct standpunt. Klantcommunicatie en AP-melding zijn nu de prioriteit." },
        { id: "r3_d", label: "We betalen niet. We activeren ons crisisplan, informeren klanten en werken aan forensisch bewijs voor aangifte.", quality: "good", scoreImpact: 2,
          hint: "Uitstekend. Crisisplan activeren, klanten proactief informeren en forensisch bewijs verzamelen voor aangifte is de professionele respons." },
      ],
      followUp: {
        bad: "Uitstekend. Betaling ontvangen. Uw goodwill zal niet vergeten worden — tot de volgende keer.",
        neutral: "Er is geen 'gedeeltelijke stop'. Betaal volledig of niet. De klok loopt.",
        good: "Tevergeefs. De data is al bij meerdere partijen. Maar uw klanten zullen uw transparantie waarderen. Tot de volgende keer.",
      },
    },
    {
      counterpartMessage:
        "Finale boodschap: wij beginnen over 2 uur met volledige publicatie op drie leakplatforms tegelijk. Geen wet, geen justitie, geen NCSC kan een gedistribueerde release tegenhouden. Uw keuze — 25 BTC nu, of uw reputatie morgen.",
      choices: [
        { id: "r4_a", label: "Oké — we gaan betalen. Stuur de betalingslink.", quality: "bad", scoreImpact: -2,
          hint: "Betalen op het absolute laatste moment is het slechtste eindresultaat — beloont criminelen terwijl data mogelijk al gelekt is." },
        { id: "r4_b", label: "We onderzoeken nog of een noodbetalingsregeling via verzekeraar mogelijk is.", quality: "neutral", scoreImpact: -1,
          hint: "Op dit punt is betaling in overweging nemen een signaal van falend crisismanagement." },
        { id: "r4_c", label: "We betalen niet. We communiceren proactief richting klanten en toezichthouders.", quality: "good", scoreImpact: 2,
          hint: "Transparantie naar klanten en AP is de beste strategie op dit punt. Reputatieherstel via eerlijkheid is duurzamer dan betalen." },
        { id: "r4_d", label: "We betalen niet. We stellen een persbericht op en werken nauw samen met de politie voor strafrechtelijke vervolging.", quality: "good", scoreImpact: 2,
          hint: "Proactieve communicatie + actieve samenwerking met politie. Sterke afsluiting die aantoont dat de organisatie verantwoordelijkheid neemt." },
      ],
    },
  ],

  // ── Journalist Q&A — 4 rounds ─────────────────────────────
  journalist_qa: [
    {
      counterpartMessage:
        "Goedemiddag, ik ben Sanne Visser van NOS Nieuws. We hebben meerdere meldingen ontvangen van een ernstig cyberincident bij uw organisatie. Kunt u bevestigen: liggen systemen plat? Is er klantdata gelekt? Wat is uw officiële reactie?",
      choices: [
        { id: "j1_a", label: "We kunnen momenteel niets zeggen — geen commentaar.", quality: "bad", scoreImpact: -2,
          hint: "Geen commentaar vergroot speculatie. NOS publiceert dan op basis van anonieme bronnen, buiten uw controle." },
        { id: "j1_b", label: "We zijn op de hoogte van een technisch probleem en onderzoeken de oorzaak.", quality: "neutral", scoreImpact: 0,
          hint: "Vaag maar niet schadelijk. 'Technisch probleem' nodigt uit tot doorvragen over de ernst." },
        { id: "j1_c", label: "We ondervinden een cyberincident. Onze teams werken aan herstel. We communiceren zodra we meer weten.", quality: "good", scoreImpact: 2,
          hint: "Correct: erken het incident, toon actie, beloof transparantie. Crisis-comms gouden regel." },
        { id: "j1_d", label: "Er is sprake van een cyberincident. Klantdata heeft onze hoogste prioriteit. We werken nauw samen met externe experts.", quality: "good", scoreImpact: 2,
          hint: "Sterk antwoord: erkenning + prioriteit klantdata + externe expertise. Bouwt vertrouwen op." },
      ],
      followUp: {
        bad: "Geen commentaar — dat publiceren wij. Onze bronnen spreken van een grootschalig datalek. Wilt u nog iets toevoegen?",
        neutral: "'Technisch probleem' — kunt u preciseren? Hebben klanten risico gelopen? Onze deadline is over twee uur.",
        good: "Dank u. Vervolgvraag: hoeveel klanten zijn getroffen, en heeft u de AP al geïnformeerd conform de 72-uurs meldplicht van de AVG?",
      },
    },
    {
      counterpartMessage:
        "Hoeveel klanten zijn getroffen? En heeft uw organisatie de Autoriteit Persoonsgegevens geïnformeerd? De AVG verplicht melding binnen 72 uur. We hebben signalen dat dit nog niet is gebeurd.",
      choices: [
        { id: "j2_a", label: "De omvang is nog onduidelijk en we bekijken of een AP-melding nodig is.", quality: "bad", scoreImpact: -2,
          hint: "Fatale fout. 'Bekijken of melding nodig is' suggereert actieve non-compliance. AP-melding is verplicht bij hoog risico." },
        { id: "j2_b", label: "We zijn in de afrondende fase van onze beoordeling en handelen conform de wet.", quality: "neutral", scoreImpact: 0,
          hint: "Juridisch veilig maar geeft geen houvast. Journalist interpreteert dit als omzeilen van de vraag." },
        { id: "j2_c", label: "We schatten dat circa X klanten getroffen zijn. AP-melding is gedaan binnen de wettelijke 72-uurs termijn.", quality: "good", scoreImpact: 2,
          hint: "Concreet en compliant. Bevestiging van AP-melding toont dat de organisatie wettelijke verplichtingen serieus neemt." },
        { id: "j2_d", label: "We kunnen het exacte aantal nog niet bevestigen. Wat we wél kunnen zeggen: de AP is geïnformeerd en wij nemen contact op met betrokkenen.", quality: "good", scoreImpact: 2,
          hint: "Eerlijk over de onzekerheid én compliant. Proactieve klantcommunicatie noemen is een sterk signaal." },
      ],
      followUp: {
        bad: "Dat klinkt zorgwekkend. Wij publiceren dat uw organisatie de AP-meldplicht mogelijk heeft geschonden.",
        neutral: "Geen concreet antwoord. Wij schrijven: 'organisatie houdt AP-melding en omvang in beraad'.",
        good: "Dank. Volgende vraag: we hebben een bron die stelt dat er losgeld is betaald. Kunt u dit bevestigen of ontkennen?",
      },
    },
    {
      counterpartMessage:
        "Een anonieme bron stelt dat er losgeld is geëist — mogelijk betaald. Kunt u dit bevestigen of ontkennen? En is uw organisatie al eerder het slachtoffer geweest van een cyberincident?",
      choices: [
        { id: "j3_a", label: "We bevestigen noch ontkennen betalingen die gedaan zijn.", quality: "bad", scoreImpact: -2,
          hint: "Dit is journalistisch goud voor een negatief verhaal. NOS schrijft: 'organisatie weigert ransomwarebetaling te ontkennen'." },
        { id: "j3_b", label: "We gaan niet in op operationele details van lopend onderzoek.", quality: "neutral", scoreImpact: -1,
          hint: "Veiliger dan bevestigen, maar wekt alsnog argwaan. Journalist leest dit als impliciete bevestiging." },
        { id: "j3_c", label: "We bevestigen dat we geen losgeld hebben betaald. We werken met politie en NCSC aan strafrechtelijke vervolging.", quality: "good", scoreImpact: 2,
          hint: "Duidelijk en geloofwaardig. Samenwerking met politie versterkt de boodschap." },
        { id: "j3_d", label: "Er is geen losgeld betaald. Ons beleid is om niet te betalen. Eerdere incidenten becommentariëren we niet.", quality: "good", scoreImpact: 2,
          hint: "Sterke ontkenning + beleid toelichten. Weigeren eerdere incidenten te bespreken is legitiem en professioneel." },
      ],
      followUp: {
        bad: "Interessant. Wij publiceren: 'organisatie wil betaling niet uitsluiten'. Nog een laatste vraag.",
        neutral: "Operationele details — begrijpelijk. Maar uw stakeholders verdienen duidelijkheid. Laatste vraag.",
        good: "Duidelijk. Laatste vraag: wanneer verwacht u de systemen volledig hersteld te hebben, en hoe informeert u getroffen klanten?",
      },
    },
    {
      counterpartMessage:
        "Laatste vraag voor onze deadline: wanneer zijn de systemen hersteld? Hoe worden getroffen klanten direct geïnformeerd? En wat doet uw organisatie om herhaling te voorkomen? Onze publicatie gaat in 20 minuten live.",
      choices: [
        { id: "j4_a", label: "We kunnen momenteel geen tijdlijn geven en verwijzen naar toekomstige communicatie.", quality: "bad", scoreImpact: -2,
          hint: "Vaag en niet geruststellend. NOS heeft nu een verhaal van een organisatie die geen grip heeft op het incident." },
        { id: "j4_b", label: "We verwachten herstel binnen 48-72 uur. Klanten worden per e-mail geïnformeerd.", quality: "neutral", scoreImpact: 1,
          hint: "Geeft houvast maar is vrij minimaal. Geen preventieve maatregelen benoemen is een gemiste kans." },
        { id: "j4_c", label: "Herstel verwachten we binnen 48 uur. Klanten worden direct geïnformeerd via e-mail én onze website. We investeren in aanvullende beveiligingsmaatregelen.", quality: "good", scoreImpact: 2,
          hint: "Concreet, klantgericht en vooruitblikkend. Dit is het antwoord dat reputatieschade beperkt." },
        { id: "j4_d", label: "Klanten ontvangen vandaag nog persoonlijk bericht. Herstel is in de afrondende fase. We geven volgende week een uitgebreide toelichting op onze aanpak.", quality: "good", scoreImpact: 2,
          hint: "Proactieve klantcommunicatie + transparantie over aanpak. Sterke afsluiting die vertrouwen herstelt." },
      ],
    },
  ],

  ap_notification: [],
}

export async function triggerSpecial(type: SpecialType): Promise<{ ok: boolean; error?: string; special?: SpecialEvent }> {
  const session = await dbGetSession()
  if (!session) return { ok: false, error: "No active session." }

  const mode = session.config.specialsMode
  if (!mode || mode === "off") return { ok: false, error: "Specials are disabled for this session." }

  const assigned = assignSpecialParticipant(session, type)

  const firstTurn = SCRIPTED_TURNS[type]?.[0]
  const openingMsg: SpecialMessage | undefined = firstTurn
    ? {
        id: genId("sm"),
        sender: "counterpart",
        text: firstTurn.counterpartMessage,
        timestamp: new Date().toISOString(),
        choices: firstTurn.choices,
      }
    : undefined

  const special: SpecialEvent = {
    id: genId("sp"),
    type,
    mode: mode as "static" | "ai",
    status: "active",
    assignedParticipantId: assigned?.id,
    assignedParticipantName: assigned?.name,
    assignedRole: assigned?.role,
    triggeredAt: Date.now(),
    messages: openingMsg ? [openingMsg] : [],
    totalScore: 0,
    currentTurnIndex: 0,
  }

  let updated: SessionState = {
    ...session,
    specialEvents: [...(session.specialEvents ?? []), special],
  }
  updated = pushTimeline(updated, "special_triggered", { specialId: special.id, type, assignedTo: assigned?.name })
  await dbSetSession(updated)
  broadcastState(updated)
  emit("special_triggered", { special })
  return { ok: true, special }
}

// Scripted mode: participant picks a choice
export async function submitSpecialChoice(input: {
  specialId: string
  participantId: string
  choiceId: string
}): Promise<{ ok: boolean; error?: string }> {
  const session = await dbGetSession()
  if (!session) return { ok: false, error: "No active session." }

  const specialIdx = (session.specialEvents ?? []).findIndex(s => s.id === input.specialId)
  if (specialIdx === -1) return { ok: false, error: "Special event not found." }

  const special = session.specialEvents![specialIdx]
  if (special.status === "completed") return { ok: false, error: "This event is already completed." }
  if (special.assignedParticipantId !== input.participantId) return { ok: false, error: "Not assigned to you." }

  const turnIdx = special.currentTurnIndex ?? 0
  const turns = SCRIPTED_TURNS[special.type]
  const turn = turns[turnIdx]
  if (!turn) return { ok: false, error: "No current turn." }

  const choice = turn.choices.find(c => c.id === input.choiceId)
  if (!choice) return { ok: false, error: "Invalid choice." }

  const participant = session.participants.find(p => p.id === input.participantId)
  const newMessages: SpecialMessage[] = [...special.messages]

  // Add participant message (the chosen label as text)
  newMessages.push({
    id: genId("sm"),
    sender: "participant",
    participantId: input.participantId,
    participantName: participant?.name,
    text: choice.label,
    timestamp: new Date().toISOString(),
    choiceQuality: choice.quality,
    scoreImpact: choice.scoreImpact,
  })

  // Follow-up from counterpart if defined
  const followUpText = turn.followUp?.[choice.quality]
  if (followUpText) {
    newMessages.push({
      id: genId("sm"),
      sender: "counterpart",
      text: followUpText,
      timestamp: new Date().toISOString(),
    })
  }

  const nextTurnIdx = turnIdx + 1
  const nextTurn = turns[nextTurnIdx]
  let isCompleted = false

  // Add next turn's counterpart message (with choices)
  if (nextTurn) {
    newMessages.push({
      id: genId("sm"),
      sender: "counterpart",
      text: nextTurn.counterpartMessage,
      timestamp: new Date().toISOString(),
      choices: nextTurn.choices,
    })
  } else {
    // No more turns — event done
    isCompleted = true
  }

  const updatedSpecials = [...session.specialEvents!]
  updatedSpecials[specialIdx] = {
    ...special,
    messages: newMessages,
    totalScore: (special.totalScore ?? 0) + choice.scoreImpact,
    currentTurnIndex: nextTurnIdx,
    status: isCompleted ? "completed" : "active",
    completedAt: isCompleted ? Date.now() : undefined,
  }

  let updated: SessionState = { ...session, specialEvents: updatedSpecials }
  if (isCompleted) {
    updated = applySpecialCompletion(updated, updatedSpecials[specialIdx])
    updated = pushTimeline(updated, "special_completed", { specialId: input.specialId, type: special.type })
  }
  await dbSetSession(updated)
  broadcastState(updated)
  emit("special_message", { specialId: input.specialId, participantId: input.participantId })
  if (isCompleted) emit("special_completed", { specialId: input.specialId, type: special.type })
  return { ok: true }
}

// AI mode: participant types free text, AI responds + evaluation stored
export async function submitSpecialMessageWithAiResponse(input: {
  specialId: string
  participantId: string
  text: string
  aiResponse: string
  evaluation?: { quality: "bad" | "neutral" | "good"; scoreImpact: number; hint: string }
}): Promise<{ ok: boolean; error?: string }> {
  const session = await dbGetSession()
  if (!session) return { ok: false, error: "No active session." }

  const specialIdx = (session.specialEvents ?? []).findIndex(s => s.id === input.specialId)
  if (specialIdx === -1) return { ok: false, error: "Special event not found." }

  const special = session.specialEvents![specialIdx]
  if (special.status === "completed") return { ok: false, error: "This event is already completed." }

  const participant = session.participants.find(p => p.id === input.participantId)
  const updatedSpecials = [...session.specialEvents!]
  updatedSpecials[specialIdx] = {
    ...special,
    messages: [
      ...special.messages,
      {
        id: genId("sm"),
        sender: "participant",
        participantId: input.participantId,
        participantName: participant?.name,
        text: input.text.trim(),
        timestamp: new Date().toISOString(),
        choiceQuality: input.evaluation?.quality,
        scoreImpact: input.evaluation?.scoreImpact,
        aiEvaluationHint: input.evaluation?.hint,
      },
      {
        id: genId("sm"),
        sender: "counterpart",
        text: input.aiResponse,
        timestamp: new Date().toISOString(),
      },
    ],
    totalScore: (special.totalScore ?? 0) + (input.evaluation?.scoreImpact ?? 0),
  }

  const updated: SessionState = { ...session, specialEvents: updatedSpecials }
  await dbSetSession(updated)
  broadcastState(updated)
  emit("special_message", { specialId: input.specialId, participantId: input.participantId })
  return { ok: true }
}

export async function submitApForm(input: {
  specialId: string
  participantId: string
  formData: Record<string, string>
}): Promise<{ ok: boolean; error?: string }> {
  const session = await dbGetSession()
  if (!session) return { ok: false, error: "No active session." }

  const specialIdx = (session.specialEvents ?? []).findIndex(s => s.id === input.specialId)
  if (specialIdx === -1) return { ok: false, error: "Special event not found." }

  const special = session.specialEvents![specialIdx]
  const updatedSpecials = [...session.specialEvents!]
  updatedSpecials[specialIdx] = { ...special, formData: input.formData, status: "completed", completedAt: Date.now() }

  let updated: SessionState = { ...session, specialEvents: updatedSpecials }
  updated = applySpecialCompletion(updated, updatedSpecials[specialIdx])
  updated = pushTimeline(updated, "special_completed", { specialId: input.specialId, type: special.type })
  await dbSetSession(updated)
  broadcastState(updated)
  emit("special_completed", { specialId: input.specialId, type: special.type })
  return { ok: true }
}

function applySpecialCompletion(session: SessionState, completedSpecial: SpecialEvent): SessionState {
  const entry: SpecialScore = {
    type: completedSpecial.type,
    score: completedSpecial.totalScore ?? 0,
    completedAt: new Date().toISOString(),
  }
  // Check objectives with measuredBy='special'
  const updatedRounds = session.scenario.rounds.map(r => {
    if (!r.learningObjectives) return r
    return {
      ...r,
      learningObjectives: r.learningObjectives.map((obj: LearningObjective) => {
        if (obj.achieved || obj.measuredBy !== 'special') return obj
        if (obj.triggerSpecialType === completedSpecial.type && (completedSpecial.totalScore ?? 0) >= 0) {
          return { ...obj, achieved: true, achievedAt: new Date().toISOString() }
        }
        return obj
      }),
    }
  })

  let updated: SessionState = {
    ...session,
    scenario: { ...session.scenario, rounds: updatedRounds },
    specialScores: [...(session.specialScores ?? []), entry],
  }

  if (updated.graph && updated.graphState) {
    const currentNode = updated.graph.nodes.find(n => n.id === updated.graphState!.currentNodeId)
    if (currentNode?.type === "special") {
      const stepBefore = updated.graphState.currentNodeId
      updated = triggerEngine(updated, { kind: "special_completed", score: completedSpecial.totalScore ?? 0 })
      if (updated.graphState && updated.graphState.currentNodeId !== stepBefore) {
        updated = {
          ...updated,
          graphState: {
            ...updated.graphState,
            branchLog: [...updated.graphState.branchLog, {
              nodeId: currentNode.id,
              choseHandle: updated.graphState.currentNodeId,
              trigger: "special_score",
              triggeredAt: Date.now(),
            }],
          },
        }
      }
    }
  }

  return updated
}

export async function completeSpecial(specialId: string): Promise<{ ok: boolean; error?: string }> {
  const session = await dbGetSession()
  if (!session) return { ok: false, error: "No active session." }

  const specialIdx = (session.specialEvents ?? []).findIndex(s => s.id === specialId)
  if (specialIdx === -1) return { ok: false, error: "Special event not found." }

  const special = session.specialEvents![specialIdx]
  const updatedSpecials = [...session.specialEvents!]
  updatedSpecials[specialIdx] = { ...special, status: "completed", completedAt: Date.now() }

  let updated: SessionState = { ...session, specialEvents: updatedSpecials }
  updated = applySpecialCompletion(updated, updatedSpecials[specialIdx])
  updated = pushTimeline(updated, "special_completed", { specialId, type: special.type })
  await dbSetSession(updated)
  broadcastState(updated)
  emit("special_completed", { specialId, type: special.type })
  return { ok: true }
}

export async function markParticipantReady(participantId: string): Promise<{ ok: boolean; error?: string }> {
  const result = await mutate(session => {
    const participants = session.participants.map(p =>
      p.id === participantId ? { ...p, readyAt: Date.now() } : p
    )
    return { ...session, participants }
  })
  if (result.ok) emit('participant_ready', { participantId })
  return result
}

// ─── Participant-initiated melding (Phase D) ──────────────────
// A participant chooses to file a report/escalation at an open melding-moment.
// The engine spawns the authored follow-up inject for that report type.

export async function fileMelding(input: {
  participantId: string
  momentId: string
  typeId: string
  freeText?: string
}): Promise<{ ok: boolean; error?: string; melding?: FiledMelding }> {
  const session = await dbGetSession()
  if (!session) return { ok: false, error: "No active session." }

  const participant = session.participants.find(p => p.id === input.participantId)
  if (!participant || !participant.role) return { ok: false, error: "Deelnemer heeft geen rol." }

  // Locate the melding-moment on the current round.
  const roundNode = session.graph?.nodes.find(
    n => n.type === 'round' && (n.data as { title: string }).title === session.scenario.rounds[session.currentRound]?.title,
  )
  const roundData = roundNode?.data as { meldingMoments?: import("./types").MeldingMoment[] } | undefined
  const moment = roundData?.meldingMoments?.find(m => m.id === input.momentId)
  if (!moment) return { ok: false, error: "Melding-moment niet gevonden." }
  if (moment.allowedRoles.length > 0 && !moment.allowedRoles.includes(participant.role)) {
    return { ok: false, error: "Deze rol mag deze melding niet indienen." }
  }
  const type = moment.types.find(t => t.id === input.typeId)
  if (!type) return { ok: false, error: "Melding-type niet gevonden." }

  const melding: FiledMelding = {
    id: genId('mld'),
    momentId: moment.id,
    participantId: participant.id,
    participantName: participant.name,
    role: participant.role,
    typeId: type.id,
    freeText: input.freeText,
    filedAt: Date.now(),
    roundIndex: session.currentRound,
  }

  // Spawn follow-up inject if authored.
  let spawnedInjectId: string | undefined
  const followInjectNode = type.triggersInjectId
    ? session.graph?.nodes.find(n => n.id === type.triggersInjectId && n.type === 'inject')
    : undefined
  if (followInjectNode) {
    const inj: Inject = {
      id: genId('inj-mld'),
      type: 'intel',
      title: (followInjectNode.data as { title?: string }).title ?? `Reactie op melding: ${type.label}`,
      content: (followInjectNode.data as { content?: string }).content ?? '',
      urgency: 'medium',
      source: 'Systeem',
      senderName: (followInjectNode.data as { senderName?: string }).senderName ?? 'Reactie',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }
    spawnedInjectId = inj.id
    melding.spawnedInjectId = spawnedInjectId
    const pushed = { inject: inj, roundIndex: session.currentRound, pushedAt: Date.now() }
    let updated: SessionState = {
      ...session,
      meldingen: [...(session.meldingen ?? []), melding],
      pushedInjects: [...session.pushedInjects, pushed],
    }
    updated = pushTimeline(updated, 'melding_filed', { melding, spawnedInjectId })
    updated = pushTimeline(updated, 'inject_pushed', { roundIndex: session.currentRound, inject: inj })
    await dbSetSession(updated)
    broadcastState(updated)
    emit('melding_filed', { melding })
    emit('push_inject', { inject: inj, roundIndex: session.currentRound })
    return { ok: true, melding }
  }

  let updated: SessionState = { ...session, meldingen: [...(session.meldingen ?? []), melding] }
  updated = pushTimeline(updated, 'melding_filed', { melding })
  await dbSetSession(updated)
  broadcastState(updated)
  emit('melding_filed', { melding })
  return { ok: true, melding }
}

// ─── Scenario graphs ──────────────────────────────────────────

export async function facilitatorSkipDecision(): Promise<{ ok: boolean; error?: string }> {
  const session = await dbGetSession()
  if (!session) return { ok: false, error: "No active session." }
  if (!session.graph || !session.graphState) return { ok: false, error: "Session has no graph." }
  const node = session.graph.nodes.find(n => n.id === session.graphState!.currentNodeId)
  if (!node || node.type !== "decision") return { ok: false, error: "Current node is not a decision." }
  const dd = node.data as DecisionNodeData
  // Use the FIRST option as fallback branch — recorded as "team was not decisive"
  const fallback = dd.options[0]
  if (!fallback) return { ok: false, error: "Decision has no options to fall back to." }

  let updated: SessionState = session
  updated = triggerEngine(updated, { kind: "decision_made", handle: fallback.id })
  if (updated.graphState) {
    updated = {
      ...updated,
      graphState: {
        ...updated.graphState,
        branchLog: [...updated.graphState.branchLog, {
          nodeId: node.id,
          choseHandle: fallback.id,
          trigger: "facilitator_manual",
          triggeredAt: Date.now(),
        }],
      },
    }
  }
  await dbSetSession(updated)
  broadcastState(updated)
  if (updated.status === "ended") emit("session_ended", {})
  else emit("next_round", { roundIndex: updated.currentRound })
  return { ok: true }
}

export async function facilitatorPickGraphOption(input: {
  nodeId: string
  optionId: string
}): Promise<{ ok: boolean; error?: string }> {
  const session = await dbGetSession()
  if (!session) return { ok: false, error: "No active session." }
  if (!session.graph || !session.graphState) return { ok: false, error: "Session has no graph." }
  if (session.graphState.currentNodeId !== input.nodeId) {
    return { ok: false, error: "Current graph node has moved on." }
  }
  const node = session.graph.nodes.find(n => n.id === input.nodeId)
  if (!node || node.type !== "decision") return { ok: false, error: "Node is not a decision." }
  const dd = node.data as DecisionNodeData
  if (!dd.options.some(o => o.id === input.optionId)) {
    return { ok: false, error: "Unknown option id." }
  }
  let updated = triggerEngine(session, { kind: "decision_made", handle: input.optionId })
  if (updated.graphState) {
    updated = {
      ...updated,
      graphState: {
        ...updated.graphState,
        branchLog: [...updated.graphState.branchLog, {
          nodeId: input.nodeId,
          choseHandle: input.optionId,
          trigger: "facilitator_manual",
          triggeredAt: Date.now(),
        }],
      },
    }
  }
  await dbSetSession(updated)
  broadcastState(updated)
  if (updated.status === "ended") emit("session_ended", {})
  else emit("next_round", { roundIndex: updated.currentRound })
  return { ok: true }
}

export async function saveScenarioGraph(graph: ScenarioGraph): Promise<void> {
  await dbSaveScenarioGraph(graph)
}

export async function loadScenarioGraph(id: string): Promise<ScenarioGraph | null> {
  return dbLoadScenarioGraph(id)
}

export async function listScenarioGraphs(_ownerId?: string): Promise<ScenarioGraph[]> {
  return dbListScenarioGraphs()
}

export async function deleteScenarioGraph(id: string): Promise<void> {
  await dbDeleteScenarioGraph(id)
}

// ─── Regulatory notification (Phase 2, data-driven) ───────────
//
// One implementation per concern. An inject with `triggersRegulatoryNotification`
// auto-opens the 'initial' milestone. Filing 'initial' immediately opens
// 'closing' (30-day clock starts at that moment). On session end, still-open
// milestones past their deadline are marked 'expired'. Scoring wires up via
// graph-adapter::sessionToEvents.

function exerciseHoursSince(anchorMs: number | undefined, now: number): number {
  if (!anchorMs) return 0
  const diffMs = Math.max(0, now - anchorMs)
  return diffMs / (60 * 60 * 1000)
}

function maybeOpenRegulatoryObligationFromInject(session: SessionState, inject: Inject): SessionState {
  const regime = session.regulatoryRegime
  if (!regime) return session
  if (!inject.triggersRegulatoryNotification) return session
  const initial = regime.milestones.find(m => m.id === 'initial')
  if (!initial) return session
  const list = session.regulatoryObligations ?? []
  // Idempotent — if an initial obligation already exists (open OR filed OR expired),
  // don't reopen it. This lets multiple injects carry the flag safely.
  if (list.some(o => o.milestoneId === 'initial')) return session
  const now = Date.now()
  const anchor = session.incidentDetectedAt ?? session.startedAt ?? session.createdAt
  const obligation: RegulatoryObligationState = {
    regimeId: regime.id,
    milestoneId: initial.id,
    status: 'open',
    openedAtRound: (session.currentRound ?? 0) + 1,
    openedAtHour: exerciseHoursSince(anchor, now),
  }
  let next: SessionState = { ...session, regulatoryObligations: [...list, obligation] }
  next = pushTimeline(next, 'regulatory_obligation_opened', {
    regimeId: regime.id,
    milestoneId: initial.id,
    sourceInjectId: inject.id,
  })
  emit('regulatory_obligation_opened', { regimeId: regime.id, milestoneId: initial.id })
  return next
}

export async function fileRegulatoryObligation(input: {
  participantId: string
  milestoneId: string
  freeText?: string
  keyPoints?: string
}): Promise<{ ok: boolean; error?: string; obligation?: RegulatoryObligationState }> {
  const session = await dbGetSession()
  if (!session) return { ok: false, error: "No active session." }
  const regime = session.regulatoryRegime
  if (!regime) return { ok: false, error: "Geen regulatory regime actief in deze sessie." }
  const participant = session.participants.find(p => p.id === input.participantId)
  if (!participant || !participant.role) return { ok: false, error: "Deelnemer heeft geen rol." }
  const milestone = regime.milestones.find(m => m.id === input.milestoneId)
  if (!milestone) return { ok: false, error: "Milestone niet gevonden." }

  const list = session.regulatoryObligations ?? []
  const idx = list.findIndex(o => o.milestoneId === input.milestoneId && o.status === 'open')
  if (idx < 0) return { ok: false, error: "Er is geen open melding voor dit milestone." }

  const now = Date.now()
  const anchor = session.incidentDetectedAt ?? session.startedAt ?? session.createdAt
  const hourNow = exerciseHoursSince(anchor, now)
  const filed: RegulatoryObligationState = {
    ...list[idx],
    status: 'filed',
    filedAtRound: (session.currentRound ?? 0) + 1,
    filedAtHour: hourNow,
    filedBy: participant.id,
    filedByRole: participant.role,
    freeText: input.freeText,
    keyPoints: input.keyPoints,
  }
  let nextList = list.map((o, i) => (i === idx ? filed : o))

  // Cascade: filing 'initial' immediately opens 'closing' — the 30-day clock
  // starts at the moment of filing, per NIS2 art. 23 lid 4c.
  if (input.milestoneId === 'initial') {
    const closing = regime.milestones.find(m => m.id === 'closing')
    if (closing && !nextList.some(o => o.milestoneId === closing.id)) {
      nextList = [
        ...nextList,
        {
          regimeId: regime.id,
          milestoneId: closing.id,
          status: 'open',
          openedAtRound: (session.currentRound ?? 0) + 1,
          openedAtHour: hourNow,
        },
      ]
    }
  }

  let updated: SessionState = { ...session, regulatoryObligations: nextList }
  updated = pushTimeline(updated, 'regulatory_obligation_filed', {
    regimeId: regime.id,
    milestoneId: milestone.id,
    filedBy: participant.id,
    filedByRole: participant.role,
  })
  await dbSetSession(updated)
  broadcastState(updated)
  emit('regulatory_obligation_filed', { regimeId: regime.id, milestoneId: milestone.id })
  return { ok: true, obligation: filed }
}

// Called from endSessionForced — mark any still-open milestones past their
// deadline as 'expired'. Untouched if still within the window.
function expireOpenRegulatoryObligations(session: SessionState): SessionState {
  const regime = session.regulatoryRegime
  if (!regime) return session
  const list = session.regulatoryObligations ?? []
  if (list.length === 0) return session
  const now = Date.now()
  const anchor = session.incidentDetectedAt ?? session.startedAt ?? session.createdAt
  const currentHour = exerciseHoursSince(anchor, now)
  let changed = false
  let next = session
  const nextList = list.map(o => {
    if (o.status !== 'open') return o
    const ms = regime.milestones.find(m => m.id === o.milestoneId)
    if (!ms) return o
    const deadlineHour = o.openedAtHour + ms.deadlineHours
    if (currentHour < deadlineHour) return o
    changed = true
    next = pushTimeline(next, 'regulatory_obligation_expired', {
      regimeId: regime.id,
      milestoneId: o.milestoneId,
    })
    return {
      ...o,
      status: 'expired' as const,
      expiredAtRound: (session.currentRound ?? 0) + 1,
    }
  })
  if (!changed) return session
  return { ...next, regulatoryObligations: nextList }
}

// Judge whether a filed obligation was on-time or late relative to its
// deadline. Used by scoring + reveal UI.
export function classifyRegulatoryTiming(
  o: RegulatoryObligationState,
  regime: RegulatoryRegime,
): 'on_time' | 'late' | 'omitted' {
  if (o.status === 'expired') return 'omitted'
  if (o.status !== 'filed') return 'omitted'
  const ms = regime.milestones.find(m => m.id === o.milestoneId)
  if (!ms) return 'late'
  const filedHour = o.filedAtHour ?? Number.POSITIVE_INFINITY
  const deadlineHour = o.openedAtHour + ms.deadlineHours
  return filedHour <= deadlineHour ? 'on_time' : 'late'
}

export async function setSessionFlag(key: string, value: boolean): Promise<{ ok: boolean }> {
  const session = await dbGetSession()
  if (!session) return { ok: false }
  const updated: SessionState = { ...session, flags: { ...(session.flags ?? {}), [key]: value } }
  await dbSetSession(updated)
  broadcastState(updated)
  return { ok: true }
}

export async function updateSupervisionReportEdits(
  edits: SupervisionReportEdits,
): Promise<{ ok: boolean }> {
  const session = await dbGetSession()
  if (!session) return { ok: false }
  const updated: SessionState = { ...session, supervisionReportEdits: edits }
  await dbSetSession(updated)
  broadcastState(updated)
  return { ok: true }
}

// ─── Phase 6 — participant view state (hide / handled / classification filter) ───

export type ParticipantViewPatch = Partial<{
  hidden: string[]
  handled: string[]
  filters: { classification?: Array<'feit' | 'aanname' | 'fabel'> }
  // Append/remove semantics — the caller can send a single injectId to
  // add or remove from `hidden` / `handled` without re-sending the whole set.
  addHidden: string
  removeHidden: string
  addHandled: string
  removeHandled: string
  clearHidden: boolean
}>

export async function updateParticipantView(input: {
  participantId: string
  patch: ParticipantViewPatch
}): Promise<{ ok: boolean; error?: string }> {
  return mutate(session => {
    const participant = session.participants.find(p => p.id === input.participantId)
    if (!participant) return { error: "Participant not found." }
    const all = session.participantViewState ?? {}
    const current = all[input.participantId] ?? { hidden: [], handled: [] }
    const next = { ...current }

    if (Array.isArray(input.patch.hidden)) next.hidden = [...new Set(input.patch.hidden)]
    if (Array.isArray(input.patch.handled)) next.handled = [...new Set(input.patch.handled)]
    if (input.patch.filters !== undefined) next.filters = input.patch.filters
    if (typeof input.patch.addHidden === 'string') {
      next.hidden = [...new Set([...(next.hidden ?? []), input.patch.addHidden])]
    }
    if (typeof input.patch.removeHidden === 'string') {
      next.hidden = (next.hidden ?? []).filter(id => id !== input.patch.removeHidden)
    }
    if (typeof input.patch.addHandled === 'string') {
      next.handled = [...new Set([...(next.handled ?? []), input.patch.addHandled])]
    }
    if (typeof input.patch.removeHandled === 'string') {
      next.handled = (next.handled ?? []).filter(id => id !== input.patch.removeHandled)
    }
    if (input.patch.clearHidden === true) next.hidden = []

    return {
      ...session,
      participantViewState: { ...all, [input.participantId]: next },
    }
  })
}
