"use client"

import type { ReactNode } from "react"
import {
  ArrowLeft, ArrowRight, Check, Flag, Gavel, Inbox, Lock,
  Scale, ShieldCheck, Users, Waypoints,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { STEP_META, STEP_ORDER, TOTAL_STEPS, stepLabel, stepNumber, type StepIcon, type StepId } from "./flow"

// Eén icoon per stap, zodat de voortgang te zien is zonder te lezen. Issue #105
// §2 vraagt iconen en duidelijke status; de vorige voortgangsbalk was zeven
// streepjes van anderhalve pixel met alleen sr-only labels erin.
const STEP_ICON: Record<StepIcon, LucideIcon> = {
  rol: ShieldCheck,
  situatie: Waypoints,
  bericht: Inbox,
  overleg: Users,
  keuze: Gavel,
  weegschaal: Scale,
  vlag: Flag,
}

// Het frame om elke stap heen: voortgang, één korte titel, één primaire actie.
// Waarom één frame en geen vrije opmaak per stap: issue #105 §2 ging mis omdat
// elk paneel zijn eigen kop, eigen uitleg en eigen knop meebracht.

export interface StepPrimary {
  label: string
  onClick?: () => void
  disabled?: boolean
  busy?: boolean
}

export function StepProgress({
  step,
  highest,
  onGo,
}: {
  step: StepId
  highest: StepId
  onGo: (id: StepId) => void
}) {
  const highestIdx = STEP_ORDER.indexOf(highest)
  const currentIdx = STEP_ORDER.indexOf(step)

  return (
    <div className="flex flex-col gap-2">
      <span className="font-mono text-[10px] uppercase tracking-widest text-primary">
        {stepLabel(step)} · {STEP_META[step].title}
      </span>
      <ol
        className="flex items-center gap-1 sm:gap-1.5"
        aria-label={`Voortgang: stap ${stepNumber(step)} van ${TOTAL_STEPS}`}
      >
        {STEP_ORDER.map((id, i) => {
          const open = i <= highestIdx
          const active = i === currentIdx
          const done = open && i < currentIdx
          const Icon = done ? Check : STEP_ICON[STEP_META[id].icon]
          return (
            <li key={id} className="flex min-w-0 flex-1 items-center gap-1 sm:gap-1.5">
              <button
                type="button"
                disabled={!open}
                onClick={() => open && onGo(id)}
                title={open ? `${stepLabel(id)} — ${STEP_META[id].title}` : `${STEP_META[id].title} — nog niet geopend`}
                aria-current={active ? "step" : undefined}
                className={`flex size-8 shrink-0 items-center justify-center rounded-full border transition-colors ${
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : done
                      ? "border-primary/40 bg-primary/10 text-primary hover:bg-primary/20"
                      : open
                        ? "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-primary"
                        : "border-dashed border-border bg-transparent text-muted-foreground/40 cursor-not-allowed"
                }`}
              >
                {open ? <Icon className="size-4" aria-hidden /> : <Lock className="size-3" aria-hidden />}
                <span className="sr-only">{STEP_META[id].title}</span>
              </button>
              {/* Verbindingslijn tussen de stappen, zodat het als één route
                  leest en niet als zeven losse knoppen. */}
              {i < STEP_ORDER.length - 1 && (
                <span
                  aria-hidden
                  className={`h-px min-w-1 flex-1 ${i < currentIdx ? "bg-primary/40" : "bg-border"}`}
                />
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}

export function StepShell({
  step,
  highest,
  onGo,
  primary,
  note,
  children,
}: {
  step: StepId
  highest: StepId
  onGo: (id: StepId) => void
  primary?: StepPrimary
  // Eén regel onderaan: waarom er nu niets te doen is, of wat er hierna komt.
  note?: string
  children: ReactNode
}) {
  const meta = STEP_META[step]
  const HeaderIcon = STEP_ICON[meta.icon]
  const idx = STEP_ORDER.indexOf(step)
  const prev = idx > 0 ? STEP_ORDER[idx - 1] : null
  const highestIdx = STEP_ORDER.indexOf(highest)
  const next = idx < highestIdx ? STEP_ORDER[idx + 1] : null

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <StepProgress step={step} highest={highest} onGo={onGo} />

      <header className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-primary/30 bg-primary/10">
          <HeaderIcon className="size-5 text-primary" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">{meta.title}</h1>
          <p className="text-sm text-muted-foreground">{meta.lead}</p>
        </span>
      </header>

      <div className="flex flex-col gap-4">{children}</div>

      <footer className="flex flex-col gap-3 border-t border-border pt-4">
        {note && (
          <p className="flex items-start gap-2 text-xs text-muted-foreground">
            <Lock className="mt-0.5 size-3 shrink-0" aria-hidden />
            <span>{note}</span>
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          {prev ? (
            <button
              type="button"
              onClick={() => onGo(prev)}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground hover:bg-accent"
            >
              <ArrowLeft className="size-3.5" /> {STEP_META[prev].title}
            </button>
          ) : null}

          <div className="ml-auto flex items-center gap-3">
            {primary ? (
              <button
                type="button"
                onClick={primary.onClick}
                disabled={primary.disabled || primary.busy}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 font-mono text-xs uppercase tracking-wider text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {primary.label}
                {primary.busy ? <span className="font-mono text-[10px]">…</span> : <ArrowRight className="size-3.5" />}
              </button>
            ) : next ? (
              <button
                type="button"
                onClick={() => onGo(next)}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 font-mono text-xs uppercase tracking-wider text-primary-foreground hover:opacity-90"
              >
                Verder naar {STEP_META[next].title.toLowerCase()}
                <ArrowRight className="size-3.5" />
              </button>
            ) : null}
          </div>
        </div>
      </footer>
    </div>
  )
}
