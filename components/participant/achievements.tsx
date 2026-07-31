"use client"

import { useEffect, useState, useRef } from "react"
import { Trophy, Zap, Target, Flame, TrendingUp } from "lucide-react"
import type { SessionState } from "@/lib/types"
import { playNotificationSound } from "@/lib/sounds"

// Gamification-laag voor participants. Detecteert momenten in de session-state
// die een achievement rechtvaardigen en toont een korte toast rechtsboven.
// Alleen visueel — geen scoring-effect (spec §5 "vectoren of niets").

interface Achievement {
  id: string
  icon: typeof Trophy
  title: string
  subtitle: string
  tone: "gold" | "green" | "purple" | "orange"
}

const ACHIEVEMENTS = {
  first_blood: { icon: Zap, title: "First Blood", subtitle: "Eerste beslissing van de sessie", tone: "purple" as const },
  streak_3:    { icon: Flame, title: "Op streek", subtitle: "3 rondes op rij ingezonden", tone: "orange" as const },
  perfect_round: { icon: Target, title: "Perfect Round", subtitle: "Sterke keuze — hoge zekerheid", tone: "green" as const },
  comeback:    { icon: TrendingUp, title: "Comeback", subtitle: "Herstel na een fout in vorige ronde", tone: "gold" as const },
  first_share: { icon: Trophy, title: "Delen is winst", subtitle: "Eerste inject gedeeld met het team", tone: "gold" as const },
} satisfies Record<string, Omit<Achievement, "id">>

type AchievementKey = keyof typeof ACHIEVEMENTS

export function AchievementsToaster({
  session,
  participantId,
}: {
  session: SessionState
  participantId: string
}) {
  const [visible, setVisible] = useState<Achievement | null>(null)
  const seenRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    const myDecisions = (session.submittedDecisions ?? []).filter(d => d.participantId === participantId)

    // First Blood — eerste beslissing van deze participant
    if (myDecisions.length === 1 && !seenRef.current.has("first_blood")) {
      trigger("first_blood")
    }
    // Streak — 3+ rondes met inzendingen
    const uniqueRounds = new Set(myDecisions.map(d => d.roundIndex))
    if (uniqueRounds.size >= 3 && !seenRef.current.has("streak_3")) {
      trigger("streak_3")
    }
    // Perfect round — laatste inzending had confidence ≥ 4
    const latest = myDecisions[myDecisions.length - 1]
    if (latest && typeof latest.confidence === "number" && latest.confidence >= 4
        && !seenRef.current.has(`perfect_${latest.roundIndex}`)) {
      trigger("perfect_round", `perfect_${latest.roundIndex}`)
    }

    function trigger(key: AchievementKey, dedupe: string = key) {
      seenRef.current.add(dedupe)
      const spec = ACHIEVEMENTS[key]
      setVisible({ id: dedupe, ...spec })
      try { playNotificationSound("success") } catch { /* silent */ }
      setTimeout(() => setVisible(prev => prev?.id === dedupe ? null : prev), 4500)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.submittedDecisions?.length, participantId])

  if (!visible) return null

  const toneClass = {
    gold: "border-yellow-500/60 bg-yellow-500/10 text-yellow-700 dark:text-yellow-300",
    green: "border-emerald-500/60 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    purple: "border-purple-500/60 bg-purple-500/10 text-purple-700 dark:text-purple-300",
    orange: "border-orange-500/60 bg-orange-500/10 text-orange-700 dark:text-orange-300",
  }[visible.tone]

  const Icon = visible.icon
  return (
    <div className="fixed right-4 top-20 z-50 pointer-events-none animate-in slide-in-from-right-4 fade-in duration-300">
      <div className={`flex items-center gap-3 rounded-xl border-2 px-4 py-3 shadow-lg backdrop-blur-sm ${toneClass}`}>
        <div className="rounded-full bg-current/10 p-2">
          <Icon className="size-5" />
        </div>
        <div className="flex flex-col">
          <span className="font-mono text-xs uppercase tracking-wider opacity-80">Achievement</span>
          <span className="font-bold">{visible.title}</span>
          <span className="text-[11px] opacity-70">{visible.subtitle}</span>
        </div>
      </div>
    </div>
  )
}
