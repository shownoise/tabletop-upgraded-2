"use client"

import { useState } from "react"
import { CheckCircle, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import type { Lang } from "@/lib/i18n"
import { tr } from "@/lib/i18n"

interface FeedbackScreenProps {
  roundNumber: number
  totalRounds: number
  isFinal: boolean
  lang: Lang
  onContinue: (feedback: { worked: string; didnt: string; gap: string }) => void
}

export function FeedbackScreen({ roundNumber, totalRounds, isFinal, lang, onContinue }: FeedbackScreenProps) {
  const [worked, setWorked] = useState("")
  const [didnt, setDidnt] = useState("")
  const [gap, setGap] = useState("")

  const title = isFinal
    ? tr(lang, "sessionFeedbackTitle")
    : tr(lang, "feedbackTitle", { n: String(roundNumber) })

  const sub = isFinal
    ? tr(lang, "sessionFeedbackSub")
    : tr(lang, "feedbackSub")

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm px-4">
      <div className="w-full max-w-lg flex flex-col gap-6 rounded-xl border border-primary/30 bg-card p-8 shadow-2xl">
        {/* Header */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-full border border-primary/40 bg-primary/10">
              <CheckCircle className="size-5 text-primary" />
            </div>
            <div>
              <h2 className="font-mono text-lg font-semibold tracking-tight">{title}</h2>
              <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">{sub}</p>
            </div>
          </div>

          {/* Round progress dots */}
          {!isFinal && (
            <div className="flex gap-1.5 mt-2">
              {Array.from({ length: totalRounds }, (_, i) => (
                <div
                  key={i}
                  className={`h-1 flex-1 rounded-full ${
                    i < roundNumber ? "bg-primary" : "bg-border"
                  }`}
                />
              ))}
            </div>
          )}
        </div>

        {/* Feedback fields */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="font-mono text-[10px] uppercase tracking-wider text-primary">
              ✓ {tr(lang, "whatWorked")}
            </label>
            <Textarea
              value={worked}
              onChange={(e) => setWorked(e.target.value)}
              rows={2}
              className="resize-none text-sm"
              placeholder={tr(lang, "placeholder_worked")}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              ✗ {tr(lang, "whatDidnt")}
            </label>
            <Textarea
              value={didnt}
              onChange={(e) => setDidnt(e.target.value)}
              rows={2}
              className="resize-none text-sm"
              placeholder={tr(lang, "placeholder_didnt")}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="font-mono text-[10px] uppercase tracking-wider text-destructive">
              ⚑ {tr(lang, "biggestGap")}
            </label>
            <Textarea
              value={gap}
              onChange={(e) => setGap(e.target.value)}
              rows={2}
              className="resize-none text-sm"
              placeholder={tr(lang, "placeholder_gap")}
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 pt-2 border-t border-border">
          <button
            onClick={() => onContinue({ worked, didnt, gap })}
            className="font-mono text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
          >
            {tr(lang, "skipFeedback")}
          </button>
          <Button
            onClick={() => onContinue({ worked, didnt, gap })}
            className="gap-2 font-mono uppercase tracking-wider"
          >
            {isFinal ? tr(lang, "sessionFeedbackTitle") : tr(lang, "submitFeedback")}
            <ArrowRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
