"use client"

import { useState } from "react"
import { Monitor, Users, Zap, X, Info } from "lucide-react"

// Compacte help-kaart die verschijnt wanneer sessie in EVENT-mode staat.
// Legt in 3 stappen uit hoe een partner-event verloopt.

export function EventModeHelp({ joinCode }: { joinCode: string }) {
  const [dismissed, setDismissed] = useState(false)
  if (dismissed) return null

  return (
    <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 mb-2">
          <Info className="size-4 text-primary" />
          <span className="font-mono text-xs uppercase tracking-wider text-primary font-bold">Event mode — zo werkt het</span>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="text-muted-foreground hover:text-foreground"
          aria-label="Sluiten"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-2">
        <div className="flex items-start gap-2">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 font-mono text-xs font-bold text-primary">1</div>
          <div className="text-xs text-muted-foreground">
            <div className="font-semibold text-foreground mb-0.5">Open het grote scherm</div>
            <div>Ga naar <span className="font-mono">/admin/present</span> op de zaal-projector. Toont ronde, tijd en reveals.</div>
          </div>
        </div>

        <div className="flex items-start gap-2">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 font-mono text-xs font-bold text-primary">2</div>
          <div className="text-xs text-muted-foreground">
            <div className="font-semibold text-foreground mb-0.5">Deelnemers joinen</div>
            <div>Iedereen naar <span className="font-mono">/join</span> met code <span className="font-mono font-bold">{joinCode}</span>. Kiezen daarna hun team.</div>
          </div>
        </div>

        <div className="flex items-start gap-2">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 font-mono text-xs font-bold text-primary">3</div>
          <div className="text-xs text-muted-foreground">
            <div className="font-semibold text-foreground mb-0.5">Sturen per ronde</div>
            <div>Push injects, sluit ronde met <span className="font-mono">LOCK</span>. Reveal + leaderboard verschijnt automatisch op het grote scherm.</div>
          </div>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-primary/20 grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <Users className="size-3" /> Deelnemers vormen zelf teams — meerdere iPads, één per team
        </div>
        <div className="flex items-center gap-1.5">
          <Monitor className="size-3" /> Reveal is publiek — vector + leaderboard voor iedereen
        </div>
        <div className="flex items-center gap-1.5">
          <Zap className="size-3" /> LOCK = deadline · Force-LOCK als je niet wilt wachten
        </div>
      </div>
    </div>
  )
}
