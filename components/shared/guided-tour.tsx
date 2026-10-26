"use client"

// Spotlight-rondleiding over de levende UI.
//
// De eigenaar vroeg om uitleg met screenshots: het echte scherm, één functie
// uitgelicht met een pijl erbij, de rest vaag, en een aantal van die beelden
// achter elkaar. Dit bouwt datzelfde beeld, maar niet van opgenomen plaatjes.
// Opgenomen screenshots kloppen één dag en zijn daarna stil fout — elke
// opmaakwijziging vraagt dan onderhoud dat niemand doet. Deze overlay licht het
// echte element uit dat er op dat moment staat, dus hij verandert mee.

import { useCallback, useEffect, useId, useRef, useState, type JSX } from "react"
import { ArrowLeft, ArrowRight, Check, X } from "lucide-react"
import {
  TOUR_MARGIN,
  cutoutRect,
  placeBalloon,
  resolveSteps,
  type BalloonPlacement,
  type Tour,
  type TourRect,
  type TourSide,
  type TourSize,
  type TourStep,
} from "@/lib/guided-tour-steps"

// Breder dan dit leest de ballon als een alinea in plaats van een toelichting.
const BALLOON_MAX_WIDTH = 320
// Zijde van het pijldriehoekje (een vierkant van 12px, 45 graden gedraaid).
const ARROW = 12

// Welke twee randen van het gedraaide vierkantje zichtbaar blijven. Dat bepaalt
// welke kant de punt op wijst, en het laat de pijl exact dezelfde rand en
// vulling houden als de ballon zelf.
const ARROW_BORDER: Record<TourSide, string> = {
  onder: "border-l border-t",
  boven: "border-r border-b",
  rechts: "border-l border-b",
  links: "border-r border-t",
}

export function GuidedTour({
  tour,
  open,
  onClose,
}: {
  tour: Tour
  open: boolean
  onClose: () => void
}): JSX.Element | null {
  // De hele staat zit in TourOverlay, zodat die bij openen opnieuw begint en
  // hier geen hook achter een `if` komt te staan.
  if (!open) return null
  return <TourOverlay tour={tour} onClose={onClose} />
}

function TourOverlay({ tour, onClose }: { tour: Tour; onClose: () => void }): JSX.Element | null {
  // De stappen worden één keer bij openen vastgesteld: alleen de doelen die nu
  // echt in de DOM staan. Een stap die ontbreekt wordt overgeslagen in plaats
  // van de rondleiding te breken.
  const [steps] = useState<TourStep[]>(() =>
    resolveSteps(tour.steps, sel =>
      typeof document === "undefined" ? false : document.querySelector(sel) !== null,
    ),
  )
  const [index, setIndex] = useState(0)
  const [rect, setRect] = useState<TourRect | null>(null)
  const [viewport, setViewport] = useState<TourSize | null>(null)
  // Alleen de hoogte wordt gemeten; de breedte zetten we zelf, zodat de
  // positieberekening niet een frame op een meting hoeft te wachten.
  const [balloonHeight, setBalloonHeight] = useState(180)
  const balloonRef = useRef<HTMLDivElement>(null)
  const uid = useId()

  const total = steps.length
  const step: TourStep | undefined = steps[index]
  const ready = rect !== null && viewport !== null

  const next = useCallback(() => {
    if (index + 1 >= total) {
      onClose()
      return
    }
    setIndex(index + 1)
  }, [index, total, onClose])

  const prev = useCallback(() => {
    setIndex(i => (i > 0 ? i - 1 : i))
  }, [])

  const measure = useCallback(() => {
    if (!step) return
    const el = document.querySelector(step.target)
    if (!el) {
      // Het doel is tijdens de rondleiding verdwenen — de UI leeft. Doorschuiven
      // in plaats van een gat op nul bij nul tekenen. Loopt de index daarmee
      // voorbij de laatste stap, dan sluit de effect hieronder de rondleiding.
      setRect(null)
      setIndex(i => i + 1)
      return
    }
    const r = el.getBoundingClientRect()
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height })
    setViewport({ width: window.innerWidth, height: window.innerHeight })
  }, [step])

  // Niets uit te lichten, of alle resterende doelen verdwenen: nooit een leeg
  // zwart scherm laten staan.
  useEffect(() => {
    if (index >= total) onClose()
  }, [index, total, onClose])

  // Eerst het doel in beeld scrollen, dan meten. Bewust `behavior: "auto"`:
  // bij smooth scrollen meet je een positie die nog beweegt en staat de
  // uitsnede een halve seconde naast het element.
  useEffect(() => {
    if (!step) return
    document.querySelector(step.target)?.scrollIntoView({
      block: "center",
      inline: "nearest",
      behavior: "auto",
    })
    // In een frame erna meten, niet nu: na het scrollen is de positie pas bij
    // de volgende paint definitief.
    const raf = requestAnimationFrame(measure)
    return () => cancelAnimationFrame(raf)
  }, [step, measure])

  useEffect(() => {
    const onMove = () => measure()
    window.addEventListener("resize", onMove)
    // Met capture, want ook scrollen binnen een paneel verschuift het doel.
    window.addEventListener("scroll", onMove, true)
    return () => {
      window.removeEventListener("resize", onMove)
      window.removeEventListener("scroll", onMove, true)
    }
  }, [measure])

  useEffect(() => {
    const el = balloonRef.current
    if (!el) return
    const read = () => {
      const h = el.getBoundingClientRect().height
      setBalloonHeight(prev => (Math.abs(prev - h) < 1 ? prev : h))
    }
    read()
    const observer = new ResizeObserver(read)
    observer.observe(el)
    return () => observer.disconnect()
  }, [index, ready])

  useEffect(() => {
    if (ready) balloonRef.current?.focus()
  }, [index, ready])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault()
        onClose()
      } else if (e.key === "ArrowRight") {
        e.preventDefault()
        next()
      } else if (e.key === "ArrowLeft") {
        e.preventDefault()
        prev()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [next, prev, onClose])

  if (total === 0 || !step) return null
  if (!rect || !viewport) return null

  const cut: TourRect = cutoutRect(rect, viewport)
  const balloonWidth = Math.min(BALLOON_MAX_WIDTH, viewport.width - 2 * TOUR_MARGIN)
  const place: BalloonPlacement = placeBalloon(
    cut,
    { width: balloonWidth, height: balloonHeight },
    viewport,
    step.prefer,
  )

  const last = index + 1 === total
  // Vier panelen rondom de uitsnede in plaats van één laag met een gat erin.
  // Reden: een `box-shadow` met enorme spread dimt wel, maar `backdrop-filter`
  // werkt niet op het schaduwvlak — dan krijg je donker zonder vaag. Vier
  // panelen laten het uitgelichte element volledig onbedekt (dus scherp én
  // aanklikbaar) en vervagen alles eromheen echt.
  const panel = "fixed z-[200] bg-black/45 backdrop-blur-sm"

  return (
    <>
      {/* De panelen vangen klikken op: een stray klik mag niets starten in de
          UI die achter de waas ligt. Sluiten gaat via Escape of de knop. */}
      <div aria-hidden className={panel} style={{ left: 0, top: 0, width: "100%", height: cut.top }} />
      <div
        aria-hidden
        className={panel}
        style={{ left: 0, top: cut.top + cut.height, width: "100%", bottom: 0 }}
      />
      <div
        aria-hidden
        className={panel}
        style={{ left: 0, top: cut.top, width: cut.left, height: cut.height }}
      />
      <div
        aria-hidden
        className={panel}
        style={{ left: cut.left + cut.width, top: cut.top, right: 0, height: cut.height }}
      />

      <div
        aria-hidden
        className="pointer-events-none fixed z-[201] rounded-lg ring-2 ring-primary"
        style={{ left: cut.left, top: cut.top, width: cut.width, height: cut.height }}
      />

      <div
        aria-hidden
        className={`pointer-events-none fixed z-[203] size-3 rotate-45 border-border bg-card ${ARROW_BORDER[place.side]}`}
        style={{ left: place.arrowLeft - ARROW / 2, top: place.arrowTop - ARROW / 2 }}
      />

      <div
        ref={balloonRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${uid}-title`}
        aria-describedby={`${uid}-body`}
        tabIndex={-1}
        className="fixed z-[202] flex flex-col gap-3 rounded-lg border border-border bg-card p-4 shadow-xl outline-none"
        style={{ left: place.left, top: place.top, width: balloonWidth }}
      >
        <div className="flex items-start gap-2">
          <span className="min-w-0 flex-1">
            <span className="block font-mono text-[10px] uppercase tracking-widest text-primary">
              Stap {index + 1} van {total}
            </span>
            <h2 id={`${uid}-title`} className="text-base font-semibold tracking-tight text-foreground">
              {step.title}
            </h2>
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Rondleiding sluiten"
            className="-mr-1 -mt-1 shrink-0 rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>

        <p id={`${uid}-body`} className="text-sm leading-relaxed text-muted-foreground">
          {step.body}
        </p>

        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
          <button
            type="button"
            onClick={prev}
            disabled={index === 0}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ArrowLeft className="size-3.5" aria-hidden /> Vorige
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            Sluiten
          </button>
          <button
            type="button"
            onClick={next}
            className="ml-auto inline-flex items-center gap-1.5 rounded-md bg-primary px-3.5 py-1.5 font-mono text-[10px] uppercase tracking-wider text-primary-foreground hover:opacity-90"
          >
            {last ? "Klaar" : "Volgende"}
            {last ? <Check className="size-3.5" aria-hidden /> : <ArrowRight className="size-3.5" aria-hidden />}
          </button>
        </div>
      </div>
    </>
  )
}
