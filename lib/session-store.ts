/**
 * Session store — now backed by the database abstraction layer (lib/db.ts).
 * Falls back to in-memory automatically in dev when KV is not configured.
 */

import { randomBytes } from "crypto"
import { generateScenario } from "./scenario-generator"
import { dbGetSession, dbSetSession } from "./db"
import type {
  ExerciseConfig, Inject, InjectType, LiveEvent, LiveEventName,
  Participant, PublicState, Scenario, SessionState, StreamMessage,
  TimelineEvent, TimelineEventType, Urgency,
} from "./types"

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

// ─── Public API ───────────────────────────────────────────────

export function subscribe(listener: Listener): () => void {
  listeners.add(listener)
  // Send current state immediately on subscribe
  dbGetSession().then(s => listener({ type: "state", data: { session: s } }))
  return () => { listeners.delete(listener) }
}

export async function getState(): Promise<PublicState> {
  return { session: await dbGetSession() }
}

export async function getSession(): Promise<SessionState | null> {
  return dbGetSession()
}

export async function createSession(config: ExerciseConfig, scenario?: Scenario): Promise<SessionState> {
  const resolvedScenario = scenario ?? generateScenario(config)
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

export async function joinSession(input: { name: string; joinCode: string }): Promise<JoinResult | JoinError> {
  const name = input.name.trim()
  const code = input.joinCode.trim().toUpperCase()
  if (!name) return { ok: false, error: "Name is required." }

  const session = await dbGetSession()
  if (!session) return { ok: false, error: "No active session. Ask the facilitator to create one." }
  if (session.joinCode.toUpperCase() !== code) return { ok: false, error: "Invalid join code." }

  const participant: Participant = { id: genId("p"), name, joinedAt: Date.now() }
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
    let updated = { ...s, status: "active" as const, currentRound: 0, roundStartedAt: Date.now() }
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
    let updated = { ...session, currentRound: nextIdx, roundStartedAt: Date.now() }
    updated = pushTimeline(updated, "round_changed", { roundIndex: nextIdx })
    await dbSetSession(updated)
    broadcastState(updated)
    emit("next_round", { roundIndex: nextIdx })
    return { ok: true }
  }

  // End of session
  let updated = { ...session, status: "ended" as const }
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
  let updated = { ...session, currentRound: prevIdx, roundStartedAt: Date.now() }
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
