import type { Mode, ProcessDimension } from './types'

// Deel B §3 — meetbaarheid per (dimensie × modus).
//
// Regel: als een dimensie in de modus 'unmeasurable' is en er is geen ander mechaniek
// (bijv. facilitator-slider), dan valt de dimensie uit de weging met reden.
//
// Deze matrix is een *maximum-support* declaratie: de scoring-package respecteert
// het als een gate BOVEN de mechaniek-detectie. Zelfs als er data is voor MANDAAT
// in EVENT-mode, wordt die door deze matrix gemaskeerd (want spec §3 zegt: niet
// meten wanneer we niet weten wie binnen de groep wat vond).
export const MODE_MATRIX: Record<Mode, Record<ProcessDimension, 'full' | 'partial' | 'unmeasurable'>> = {
  ASSESSMENT: {
    BESLUIT: 'full',
    MANDAAT: 'full',
    AANNAME: 'full',
    ADAPT: 'full',
    EXTERN: 'full',
    VOLHOUD: 'partial',  // slider vaak nodig
    DELEN: 'full',
  },
  EVENT: {
    BESLUIT: 'full',      // tempo + dekking; Δ_ref = fasetimer
    MANDAAT: 'unmeasurable',
    AANNAME: 'unmeasurable',  // vervangen door zekerheidstap (KALIBRATIE)
    ADAPT: 'full',
    EXTERN: 'partial',    // via keuze-opties, geen facilitator-timing
    VOLHOUD: 'unmeasurable',  // niet van toepassing bij zaalevent
    DELEN: 'unmeasurable',
  },
}

export function isMeasurable(mode: Mode, dim: ProcessDimension): boolean {
  return MODE_MATRIX[mode][dim] !== 'unmeasurable'
}

export function maskUnmeasurable<T extends { value: number | null; reason?: string; dataQuality: 'measured' | 'observation' | 'null' }>(
  mode: Mode,
  dim: ProcessDimension,
  score: T,
): T {
  if (isMeasurable(mode, dim)) return score
  return {
    ...score,
    value: null,
    dataQuality: 'null',
    reason: `mode=${mode}: ${dim} is niet meetbaar in deze modus`,
  }
}
