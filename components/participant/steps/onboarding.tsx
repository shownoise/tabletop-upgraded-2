"use client"

import { useState } from "react"
import { ArrowRight, Gavel, Inbox, Scale, ShieldCheck, Users } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { ONBOARDING_CARDS, ONBOARDING_LEAD, type OnboardingIcon } from "./flow"

// Vijf kaarten in plaats van 964 woorden (issue #105 §2). Geen raamwerk, geen
// feit/aanname: alleen de kern van wat een deelnemer gaat doen.

const ICONS: Record<OnboardingIcon, LucideIcon> = {
  rol: ShieldCheck,
  bericht: Inbox,
  overleg: Users,
  keuze: Gavel,
  dimensies: Scale,
}

export function Onboarding({ onDone }: { onDone: () => void }) {
  const [i, setI] = useState(0)
  const card = ONBOARDING_CARDS[i]
  const Icon = ICONS[card.icon]
  const last = i === ONBOARDING_CARDS.length - 1

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-background/95 px-4 py-10 backdrop-blur">
      <div className="flex w-full max-w-md flex-col gap-6">
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          {ONBOARDING_LEAD}
        </p>

        <div className="flex flex-col gap-4 rounded-xl border border-primary/30 bg-card px-6 py-7">
          <div className="flex size-11 items-center justify-center rounded-full border border-primary/40 bg-primary/10">
            <Icon className="size-5 text-primary" aria-hidden />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-widest text-primary">
              {i + 1} / {ONBOARDING_CARDS.length}
            </span>
            <h2 className="text-lg font-semibold tracking-tight text-foreground">{card.title}</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">{card.body}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <ol className="flex flex-1 items-center gap-1.5" aria-label="Onboarding-voortgang">
            {ONBOARDING_CARDS.map((c, idx) => (
              <li key={c.icon} className="flex-1">
                <button
                  type="button"
                  onClick={() => setI(idx)}
                  aria-current={idx === i ? "step" : undefined}
                  className={`h-1.5 w-full rounded-full transition-colors ${
                    idx === i ? "bg-primary" : idx < i ? "bg-primary/40" : "bg-border"
                  }`}
                >
                  <span className="sr-only">{c.title}</span>
                </button>
              </li>
            ))}
          </ol>
          <button
            type="button"
            onClick={() => (last ? onDone() : setI(i + 1))}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 font-mono text-xs uppercase tracking-wider text-primary-foreground hover:opacity-90"
          >
            {last ? "Beginnen" : "Verder"}
            <ArrowRight className="size-3.5" />
          </button>
        </div>

        {!last && (
          <button
            type="button"
            onClick={onDone}
            className="self-center font-mono text-[10px] uppercase tracking-wider text-muted-foreground underline hover:no-underline"
          >
            Overslaan
          </button>
        )}
      </div>
    </div>
  )
}
