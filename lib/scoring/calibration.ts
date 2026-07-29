import type { ExerciseEvent, RoundOutcome } from './types'

// Deel B §7.2 — KALIBRATIE = − corr(zekerheid, RONDE_UITKOMST).
//   Positieve waarde → team was het meest zeker waar het het meest miszat.
//
// Correlatie is Pearson over paren (zekerheid_r, uitkomst_r) waarbij zekerheid
// per ronde het gemiddelde is over inzendingen in die ronde. Nul paren → null.
export function scoreCalibration(events: ExerciseEvent[], outcomes: RoundOutcome[]): number | null {
  const submissions = events.filter(e => e.kind === 'decision_submitted') as Extract<ExerciseEvent, { kind: 'decision_submitted' }>[]
  const conf: Record<number, number[]> = {}
  for (const s of submissions) {
    if (typeof s.confidence !== 'number') continue
    ;(conf[s.round] ??= []).push(s.confidence)
  }
  const pairs: Array<[number, number]> = []
  for (const o of outcomes) {
    const cs = conf[o.round]
    if (!cs || cs.length === 0) continue
    const avgConf = cs.reduce((s, x) => s + x, 0) / cs.length
    pairs.push([avgConf, o.normalized])
  }
  if (pairs.length < 2) return null
  const r = pearson(pairs)
  return r === null ? null : -r
}

function pearson(pairs: Array<[number, number]>): number | null {
  const n = pairs.length
  if (n < 2) return null
  const meanX = pairs.reduce((s, [x]) => s + x, 0) / n
  const meanY = pairs.reduce((s, [, y]) => s + y, 0) / n
  let num = 0, dx2 = 0, dy2 = 0
  for (const [x, y] of pairs) {
    const dx = x - meanX
    const dy = y - meanY
    num += dx * dy
    dx2 += dx * dx
    dy2 += dy * dy
  }
  const denom = Math.sqrt(dx2 * dy2)
  if (denom === 0) return null
  return num / denom
}
