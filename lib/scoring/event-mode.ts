import { NO_DECISION_FALLBACK_VECTOR } from './constants'
import type { DecisionPointSpec, ExerciseEvent, RoleId, ScenarioSpec } from './types'

// Deel B §4.2 — Event Mode statemachine als pure functie-set.
//
//   LOBBY → RONDE(n): BRIEFING → OVERLEG → KEUZE → LOCK → REVEAL → RONDE(n+1) … → EINDREVEAL
//
// LOCK is server-authoritatief: het moment waarop alle groepen hebben ingeleverd
// of de fase-timer afloopt. Daarna kan er niets meer wijzigen aan submissions
// van die ronde en worden implicit "geen besluit"-events geëmit.

export type EventModePhase = 'briefing' | 'overleg' | 'keuze' | 'lock' | 'review'

const VALID_TRANSITIONS: Record<EventModePhase, EventModePhase[]> = {
  briefing: ['overleg'],
  overleg:  ['keuze'],
  keuze:    ['lock'],
  lock:     ['review'],
  review:   ['briefing'],  // volgende ronde
}

export function isValidTransition(from: EventModePhase, to: EventModePhase): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false
}

// Deel B §4.3 — "De host kan een ronde altijd forceren". Zelfs een forceerlock
// vereist dat we vanuit `keuze` komen; anders is er nog geen deadline.
export function canForceLock(currentPhase: EventModePhase): boolean {
  return currentPhase === 'keuze'
}

// Bij LOCK van ronde r: voor elk (group, decisionPoint) zonder submission,
// produceer een virtueel `decision_submitted` event met de impliciete optie
// (of NO_DECISION_FALLBACK_VECTOR als er geen impliciete optie is).
//
// Puur: dezelfde input → dezelfde output. Idempotent: aanroepen op events
// die al implicit submissions bevatten voegt niets toe.
export function computeImplicitSubmissionsAtLock(input: {
  scenario: ScenarioSpec
  events: ExerciseEvent[]
  lockTime: number
  round: number
  groups: Array<{ id: string; participantIds: string[] }> | null  // null → geen groepen, single-team modus
}): ExerciseEvent[] {
  const { scenario, events, lockTime, round, groups } = input
  const dps = scenario.decisionPoints.filter(d => d.round === round)
  if (dps.length === 0) return []

  const already = new Set<string>()
  for (const ev of events) {
    if ((ev.kind === 'decision_submitted' || ev.kind === 'decision_revised') && ev.round === round) {
      already.add(keyFor(ev.decisionPointId, groupIdOf(ev, groups)))
    }
  }

  const out: ExerciseEvent[] = []
  const scoringUnits = groups ?? [{ id: 'single', participantIds: [] }]
  for (const dp of dps) {
    for (const g of scoringUnits) {
      const key = keyFor(dp.id, g.id)
      if (already.has(key)) continue
      const opt = pickImplicitOption(dp)
      out.push({
        kind: 'decision_submitted',
        t: lockTime,
        round,
        decisionPointId: dp.id,
        optionId: opt.id,
        by: 'IMPLICIT' as RoleId,
      })
    }
  }
  return out
}

// Kies de expliciete `implicit`-optie als die bestaat; anders bouw op de vlucht
// een fallback met NO_DECISION_FALLBACK_VECTOR.
function pickImplicitOption(dp: DecisionPointSpec): { id: string; source: 'explicit' | 'fallback' } {
  const explicit = dp.options.find(o => o.implicit)
  if (explicit) return { id: explicit.id, source: 'explicit' }
  return { id: `__implicit_${dp.id}`, source: 'fallback' }
}

// Voeg fallback-opties (voor beslispunten zonder expliciete implicit) toe aan
// het scenario zonder de originele te muteren. Handig als je het volledige
// scenario in de outcome-berekening wilt gebruiken met vectoren beschikbaar.
export function scenarioWithFallbackImplicits(scenario: ScenarioSpec): ScenarioSpec {
  return {
    ...scenario,
    decisionPoints: scenario.decisionPoints.map(dp => {
      if (dp.options.some(o => o.implicit)) return dp
      return {
        ...dp,
        options: [
          ...dp.options,
          {
            id: `__implicit_${dp.id}`,
            label: 'Geen besluit binnen de tijd',
            outcomeVector: { ...NO_DECISION_FALLBACK_VECTOR },
            implicit: true,
          },
        ],
      }
    }),
  }
}

// Deel B §4.3 — idempotente inzending op (group, decisionPoint). Deze helper
// bepaalt of een submit-poging geaccepteerd mag worden; puur.
export function isSubmissionAllowed(input: {
  events: ExerciseEvent[]
  round: number
  decisionPointId: string
  groupId: string | null
  currentPhase: EventModePhase
  mode: 'ASSESSMENT' | 'EVENT'
}): { allowed: boolean; reason?: string } {
  const { events, round, decisionPointId, groupId, currentPhase, mode } = input
  if (currentPhase === 'lock' || currentPhase === 'review') {
    return { allowed: false, reason: `fase ${currentPhase}: geen mutaties meer` }
  }
  if (currentPhase !== 'keuze' && currentPhase !== 'overleg') {
    return { allowed: false, reason: `fase ${currentPhase}: inzending pas vanaf overleg/keuze` }
  }
  // EVENT: idempotency per (group, decisionPoint). ASSESSMENT: overschrijven mag.
  if (mode === 'EVENT') {
    const already = events.some(ev =>
      ev.kind === 'decision_submitted' &&
      ev.round === round &&
      ev.decisionPointId === decisionPointId &&
      groupIdOf(ev, groupId ? [{ id: groupId, participantIds: [] }] : null) === groupId,
    )
    if (already) return { allowed: false, reason: 'group heeft al ingezonden voor dit beslispunt' }
  }
  return { allowed: true }
}

// Helpers ─────────────────────────────────────────────────────────────

function keyFor(dpId: string, groupId: string): string {
  return `${dpId}::${groupId}`
}

function groupIdOf(
  ev: ExerciseEvent,
  groups: Array<{ id: string; participantIds: string[] }> | null,
): string {
  if (!groups) return 'single'
  if (ev.kind !== 'decision_submitted' && ev.kind !== 'decision_revised') return 'single'
  // De submitter zit in één van de groups; zoek 'm op via `by` (RoleId, maar we
  // gebruiken 'm hier als opaque identifier — een participant-id-lookup zou
  // beter zijn, maar dat vergt session-context. Voor pure logica: bij groups
  // gebruiken we `by` als proxy en verwachten dat de caller `by` gebruikt om
  // een group-lid te representeren.)
  const g = groups.find(x => x.participantIds.includes(ev.by))
  return g?.id ?? 'single'
}
