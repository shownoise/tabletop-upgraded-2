import { DEFAULT_PROCESS_WEIGHTS, PROCESS_DIMENSIONS, type ProcessDimension } from './constants'
import type { DimensionScore, ScenarioSpec } from './types'

// Deel A §7.8 — gewogen geometrisch gemiddelde over meetbare dimensies.
//   PROCES = Π_k ( D_k ^ w_k )   met Σ w_k = 1
//
// Dimensies met value=null vallen uit de weging; de rest wordt herwogen.
// Zonder gemeten dimensies → null.
export function aggregateProcess(
  dims: Record<ProcessDimension, DimensionScore>,
  scenario: ScenarioSpec,
): number | null {
  const weights = mergeWeights(scenario.processWeights)
  const usable: [ProcessDimension, number, number][] = []
  for (const k of PROCESS_DIMENSIONS) {
    const s = dims[k]
    if (s.value === null || s.value === undefined) continue
    usable.push([k, s.value, weights[k]])
  }
  if (usable.length === 0) return null
  const totalW = usable.reduce((s, [, , w]) => s + w, 0)
  if (totalW === 0) return null
  // Geometrisch gemiddelde: exp( Σ w_k · ln(D_k) / Σ w_k )
  // D_k = 0 (of nul-ondergrens) klopt slecht met log — vervang door 0.01 zodat de aggregate
  // niet stil naar 0 gaat (dat is de spec-strekking: één zwakke as niet wegpoetsen, maar
  // óók geen −Infinity forceren wanneer een enkele dimensie 0 raakt).
  const eps = 0.01
  let logSum = 0
  for (const [, v, w] of usable) logSum += (w / totalW) * Math.log(Math.max(v, eps))
  return clamp05(Math.exp(logSum))
}

function mergeWeights(overrides?: Partial<Record<ProcessDimension, number>>): Record<ProcessDimension, number> {
  const out = { ...DEFAULT_PROCESS_WEIGHTS } as Record<ProcessDimension, number>
  if (overrides) for (const [k, v] of Object.entries(overrides)) {
    if (typeof v === 'number') out[k as ProcessDimension] = v
  }
  return out
}

function clamp05(x: number): number { return Math.min(5, Math.max(0, x)) }
