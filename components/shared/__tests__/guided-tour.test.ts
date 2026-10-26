// De rondleidingen: inhoud en positiekeuze.
//
// Zonder DOM — de vitest-omgeving is `node`. Daarom zit alles wat te testen
// valt in lib/guided-tour-steps.ts: de teksten, de selectors, en het rekenwerk
// voor de uitsnede en de ballon. De overlay zelf is dan nog maar opmaak.

import { describe, expect, it } from 'vitest'
import {
  ALL_TOURS,
  DEELNEMER_TOUR,
  FACILITATOR_TOUR,
  TOURS,
  TOUR_MARGIN,
  cutoutRect,
  isTourSelector,
  placeBalloon,
  resolveSteps,
  type TourRect,
} from '@/lib/guided-tour-steps'

// Een ballon van ~300px breed. Op 375px past die nooit naast een element.
const BALLOON = { width: 320, height: 180 }
const MOBILE = { width: 375, height: 812 }
const DESKTOP = { width: 1440, height: 900 }

describe('de rondleidingen', () => {
  it('levert een deelnemer- en een facilitatorrondleiding', () => {
    expect(Object.keys(TOURS).sort()).toEqual(['deelnemer', 'facilitator'])
    expect(DEELNEMER_TOUR.id).toBe('deelnemer')
    expect(FACILITATOR_TOUR.id).toBe('facilitator')
  })

  it('heeft per rondleiding vier tot zes stappen', () => {
    for (const tour of ALL_TOURS) {
      expect(tour.steps.length).toBeGreaterThanOrEqual(4)
      expect(tour.steps.length).toBeLessThanOrEqual(6)
    }
  })

  it('geeft elke stap een niet-lege titel en body', () => {
    for (const tour of ALL_TOURS) {
      for (const step of tour.steps) {
        expect(step.title.trim().length).toBeGreaterThan(0)
        expect(step.body.trim().length).toBeGreaterThan(0)
      }
    }
  })

  it('richt elke stap op een [data-tour="..."]-selector', () => {
    for (const tour of ALL_TOURS) {
      for (const step of tour.steps) {
        expect(isTourSelector(step.target)).toBe(true)
      }
    }
  })

  it('wijst geen twee stappen naar hetzelfde element', () => {
    for (const tour of ALL_TOURS) {
      const targets = tour.steps.map(s => s.target)
      expect(new Set(targets).size).toBe(targets.length)
    }
  })

  it('keurt klasse- en elementselectors af', () => {
    expect(isTourSelector('.voortgangsbalk')).toBe(false)
    expect(isTourSelector('#stapkop')).toBe(false)
    expect(isTourSelector('ol[aria-label]')).toBe(false)
    expect(isTourSelector('[data-tour="deelnemer-voortgang"]')).toBe(true)
  })
})

describe('resolveSteps', () => {
  it('slaat een stap over waarvan het doel niet bestaat', () => {
    const aanwezig = new Set([DEELNEMER_TOUR.steps[0].target, DEELNEMER_TOUR.steps[2].target])
    const resolved = resolveSteps(DEELNEMER_TOUR.steps, sel => aanwezig.has(sel))
    expect(resolved).toHaveLength(2)
    expect(resolved[0].target).toBe(DEELNEMER_TOUR.steps[0].target)
  })

  it('geeft een lege lijst als niets te vinden is — de overlay sluit dan', () => {
    expect(resolveSteps(FACILITATOR_TOUR.steps, () => false)).toEqual([])
  })
})

describe('cutoutRect', () => {
  it('laat het element uitlopen met wat lucht en rondt naar buiten af', () => {
    const cut = cutoutRect({ top: 100.4, left: 200.6, width: 120.2, height: 40.3 }, DESKTOP, 6)
    expect(cut.top).toBe(94)
    expect(cut.left).toBe(194)
    // 200.6 + 120.2 + 6 = 326.8 → 327, min 194 = 133 breed.
    expect(cut.left + cut.width).toBe(327)
    expect(cut.top + cut.height).toBe(147)
  })

  it('klemt de uitsnede binnen het venster', () => {
    const cut = cutoutRect({ top: -20, left: -10, width: 1500, height: 60 }, DESKTOP, 6)
    expect(cut.top).toBe(0)
    expect(cut.left).toBe(0)
    expect(cut.width).toBe(DESKTOP.width)
  })
})

describe('placeBalloon', () => {
  const midden: TourRect = { top: 400, left: 600, width: 200, height: 48 }

  function binnenVenster(
    place: { left: number; top: number },
    balloon: { width: number; height: number },
    viewport: { width: number; height: number },
  ) {
    expect(place.left).toBeGreaterThanOrEqual(TOUR_MARGIN)
    expect(place.top).toBeGreaterThanOrEqual(TOUR_MARGIN)
    expect(place.left + balloon.width).toBeLessThanOrEqual(viewport.width - TOUR_MARGIN)
    expect(place.top + balloon.height).toBeLessThanOrEqual(viewport.height - TOUR_MARGIN)
  }

  it('volgt de voorkeur als er ruimte is', () => {
    expect(placeBalloon(midden, BALLOON, DESKTOP, 'rechts').side).toBe('rechts')
    expect(placeBalloon(midden, BALLOON, DESKTOP, 'onder').side).toBe('onder')
    expect(placeBalloon(midden, BALLOON, DESKTOP, 'boven').side).toBe('boven')
    expect(placeBalloon(midden, BALLOON, DESKTOP, 'links').side).toBe('links')
  })

  it('valt op 375px terug op onder of boven, want naast past niet', () => {
    const smal: TourRect = { top: 300, left: 16, width: 343, height: 48 }
    for (const prefer of ['links', 'rechts'] as const) {
      const place = placeBalloon(smal, BALLOON, MOBILE, prefer)
      expect(['onder', 'boven']).toContain(place.side)
      binnenVenster(place, BALLOON, MOBILE)
    }
  })

  it('kiest boven als onder geen ruimte meer is', () => {
    const laag: TourRect = { top: 700, left: 40, width: 295, height: 60 }
    const place = placeBalloon(laag, BALLOON, MOBILE, 'onder')
    expect(place.side).toBe('boven')
    binnenVenster(place, BALLOON, MOBILE)
  })

  it('wijkt naar de andere kant als naast het element geen ruimte is', () => {
    const hoek: TourRect = { top: 8, left: 1380, width: 52, height: 40 }
    const place = placeBalloon(hoek, BALLOON, DESKTOP, 'rechts')
    expect(place.side).toBe('links')
    binnenVenster(place, BALLOON, DESKTOP)
  })

  it('klemt de ballon aan de rechterrand in plaats van hem te centreren', () => {
    const hoek: TourRect = { top: 8, left: 1380, width: 52, height: 40 }
    const place = placeBalloon(hoek, BALLOON, DESKTOP, 'onder')
    expect(place.side).toBe('onder')
    // Gecentreerd op het element zou hij buiten het venster vallen.
    expect(place.left + BALLOON.width).toBe(DESKTOP.width - TOUR_MARGIN)
  })

  it('houdt de ballon binnen het venster voor elke stap van elke rondleiding', () => {
    const hoeken: TourRect[] = [
      { top: 0, left: 0, width: 40, height: 40 },
      { top: 0, left: 335, width: 40, height: 40 },
      { top: 772, left: 0, width: 40, height: 40 },
      { top: 772, left: 335, width: 40, height: 40 },
      { top: 380, left: 8, width: 359, height: 52 },
    ]
    for (const tour of ALL_TOURS) {
      for (const step of tour.steps) {
        for (const target of hoeken) {
          const place = placeBalloon(target, BALLOON, MOBILE, step.prefer)
          binnenVenster(place, BALLOON, MOBILE)
        }
      }
    }
  })

  it('plakt de ballon aan de linkerrand als hij breder is dan het venster', () => {
    const place = placeBalloon(midden, { width: 500, height: 200 }, MOBILE, 'onder')
    expect(place.left).toBe(TOUR_MARGIN)
  })

  it('laat de pijl naar het element wijzen, ook als de ballon geklemd is', () => {
    const hoek: TourRect = { top: 300, left: 0, width: 40, height: 40 }
    const place = placeBalloon(hoek, BALLOON, MOBILE, 'onder')
    // Ballon geklemd op de marge, pijl boven de ballon en links in de buurt
    // van het element — niet in het midden van de ballon.
    expect(place.arrowTop).toBe(place.top)
    expect(place.arrowLeft).toBeGreaterThanOrEqual(place.left)
    expect(place.arrowLeft).toBeLessThan(place.left + BALLOON.width / 2)
  })

  it('zet de pijl op de rand van de ballon die naar het element kijkt', () => {
    const rechts = placeBalloon(midden, BALLOON, DESKTOP, 'rechts')
    expect(rechts.arrowLeft).toBe(rechts.left)
    const links = placeBalloon(midden, BALLOON, DESKTOP, 'links')
    expect(links.arrowLeft).toBe(links.left + BALLOON.width)
    const boven = placeBalloon(midden, BALLOON, DESKTOP, 'boven')
    expect(boven.arrowTop).toBe(boven.top + BALLOON.height)
  })
})
