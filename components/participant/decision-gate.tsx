"use client"

import { useState } from "react"
import { Lock, Shield, ChevronRight } from "lucide-react"
import type { DecisionPoint, DecisionOption } from "@/lib/template-types"
import type { Lang } from "@/lib/i18n"

interface DecisionGateProps {
  decision: DecisionPoint
  isTeamLead: boolean
  onDecide: (optionId: string) => void
  decided: string | null
  lang: Lang
}

export function DecisionGate({ decision, isTeamLead, onDecide, decided, lang }: DecisionGateProps) {
  const [selected, setSelected] = useState<string | null>(decided)
  const [confirmed, setConfirmed] = useState(!!decided)

  if (confirmed && decided) {
    const opt = decision.options.find(o => o.id === decided)
    return (
      <div className="rounded-xl border border-primary/30 bg-primary/5 px-6 py-5">
        <div className="flex items-center gap-2 mb-3">
          <Shield className="size-4 text-primary" />
          <span className="font-mono text-xs uppercase tracking-wider text-primary">Decision locked in</span>
        </div>
        <div className="font-mono text-sm font-semibold text-foreground mb-1">{decision.title}</div>
        <div className="rounded-lg border border-primary/20 bg-primary/10 px-4 py-3">
          <div className="font-mono text-xs text-primary uppercase tracking-wider mb-1">Selected: {opt?.label}</div>
          <p className="text-sm text-muted-foreground">{opt?.consequence}</p>
        </div>
      </div>
    )
  }

  if (!isTeamLead) {
    return (
      <div className="rounded-xl border border-border bg-card px-6 py-8 flex flex-col items-center gap-4 text-center">
        <div className="size-12 rounded-full border border-border bg-background flex items-center justify-center">
          <Lock className="size-5 text-muted-foreground" />
        </div>
        <div className="flex flex-col gap-1">
          <div className="font-mono text-sm font-semibold text-foreground">{decision.title}</div>
          <p className="text-sm text-muted-foreground">This decision can only be made by the crisis team lead.</p>
          <p className="font-mono text-xs text-muted-foreground mt-2">Waiting for team lead to decide…</p>
          <div className="flex gap-1 justify-center mt-2">
            {[0,1,2].map(i => <span key={i} className="size-1.5 rounded-full bg-primary/40 animate-pulse" style={{ animationDelay: `${i*0.3}s` }} />)}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-destructive/30 bg-[#1a0808] overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-destructive/20 bg-destructive/10">
        <div className="flex size-8 items-center justify-center rounded-lg border border-destructive/40 bg-destructive/20">
          <Shield className="size-4 text-destructive" />
        </div>
        <div>
          <div className="font-mono text-xs uppercase tracking-wider text-destructive">CRISIS TEAM LEAD — DECISION REQUIRED</div>
          <div className="font-mono text-sm font-bold text-foreground mt-0.5">{decision.title}</div>
        </div>
      </div>

      <div className="px-6 py-5 flex flex-col gap-5">
        <p className="text-sm leading-relaxed text-muted-foreground">{decision.description}</p>

        {/* Options */}
        <div className="flex flex-col gap-3">
          {decision.options.map((opt: DecisionOption) => (
            <button
              key={opt.id}
              onClick={() => !confirmed && setSelected(opt.id)}
              className={`flex flex-col gap-2 rounded-xl border p-4 text-left transition-all ${
                selected === opt.id
                  ? "border-primary/60 bg-primary/10"
                  : "border-border bg-card hover:border-primary/30 hover:bg-primary/5"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm font-semibold text-foreground">{opt.label}</span>
                <div className="flex items-center gap-2">
                  {opt.isRecommended && (
                    <span className="font-mono text-[9px] uppercase tracking-wider px-2 py-0.5 rounded border border-green-500/40 bg-green-500/10 text-green-400">recommended</span>
                  )}
                  <div className={`size-4 rounded-full border-2 flex items-center justify-center ${selected === opt.id ? "border-primary bg-primary" : "border-border"}`}>
                    {selected === opt.id && <div className="size-2 rounded-full bg-primary-foreground" />}
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{opt.description}</p>
              {selected === opt.id && (
                <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 mt-1">
                  <span className="font-mono text-[9px] uppercase tracking-wider text-primary">Consequence: </span>
                  <span className="text-xs text-muted-foreground">{opt.consequence}</span>
                </div>
              )}
            </button>
          ))}
        </div>

        {/* Confirm */}
        {selected && !confirmed && (
          <button
            onClick={() => { setConfirmed(true); onDecide(selected) }}
            className="flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 font-mono text-sm uppercase tracking-wider text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Confirm decision <ChevronRight className="size-4" />
          </button>
        )}
      </div>
    </div>
  )
}
