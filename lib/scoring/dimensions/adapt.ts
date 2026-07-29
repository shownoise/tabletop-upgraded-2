import { REVISION_WINDOW_MIN } from '../constants'
import type { DimensionScore, ExerciseEvent, ScenarioSpec } from '../types'

// Deel A §7.4 — ADAPT: classificatie, Youden's J.
//   Materieel event = crucial inject   → team moet herzien
//   Ruis event      = info inject      → team moet vasthouden
//   Se = juiste herzieningen / materiële events
//   Sp = terecht vastgehouden besluiten / ruis-events
//   J  = Se + Sp − 1
//   ADAPT  = 5 · max(0, J)
//   ADAPT' = ADAPT · (1 − 0.3 · gem( min(1, t_herziening / t_venster) ))
export function scoreAdapt(scenario: ScenarioSpec, events: ExerciseEvent[]): DimensionScore {
  const crucial = new Set(scenario.injects.filter(i => i.importance === 'crucial').map(i => i.id))
  const info = new Set(scenario.injects.filter(i => i.importance === 'info').map(i => i.id))

  // Per inject: kwam er ná ontvangst een revisie? Zo ja, hoe snel?
  const receipts = groupBy(events.filter(e => e.kind === 'inject_received') as Extract<ExerciseEvent, { kind: 'inject_received' }>[], r => r.injectId)
  const revisions = events.filter(e => e.kind === 'decision_revised') as Extract<ExerciseEvent, { kind: 'decision_revised' }>[]

  let materialCount = 0, sensitivityHits = 0
  let noiseCount = 0, specificityHits = 0
  const revisionDelays: number[] = []

  const windowMin = averageWindow(scenario) ?? REVISION_WINDOW_MIN

  for (const inj of scenario.injects) {
    const isCrucial = crucial.has(inj.id)
    const isInfo = info.has(inj.id)
    if (!isCrucial && !isInfo) continue

    const receiveTimes = receipts.get(inj.id) ?? []
    const receiveT = receiveTimes.length ? Math.min(...receiveTimes.map(r => r.t)) : null

    const revisedThis = revisions.find(r => r.triggeredByInjectId === inj.id)

    if (isCrucial) {
      materialCount++
      if (revisedThis) {
        sensitivityHits++
        if (receiveT != null) {
          const delayMin = Math.max((revisedThis.t - receiveT) / 60000, 0)
          revisionDelays.push(Math.min(1, delayMin / windowMin))
        }
      }
    }
    if (isInfo) {
      noiseCount++
      if (!revisedThis) specificityHits++
    }
  }

  if (materialCount === 0 && noiseCount === 0) {
    return { value: null, dataQuality: 'null', reason: 'no crucial or info injects' }
  }
  const Se = materialCount === 0 ? 1 : sensitivityHits / materialCount
  const Sp = noiseCount === 0 ? 1 : specificityHits / noiseCount
  const J = Se + Sp - 1
  const adapt = 5 * Math.max(0, J)
  const delayFactor = revisionDelays.length ? revisionDelays.reduce((s, x) => s + x, 0) / revisionDelays.length : 0
  const adaptPrime = adapt * (1 - 0.3 * delayFactor)

  return {
    value: clamp05(adaptPrime),
    dataQuality: 'measured',
    detail: { Se: round4(Se), Sp: round4(Sp), J: round4(J), adaptRaw: round4(adapt), delayFactor: round4(delayFactor) },
  }
}

function groupBy<T>(xs: T[], key: (x: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>()
  for (const x of xs) {
    const k = key(x)
    const arr = m.get(k) ?? []
    arr.push(x)
    m.set(k, arr)
  }
  return m
}

function averageWindow(scenario: ScenarioSpec): number | null {
  const ws = scenario.rounds.map(r => r.revisionWindowMin).filter((x): x is number => typeof x === 'number')
  if (ws.length === 0) return null
  return ws.reduce((s, x) => s + x, 0) / ws.length
}

function clamp05(x: number): number { return Math.min(5, Math.max(0, x)) }
function round4(x: number): number { return Math.round(x * 10000) / 10000 }
