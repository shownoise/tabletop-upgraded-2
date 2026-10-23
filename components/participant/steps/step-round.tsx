"use client"

import { useState } from "react"
import { MessageCircle } from "lucide-react"
import type { Round } from "@/lib/types"
import { stripMarkdown } from "@/lib/render-markdown"
import { DecisionBrief } from "./decision-brief"
import { shortLead } from "./flow"
import type { MandateView } from "./mandate"

// Stap 2 (ronde-intro) en stap 4 (overleg). Twee schermen, dezelfde twee
// bouwstenen: een korte situatieschets en de beslisvraag.
//
// De situatieschets stond live volledig open en vertelde alle vier injects van
// ronde 1 vooraf (issue #105 §5). `shortLead()` knipt hem af op een zinseinde;
// de rest blijft opvraagbaar maar staat dicht.

function Situation({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  const { lead, rest } = shortLead(stripMarkdown(text ?? ""))
  if (!lead) return null

  return (
    <section className="flex flex-col gap-2 rounded-lg border border-border bg-card px-4 py-3">
      <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
        De situatie
      </span>
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{lead}</p>
      {rest && (
        <>
          {open && (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{rest}</p>
          )}
          <button
            type="button"
            onClick={() => setOpen(o => !o)}
            className="self-start font-mono text-[10px] uppercase tracking-wider text-primary underline hover:no-underline"
          >
            {open ? "Minder tonen" : "Volledige situatieschets"}
          </button>
        </>
      )}
    </section>
  )
}

// `openingPrompts` staat in de scenariodata maar niet op het Round-type. Een
// cast in plaats van een typewijziging: lib/types.ts is in deze klus read-only.
function openingPrompts(round: Round | null): string[] {
  return (round as (Round & { openingPrompts?: string[] }) | null)?.openingPrompts ?? []
}

export function StepRound({
  round,
  roundNumber,
  totalRounds,
  mandate,
  deadline,
}: {
  round: Round | null
  roundNumber: number
  totalRounds: number
  mandate: MandateView | null
  deadline?: string
}) {
  if (!round) {
    return (
      <p className="rounded-lg border border-dashed border-border bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
        De facilitator heeft deze ronde nog niet geopend.
      </p>
    )
  }

  return (
    <>
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="font-mono text-[10px] uppercase tracking-widest text-primary">
          Ronde {roundNumber}{totalRounds > 0 ? ` van ${totalRounds}` : ""}
        </span>
        <h2 className="text-sm font-medium text-foreground">{round.title}</h2>
      </div>

      <Situation text={round.situation_update} />

      <DecisionBrief view={mandate} deadline={deadline} />
    </>
  )
}

export function StepDiscussion({
  round,
  mandate,
  deadline,
}: {
  round: Round | null
  mandate: MandateView | null
  deadline?: string
}) {
  const prompts = openingPrompts(round)

  return (
    <>
      <DecisionBrief view={mandate} deadline={deadline} />

      <section className="flex flex-col gap-2 rounded-lg border border-border bg-card px-4 py-3">
        <span className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
          <MessageCircle className="size-3.5" aria-hidden /> Te bespreken
        </span>
        {prompts.length > 0 ? (
          <ul className="flex flex-col gap-1.5">
            {prompts.map((p, i) => (
              <li key={i} className="flex gap-2 text-sm text-foreground">
                <span className="shrink-0 text-primary">•</span>
                <span className="leading-snug">{p}</span>
              </li>
            ))}
          </ul>
        ) : (
          <ul className="flex flex-col gap-1.5 text-sm text-foreground">
            <li className="flex gap-2"><span className="shrink-0 text-primary">•</span><span>Wat weten we zeker en wat nemen we aan?</span></li>
            <li className="flex gap-2"><span className="shrink-0 text-primary">•</span><span>Welke opties liggen er, en wat kost elk ervan?</span></li>
            <li className="flex gap-2"><span className="shrink-0 text-primary">•</span><span>Wie besluit, en wat heeft die daarvoor van jou nodig?</span></li>
          </ul>
        )}
      </section>
    </>
  )
}
