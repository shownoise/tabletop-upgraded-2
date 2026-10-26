"use client"

import { useState } from "react"
import { BookOpen, ChevronDown, ChevronRight, Target } from "lucide-react"
import { getGoal } from "@/lib/goals/registry"
import { resolveGraphGoalId } from "@/lib/admin/client-config"
import type { GoalId, SessionState } from "@/lib/types"

// Doel en facilitatorhandleiding, op de lobby-stap van het dashboard.
//
// Dit stond op een apart "Briefing vooraf"-scherm tussen het aanmaken en het
// live dashboard. De eigenaar wil na het starten direct naar de live view, dus
// dat tussenscherm is weg. De inhoud mocht niet meeverdwijnen: de handleiding
// vertelt wat je als facilitator doet. Ingeklapt, want je leest hem één keer
// en daarna wil je de lobby zien.

function SimpleMarkdown({ text }: { text: string }) {
  // Dezelfde minimale weergave als het oude briefingscherm: koppen, bullets en
  // alinea's. Geen markdown-library voor drie vormen.
  const blocks = text.trim().split(/\n{2,}/)
  return (
    <div className="flex flex-col gap-2.5">
      {blocks.map((block, i) => {
        const lines = block.split("\n")
        if (lines.every(l => /^\s*[-*›]\s+/.test(l))) {
          return (
            <ul key={i} className="flex flex-col gap-1.5">
              {lines.map((l, j) => (
                <li key={j} className="flex gap-2 text-xs leading-relaxed text-foreground/90">
                  <span aria-hidden className="text-primary">›</span>
                  <span>{l.replace(/^\s*[-*›]\s+/, "")}</span>
                </li>
              ))}
            </ul>
          )
        }
        if (/^#{1,3}\s/.test(block) || /^[A-Z][A-Z\s—-]{6,}$/.test(block.trim())) {
          return (
            <p key={i} className="font-mono text-[10px] uppercase tracking-widest text-primary">
              {block.replace(/^#{1,3}\s*/, "")}
            </p>
          )
        }
        return (
          <p key={i} className="text-xs leading-relaxed text-foreground/90">{block}</p>
        )
      })}
    </div>
  )
}

export function FacilitatorGuide({ session }: { session: SessionState }) {
  const [open, setOpen] = useState(false)
  const goalId = (session.config.goalId as GoalId | undefined) ?? resolveGraphGoalId(session.graph)
  const goal = (() => { try { return getGoal(goalId) } catch { return null } })()
  if (!goal) return null

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-card px-5 py-4">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-primary/30 bg-primary/10">
          <Target className="size-4 text-primary" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Doel van de oefening
          </p>
          <p className="text-sm font-medium text-foreground">{goal.name}</p>
          {goal.description && (
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{goal.description}</p>
          )}
        </div>
      </div>

      {goal.facilitatorGuide && (
        <>
          <button
            type="button"
            onClick={() => setOpen(v => !v)}
            aria-expanded={open}
            className="flex items-center gap-2 self-start font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground"
          >
            {open ? <ChevronDown className="size-3" aria-hidden /> : <ChevronRight className="size-3" aria-hidden />}
            <BookOpen className="size-3" aria-hidden />
            Facilitatorhandleiding
          </button>
          {open && (
            <div className="border-t border-border pt-3">
              <SimpleMarkdown text={goal.facilitatorGuide} />
            </div>
          )}
        </>
      )}
    </section>
  )
}
