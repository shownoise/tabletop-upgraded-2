"use client"

import type { ReactNode } from "react"
import { ArrowLeft, ArrowRight, Lock } from "lucide-react"
import { STEP_META, STEP_ORDER, TOTAL_STEPS, stepLabel, stepNumber, type StepId } from "./flow"

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
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-[10px] uppercase tracking-widest text-primary">
          {stepLabel(step)}
        </span>
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          {STEP_META[step].title}
        </span>
      </div>
      <ol className="flex items-center gap-1" aria-label={`Voortgang: stap ${stepNumber(step)} van ${TOTAL_STEPS}`}>
        {STEP_ORDER.map((id, i) => {
          const open = i <= highestIdx
          const active = i === currentIdx
          return (
            <li key={id} className="flex-1">
              <button
                type="button"
                disabled={!open}
                onClick={() => open && onGo(id)}
                title={open ? `${stepLabel(id)} — ${STEP_META[id].title}` : `${STEP_META[id].title} — nog niet geopend`}
                aria-current={active ? "step" : undefined}
                className={`h-1.5 w-full rounded-full transition-colors ${
                  active
                    ? "bg-primary"
                    : open
                      ? "bg-primary/35 hover:bg-primary/60 cursor-pointer"
                      : "bg-border cursor-not-allowed"
                }`}
              >
                <span className="sr-only">{STEP_META[id].title}</span>
              </button>
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
  const idx = STEP_ORDER.indexOf(step)
  const prev = idx > 0 ? STEP_ORDER[idx - 1] : null
  const highestIdx = STEP_ORDER.indexOf(highest)
  const next = idx < highestIdx ? STEP_ORDER[idx + 1] : null

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <StepProgress step={step} highest={highest} onGo={onGo} />

      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">{meta.title}</h1>
        <p className="text-sm text-muted-foreground">{meta.lead}</p>
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
