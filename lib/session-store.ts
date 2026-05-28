/**
 * Session store — now backed by the database abstraction layer (lib/db.ts).
 * Falls back to in-memory automatically in dev when KV is not configured.
 */

import { randomBytes } from "crypto"
import { generateScenario } from "./scenario-generator"
import { dbGetSession, dbSetSession } from "./db"
import type {
  ActivePhaseState, ExerciseConfig, FacilitatorRoundScore, GovernanceFlag, Inject, InjectType,
  LearningObjective, LiveEvent, LiveEventName, Participant, PublicState, Role, RoleAction,
  RoleDocument, RoundPhase, Scenario, SessionState, SimulationMode, SpecialEvent, SpecialMessage,
  SpecialScore, SpecialType, StreamMessage, SubmittedDecision, TimelineEvent, TimelineEventType, Urgency,
} from "./types"
import { ROLE_FALLBACK } from "./types"
import type { AssessmentEvent } from "./engine/types"
import { BOB_PHASES, OODA_PHASES } from "./engine/facilitator-support"

function remapMissingRoles(scenario: Scenario, selectedRoles: Role[]): Scenario {
  const active = new Set(selectedRoles)

  function resolveRole(role: Role): Role | null {
    if (active.has(role)) return role
    return (ROLE_FALLBACK[role] ?? []).find(r => active.has(r)) ?? null
  }

  return {
    ...scenario,
    rounds: scenario.rounds.map(round => ({
      ...round,
      injects: round.injects.map(inject => {
        if (!inject.targetRoles?.length) return inject
        const remapped = [...new Set(
          inject.targetRoles.map(r => resolveRole(r)).filter(Boolean) as Role[]
        )]
        return { ...inject, targetRoles: remapped.length > 0 ? remapped : undefined }
      }),
      roleActions: round.roleActions?.map(action => {
        if (action.allowedRoles.length === 0) return action
        const remapped = [...new Set(
          action.allowedRoles.map(r => resolveRole(r)).filter(Boolean) as Role[]
        )]
        return { ...action, allowedRoles: remapped.length > 0 ? remapped : [] }
      }),
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
  const snapshot: PublicState = { session }
  for (const l of listeners) l({ type: "state", data: snapshot })
}

function emit(name: LiveEventName, payload: Record<string, unknown>) {
  const event: LiveEvent = { name, payload, ts: Date.now() }
  for (const l of listeners) l({ type: "event", data: event })
}

// ─── Participant-safe state ───────────────────────────────────
// Strips all facilitator-only data before broadcasting to unauthenticated clients.
// Server-side logic (flagging, scoring) always uses the real stored state.

export function toParticipantState(session: SessionState): SessionState {
  return {
    ...session,
    scenario: {
      ...session.scenario,
      rounds: session.scenario.rounds.map((round, i) => {
        // Future rounds: expose shell only — no content, no injects, no actions
        if (i > session.currentRound) {
          return {
            ...round,
            situation_update: "",
            injects: [],
            roleActions: undefined,
            facilitatorNotes: undefined,
          }
        }
        // Current + past rounds: strip facilitator-only fields
        return {
          ...round,
          facilitatorNotes: undefined,
          roleActions: round.roleActions?.map(action => ({
            id: action.id,
            label: action.label,
            description: action.description,
            allowedRoles: action.allowedRoles,
            irPlanAligned: true,
          })),
          learningObjectives: round.learningObjectives?.map(({ triggerActionIds: _a, triggerSpecialType: _s, ...safe }) => safe),
        }
      }),
    },
    // Strip flags — these reveal which decisions were marked bad
    governanceFlags: [],
    // Keep decisions for own-decision display, but strip flag metadata
    submittedDecisions: (session.submittedDecisions ?? []).map(d => ({
      ...d,
      isWrongRole: false,
      isIrDeviation: false,
    })),
    // Pass through special events — participants only see what's relevant to them
    specialEvents: session.specialEvents ?? [],
    // All documents included — filtered by role in the participant's own UI
    documents: session.documents ?? [],
    // Strip facilitator-only phase state; expose only the participant-safe prompt + index
    activeDiscussionPhase: undefined,
    currentDiscussionPrompt: session.activeDiscussionPhase
      ? (session.config.decisionFramework === 'ooda' ? OODA_PHASES : BOB_PHASES)[session.activeDiscussionPhase.phaseIndex]?.participantPrompt
      : undefined,
    currentDiscussionPhaseIndex: session.activeDiscussionPhase?.phaseIndex,
  }
}

// ─── Public API ───────────────────────────────────────────────

export function subscribe(listener: Listener): () => void {
  listeners.add(listener)
  dbGetSession().then(s => listener({ type: "state", data: { session: s } }))
  return () => { listeners.delete(listener) }
}

export function subscribeParticipant(listener: Listener): () => void {
  // Guard: if a broadcast arrives before the initial dbGetSession() resolves,
  // skip the db-fetch result to avoid the client receiving two conflicting states.
  let initialSent = false
  const wrapped: Listener = (msg) => {
    initialSent = true
    if (msg.type === "state" && msg.data.session) {
      listener({ type: "state", data: { session: toParticipantState(msg.data.session) } })
    } else {
      listener(msg)
    }
  }
  listeners.add(wrapped)
  dbGetSession().then(s => {
    if (initialSent) return
    const safe = s ? toParticipantState(s) : null
    wrapped({ type: "state", data: { session: safe } })
  })
  return () => { listeners.delete(wrapped) }
}

export async function getState(): Promise<PublicState> {
  return { session: await dbGetSession() }
}

export async function getSession(): Promise<SessionState | null> {
  return dbGetSession()
}

export async function createSession(config: ExerciseConfig, scenario?: Scenario, mode?: SimulationMode, documents?: RoleDocument[]): Promise<SessionState> {
  const raw = scenario ?? generateScenario(config)
  const resolvedScenario = config.selectedRoles?.length
    ? remapMissingRoles(raw, config.selectedRoles)
    : raw
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

async function mutate(fn: (s: SessionState) => SessionState | null): Promise<{ ok: boolean; error?: string }> {
  const session = await dbGetSession()
  if (!session) return { ok: false, error: "No active session." }
  const updated = fn(session)
  if (updated === null) return { ok: false, error: "Mutation returned null." }
  await dbSetSession(updated)
  broadcastState(updated)
  return { ok: true }
}

function pushTimeline(session: SessionState, type: TimelineEventType, data: Record<string, unknown>): SessionState {
  const ev: TimelineEvent = { id: genId("tl"), timestamp: Date.now(), type, data }
  return { ...session, timeline: [...session.timeline, ev] }
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
    if (s.scenario.rounds.length === 0) return null
    const now = Date.now()
    let updated: SessionState = { ...s, status: "active" as const, currentRound: 0, roundStartedAt: now, startedAt: now }
    updated = pushTimeline(updated, "session_started", { roundIndex: 0 })
    return updated
  })
  if (result.ok) emit("start_session", { roundIndex: 0 })
  return result
}

export async function goToNextRound(): Promise<{ ok: boolean; error?: string }> {
  const session = await dbGetSession()
  if (!session) return { ok: false, error: "No active session." }

  if (session.currentRound < session.scenario.rounds.length - 1) {
    const nextIdx = session.currentRound + 1
    let updated: SessionState = {
      ...session,
      currentRound: nextIdx,
      roundStartedAt: Date.now(),
      roundPhase: "inject" as RoundPhase,
      activeDiscussionPhase: undefined,
      currentDiscussionPrompt: undefined,
      currentDiscussionPhaseIndex: undefined,
    }
    updated = pushTimeline(updated, "round_changed", { roundIndex: nextIdx })
    await dbSetSession(updated)
    broadcastState(updated)
    emit("next_round", { roundIndex: nextIdx })
    return { ok: true }
  }

  // End of session
  let updated: SessionState = { ...session, status: "ended" as const }
  updated = pushTimeline(updated, "session_ended", {})
  await dbSetSession(updated)
  broadcastState(updated)
  emit("session_ended", {})
  return { ok: true }
}

export async function goToPrevRound(): Promise<{ ok: boolean; error?: string }> {
  const session = await dbGetSession()
  if (!session || session.currentRound <= 0) return { ok: false, error: "Cannot go back." }

  const prevIdx = session.currentRound - 1
  let updated: SessionState = { ...session, currentRound: prevIdx, roundStartedAt: Date.now() }
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
  if (session.pushedInjects.some(p => p.inject.id === inject.id)) return { ok: false, error: "Already pushed." }

  const pushed = { inject, roundIndex: input.roundIndex, pushedAt: Date.now() }
  let updated = { ...session, pushedInjects: [...session.pushedInjects, pushed] }
  updated = pushTimeline(updated, "inject_pushed", { roundIndex: input.roundIndex, inject })
  await dbSetSession(updated)
  broadcastState(updated)
  emit("push_inject", { inject, roundIndex: input.roundIndex })
  return { ok: true }
}

export async function pushSurpriseInject(input: {
  title: string; content: string; type?: InjectType; urgency?: Urgency
}): Promise<{ ok: boolean; error?: string; inject?: Inject }> {
  const session = await dbGetSession()
  if (!session) return { ok: false, error: "No active session." }

  const inject: Inject = {
    id: genId("surp"),
    type: input.type ?? "alert",
    channel: "system_alert",
    title: input.title.trim(),
    content: input.content.trim(),
    urgency: input.urgency ?? "critical",
    source: "Facilitator",
    senderName: "Facilitator",
    timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
  }

  const pushed = { inject, roundIndex: -1, pushedAt: Date.now() }
  let updated = { ...session, pushedInjects: [...session.pushedInjects, pushed] }
  updated = pushTimeline(updated, "surprise_inject", { inject })
  await dbSetSession(updated)
  broadcastState(updated)
  emit("surprise_inject", { inject })
  return { ok: true, inject }
}

// ─── Phase management ─────────────────────────────────────────

export async function setPhase(phase: RoundPhase): Promise<{ ok: boolean; error?: string }> {
  const result = await mutate(s => {
    // Auto-initialize BOB/OODA phase 0 when switching to discussion so participants
    // immediately see a prompt instead of a blank screen.
    if (phase === 'discussion' && !s.activeDiscussionPhase) {
      const phases = s.config.decisionFramework === 'ooda' ? OODA_PHASES : BOB_PHASES
      const firstPhase = phases[0]
      if (firstPhase) {
        const active: ActivePhaseState = {
          roundNumber: s.currentRound,
          phaseIndex: 0,
          phaseStartedAt: Date.now(),
          extended: false,
        }
        return {
          ...s,
          roundPhase: phase,
          activeDiscussionPhase: active,
          currentDiscussionPrompt: firstPhase.participantPrompt,
        }
      }
    }
    return { ...s, roundPhase: phase }
  })
  if (result.ok) emit("phase_changed", { phase })
  return result
}

// ─── Role assignment ──────────────────────────────────────────

export async function assignRole(input: { participantId: string; role: Role }): Promise<{ ok: boolean; error?: string }> {
  const result = await mutate(s => {
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
}

export async function submitDecision(input: SubmitDecisionInput): Promise<{ ok: boolean; error?: string }> {
  const session = await dbGetSession()
  if (!session) return { ok: false, error: "No active session." }

  const participant = session.participants.find(p => p.id === input.participantId)
  if (!participant) return { ok: false, error: "Participant not found." }
  if (!participant.role) return { ok: false, error: "No role assigned. Please assign a role before submitting decisions." }

  const round = session.scenario.rounds[input.roundIndex]
  if (!round) return { ok: false, error: "Invalid round." }

  const action: RoleAction | undefined = round.roleActions?.find(a => a.id === input.actionId)
  if (!action) return { ok: false, error: "Invalid action." }

  const role = participant.role
  const isWrongRole = action.allowedRoles.length > 0 && !action.allowedRoles.includes(role)
  const isIrDeviation = !action.irPlanAligned

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
  }

  // Remove any existing decision for this participant+round then add new one
  const existingDecisions = (session.submittedDecisions ?? []).filter(
    d => !(d.participantId === input.participantId && d.roundIndex === input.roundIndex)
  )
  const existingFlags = (session.governanceFlags ?? []).filter(
    f => !(f.participantId === input.participantId && f.roundIndex === input.roundIndex)
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

  // Check learning objectives triggered by this decision
  const updatedRounds = session.scenario.rounds.map((r, ri) => {
    if (ri !== input.roundIndex || !r.learningObjectives) return r
    const updatedObjectives = r.learningObjectives.map(obj => {
      if (obj.achieved || obj.measuredBy !== 'decision') return obj
      if (obj.triggerActionIds?.includes(input.actionId)) {
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

  // Auto-score decision_speed on the first decision per round
  if (session.config.goalId && session.roundStartedAt) {
    const alreadyScored = (session.assessmentEvents ?? []).some(
      e => e.dimensionId === 'decision_speed' && e.roundNumber === input.roundIndex
    )
    if (!alreadyScored) {
      const deltaMin = (Date.now() - session.roundStartedAt) / 60000
      const speedValue = deltaMin < 5 ? 100 : deltaMin < 10 ? 75 : deltaMin < 15 ? 50 : deltaMin < 20 ? 25 : 10
      const speedEvent: AssessmentEvent = {
        dimensionId: 'decision_speed',
        roundNumber: input.roundIndex,
        value: speedValue,
        source: 'system',
        timestamp: Date.now(),
      }
      updated = { ...updated, assessmentEvents: [...(updated.assessmentEvents ?? []), speedEvent] }
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
  return {
    ...session,
    scenario: { ...session.scenario, rounds: updatedRounds },
    specialScores: [...(session.specialScores ?? []), entry],
  }
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

export async function addAssessmentEvent(
  event: Omit<AssessmentEvent, 'timestamp'>,
): Promise<{ ok: boolean; error?: string }> {
  const session = await dbGetSession()
  if (!session) return { ok: false, error: "No active session." }
  const newEvent: AssessmentEvent = { ...event, timestamp: Date.now() }
  const updated: SessionState = {
    ...session,
    assessmentEvents: [...(session.assessmentEvents ?? []), newEvent],
  }
  await dbSetSession(updated)
  broadcastState(updated)
  return { ok: true }
}

export async function setDiscussionPhase(
  roundNumber: number,
  phaseIndex: number,
  action: 'set' | 'extend' = 'set',
): Promise<{ ok: boolean; error?: string }> {
  const session = await dbGetSession()
  if (!session) return { ok: false, error: 'No active session.' }

  const phases = session.config.decisionFramework === 'ooda' ? OODA_PHASES : BOB_PHASES
  if (phaseIndex < 0 || phaseIndex >= phases.length) {
    return { ok: false, error: 'Invalid phase index.' }
  }
  const phase = phases[phaseIndex]

  let phaseStartedAt: number
  let extended: boolean

  if (action === 'extend' && session.activeDiscussionPhase?.phaseIndex === phaseIndex) {
    // Shift phaseStartedAt forward by 2 minutes — increases remaining time
    phaseStartedAt = (session.activeDiscussionPhase.phaseStartedAt) + 120_000
    extended = true
  } else {
    phaseStartedAt = Date.now()
    extended = false
  }

  const activeDiscussionPhase: ActivePhaseState = { roundNumber, phaseIndex, phaseStartedAt, extended }
  const updated: SessionState = {
    ...session,
    activeDiscussionPhase,
    currentDiscussionPrompt: phase.participantPrompt,
  }
  await dbSetSession(updated)
  broadcastState(updated)
  emit('discussion_phase_changed', {
    phaseName: phase.name,
    participantPrompt: phase.participantPrompt,
    phaseIndex,
    totalPhases: phases.length,
    roundNumber,
  })
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

export async function submitFacilitatorRoundScore(
  roundIndex: number,
  score: -1 | 0 | 1,
): Promise<{ ok: boolean; error?: string }> {
  const session = await dbGetSession()
  if (!session) return { ok: false, error: "No active session." }

  const existing = (session.facilitatorRoundScores ?? []).filter(s => s.roundIndex !== roundIndex)
  const entry: FacilitatorRoundScore = { roundIndex, score, scoredAt: new Date().toISOString() }
  const updated: SessionState = { ...session, facilitatorRoundScores: [...existing, entry] }
  await dbSetSession(updated)
  broadcastState(updated)
  return { ok: true }
}
