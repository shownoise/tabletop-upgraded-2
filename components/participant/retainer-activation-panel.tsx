"use client"

import { useMemo, useState } from "react"
import { PhoneCall, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { api } from "@/lib/api-client"
import type { IrRetainerProfile, SessionState } from "@/lib/types"

interface Props {
  session: SessionState
  participantId: string
}

export function RetainerActivationPanel({ session, participantId }: Props) {
  const profile: IrRetainerProfile | undefined = session.config.irRetainerProfile ?? session.graph?.irRetainerProfile
  const state = session.retainerState
  const [busy, setBusy] = useState(false)

  const scoreLevel = useMemo(() => {
    if (!state?.dialedAt) return "not_activated"
    const total = profile?.handoffChecklist.length ?? 0
    const done = state.handoffCompleted?.length ?? 0
    const frac = total > 0 ? done / total : 0
    if (state.chosenActivatorAuthorized && frac >= 0.6) return "effective"
    if (state.chosenActivatorAuthorized && frac >= 0.4) return "partial"
    if (state.chosenActivatorAuthorized) return "partial"
    return "failed"
  }, [profile, state])

  if (!profile) return null

  async function setActivator(name: string) {
    const authorized = profile!.authorizedActivators.includes(name)
    setBusy(true)
    try {
      await api.updateRetainer({ participantId, patch: { chosenActivator: name, chosenActivatorAuthorized: authorized } })
    } finally { setBusy(false) }
  }

  async function dial() {
    setBusy(true)
    try {
      await api.updateRetainer({ participantId, patch: { dialedAt: Date.now() } })
    } finally { setBusy(false) }
  }

  async function toggleHandoff(item: string) {
    const cur = new Set(state?.handoffCompleted ?? [])
    if (cur.has(item)) cur.delete(item); else cur.add(item)
    setBusy(true)
    try {
      await api.updateRetainer({ participantId, patch: { handoffCompleted: Array.from(cur) } })
    } finally { setBusy(false) }
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
        <ShieldCheck className="size-3.5 text-tt-accent" />
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">IR-retainer activatie</span>
        <span className={`ml-auto font-mono text-[9px] uppercase tracking-wider ${
          scoreLevel === "effective" ? "text-emerald-500"
            : scoreLevel === "partial" ? "text-yellow-500"
            : scoreLevel === "failed" ? "text-red-500" : "text-muted-foreground"
        }`}>
          {scoreLevel === "not_activated" ? "niet geactiveerd" : scoreLevel}
        </span>
      </div>
      <div className="flex flex-col gap-3 px-4 py-3 text-xs">
        <div>
          <div className="text-[10px] font-mono uppercase text-muted-foreground">Partner</div>
          <div className="text-[12px]">{profile.name} · {profile.activationNumber}</div>
        </div>
        <div>
          <div className="text-[10px] font-mono uppercase text-muted-foreground mb-1">1. Kies activator</div>
          <div className="flex flex-wrap gap-1">
            {(session.participants).map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => setActivator(p.name)}
                disabled={busy}
                className={`rounded border px-2 py-0.5 font-mono text-[10px] ${
                  state?.chosenActivator === p.name ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"
                }`}
              >
                {p.name}
              </button>
            ))}
          </div>
          {state?.chosenActivator && (
            <div className={`mt-1 text-[10px] ${state.chosenActivatorAuthorized ? "text-emerald-500" : "text-red-500"}`}>
              {state.chosenActivatorAuthorized ? "Geautoriseerd." : "Niet in geautoriseerde activator-lijst."}
            </div>
          )}
        </div>
        <div>
          <div className="text-[10px] font-mono uppercase text-muted-foreground mb-1">2. Bel 24/7 nummer</div>
          <Button type="button" size="sm" onClick={dial} disabled={busy || !state?.chosenActivator} className="h-7 gap-1">
            <PhoneCall className="size-3" />
            {state?.dialedAt ? "Opnieuw bellen" : "Bel nu"}
          </Button>
          {state?.dialedAt && (
            <div className="text-[10px] text-emerald-500 mt-1">Gebeld om {new Date(state.dialedAt).toLocaleTimeString()}</div>
          )}
        </div>
        <div>
          <div className="text-[10px] font-mono uppercase text-muted-foreground mb-1">3. Overdrachtchecklist</div>
          <div className="flex flex-col gap-1">
            {profile.handoffChecklist.map(item => {
              const on = state?.handoffCompleted?.includes(item) ?? false
              return (
                <label key={item} className="flex items-start gap-2 text-[11px]">
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => toggleHandoff(item)}
                    disabled={busy || !state?.dialedAt}
                    className="size-3 mt-0.5"
                  />
                  <span className={on ? "text-foreground" : "text-muted-foreground"}>{item}</span>
                </label>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
