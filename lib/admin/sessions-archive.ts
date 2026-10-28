// Sessie-archief. BEWUST simpel: elke afgeronde/gestarte sessie krijgt één
// snapshot. Geen relationeel model — waar de snapshots heen gaan bepaalt de
// opslagnaad (lib/store/backend.ts). Snapshot is een subset van SessionState +
// een paar computed velden.

import type { SessionState } from "@/lib/types"
import { withStore } from "@/lib/db"

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
  // Grote blob (~100KB), maar elke achterkant kan dat aan.
  snapshot: SessionState
  // Post-sessie facilitator-notities. Bewerken via het session-detail
  // rapport. Optioneel — rapport rendert prima zonder.
  facilitatorReport?: {
    observations?: string        // "wat viel op"
    recommendations?: string     // concrete aanbevelingen voor klant
    // Retroactieve feit-vs-aanname labels per inject. Gebruikt als
    // deelnemers zelf niet tagden tijdens de sessie. Sleutel = inject-id.
    // Waarde = wat het team volgens de facilitator behandelde.
    retroactiveInjectTags?: Record<string, "fact" | "assumption">
    updatedAt?: number
  }
}

const KEY = "admin:sessions-archive"

// Via withStore uit lib/db.ts: één plek die bepaalt of de opslag leeft, en één
// plek die een omvallende store opvangt. De eigen geheugen-fallback die hier
// stond is weg — die rol heeft de geheugen-achterkant nu.
export async function listSnapshots(): Promise<SessionSnapshot[]> {
  const obj = await withStore("archief lezen", async s =>
    (await s.get<Record<string, SessionSnapshot>>(KEY)) ?? {})
  return Object.values(obj).sort((a, b) => (b.endedAt ?? b.startedAt) - (a.endedAt ?? a.startedAt))
}

export async function getSnapshot(id: string): Promise<SessionSnapshot | null> {
  const list = await listSnapshots()
  return list.find(s => s.id === id) ?? null
}

export async function upsertSnapshot(snap: SessionSnapshot): Promise<void> {
  await withStore("archief schrijven", async s => {
    const current = (await s.get<Record<string, SessionSnapshot>>(KEY)) ?? {}
    await s.set(KEY, { ...current, [snap.id]: snap })
  })
}

export async function deleteSnapshot(id: string): Promise<void> {
  await withStore("archief verwijderen", async s => {
    const next = { ...((await s.get<Record<string, SessionSnapshot>>(KEY)) ?? {}) }
    delete next[id]
    await s.set(KEY, next)
  })
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
