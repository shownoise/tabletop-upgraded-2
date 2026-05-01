"use client"

import { useState } from "react"
import { ChevronDown, ChevronUp, Target, HelpCircle, Lightbulb, CheckSquare, AlertOctagon } from "lucide-react"
import type { FacilitatorNotes } from "@/lib/types"

interface Props {
  notes: FacilitatorNotes
  roundTitle: string
  roundNumber: number
}

export function FacilitatorNotesPanel({ notes, roundTitle, roundNumber }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-3 hover:bg-primary/10 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Target className="size-3.5 text-primary" />
          <span className="font-mono text-xs uppercase tracking-wider text-primary">
            Facilitator notes — Round {roundNumber}: {roundTitle}
          </span>
        </div>
        {open ? <ChevronUp className="size-4 text-primary" /> : <ChevronDown className="size-4 text-primary" />}
      </button>

      {open && (
        <div className="px-5 pb-5 flex flex-col gap-5 border-t border-primary/20">
          {/* Discussion goal */}
          <div className="mt-4 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Target className="size-3.5 text-primary" />
              <span className="font-mono text-[10px] uppercase tracking-wider text-primary">Discussion goal</span>
            </div>
            <p className="text-sm leading-relaxed text-foreground pl-5">{notes.discussionGoal}</p>
          </div>

          {/* Key questions */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <HelpCircle className="size-3.5 text-primary" />
              <span className="font-mono text-[10px] uppercase tracking-wider text-primary">Key discussion questions</span>
            </div>
            <ul className="flex flex-col gap-1.5 pl-5">
              {notes.keyQuestions.map((q, i) => (
                <li key={i} className="flex gap-2 text-sm text-muted-foreground">
                  <span className="font-mono text-primary shrink-0">{i + 1}.</span>
                  <span>{q}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Expected decisions */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <CheckSquare className="size-3.5 text-primary" />
              <span className="font-mono text-[10px] uppercase tracking-wider text-primary">Expected decisions</span>
            </div>
            <ul className="flex flex-col gap-1.5 pl-5">
              {notes.expectedDecisions.map((d, i) => (
                <li key={i} className="flex gap-2 text-sm text-muted-foreground">
                  <span className="text-primary shrink-0">☐</span>
                  <span>{d}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Hints */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Lightbulb className="size-3.5 text-yellow-500" />
              <span className="font-mono text-[10px] uppercase tracking-wider text-yellow-500">Facilitator hints</span>
            </div>
            <ul className="flex flex-col gap-1.5 pl-5">
              {notes.hints.map((h, i) => (
                <li key={i} className="flex gap-2 text-sm text-muted-foreground">
                  <span className="text-yellow-500 shrink-0">→</span>
                  <span>{h}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Red flags */}
          <div className="flex flex-col gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3">
            <div className="flex items-center gap-2">
              <AlertOctagon className="size-3.5 text-destructive" />
              <span className="font-mono text-[10px] uppercase tracking-wider text-destructive">Red flags to watch for</span>
            </div>
            <ul className="flex flex-col gap-1.5 pl-5">
              {notes.redFlags.map((f, i) => (
                <li key={i} className="flex gap-2 text-sm text-muted-foreground">
                  <span className="text-destructive shrink-0">⚑</span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}
