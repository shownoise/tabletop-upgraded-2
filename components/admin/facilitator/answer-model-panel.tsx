"use client"

// Het antwoordmodel van een ronde, voor de facilitator.
//
// De reviewkaarten vertellen wat een team koos en wat dat op de zes dimensies
// deed. Wat er niet stond: wat het bedoelde antwoord was, welk antwoord er
// vlak achter zat, en waarom het eerste beter is dan het tweede. Zonder dat
// kan een facilitator een score melden maar niet uitleggen — en uitleggen is
// de hele oefening.
//
// Alles hieronder is auteurstekst (`qualityRank`, `description`,
// `facilitatorCommentary`, `facilitatorRationale`). Niets wordt hier verzonnen
// en er wordt geen vector nagerekend; die staan al op de reviewkaart.

import { useState } from "react"
import { Check, ChevronRight, Lightbulb, Minus, X } from "lucide-react"
import { ROLE_META, type ChoiceQuality } from "@/lib/types"
import type { AnswerModelDecision, AnswerModelOption } from "./review-items"

const KWALITEIT: Record<ChoiceQuality, { label: string; klasse: string; Icon: typeof Check }> = {
  best: {
    label: "Beste antwoord",
    klasse: "border-primary/50 bg-primary/10 text-primary",
    Icon: Check,
  },
  good: {
    label: "Ook verdedigbaar",
    klasse: "border-primary/25 bg-primary/5 text-primary/80",
    Icon: Check,
  },
  poor: {
    label: "Zwak",
    klasse: "border-border bg-muted/40 text-muted-foreground",
    Icon: Minus,
  },
  wrong: {
    label: "Fout",
    klasse: "border-destructive/40 bg-destructive/10 text-destructive",
    Icon: X,
  },
}

const ZONDER_RANG = {
  label: "Geen rang vastgelegd",
  klasse: "border-dashed border-border bg-background text-muted-foreground",
  Icon: Minus,
}

export function AnswerModelPanel({
  decisions,
  defaultOpen = false,
}: {
  decisions: AnswerModelDecision[]
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)

  // Een ronde zonder beslispunt, of een beslispunt waarvan de auteur geen enkel
  // antwoord heeft gerangschikt: dan is er niets uit te leggen en is een leeg
  // paneel erger dan geen paneel.
  const bruikbaar = decisions.filter(d => d.byRole.some(r => r.options.length > 0))
  if (bruikbaar.length === 0) return null

  return (
    <section className="rounded-xl border border-primary/30 bg-primary/5">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-primary/10"
      >
        <span className="flex items-center gap-2">
          <Lightbulb className="size-3.5 shrink-0 text-primary" aria-hidden />
          <span className="font-mono text-[10px] uppercase tracking-widest text-primary">
            Antwoordmodel — waarom het ene antwoord beter is
          </span>
        </span>
        <ChevronRight
          aria-hidden
          className={`size-4 shrink-0 text-primary transition-transform ${open ? "rotate-90" : ""}`}
        />
      </button>

      {open && (
        <div className="flex flex-col gap-5 border-t border-primary/20 px-4 py-4">
          {bruikbaar.map(decision => (
            <Beslispunt key={decision.nodeId} decision={decision} meerdere={bruikbaar.length > 1} />
          ))}
        </div>
      )}
    </section>
  )
}

function Beslispunt({ decision, meerdere }: { decision: AnswerModelDecision; meerdere: boolean }) {
  return (
    <div className="flex flex-col gap-3">
      {meerdere && (
        <p className="text-sm font-semibold leading-snug text-foreground">{decision.prompt}</p>
      )}

      {/* De motivatie van de auteur staat bovenaan: dat is de regel die de
          facilitator voorleest, de rest is het bewijs eronder. */}
      {decision.facilitatorRationale ? (
        <p className="rounded-lg border-l-[3px] border-primary bg-card px-3 py-2 text-sm leading-relaxed text-foreground">
          {decision.facilitatorRationale}
        </p>
      ) : (
        <p className="rounded-lg border border-dashed border-border px-3 py-2 text-xs leading-relaxed text-muted-foreground">
          De auteur van dit scenario heeft geen motivatie bij dit beslispunt geschreven. De
          commentaren per antwoord hieronder zijn wat er wél staat.
        </p>
      )}

      {decision.byRole.map(bucket => (
        <div key={bucket.role ?? "__alle__"} className="flex flex-col gap-1.5">
          <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
            {bucket.role ? (ROLE_META[bucket.role]?.label ?? bucket.role) : "Alle rollen"}
          </p>
          <ol className="flex flex-col gap-1.5">
            {bucket.options.map(option => (
              <Antwoord key={option.id} option={option} />
            ))}
          </ol>
        </div>
      ))}
    </div>
  )
}

function Antwoord({ option }: { option: AnswerModelOption }) {
  const stijl = option.quality ? KWALITEIT[option.quality] : ZONDER_RANG
  const { Icon } = stijl
  const gekozen = option.chosenBy.length > 0

  return (
    <li
      className={`flex flex-col gap-1 rounded-lg border px-3 py-2 ${stijl.klasse} ${
        gekozen ? "ring-1 ring-inset ring-foreground/20" : ""
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1 font-mono text-[9px] uppercase tracking-widest">
          <Icon className="size-3" aria-hidden />
          {stijl.label}
        </span>
        {gekozen && (
          <span className="rounded-full border border-foreground/25 bg-background/60 px-1.5 py-px font-mono text-[9px] uppercase tracking-wider text-foreground">
            gekozen door {option.chosenBy.join(", ")}
          </span>
        )}
      </div>
      <p className="text-sm font-medium leading-snug text-foreground">{option.label}</p>
      {option.description && (
        <p className="text-xs leading-relaxed text-muted-foreground">{option.description}</p>
      )}
      {option.commentary && (
        <p className="border-t border-current/15 pt-1.5 text-xs italic leading-relaxed text-muted-foreground">
          {option.commentary}
        </p>
      )}
    </li>
  )
}
