"use client"

import { useEffect, useState, useRef } from "react"
import { CheckCircle2 } from "lucide-react"
import type { SessionState } from "@/lib/types"

// Subtiele signaal-notificaties voor deelnemers.
// Zakelijk, niet gamified: één regel, monochroom, fade-in rechtsonder.
// Geen "achievement"-taal, geen kleuren-explosies, geen geluid.

interface Signal {
  id: string
  text: string
}

const SIGNALS = {
  first_decision:  "Eerste beslissing ingediend",
  three_rounds:    "3 rondes op rij ingediend",
  five_rounds:     "5 rondes op rij ingediend",
  confident:       "Zelfverzekerde keuze",
  consistent_hi:   "Consistent hoge zekerheid",
} as const

type SignalKey = keyof typeof SIGNALS

export function AchievementsToaster({
  session,
  participantId,
}: {
  session: SessionState
  participantId: string
}) {
  const [visible, setVisible] = useState<Signal | null>(null)
  const seenRef = useRef<Set<string>>(new Set())
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const my = (session.submittedDecisions ?? []).filter(d => d.participantId === participantId)
    if (my.length === 0) return

    if (my.length === 1) trigger("first_decision")
    const rounds = new Set(my.map(d => d.roundIndex))
    if (rounds.size >= 3) trigger("three_rounds")
    if (rounds.size >= 5) trigger("five_rounds")
    const latest = my[my.length - 1]
    if (latest && typeof latest.confidence === "number" && latest.confidence >= 4) {
      trigger("confident", `conf_${latest.roundIndex}`)
    }
    const highConfidenceCount = my.filter(d => typeof d.confidence === "number" && d.confidence >= 4).length
    if (highConfidenceCount >= 3) trigger("consistent_hi")

    function trigger(key: SignalKey, dedupe: string = key) {
      if (seenRef.current.has(dedupe)) return
      seenRef.current.add(dedupe)
      setVisible({ id: dedupe, text: SIGNALS[key] })
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => setVisible(prev => prev?.id === dedupe ? null : prev), 3500)
    }

    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.submittedDecisions?.length, participantId])

  if (!visible) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 pointer-events-none">
      <div
        key={visible.id}
        className="flex items-center gap-2 rounded-md border border-border bg-background/95 px-3 py-2 shadow-sm backdrop-blur"
        style={{ animation: "fadeInUp 0.4s ease-out" }}
      >
        <CheckCircle2 className="size-3.5 text-muted-foreground/70" />
        <span className="text-xs text-foreground/80">{visible.text}</span>
      </div>
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
