import type { DimensionScore, ExerciseEvent, RoleId } from '../types'

// Deel A §7.6 — VOLHOUD = 5 · (0.30·R + 0.25·U + 0.25·F + 0.20·O)
//   R = 1 (rooster vóór T+12u) | 0.5 (later) | 0 (niet)
//   N_eff = 1 / Σ_i p_i²
//   U = N_eff / N
//   F = max(0, 1 − max(0, uren_max − 12)/12)
//   O = facilitator 0..1
//
// Vereist een roster_snapshot event met hoursWorkedByRole en taskShareByRole.
export function scoreVolhoud(events: ExerciseEvent[]): DimensionScore {
  const snap = lastOfKind(events, 'roster_snapshot')
  const handoff = lastOfKind(events, 'facilitator_handoff_quality')
    ?? lastOfKind(events, 'handoff_recorded')

  if (!snap) {
    return { value: null, dataQuality: 'null', reason: 'no roster_snapshot event' }
  }

  const R = rosterScore(snap.hasRoster, snap.rosterCreatedBeforeHour)

  const shares = Object.values(snap.taskShareByRole)
  const N = shares.length
  const N_eff = effectiveTeamSize(snap.taskShareByRole)
  const U = N === 0 ? 0 : Math.min(1, N_eff / N)

  const hours = Object.values(snap.hoursWorkedByRole)
  const urenMax = hours.length ? Math.max(...hours) : 0
  const F = Math.max(0, 1 - Math.max(0, urenMax - 12) / 12)

  const O = handoff ? (handoff.kind === 'facilitator_handoff_quality' ? handoff.value : handoff.quality) : null

  const contribs: number[] = [0.30 * R, 0.25 * U, 0.25 * F]
  let totalW = 0.30 + 0.25 + 0.25
  if (O !== null) { contribs.push(0.20 * O); totalW += 0.20 }
  const raw = contribs.reduce((s, x) => s + x, 0)
  const rescaled = totalW > 0 ? raw / totalW : 0
  return {
    value: clamp05(5 * rescaled),
    dataQuality: O === null ? 'observation' : 'measured',
    reason: O === null ? 'no handoff quality — Overdracht-term via slider vereist' : undefined,
    detail: { R: round4(R), U: round4(U), F: round4(F), O: O === null ? null : round4(O), N_eff: round4(N_eff) },
  }
}

function rosterScore(hasRoster: boolean, createdBeforeHour: number | null): 0 | 0.5 | 1 {
  if (!hasRoster) return 0
  if (createdBeforeHour === null) return 0.5
  return createdBeforeHour <= 12 ? 1 : 0.5
}

function effectiveTeamSize(shares: Record<RoleId, number>): number {
  const arr = Object.values(shares)
  const total = arr.reduce((s, v) => s + v, 0)
  if (total === 0) return 0
  const p2 = arr.reduce((s, v) => { const p = v / total; return s + p * p }, 0)
  return p2 === 0 ? 0 : 1 / p2
}

function lastOfKind<K extends ExerciseEvent['kind']>(events: ExerciseEvent[], kind: K): Extract<ExerciseEvent, { kind: K }> | undefined {
  for (let i = events.length - 1; i >= 0; i--) {
    if (events[i].kind === kind) return events[i] as Extract<ExerciseEvent, { kind: K }>
  }
  return undefined
}

function clamp05(x: number): number { return Math.min(5, Math.max(0, x)) }
function round4(x: number): number { return Math.round(x * 10000) / 10000 }
