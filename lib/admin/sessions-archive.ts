// Sessie-archief. BEWUST simpel: elke afgeronde/gestarte sessie krijgt één
// snapshot in KV. Geen relationeel model — developers vervangen de opslag
// later. Snapshot is een subset van SessionState + een paar computed velden.

import type { SessionState } from "@/lib/types"

export interface SessionSnapshot {
  id: string                      // sessionId (uit SessionState.id)
  clientId?: string               // koppeling naar admin-client als beschikbaar
  clientName?: string             // gekopieerd voor rendering zonder join
  scenarioName: string
  scenarioType: string
  mode: "training" | "event"
  startedAt: number
  endedAt?: number
  participantCount: number
  rounds: number
  currentRound: number
  status: "lobby" | "active" | "ended"
  finalOutcomeKey?: string
  finalOutcomeLabel?: string
  // De volledige sessie-state bewaren maakt "openen" trivial — de
  // ScorePanel + narrative kunnen erop draaien alsof het live is.
  // Grote blob (~100KB) maar KV kan het aan.
  snapshot: SessionState
  // Post-sessie facilitator-notities. Bewerken via het session-detail
  // rapport. Optioneel — rapport rendert prima zonder.
  facilitatorReport?: {
    observations?: string        // "wat viel op"
    recommendations?: string     // concrete aanbevelingen voor klant
    updatedAt?: number
  }
}

const KEY = "admin:sessions-archive"

const globalAny = globalThis as unknown as { __ctt_admin_sessions_archive__?: Record<string, SessionSnapshot> }

async function getKv() {
  if (!process.env.KV_REST_API_URL && !process.env.KV_URL) return null
  try { const { kv } = await import("@vercel/kv"); return kv }
  catch { return null }
}

export async function listSnapshots(): Promise<SessionSnapshot[]> {
  const kv = await getKv()
  const obj = kv
    ? (await kv.get<Record<string, SessionSnapshot>>(KEY)) ?? {}
    : globalAny.__ctt_admin_sessions_archive__ ?? {}
  return Object.values(obj).sort((a, b) => (b.endedAt ?? b.startedAt) - (a.endedAt ?? a.startedAt))
}

export async function getSnapshot(id: string): Promise<SessionSnapshot | null> {
  const list = await listSnapshots()
  return list.find(s => s.id === id) ?? null
}

export async function upsertSnapshot(snap: SessionSnapshot): Promise<void> {
  const kv = await getKv()
  const current = kv
    ? (await kv.get<Record<string, SessionSnapshot>>(KEY)) ?? {}
    : globalAny.__ctt_admin_sessions_archive__ ?? {}
  const next = { ...current, [snap.id]: snap }
  if (kv) await kv.set(KEY, next)
  else globalAny.__ctt_admin_sessions_archive__ = next
}

export async function deleteSnapshot(id: string): Promise<void> {
  const kv = await getKv()
  const current = kv
    ? (await kv.get<Record<string, SessionSnapshot>>(KEY)) ?? {}
    : globalAny.__ctt_admin_sessions_archive__ ?? {}
  const next = { ...current }
  delete next[id]
  if (kv) await kv.set(KEY, next)
  else globalAny.__ctt_admin_sessions_archive__ = next
}

// Snapshot bouwen vanuit een live SessionState.
export function snapshotFromSession(
  session: SessionState,
  clientId?: string,
  clientName?: string,
): SessionSnapshot {
  return {
    id: session.id,
    clientId,
    clientName,
    scenarioName: session.scenario.scenario_title,
    scenarioType: (session.graph as unknown as { scenarioType?: string })?.scenarioType ?? "unknown",
    mode: session.mode ?? "training",
    startedAt: session.startedAt ?? session.createdAt,
    endedAt: session.status === "ended" ? Date.now() : undefined,
    participantCount: session.participants.length,
    rounds: session.scenario.rounds.length,
    currentRound: session.currentRound + 1,
    status: session.status,
    finalOutcomeKey: session.graphState?.finalOutcome?.key,
    finalOutcomeLabel: session.graphState?.finalOutcome?.label,
    snapshot: session,
  }
}
